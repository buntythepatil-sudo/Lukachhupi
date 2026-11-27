import {
  ChatMessagePayload,
  ClientToServerMessage,
  MultiplayerRoomSnapshot,
  PlayerEmotePayload,
  PlayerTransformPayload,
  ServerToClientMessage,
} from './multiplayerTypes';
import { EmoteType, ReportReason } from './chatFilter';
import { CharacterCustomization } from './types';

export type MultiplayerConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface MultiplayerConnectionMeta {
  rttMs: number | null;
  reconnectAttempt: number;
  isOffline: boolean;
}

export interface MultiplayerClientCallbacks {
  onStatusChange: (status: MultiplayerConnectionStatus) => void;
  onConnectionMeta?: (meta: MultiplayerConnectionMeta) => void;
  onRoomChange: (
    room: MultiplayerRoomSnapshot | null,
    localPlayerId: string | null,
  ) => void;
  onPositions: (
    positions: NonNullable<ServerToClientMessage['positions']>,
    serverTime?: number,
  ) => void;
  onMatchEvent: (event: ServerToClientMessage) => void;
  onChatHistory?: (messages: ChatMessagePayload[]) => void;
  onChatMessage?: (message: ChatMessagePayload) => void;
  onPlayerEmote?: (emote: PlayerEmotePayload) => void;
  onReportAck?: (reportedPlayerId: string, message: string) => void;
  onError: (message: string) => void;
}

const HEARTBEAT_INTERVAL_MS = 5000;
const STALE_WATCHDOG_CHECK_MS = 3000;
const STALE_SOCKET_TIMEOUT_MS = 12500;
const MAX_BUFFERED_POSITION_BYTES = 32 * 1024;

const DEDUPABLE_QUEUE_TYPES = new Set<ClientToServerMessage['type']>([
  'create_room',
  'join_room',
  'select_map',
  'update_profile',
  'toggle_room_lock',
]);

function createClientSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerClientCallbacks;
  private status: MultiplayerConnectionStatus = 'disconnected';
  private disposed = false;

  // Kept strictly in memory (never localStorage/sessionStorage)
  private readonly clientSessionId: string = createClientSessionId();
  private roomCode: string | null = null;
  private localPlayerId: string | null = null;
  private reconnectToken: string | null = null;

  private pendingQueue: ClientToServerMessage[] = [];
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private reconnectAttempts = 0;
  private lastMessageAt = 0;
  private rttMs: number | null = null;
  private isOffline =
    typeof navigator !== 'undefined' ? navigator.onLine === false : false;

  private readonly handleOnline = (): void => {
    this.isOffline = false;
    this.emitMeta();
    if (this.disposed) return;
    if (this.roomCode || this.pendingQueue.length > 0) {
      this.reconnectAttempts = 0;
      this.ensureConnected();
    }
  };

  private readonly handleOffline = (): void => {
    this.isOffline = true;
    this.emitMeta();
    if (this.disposed) return;
    if (this.roomCode) {
      this.setStatus('reconnecting');
    } else {
      this.setStatus('disconnected');
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close(4000, 'Browser offline');
      } catch {
        // Ignore close errors
      }
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.disposed || typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    if (!this.roomCode && this.pendingQueue.length === 0) return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this.isOffline) {
        this.reconnectAttempts = 0;
        this.ensureConnected();
      }
      return;
    }

    // Probe open socket after returning from background on mobile
    if (Date.now() - this.lastMessageAt > 6000) {
      this.sendRaw({ type: 'ping', clientSentAt: Date.now() });
    }
  };

  constructor(callbacks: MultiplayerClientCallbacks) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private getWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/multiplayer`;
  }

  private setStatus(next: MultiplayerConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatusChange(next);
  }

  private emitMeta(): void {
    this.callbacks.onConnectionMeta?.({
      rttMs: this.rttMs,
      reconnectAttempt: this.reconnectAttempts,
      isOffline: this.isOffline,
    });
  }

  private clearSocketTimers(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.watchdogTimer !== null) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectTimer !== null) return;
    if (!this.roomCode && this.pendingQueue.length === 0) return;

    const baseDelay = Math.min(
      5000,
      Math.round(500 * Math.pow(1.6, this.reconnectAttempts)),
    );
    const jitter = Math.floor(Math.random() * 260);
    this.reconnectAttempts += 1;
    this.emitMeta();
    this.setStatus(this.roomCode ? 'reconnecting' : 'connecting');

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed) return;
      if (this.isOffline) {
        this.scheduleReconnect();
        return;
      }
      this.ensureConnected();
    }, baseDelay + jitter);
  }

  public ensureConnected(): void {
    if (this.disposed) return;
    if (this.isOffline) {
      this.setStatus(this.roomCode ? 'reconnecting' : 'disconnected');
      this.emitMeta();
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setStatus(this.roomCode ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.getWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      if (this.disposed || this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.lastMessageAt = Date.now();
      this.setStatus('connected');
      this.emitMeta();

      this.clearSocketTimers();

      // Send an immediate RTT probe and maintain 5s heartbeat for mobile stability
      this.sendRaw({ type: 'ping', clientSentAt: Date.now() });
      this.pingTimer = window.setInterval(() => {
        if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
          this.sendRaw({ type: 'ping', clientSentAt: Date.now() });
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Watchdog catches silent half-open mobile connections without freezing UI
      this.watchdogTimer = window.setInterval(() => {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - this.lastMessageAt > STALE_SOCKET_TIMEOUT_MS) {
          try {
            ws.close(4002, 'Connection timed out');
          } catch {
            // Ignore close errors
          }
        }
      }, STALE_WATCHDOG_CHECK_MS);

      // Rejoin active room cleanly if recovering from a drop
      if (this.roomCode && this.localPlayerId && this.reconnectToken) {
        this.sendRaw({
          type: 'rejoin_room',
          roomCode: this.roomCode,
          playerId: this.localPlayerId,
          reconnectToken: this.reconnectToken,
        });
      }

      // Flush queued control messages
      const queued = this.pendingQueue.splice(0, this.pendingQueue.length);
      for (const msg of queued) {
        this.sendRaw(msg);
      }
    };

    ws.onmessage = (event) => {
      if (this.disposed || this.ws !== ws) return;
      this.lastMessageAt = Date.now();
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerToClientMessage;
      } catch {
        return;
      }
      this.handleMessage(msg);
    };

    ws.onerror = () => {
      // onclose handles cleanup and backoff retry
    };

    ws.onclose = (closeEvent) => {
      if (this.ws === ws) {
        this.ws = null;
        this.clearSocketTimers();
      }
      if (this.disposed) return;

      // 4001 indicates this tab was replaced by a newer reconnected socket
      if (closeEvent.code === 4001) {
        this.setStatus('disconnected');
        return;
      }

      if (this.roomCode || this.pendingQueue.length > 0) {
        this.scheduleReconnect();
      } else {
        this.rttMs = null;
        this.emitMeta();
        this.setStatus('disconnected');
      }
    };
  }

  private handleMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case 'room_joined': {
        if (msg.room && msg.playerId) {
          this.roomCode = msg.room.code;
          this.localPlayerId = msg.playerId;
          if (msg.reconnectToken) {
            this.reconnectToken = msg.reconnectToken;
          }
          if (Array.isArray(msg.recentMessages)) {
            this.callbacks.onChatHistory?.(msg.recentMessages);
          }
          this.callbacks.onRoomChange(msg.room, this.localPlayerId);
        }
        break;
      }
      case 'room_state': {
        if (msg.room) {
          this.roomCode = msg.room.code;
          this.callbacks.onRoomChange(msg.room, this.localPlayerId);
        }
        break;
      }
      case 'player_positions': {
        if (msg.positions) {
          this.callbacks.onPositions(msg.positions, msg.serverTime);
        }
        break;
      }
      case 'match_event': {
        this.callbacks.onMatchEvent(msg);
        break;
      }
      case 'chat_message': {
        if (msg.chatMessage) {
          this.callbacks.onChatMessage?.(msg.chatMessage);
        }
        break;
      }
      case 'player_emote': {
        if (msg.playerEmote) {
          this.callbacks.onPlayerEmote?.(msg.playerEmote);
        }
        break;
      }
      case 'report_ack': {
        if (msg.reportedPlayerId && msg.message) {
          this.callbacks.onReportAck?.(msg.reportedPlayerId, msg.message);
        }
        break;
      }
      case 'room_left': {
        this.roomCode = null;
        this.localPlayerId = null;
        this.reconnectToken = null;
        this.pendingQueue = [];
        this.callbacks.onRoomChange(null, null);
        break;
      }
      case 'error': {
        if (msg.message) {
          if (
            this.roomCode &&
            /no longer exists|session expired|removed from the room/i.test(
              msg.message,
            )
          ) {
            this.roomCode = null;
            this.localPlayerId = null;
            this.reconnectToken = null;
            this.pendingQueue = [];
            this.callbacks.onRoomChange(null, null);
          }
          this.callbacks.onError(msg.message);
        }
        break;
      }
      case 'pong': {
        if (typeof msg.clientSentAt === 'number') {
          const sampleRtt = Math.max(0, Math.min(3000, Date.now() - msg.clientSentAt));
          this.rttMs =
            this.rttMs === null
              ? sampleRtt
              : Math.round(this.rttMs * 0.72 + sampleRtt * 0.28);
          this.emitMeta();
        }
        break;
      }
      default:
        break;
    }
  }

  private sendRaw(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // Transient socket error handled by close/watchdog
      }
    }
  }

  private sendOrQueue(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw(msg);
    } else {
      if (msg.type !== 'player_state') {
        if (DEDUPABLE_QUEUE_TYPES.has(msg.type)) {
          this.pendingQueue = this.pendingQueue.filter(
            (queued) => queued.type !== msg.type,
          );
        }
        this.pendingQueue.push(msg);
      }
      this.ensureConnected();
    }
  }

  public createRoom(
    customization: CharacterCustomization,
    unlockedLevel: number,
    levelId: number,
    authToken?: string,
    avatarId?: string,
    passcode?: string,
  ): void {
    this.sendOrQueue({
      type: 'create_room',
      customization,
      unlockedLevel,
      levelId,
      authToken,
      avatarId,
      clientSessionId: this.clientSessionId,
      passcode: passcode?.trim() || undefined,
    });
  }

  public joinRoom(
    roomCode: string,
    customization: CharacterCustomization,
    authToken?: string,
    avatarId?: string,
    passcode?: string,
  ): void {
    this.sendOrQueue({
      type: 'join_room',
      roomCode,
      customization,
      authToken,
      avatarId,
      clientSessionId: this.clientSessionId,
      passcode: passcode?.trim() || undefined,
    });
  }

  public toggleRoomLock(locked: boolean): void {
    if (!this.roomCode) return;
    this.sendOrQueue({
      type: 'toggle_room_lock',
      locked,
    });
  }

  public kickPlayer(targetPlayerId: string): void {
    if (!this.roomCode || !targetPlayerId) return;
    this.sendRaw({
      type: 'kick_player',
      targetPlayerId,
    });
  }

  public identifyAuth(authToken: string, avatarId?: string): void {
    if (!this.roomCode || !authToken) return;
    this.sendOrQueue({
      type: 'identify_auth',
      authToken,
      avatarId,
    });
  }

  public updateProfile(
    customization: CharacterCustomization,
    unlockedLevel: number,
    avatarId?: string,
  ): void {
    if (!this.roomCode) return;
    this.sendOrQueue({
      type: 'update_profile',
      customization,
      unlockedLevel,
      avatarId,
    });
  }

  public selectMap(levelId: number, unlockedLevel: number): void {
    if (!this.roomCode) return;
    this.sendOrQueue({
      type: 'select_map',
      levelId,
      unlockedLevel,
    });
  }

  public startMatch(): void {
    if (!this.roomCode) return;
    this.sendOrQueue({ type: 'start_match' });
  }

  public returnToLobby(): void {
    if (!this.roomCode) return;
    this.sendOrQueue({ type: 'return_to_lobby' });
  }

  public leaveRoom(): void {
    if (this.roomCode) {
      this.sendRaw({ type: 'leave_room' });
    }
    this.roomCode = null;
    this.localPlayerId = null;
    this.reconnectToken = null;
    this.pendingQueue = [];
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.callbacks.onRoomChange(null, null);
  }

  public sendPlayerState(state: PlayerTransformPayload): void {
    if (!this.roomCode) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Backpressure guard: drop redundant movement frames on congested mobile links
    if (this.ws.bufferedAmount > MAX_BUFFERED_POSITION_BYTES) return;
    this.sendRaw({ type: 'player_state', state });
  }

  public sendTagAttempt(targetPlayerId?: string): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'try_tag', targetPlayerId });
  }

  public sendHiderSlap(targetPlayerId?: string): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'try_slap_hider', targetPlayerId });
  }

  public sendHandshake(targetPlayerId?: string): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'try_handshake', targetPlayerId });
  }

  public sendChat(text: string, isQuickChat = false): void {
    if (!this.roomCode) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    this.sendRaw({ type: 'send_chat', text: trimmed, isQuickChat });
  }

  public sendEmote(emote: EmoteType): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'send_emote', emote });
  }

  public reportPlayer(
    targetPlayerId: string,
    reason: ReportReason,
    details?: string,
  ): void {
    if (!this.roomCode) return;
    this.sendRaw({
      type: 'report_player',
      targetPlayerId,
      reason,
      details: details?.trim() || undefined,
    });
  }

  public dispose(): void {
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      );
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearSocketTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

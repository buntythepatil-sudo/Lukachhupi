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
  | 'connected';

export interface MultiplayerClientCallbacks {
  onStatusChange: (status: MultiplayerConnectionStatus) => void;
  onRoomChange: (
    room: MultiplayerRoomSnapshot | null,
    localPlayerId: string | null,
  ) => void;
  onPositions: (
    positions: NonNullable<ServerToClientMessage['positions']>,
  ) => void;
  onMatchEvent: (event: ServerToClientMessage) => void;
  onChatHistory?: (messages: ChatMessagePayload[]) => void;
  onChatMessage?: (message: ChatMessagePayload) => void;
  onPlayerEmote?: (emote: PlayerEmotePayload) => void;
  onReportAck?: (reportedPlayerId: string, message: string) => void;
  onError: (message: string) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerClientCallbacks;
  private status: MultiplayerConnectionStatus = 'disconnected';
  private disposed = false;

  private roomCode: string | null = null;
  private localPlayerId: string | null = null;
  private reconnectToken: string | null = null;

  private pendingQueue: ClientToServerMessage[] = [];
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(callbacks: MultiplayerClientCallbacks) {
    this.callbacks = callbacks;
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

  public ensureConnected(): void {
    if (this.disposed) return;
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

    this.setStatus('connecting');
    const ws = new WebSocket(this.getWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      if (this.disposed || this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');

      // Start lightweight keepalive ping
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => {
        this.sendRaw({ type: 'ping' });
      }, 20000);

      // Rejoin active room if recovering from a drop
      if (this.roomCode && this.localPlayerId && this.reconnectToken) {
        this.sendRaw({
          type: 'rejoin_room',
          roomCode: this.roomCode,
          playerId: this.localPlayerId,
          reconnectToken: this.reconnectToken,
        });
      }

      // Flush any queued messages (e.g., create_room / join_room)
      const queued = this.pendingQueue.splice(0, this.pendingQueue.length);
      for (const msg of queued) {
        this.sendRaw(msg);
      }
    };

    ws.onmessage = (event) => {
      if (this.disposed || this.ws !== ws) return;
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerToClientMessage;
      } catch {
        return;
      }
      this.handleMessage(msg);
    };

    ws.onerror = () => {
      // onclose handles cleanup & retry
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      if (this.pingTimer !== null) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.disposed) return;
      this.setStatus('disconnected');

      // Auto-reconnect whenever the user is in an active room or has pending commands
      if (this.roomCode || this.pendingQueue.length > 0) {
        const delay = Math.min(5000, 600 * Math.pow(1.6, this.reconnectAttempts));
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
          this.ensureConnected();
        }, delay);
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
          this.callbacks.onPositions(msg.positions);
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
        this.callbacks.onRoomChange(null, null);
        break;
      }
      case 'error': {
        if (msg.message) {
          this.callbacks.onError(msg.message);
        }
        break;
      }
      case 'pong':
      default:
        break;
    }
  }

  private sendRaw(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendOrQueue(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Keep only latest non-position action queued while connecting
      if (msg.type !== 'player_state') {
        this.pendingQueue.push(msg);
      }
      this.ensureConnected();
    }
  }

  public createRoom(
    customization: CharacterCustomization,
    unlockedLevel: number,
    levelId: number,
  ): void {
    this.sendOrQueue({
      type: 'create_room',
      customization,
      unlockedLevel,
      levelId,
    });
  }

  public joinRoom(
    roomCode: string,
    customization: CharacterCustomization,
  ): void {
    this.sendOrQueue({
      type: 'join_room',
      roomCode,
      customization,
    });
  }

  public updateProfile(
    customization: CharacterCustomization,
    unlockedLevel: number,
  ): void {
    if (!this.roomCode) return;
    this.sendOrQueue({
      type: 'update_profile',
      customization,
      unlockedLevel,
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
    this.callbacks.onRoomChange(null, null);
  }

  public sendPlayerState(state: PlayerTransformPayload): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'player_state', state });
  }

  public sendTagAttempt(targetPlayerId?: string): void {
    if (!this.roomCode) return;
    this.sendRaw({ type: 'try_tag', targetPlayerId });
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
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
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

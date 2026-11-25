import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CharacterAnimState,
  CharacterCustomization,
  MatchWinner,
  OutfitStyle,
  AccessoryType,
  TeamRole,
} from './src/game/types.ts';
import type {
  ChatMessagePayload,
  ClientToServerMessage,
  MultiplayerRoomSnapshot,
  OnlinePlayerState,
  OnlineRoomPhase,
  PlayerEmotePayload,
  PlayerLiveStatus,
  ServerToClientMessage,
} from './src/game/multiplayerTypes.ts';
import {
  ALLOWED_EMOTES,
  ALLOWED_REPORT_REASONS,
  filterChatMessage,
  getEmoteDefinition,
  MAX_REPORT_DETAILS_LENGTH,
} from './src/game/chatFilter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const MAX_ROOM_PLAYERS = 10;
const MIN_PLAYERS_TO_START = 2;
const MATCH_DURATION_SECONDS = 180;
const HEADSTART_SECONDS = 12;
const SERVER_TAG_RANGE = 3.95; // Slight latency tolerance above client 3.25m tag range
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTAL_LEVELS = 8;

const ALLOWED_OUTFITS = new Set<OutfitStyle>([
  'shirt_shorts',
  'kurta_pyjama',
  'frock',
  'school_uniform',
]);

const ALLOWED_ACCESSORIES = new Set<AccessoryType>([
  'none',
  'gamcha',
  'cap',
  'spectacles',
  'satchel',
  'bangles',
  'wristwatch',
]);

const ALLOWED_ANIM_STATES = new Set<CharacterAnimState>([
  'idle',
  'walk',
  'run',
  'jump',
  'crouch',
  'sneak',
  'hide_cover',
  'counting_eyes_closed',
  'tag_lunge',
  'caught_funny',
  'showcase',
  'emote_laugh',
  'emote_wave',
  'emote_dance',
  'emote_clap',
  'emote_cry',
]);

const MAX_CHAT_HISTORY = 40;
const MAX_ROOM_REPORTS = 50;
const CHAT_MIN_INTERVAL_MS = 550;
const CHAT_WINDOW_MS = 6000;
const CHAT_MAX_IN_WINDOW = 5;
const EMOTE_COOLDOWN_MS = 1100;

// Safe open spawn points per level (supporting up to 10 players with clear paths)
interface LevelServerSpawns {
  seeker: [number, number, number];
  hiders: Array<[number, number, number]>;
  worldRadius: number;
}

const LEVEL_SERVER_SPAWNS: Record<number, LevelServerSpawns> = {
  1: {
    worldRadius: 45.5,
    seeker: [2.8, 2.2, 0],
    hiders: [
      [-1.8, 7.2, Math.PI],
      [-6.8, -5.4, 0.8],
      [5.4, 5.4, -0.7],
      [2.6, -7.8, 2.5],
      [-19.8, -14.5, 0.4],
      [10.5, -18.2, -0.5],
      [21.4, -2.5, -1.5],
      [21.4, 10.5, -2.0],
      [0.0, 19.2, Math.PI],
      [-18.5, 19.2, 1.0],
    ],
  },
  2: {
    worldRadius: 42.5,
    seeker: [1.5, 0.5, 0],
    hiders: [
      [-2.0, 7.5, Math.PI],
      [-11.5, 4.5, 0.6],
      [10.5, -2.5, -0.8],
      [4.5, 15.5, 2.4],
      [-12.0, -10.5, 0.2],
      [6.5, -10.5, -0.4],
      [-17.2, -1.5, 1.4],
      [-17.2, 9.5, 1.2],
      [17.5, -1.5, -1.4],
      [19.5, 13.5, -1.8],
    ],
  },
  3: {
    worldRadius: 43.5,
    seeker: [1.8, 1.2, 0],
    hiders: [
      [-1.8, 7.2, Math.PI],
      [-17.5, -5.0, 0.5],
      [17.5, 6.0, -0.7],
      [0.0, -17.5, 2.8],
      [-18.0, -18.0, 0.8],
      [18.0, -18.0, -0.8],
      [18.0, 18.0, -2.2],
      [-18.0, 18.0, 2.2],
      [0.0, 18.0, Math.PI],
      [-18.0, 0.0, 1.5],
    ],
  },
  4: {
    worldRadius: 42.5,
    seeker: [2.2, 2.2, 0],
    hiders: [
      [-2.0, 7.5, Math.PI],
      [-14.5, -8.5, 0.4],
      [14.5, 8.5, -0.5],
      [0.0, -15.5, 3.0],
      [-14.5, -14.5, 0.6],
      [14.5, -14.5, -0.6],
      [14.5, 14.5, -2.4],
      [-14.5, 14.5, 2.4],
      [-28.0, 0.0, 1.5],
      [28.0, 0.0, -1.5],
    ],
  },
  5: {
    worldRadius: 43.0,
    seeker: [2.2, 2.5, 0],
    hiders: [
      [-2.0, 7.5, Math.PI],
      [-17.5, 4.5, 0.5],
      [17.5, 4.5, -0.5],
      [-2.0, -16.5, 2.8],
      [-12.0, -6.4, 0.3],
      [8.0, -6.4, -0.3],
      [-18.0, 12.5, 1.0],
      [18.0, 12.5, -1.0],
      [0.0, 21.0, Math.PI],
      [-18.0, 21.0, 2.0],
    ],
  },
  6: {
    worldRadius: 42.5,
    seeker: [3.2, 2.2, 0],
    hiders: [
      [-2.0, 7.5, Math.PI],
      [-18.5, -6.5, 0.7],
      [18.5, -6.5, -0.7],
      [0.0, -18.5, 3.0],
      [-8.0, -7.5, 0.5],
      [8.0, -7.5, -0.5],
      [-20.5, -14.0, 0.9],
      [20.5, -14.0, -0.9],
      [-20.5, 8.0, 1.6],
      [20.5, 8.0, -1.6],
    ],
  },
  7: {
    worldRadius: 43.0,
    seeker: [12.5, 0.0, -Math.PI / 2],
    hiders: [
      [-12.5, 7.6, Math.PI],
      [-12.5, -14.0, 0.5],
      [12.5, 14.0, -0.6],
      [12.5, -14.0, 2.5],
      [-12.5, -18.0, 1.2],
      [-12.5, 0.0, 1.5],
      [-12.5, 18.0, 2.0],
      [12.5, -18.0, -1.2],
      [12.5, 18.0, -2.0],
      [-26.5, -8.0, 1.0],
    ],
  },
  8: {
    worldRadius: 43.0,
    seeker: [2.4, 2.4, 0],
    hiders: [
      [-2.0, 7.5, Math.PI],
      [-16.5, -10.5, 0.5],
      [16.5, 10.5, -0.5],
      [0.0, -16.5, 2.8],
      [-16.5, -16.5, 0.8],
      [16.5, -16.5, -0.8],
      [16.5, 16.5, -2.3],
      [-16.5, 16.5, 2.3],
      [-16.5, 0.0, 1.5],
      [16.5, 0.0, -1.5],
    ],
  },
};

interface ServerPlayer {
  id: string;
  reconnectToken: string;
  ws: WebSocket | null;
  disconnectedAt: number | null;
  name: string;
  customization: CharacterCustomization;
  role: TeamRole;
  caught: boolean;
  caughtAtSeconds: number | null;
  isHiding: boolean;
  liveStatus: PlayerLiveStatus;
  x: number;
  y: number;
  z: number;
  rotY: number;
  moveSpeed: number;
  animState: CharacterAnimState;
  chatTimestamps: number[];
  lastEmoteAt: number;
  reportedTargetIds: Set<string>;
  seekCount: number;
  lastSeekRound: number;
}

interface ServerPlayerReport {
  id: string;
  reporterId: string;
  targetId: string;
  targetName: string;
  reason: string;
  details: string;
  createdAt: number;
}

interface ServerRoom {
  code: string;
  hostId: string;
  hostUnlockedLevel: number;
  levelId: number;
  phase: OnlineRoomPhase;
  roundNumber: number;
  seekerRotationIndex: number;
  lastSeekerId: string | null;
  timeRemaining: number;
  countdownTimer: number;
  lastCountdownCeil: number;
  winner: MatchWinner;
  banner: string | null;
  bannerExpiresAt: number;
  players: Map<string, ServerPlayer>;
  playerOrder: string[];
  dirtyPositions: boolean;
  chatHistory: ChatMessagePayload[];
  reports: ServerPlayerReport[];
}

interface SocketMeta {
  roomCode: string | null;
  playerId: string | null;
}

const rooms = new Map<string, ServerRoom>();
const socketMeta = new WeakMap<WebSocket, SocketMeta>();

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Player';
  const cleaned = raw.replace(/[\r\n\t<>]/g, '').trim().slice(0, 16);
  return cleaned || 'Player';
}

function sanitizeCustomization(raw: unknown): CharacterCustomization {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const presetId =
    typeof obj.presetId === 'string' && /^[a-z0-9_-]{1,24}$/i.test(obj.presetId)
      ? obj.presetId
      : 'raju';
  const name = sanitizeName(obj.name);
  const outfitStyle: OutfitStyle = ALLOWED_OUTFITS.has(obj.outfitStyle as OutfitStyle)
    ? (obj.outfitStyle as OutfitStyle)
    : 'shirt_shorts';
  const rawColor = typeof obj.outfitColor === 'number' && Number.isFinite(obj.outfitColor)
    ? Math.floor(obj.outfitColor) & 0xffffff
    : 0xc9522e;
  const accessory: AccessoryType = ALLOWED_ACCESSORIES.has(obj.accessory as AccessoryType)
    ? (obj.accessory as AccessoryType)
    : 'none';
  return {
    presetId,
    name,
    outfitStyle,
    outfitColor: rawColor,
    accessory,
  };
}

function sanitizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (code.length < 4 || code.length > 8) return null;
  return code;
}

function clampUnlockedLevel(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(raw)));
}

function generateUniqueRoomCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
    }
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sendJson(ws: WebSocket | null, payload: ServerToClientMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore transient closed-socket send errors
  }
}

function getNextSeekerId(room: ServerRoom): string | null {
  const ordered = room.playerOrder.filter((id) => room.players.has(id));
  if (ordered.length === 0) return null;

  const connected = ordered.filter((id) => {
    const p = room.players.get(id);
    return Boolean(p && p.ws && p.ws.readyState === WebSocket.OPEN);
  });
  const candidates = connected.length > 0 ? connected : ordered;

  // Fair round-robin rotation: avoid back-to-back seeker repeats and prioritize
  // connected players with the fewest seeker turns (even across joins/leaves).
  const pool =
    room.lastSeekerId && candidates.length > 1
      ? candidates.filter((id) => id !== room.lastSeekerId)
      : candidates;

  const sorted = [...pool].sort((a, b) => {
    const pa = room.players.get(a)!;
    const pb = room.players.get(b)!;
    if (pa.seekCount !== pb.seekCount) return pa.seekCount - pb.seekCount;
    if (pa.lastSeekRound !== pb.lastSeekRound) {
      return pa.lastSeekRound - pb.lastSeekRound;
    }
    return room.playerOrder.indexOf(a) - room.playerOrder.indexOf(b);
  });

  return sorted[0] ?? null;
}

function buildRoomSnapshot(room: ServerRoom): MultiplayerRoomSnapshot {
  const now = Date.now();
  if (room.banner && room.bannerExpiresAt > 0 && now > room.bannerExpiresAt) {
    room.banner = null;
    room.bannerExpiresAt = 0;
  }

  const players: OnlinePlayerState[] = [];
  for (const id of room.playerOrder) {
    const p = room.players.get(id);
    if (!p) continue;
    players.push({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
      customization: p.customization,
      role: p.role,
      caught: p.caught,
      caughtAtSeconds: p.caughtAtSeconds,
      isHiding: p.isHiding,
      liveStatus: p.liveStatus,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      moveSpeed: p.moveSpeed,
      animState: p.animState,
    });
  }

  return {
    code: room.code,
    hostId: room.hostId,
    hostUnlockedLevel: room.hostUnlockedLevel,
    levelId: room.levelId,
    phase: room.phase,
    roundNumber: room.roundNumber,
    nextSeekerId: getNextSeekerId(room),
    timeRemaining: Math.max(0, Math.ceil(room.timeRemaining)),
    countdownSeconds: Math.max(0, Math.ceil(room.countdownTimer)),
    winner: room.winner,
    banner: room.banner,
    players,
  };
}

function broadcastRoomState(room: ServerRoom): void {
  const snapshot = buildRoomSnapshot(room);
  const msg: ServerToClientMessage = { type: 'room_state', room: snapshot };
  for (const p of room.players.values()) {
    sendJson(p.ws, msg);
  }
}

function broadcastEvent(room: ServerRoom, msg: ServerToClientMessage): void {
  for (const p of room.players.values()) {
    sendJson(p.ws, msg);
  }
}

function setRoomBanner(room: ServerRoom, message: string, durationMs = 3000): void {
  room.banner = message;
  room.bannerExpiresAt = Date.now() + durationMs;
}

function computeLiveStatus(room: ServerRoom, player: ServerPlayer): PlayerLiveStatus {
  if (room.phase === 'lobby') return 'waiting';
  if (player.role === 'seeker') {
    return room.countdownTimer > 0 ? 'counting' : 'seeking';
  }
  if (player.caught) return 'caught';
  if (player.isHiding) return 'hiding';
  return 'moving';
}

function startOnlineMatch(room: ServerRoom): void {
  const activeIds = room.playerOrder.filter((id) => {
    const p = room.players.get(id);
    return Boolean(p && p.ws && p.ws.readyState === WebSocket.OPEN);
  });

  if (activeIds.length < MIN_PLAYERS_TO_START) {
    return;
  }

  const seekerId = getNextSeekerId(room) ?? activeIds[0];
  room.lastSeekerId = seekerId;
  room.seekerRotationIndex = (activeIds.indexOf(seekerId) + 1) % activeIds.length;
  room.roundNumber += 1;
  room.phase = 'playing';
  room.winner = null;
  room.timeRemaining = MATCH_DURATION_SECONDS;
  room.countdownTimer = HEADSTART_SECONDS;
  room.lastCountdownCeil = HEADSTART_SECONDS;

  const levelSpawns = LEVEL_SERVER_SPAWNS[room.levelId] ?? LEVEL_SERVER_SPAWNS[1];
  let hiderCursor = 0;

  for (const id of activeIds) {
    const p = room.players.get(id);
    if (!p) continue;
    p.caught = false;
    p.caughtAtSeconds = null;
    p.isHiding = false;
    p.moveSpeed = 0;
    p.animState = 'idle';
    p.y = 0;

    if (id === seekerId) {
      p.role = 'seeker';
      p.seekCount += 1;
      p.lastSeekRound = room.roundNumber;
      p.animState = 'counting_eyes_closed';
      p.x = levelSpawns.seeker[0];
      p.z = levelSpawns.seeker[1];
      p.rotY = levelSpawns.seeker[2];
    } else {
      p.role = 'hider';
      const sp = levelSpawns.hiders[hiderCursor % levelSpawns.hiders.length];
      hiderCursor++;
      p.x = sp[0];
      p.z = sp[1];
      p.rotY = sp[2];
    }
    p.liveStatus = computeLiveStatus(room, p);
  }

  const seekerName = room.players.get(seekerId)?.name ?? 'Seeker';
  setRoomBanner(
    room,
    `Round ${room.roundNumber} · ${seekerName} has eyes closed counting! ${HEADSTART_SECONDS}s to hide!`,
    3500,
  );
  broadcastRoomState(room);
  broadcastEvent(room, {
    type: 'match_event',
    eventKind: 'countdown_tick',
    secondsLeft: HEADSTART_SECONDS,
  });
}

function endOnlineMatch(room: ServerRoom, winner: MatchWinner, bannerMsg: string): void {
  if (room.phase !== 'playing') return;
  room.phase = 'ended';
  room.winner = winner;
  setRoomBanner(room, bannerMsg, 5000);
  broadcastRoomState(room);
  broadcastEvent(room, {
    type: 'match_event',
    eventKind: 'match_end',
    winner,
    message: bannerMsg,
  });
}

function removePlayerFromRoom(room: ServerRoom, playerId: string): void {
  const leaving = room.players.get(playerId);
  if (!leaving) return;

  const wasSeeker = leaving.role === 'seeker';
  const leavingName = leaving.name;
  room.players.delete(playerId);
  room.playerOrder = room.playerOrder.filter((id) => id !== playerId);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  // Migrate host cleanly if host left
  if (room.hostId === playerId) {
    const nextHostId = room.playerOrder[0];
    room.hostId = nextHostId;
    const nextHost = room.players.get(nextHostId);
    if (nextHost) {
      setRoomBanner(room, `${leavingName} left. ${nextHost.name} is now the host.`, 3200);
    }
  } else {
    setRoomBanner(room, `${leavingName} left the room.`, 2800);
  }

  // Check if active match should finish when a player leaves
  if (room.phase === 'playing') {
    const remainingHiders = Array.from(room.players.values()).filter(
      (p) => p.role === 'hider' && !p.caught,
    );
    if (room.players.size < MIN_PLAYERS_TO_START) {
      room.phase = 'lobby';
      room.winner = null;
      for (const p of room.players.values()) {
        p.caught = false;
        p.isHiding = false;
        p.liveStatus = 'waiting';
      }
      setRoomBanner(room, 'Not enough players remaining. Returned to waiting lobby.', 4000);
    } else if (wasSeeker) {
      endOnlineMatch(
        room,
        'hiders',
        `Seeker ${leavingName} left the match — Hiders win this round!`,
      );
      return;
    } else if (remainingHiders.length === 0) {
      endOnlineMatch(room, 'seekers', 'All remaining hiders are out — Seeker wins!');
      return;
    }
  }

  broadcastRoomState(room);
}

// Authoritative server tick: countdown, match clock, position fan-out, and disconnect cleanup
setInterval(() => {
  const now = Date.now();
  const dt = 0.05; // 20Hz authoritative tick

  for (const room of rooms.values()) {
    // Clean up players disconnected for > 18 seconds
    for (const p of Array.from(room.players.values())) {
      if (p.disconnectedAt !== null && now - p.disconnectedAt > 18000) {
        removePlayerFromRoom(room, p.id);
      }
    }
    if (!rooms.has(room.code)) continue;

    if (room.phase === 'playing') {
      let stateChanged = false;

      if (room.countdownTimer > 0) {
        room.countdownTimer = Math.max(0, room.countdownTimer - dt);
        const nextCeil = Math.ceil(room.countdownTimer);
        if (nextCeil !== room.lastCountdownCeil) {
          room.lastCountdownCeil = nextCeil;
          stateChanged = true;
          if (nextCeil > 0) {
            broadcastEvent(room, {
              type: 'match_event',
              eventKind: 'countdown_tick',
              secondsLeft: nextCeil,
            });
          } else {
            for (const p of room.players.values()) {
              if (p.role === 'seeker' && p.animState === 'counting_eyes_closed') {
                p.animState = 'idle';
                room.dirtyPositions = true;
              }
              p.liveStatus = computeLiveStatus(room, p);
            }
            setRoomBanner(room, 'Ready or not, here comes the Seeker!', 2600);
            broadcastEvent(room, {
              type: 'match_event',
              eventKind: 'seek_start',
            });
          }
        }
      } else {
        const prevSec = Math.ceil(room.timeRemaining);
        room.timeRemaining = Math.max(0, room.timeRemaining - dt);
        const curSec = Math.ceil(room.timeRemaining);
        if (curSec !== prevSec) {
          stateChanged = true;
        }
        if (room.timeRemaining <= 0) {
          const surviving = Array.from(room.players.values()).filter(
            (p) => p.role === 'hider' && !p.caught,
          );
          if (surviving.length > 0) {
            endOnlineMatch(
              room,
              'hiders',
              `Time is up! ${surviving.length} ${surviving.length === 1 ? 'hider' : 'hiders'} survived!`,
            );
            continue;
          } else {
            endOnlineMatch(
              room,
              'seekers',
              'All hiders caught — Seeker wins!',
            );
            continue;
          }
        }
      }

      if (stateChanged) {
        broadcastRoomState(room);
      }

      if (room.dirtyPositions) {
        room.dirtyPositions = false;
        const positions = Array.from(room.players.values()).map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
          rotY: p.rotY,
          moveSpeed: p.moveSpeed,
          isHiding: p.isHiding,
          animState: p.animState,
          liveStatus: p.liveStatus,
        }));
        broadcastEvent(room, { type: 'player_positions', positions });
      }
    }
  }
}, 50);

function handleWsMessage(ws: WebSocket, rawData: string): void {
  let msg: ClientToServerMessage;
  try {
    msg = JSON.parse(rawData) as ClientToServerMessage;
  } catch {
    sendJson(ws, { type: 'error', message: 'Invalid message payload.' });
    return;
  }
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'ping') {
    sendJson(ws, { type: 'pong' });
    return;
  }

  const meta = socketMeta.get(ws) ?? { roomCode: null, playerId: null };
  socketMeta.set(ws, meta);

  if (msg.type === 'create_room') {
    // Cleanly leave any previous room
    if (meta.roomCode && meta.playerId) {
      const oldRoom = rooms.get(meta.roomCode);
      if (oldRoom) removePlayerFromRoom(oldRoom, meta.playerId);
      meta.roomCode = null;
      meta.playerId = null;
    }

    const code = generateUniqueRoomCode();
    const playerId = crypto.randomUUID();
    const reconnectToken = crypto.randomBytes(16).toString('hex');
    const customization = sanitizeCustomization(msg.customization);
    const unlockedLevel = clampUnlockedLevel(msg.unlockedLevel);
    const requestedLevel =
      typeof msg.levelId === 'number' && Number.isFinite(msg.levelId)
        ? Math.max(1, Math.min(unlockedLevel, Math.floor(msg.levelId)))
        : 1;

    const hostPlayer: ServerPlayer = {
      id: playerId,
      reconnectToken,
      ws,
      disconnectedAt: null,
      name: customization.name,
      customization,
      role: 'hider',
      caught: false,
      caughtAtSeconds: null,
      isHiding: false,
      liveStatus: 'waiting',
      x: 0,
      y: 0,
      z: 7.2,
      rotY: 0,
      moveSpeed: 0,
      animState: 'idle',
      chatTimestamps: [],
      lastEmoteAt: 0,
      reportedTargetIds: new Set<string>(),
      seekCount: 0,
      lastSeekRound: 0,
    };

    const room: ServerRoom = {
      code,
      hostId: playerId,
      hostUnlockedLevel: unlockedLevel,
      levelId: requestedLevel,
      phase: 'lobby',
      roundNumber: 0,
      seekerRotationIndex: 0,
      lastSeekerId: null,
      timeRemaining: MATCH_DURATION_SECONDS,
      countdownTimer: 0,
      lastCountdownCeil: 0,
      winner: null,
      banner: null,
      bannerExpiresAt: 0,
      players: new Map([[playerId, hostPlayer]]),
      playerOrder: [playerId],
      dirtyPositions: false,
      chatHistory: [],
      reports: [],
    };

    rooms.set(code, room);
    meta.roomCode = code;
    meta.playerId = playerId;

    sendJson(ws, {
      type: 'room_joined',
      playerId,
      reconnectToken,
      room: buildRoomSnapshot(room),
      recentMessages: room.chatHistory,
    });
    return;
  }

  if (msg.type === 'join_room') {
    const code = sanitizeRoomCode(msg.roomCode);
    if (!code) {
      sendJson(ws, { type: 'error', message: 'Enter a valid 6-character room code.' });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      sendJson(ws, {
        type: 'error',
        message: `Room "${code}" was not found. Double-check the code.`,
      });
      return;
    }
    if (room.players.size >= MAX_ROOM_PLAYERS) {
      sendJson(ws, {
        type: 'error',
        message: `Room ${code} is full (${MAX_ROOM_PLAYERS}/${MAX_ROOM_PLAYERS} players).`,
      });
      return;
    }
    if (room.phase === 'playing') {
      sendJson(ws, {
        type: 'error',
        message: `Room ${code} is currently in a match. Try joining once the round finishes.`,
      });
      return;
    }

    if (meta.roomCode && meta.playerId) {
      const oldRoom = rooms.get(meta.roomCode);
      if (oldRoom) removePlayerFromRoom(oldRoom, meta.playerId);
    }

    const playerId = crypto.randomUUID();
    const reconnectToken = crypto.randomBytes(16).toString('hex');
    const customization = sanitizeCustomization(msg.customization);

    let minExistingSeekCount = 0;
    if (room.players.size > 0) {
      minExistingSeekCount = Math.min(
        ...Array.from(room.players.values()).map((ep) => ep.seekCount),
      );
    }

    const player: ServerPlayer = {
      id: playerId,
      reconnectToken,
      ws,
      disconnectedAt: null,
      name: customization.name,
      customization,
      role: 'hider',
      caught: false,
      caughtAtSeconds: null,
      isHiding: false,
      liveStatus: 'waiting',
      x: 0,
      y: 0,
      z: 7.2,
      rotY: 0,
      moveSpeed: 0,
      animState: 'idle',
      chatTimestamps: [],
      lastEmoteAt: 0,
      reportedTargetIds: new Set<string>(),
      seekCount: minExistingSeekCount,
      lastSeekRound: 0,
    };

    room.players.set(playerId, player);
    room.playerOrder.push(playerId);
    meta.roomCode = code;
    meta.playerId = playerId;

    setRoomBanner(room, `${player.name} joined the lobby!`, 2600);
    sendJson(ws, {
      type: 'room_joined',
      playerId,
      reconnectToken,
      room: buildRoomSnapshot(room),
      recentMessages: room.chatHistory,
    });
    broadcastRoomState(room);
    return;
  }

  if (msg.type === 'rejoin_room') {
    const code = sanitizeRoomCode(msg.roomCode);
    if (!code || typeof msg.playerId !== 'string' || typeof msg.reconnectToken !== 'string') {
      sendJson(ws, { type: 'room_left' });
      return;
    }
    const room = rooms.get(code);
    const existing = room?.players.get(msg.playerId);
    if (!room || !existing || existing.reconnectToken !== msg.reconnectToken) {
      sendJson(ws, { type: 'room_left' });
      return;
    }
    existing.ws = ws;
    existing.disconnectedAt = null;
    meta.roomCode = code;
    meta.playerId = existing.id;

    sendJson(ws, {
      type: 'room_joined',
      playerId: existing.id,
      reconnectToken: existing.reconnectToken,
      room: buildRoomSnapshot(room),
      recentMessages: room.chatHistory,
    });
    broadcastRoomState(room);
    return;
  }

  // Remaining actions require an active room membership
  if (!meta.roomCode || !meta.playerId) return;
  const room = rooms.get(meta.roomCode);
  if (!room) {
    meta.roomCode = null;
    meta.playerId = null;
    sendJson(ws, { type: 'room_left' });
    return;
  }
  const player = room.players.get(meta.playerId);
  if (!player) return;

  if (msg.type === 'leave_room') {
    meta.roomCode = null;
    meta.playerId = null;
    removePlayerFromRoom(room, player.id);
    sendJson(ws, { type: 'room_left' });
    return;
  }

  if (msg.type === 'update_profile') {
    const nextCust = sanitizeCustomization(msg.customization);
    player.customization = nextCust;
    player.name = nextCust.name;
    if (player.id === room.hostId && typeof msg.unlockedLevel === 'number') {
      room.hostUnlockedLevel = Math.max(
        room.hostUnlockedLevel,
        clampUnlockedLevel(msg.unlockedLevel),
      );
    }
    broadcastRoomState(room);
    return;
  }

  if (msg.type === 'select_map') {
    if (player.id !== room.hostId) {
      sendJson(ws, { type: 'error', message: 'Only the room host can select the map.' });
      return;
    }
    if (room.phase === 'playing') return;
    if (typeof msg.unlockedLevel === 'number') {
      room.hostUnlockedLevel = Math.max(
        room.hostUnlockedLevel,
        clampUnlockedLevel(msg.unlockedLevel),
      );
    }
    const requested =
      typeof msg.levelId === 'number' && Number.isFinite(msg.levelId)
        ? Math.floor(msg.levelId)
        : 1;
    if (requested < 1 || requested > room.hostUnlockedLevel) {
      sendJson(ws, {
        type: 'error',
        message: 'That map is locked. Unlock it first to play it in your room.',
      });
      return;
    }
    room.levelId = requested;
    broadcastRoomState(room);
    return;
  }

  if (msg.type === 'start_match') {
    if (player.id !== room.hostId) {
      sendJson(ws, { type: 'error', message: 'Only the room host can start the match.' });
      return;
    }
    if (room.phase === 'playing') return;
    if (room.players.size < MIN_PLAYERS_TO_START) {
      sendJson(ws, {
        type: 'error',
        message: 'Wait for at least 1 friend to join the room before starting.',
      });
      return;
    }
    startOnlineMatch(room);
    return;
  }

  if (msg.type === 'return_to_lobby') {
    if (player.id !== room.hostId) return;
    room.phase = 'lobby';
    room.winner = null;
    room.countdownTimer = 0;
    for (const p of room.players.values()) {
      p.caught = false;
      p.caughtAtSeconds = null;
      p.isHiding = false;
      p.y = 0;
      p.liveStatus = 'waiting';
    }
    setRoomBanner(room, 'Back in waiting lobby. Host can pick the next map or start!', 2800);
    broadcastRoomState(room);
    return;
  }

  if (msg.type === 'player_state') {
    if (room.phase !== 'playing' || !msg.state) return;
    if (player.role === 'hider' && player.caught) return;
    if (player.role === 'seeker' && room.countdownTimer > 0) return;

    const st = msg.state;
    const maxR = (LEVEL_SERVER_SPAWNS[room.levelId]?.worldRadius ?? 45) + 2;
    if (typeof st.x === 'number' && Number.isFinite(st.x)) {
      player.x = Math.max(-maxR, Math.min(maxR, st.x));
    }
    if (typeof st.y === 'number' && Number.isFinite(st.y)) {
      player.y = Math.max(0, Math.min(4.5, st.y));
    }
    if (typeof st.z === 'number' && Number.isFinite(st.z)) {
      player.z = Math.max(-maxR, Math.min(maxR, st.z));
    }
    if (typeof st.rotY === 'number' && Number.isFinite(st.rotY)) {
      player.rotY = st.rotY;
    }
    if (typeof st.moveSpeed === 'number' && Number.isFinite(st.moveSpeed)) {
      player.moveSpeed = Math.max(0, Math.min(12, st.moveSpeed));
    }
    if (typeof st.isHiding === 'boolean' && player.role === 'hider') {
      player.isHiding = st.isHiding;
    }
    if (ALLOWED_ANIM_STATES.has(st.animState)) {
      player.animState = st.animState;
    }

    const nextStatus = computeLiveStatus(room, player);
    const statusChanged = nextStatus !== player.liveStatus;
    player.liveStatus = nextStatus;
    room.dirtyPositions = true;
    if (statusChanged) {
      broadcastRoomState(room);
    }
    return;
  }

  if (msg.type === 'try_tag') {
    if (room.phase !== 'playing' || room.countdownTimer > 0) return;
    if (player.role !== 'seeker') return;

    // Server-authoritative proximity check against target (or nearest uncaught hider)
    let target: ServerPlayer | null = null;
    if (typeof msg.targetPlayerId === 'string') {
      const candidate = room.players.get(msg.targetPlayerId);
      if (candidate && candidate.role === 'hider' && !candidate.caught) {
        const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
        if (d <= SERVER_TAG_RANGE) {
          target = candidate;
        }
      }
    }
    if (!target) {
      let bestDist = SERVER_TAG_RANGE;
      for (const candidate of room.players.values()) {
        if (candidate.role !== 'hider' || candidate.caught) continue;
        const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
        if (d <= bestDist) {
          bestDist = d;
          target = candidate;
        }
      }
    }

    if (!target) return;

    target.caught = true;
    target.isHiding = false;
    target.caughtAtSeconds = Math.max(0, Math.ceil(room.timeRemaining));
    target.liveStatus = 'caught';
    target.animState = 'caught_funny';
    target.moveSpeed = 0;

    player.animState = 'tag_lunge';
    room.dirtyPositions = true;

    const remainingHiders = Array.from(room.players.values()).filter(
      (p) => p.role === 'hider' && !p.caught,
    ).length;

    broadcastEvent(room, {
      type: 'match_event',
      eventKind: 'tag_caught',
      taggedPlayerId: target.id,
      seekerPlayerId: player.id,
      message: `Dhappa! ${player.name} caught ${target.name}!`,
    });

    if (remainingHiders === 0) {
      endOnlineMatch(
        room,
        'seekers',
        `Dhappa! ${player.name} caught all hiders!`,
      );
      return;
    }

    setRoomBanner(
      room,
      `Dhappa! ${player.name} caught ${target.name}! ${remainingHiders} ${remainingHiders === 1 ? 'hider' : 'hiders'} left.`,
      3000,
    );
    broadcastRoomState(room);
    return;
  }

  if (msg.type === 'send_chat') {
    const now = Date.now();
    player.chatTimestamps = player.chatTimestamps.filter(
      (ts) => now - ts < CHAT_WINDOW_MS,
    );
    const lastTs = player.chatTimestamps[player.chatTimestamps.length - 1] ?? 0;
    if (
      now - lastTs < CHAT_MIN_INTERVAL_MS ||
      player.chatTimestamps.length >= CHAT_MAX_IN_WINDOW
    ) {
      sendJson(ws, {
        type: 'error',
        message: 'Slow down a moment before sending another message.',
      });
      return;
    }

    const filtered = filterChatMessage(msg.text);
    if (filtered.empty) return;

    player.chatTimestamps.push(now);

    const chatMessage: ChatMessagePayload = {
      id: crypto.randomUUID(),
      senderId: player.id,
      senderName: player.name,
      senderRole: player.role,
      text: filtered.text,
      kind: msg.isQuickChat ? 'quick' : 'text',
      wasFiltered: filtered.wasFiltered,
      timestamp: now,
    };

    room.chatHistory.push(chatMessage);
    if (room.chatHistory.length > MAX_CHAT_HISTORY) {
      room.chatHistory.splice(0, room.chatHistory.length - MAX_CHAT_HISTORY);
    }

    broadcastEvent(room, {
      type: 'chat_message',
      chatMessage,
    });
    return;
  }

  if (msg.type === 'send_emote') {
    if (!msg.emote || !ALLOWED_EMOTES.has(msg.emote)) return;
    const now = Date.now();
    if (now - player.lastEmoteAt < EMOTE_COOLDOWN_MS) {
      return;
    }
    player.lastEmoteAt = now;

    const def = getEmoteDefinition(msg.emote);
    const playerEmote: PlayerEmotePayload = {
      id: crypto.randomUUID(),
      senderId: player.id,
      senderName: player.name,
      emote: def.id,
      timestamp: now,
    };

    const chatMessage: ChatMessagePayload = {
      id: `emote-${playerEmote.id}`,
      senderId: player.id,
      senderName: player.name,
      senderRole: player.role,
      text: def.chatAction,
      kind: 'emote',
      emote: def.id,
      timestamp: now,
    };

    room.chatHistory.push(chatMessage);
    if (room.chatHistory.length > MAX_CHAT_HISTORY) {
      room.chatHistory.splice(0, room.chatHistory.length - MAX_CHAT_HISTORY);
    }

    broadcastEvent(room, {
      type: 'player_emote',
      playerEmote,
    });
    broadcastEvent(room, {
      type: 'chat_message',
      chatMessage,
    });
    return;
  }

  if (msg.type === 'report_player') {
    if (typeof msg.targetPlayerId !== 'string') return;
    const target = room.players.get(msg.targetPlayerId);
    if (!target) {
      sendJson(ws, {
        type: 'error',
        message: 'That player is no longer in this room.',
      });
      return;
    }
    if (target.id === player.id) {
      sendJson(ws, {
        type: 'error',
        message: 'You cannot report yourself.',
      });
      return;
    }
    if (!msg.reason || !ALLOWED_REPORT_REASONS.has(msg.reason)) {
      sendJson(ws, {
        type: 'error',
        message: 'Select a valid report reason.',
      });
      return;
    }
    if (player.reportedTargetIds.has(target.id)) {
      sendJson(ws, {
        type: 'report_ack',
        reportedPlayerId: target.id,
        message: `You already reported ${target.name} in this room.`,
      });
      return;
    }

    const filteredDetails = filterChatMessage(msg.details ?? '');
    const cleanDetails = filteredDetails.text.slice(0, MAX_REPORT_DETAILS_LENGTH);
    player.reportedTargetIds.add(target.id);

    if (room.reports.length < MAX_ROOM_REPORTS) {
      room.reports.push({
        id: crypto.randomUUID(),
        reporterId: player.id,
        targetId: target.id,
        targetName: target.name,
        reason: msg.reason,
        details: cleanDetails,
        createdAt: Date.now(),
      });
    }

    sendJson(ws, {
      type: 'report_ack',
      reportedPlayerId: target.id,
      message: `Report submitted for ${target.name}. Thank you for keeping the village friendly.`,
    });
  }
}

async function startServer(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  // Dedicated WebSocket server exclusively for /ws/multiplayer
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  wss.on('connection', (ws) => {
    socketMeta.set(ws, { roomCode: null, playerId: null });

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      handleWsMessage(ws, text);
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (!meta?.roomCode || !meta.playerId) return;
      const room = rooms.get(meta.roomCode);
      const player = room?.players.get(meta.playerId);
      if (!room || !player) return;

      // Only detach if this socket is still the active socket for this player
      if (player.ws === ws) {
        player.ws = null;
        player.disconnectedAt = Date.now();
        // In lobby, remove faster (3.5s grace for tab refresh)
        if (room.phase === 'lobby') {
          setTimeout(() => {
            const r = rooms.get(room.code);
            const p = r?.players.get(player.id);
            if (r && p && p.ws === null) {
              removePlayerFromRoom(r, p.id);
            }
          }, 3500);
        }
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url ?? '';
    if (reqUrl.startsWith('/ws/multiplayer')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Gully Chhupan Chhupai 1995 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

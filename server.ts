import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CharacterAnimState,
  CharacterCustomization,
  FacialExpression,
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
import {
  extractBearerToken,
  verifyFirebaseIdToken,
} from './src/server/firebaseTokenVerifier.ts';
import {
  type LeaderboardPeriod,
  verifiedLeaderboardStore,
} from './src/server/leaderboardStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const MAX_ROOM_PLAYERS = 10;
const MIN_PLAYERS_TO_START = 2;
const MATCH_DURATION_SECONDS = 180;
const HEADSTART_SECONDS = 12;
const SERVER_TAG_RANGE = 3.95; // Slight latency tolerance above client 3.25m tag range
const SERVER_TAG_MAX_DY = 2.35; // Prevent tagging players on a different floor/roof
const SERVER_TAG_COOLDOWN_MS = 250; // Prevent duplicate simultaneous tag bursts
const SERVER_MAX_MOVE_SPEED = 11.5; // m/s upper bound for anti-teleport clamping
const SERVER_SLAP_RANGE = 3.4; // Proximity tolerance for playful hider-to-hider slap
const HIDER_SLAP_COOLDOWN_MS = 1500;
const MIN_VERIFIED_ONLINE_MATCH_MS = 15_000;
const LOBBY_DISCONNECT_GRACE_MS = 8_000;
const MATCH_DISCONNECT_GRACE_MS = 25_000;
const FULL_SYNC_INTERVAL_MS = 1_000;
const JOIN_RATE_WINDOW_MS = 30_000;
const MAX_FAILED_JOINS_PER_WINDOW = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTAL_LEVELS = 15;
const PIXAR_OPEN_START_LEVEL = 9;

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
  'handshake',
  'sit_down',
  'sitting',
  'stand_up',
  'emote_laugh',
  'emote_surprise',
  'emote_wave',
  'emote_dance',
  'emote_clap',
  'emote_cry',
]);

const ALLOWED_EXPRESSIONS = new Set<FacialExpression>([
  'neutral',
  'happy',
  'laughing',
  'excited',
  'fear',
  'surprise',
  'sad',
  'determined',
  'counting',
]);

const SERVER_HANDSHAKE_RANGE = 3.5;
const HANDSHAKE_COOLDOWN_MS = 2200;

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
    worldRadius: 58.5,
    seeker: [0.0, 2.0, Math.PI],
    hiders: [
      [0.0, -6.5, 0.0],
      [0.0, -28.0, 0.0],
      [0.0, 28.0, Math.PI],
      [-22.0, 2.0, 1.57],
      [22.0, 2.0, -1.57],
      [-36.0, -20.0, 0.8],
      [36.0, -20.0, -0.8],
      [-36.0, 20.0, 2.3],
      [36.0, 20.0, -2.3],
      [0.0, -36.0, 0.0],
    ],
  },
  4: {
    worldRadius: 56.5,
    seeker: [0.0, 3.8, Math.PI],
    hiders: [
      [0.0, 18.0, Math.PI],
      [0.0, -18.0, 0.0],
      [-17.5, -4.0, 1.4],
      [17.5, 4.0, -1.4],
      [-25.8, 0.0, 1.5],
      [22.2, 0.0, -1.5],
      [-17.5, 18.0, 0.8],
      [17.5, -18.0, -0.8],
      [-35.0, 6.0, 1.5],
      [35.0, -6.0, -1.5],
    ],
  },
  5: {
    worldRadius: 58.0,
    seeker: [0.0, -5.5, 0.0],
    hiders: [
      [0.0, -21.0, Math.PI],
      [-24.0, -21.0, 1.57],
      [24.0, -21.0, -1.57],
      [-22.0, -5.5, 1.57],
      [22.0, -5.5, -1.57],
      [-19.5, 16.5, 0.5],
      [19.5, 16.5, -0.5],
      [0.0, 16.5, Math.PI],
      [-19.5, 36.5, 0.8],
      [19.5, 36.5, -0.8],
    ],
  },
  6: {
    worldRadius: 56.5,
    seeker: [0.0, 12.0, Math.PI],
    hiders: [
      [0.0, 26.0, Math.PI],
      [-10.5, 4.5, 1.4],
      [10.5, 4.5, -1.4],
      [-22.5, 14.5, 0.2],
      [22.5, 14.5, -0.2],
      [-22.5, -8.5, 0.8],
      [22.5, -8.5, -0.8],
      [-35.0, 6.0, 1.5],
      [35.0, 6.0, -1.5],
      [0.0, 42.0, Math.PI],
    ],
  },
  7: {
    worldRadius: 56.5,
    seeker: [12.5, 0.0, -Math.PI / 2],
    hiders: [
      [-12.5, 7.6, Math.PI],
      [-12.5, -14.0, 0.5],
      [12.5, 14.0, -0.6],
      [12.5, -14.0, 2.5],
      [-12.5, -36.0, 1.2],
      [12.5, -36.0, -1.2],
      [-12.5, 36.0, 2.0],
      [12.5, 36.0, -2.0],
      [-26.5, 0.0, 1.5],
      [26.5, 0.0, -1.5],
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
  9: {
    worldRadius: 42.0,
    seeker: [0.0, 5.2, Math.PI],
    hiders: [
      [-4.5, 8.5, Math.PI],
      [4.5, -8.5, 0],
      [-16.5, 0.0, 1.5],
      [16.5, 0.0, -1.5],
      [-16.0, -18.5, 0.8],
      [18.0, -18.0, -0.8],
      [-18.0, 18.0, 2.3],
      [16.0, 18.5, -2.3],
      [0.0, -21.0, 0],
      [0.0, 21.0, Math.PI],
    ],
  },
  10: {
    worldRadius: 42.5,
    seeker: [0.0, 1.2, Math.PI],
    hiders: [
      [-6.5, 4.0, Math.PI],
      [6.5, -10.0, 0],
      [-16.5, 2.0, 1.5],
      [16.5, -2.0, -1.5],
      [-18.0, -18.0, 0.8],
      [18.0, -18.0, -0.8],
      [-18.0, 22.0, 2.3],
      [18.0, 22.0, -2.3],
      [0.0, -16.0, 0],
      [0.0, 22.0, Math.PI],
    ],
  },
  11: {
    worldRadius: 42.5,
    seeker: [11.5, 0.0, -Math.PI / 2],
    hiders: [
      [-11.5, 9.0, Math.PI],
      [11.5, -9.0, 0],
      [-11.5, -18.0, 0.5],
      [11.5, 18.0, -0.5],
      [-11.5, -26.0, 0.4],
      [11.5, -26.0, -0.4],
      [-11.5, 26.0, 2.4],
      [11.5, 26.0, -2.4],
      [0.0, -16.0, 0],
      [0.0, 16.0, Math.PI],
    ],
  },
  12: {
    worldRadius: 42.0,
    seeker: [2.5, 2.5, Math.PI],
    hiders: [
      [-4.5, 8.5, Math.PI],
      [-4.5, -8.5, 0],
      [7.5, 0.0, -1.5],
      [-18.0, 2.0, 1.5],
      [-4.5, -20.0, 0.3],
      [-4.5, 20.0, 2.8],
      [21.0, 0.0, -1.5],
      [4.5, -15.0, -0.5],
      [-20.0, -12.0, 0.8],
      [-20.0, 14.0, 2.1],
    ],
  },
  13: {
    worldRadius: 42.5,
    seeker: [0.0, 5.4, Math.PI],
    hiders: [
      [-4.5, 7.0, Math.PI],
      [4.5, -7.0, 0],
      [-14.5, 0.0, 1.5],
      [14.5, 0.0, -1.5],
      [-20.0, -14.0, 0.8],
      [20.0, -14.0, -0.8],
      [-20.0, 14.0, 2.2],
      [20.0, 14.0, -2.2],
      [0.0, -20.0, 0],
      [0.0, 20.0, Math.PI],
    ],
  },
  14: {
    worldRadius: 42.5,
    seeker: [0.0, 2.0, Math.PI],
    hiders: [
      [-4.5, 8.0, Math.PI],
      [4.5, -8.0, 0],
      [-10.5, -4.0, 1.5],
      [8.5, 9.0, -1.5],
      [-19.0, -10.0, 0.8],
      [19.0, -10.0, -0.8],
      [-19.0, 10.0, 2.2],
      [19.0, 10.0, -2.2],
      [0.0, -13.0, 0],
      [0.0, 18.0, Math.PI],
    ],
  },
  15: {
    worldRadius: 42.5,
    seeker: [0.0, 12.0, Math.PI],
    hiders: [
      [-4.5, 11.5, Math.PI],
      [4.5, -11.5, 0],
      [-16.0, 9.0, 1.5],
      [16.0, -9.0, -1.5],
      [-16.0, -11.0, 0.8],
      [16.0, 11.0, -2.2],
      [0.0, -12.0, 0],
      [0.0, 0.0, Math.PI],
      [-16.0, 0.0, 1.5],
      [16.0, 0.0, -1.5],
    ],
  },
};

export interface MultiplayerHubOptions {
  headstartSeconds?: number;
  matchDurationSeconds?: number;
  lobbyDisconnectGraceMs?: number;
  matchDisconnectGraceMs?: number;
  tickIntervalMs?: number;
  fullSyncIntervalMs?: number;
  minVerifiedOnlineMatchMs?: number;
}

interface ServerPlayer {
  id: string;
  reconnectToken: string;
  clientSessionId: string | null;
  authUid: string | null;
  avatarId: string;
  ws: WebSocket | null;
  disconnectedAt: number | null;
  lobbyDisconnectTimer: ReturnType<typeof setTimeout> | null;
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
  expression?: FacialExpression;
  dirtyPosition: boolean;
  lastStateAt: number;
  lastTagAt: number;
  chatTimestamps: number[];
  lastEmoteAt: number;
  lastSlapAt: number;
  lastHandshakeAt: number;
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
  isLocked: boolean;
  passcodeSalt: string | null;
  passcodeHash: Buffer | null;
  phase: OnlineRoomPhase;
  roundNumber: number;
  activeMatchId: string | null;
  matchStartedAt: number;
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
  lastFullSyncAt: number;
  chatHistory: ChatMessagePayload[];
  reports: ServerPlayerReport[];
}

interface SocketMeta {
  roomCode: string | null;
  playerId: string | null;
  failedJoinTimestamps: number[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sanitizeClientSessionId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function sanitizePasscode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (cleaned.length < 4 || cleaned.length > 12) return null;
  return cleaned;
}

function hashRoomPasscode(passcode: string): { salt: string; hash: Buffer } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(passcode, salt, 32);
  return { salt, hash };
}

function verifyRoomPasscode(
  passcode: string | null,
  salt: string | null,
  expectedHash: Buffer | null,
): boolean {
  if (!expectedHash || !salt) return true;
  if (!passcode) return false;
  const candidate = crypto.scryptSync(passcode, salt, 32);
  if (candidate.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(candidate, expectedHash);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sanitizeAvatarId(raw: unknown, fallback = 'raju'): string {
  if (typeof raw === 'string' && /^[a-z0-9_-]{1,32}$/.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

function attachVerifiedAuthAsync(
  player: ServerPlayer,
  rawAuthToken: unknown,
  rawAvatarId?: unknown,
): void {
  if (rawAvatarId !== undefined) {
    player.avatarId = sanitizeAvatarId(rawAvatarId, player.avatarId);
  }
  if (typeof rawAuthToken !== 'string' || !rawAuthToken.trim()) return;
  void verifyFirebaseIdToken(rawAuthToken).then((verified) => {
    if (verified) {
      player.authUid = verified.uid;
    }
  });
}

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

function sendJson(ws: WebSocket | null, payload: ServerToClientMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore transient socket send failures
  }
}

export function createMultiplayerHub(
  wss: WebSocketServer,
  options: MultiplayerHubOptions = {},
): {
  rooms: Map<string, ServerRoom>;
  dispose: () => void;
} {
  const headstartSeconds = options.headstartSeconds ?? HEADSTART_SECONDS;
  const matchDurationSeconds = options.matchDurationSeconds ?? MATCH_DURATION_SECONDS;
  const lobbyDisconnectGraceMs = options.lobbyDisconnectGraceMs ?? LOBBY_DISCONNECT_GRACE_MS;
  const matchDisconnectGraceMs = options.matchDisconnectGraceMs ?? MATCH_DISCONNECT_GRACE_MS;
  const tickIntervalMs = options.tickIntervalMs ?? 50;
  const fullSyncIntervalMs = options.fullSyncIntervalMs ?? FULL_SYNC_INTERVAL_MS;
  const minVerifiedOnlineMatchMs = options.minVerifiedOnlineMatchMs ?? MIN_VERIFIED_ONLINE_MATCH_MS;

  const rooms = new Map<string, ServerRoom>();
  const socketMeta = new WeakMap<WebSocket, SocketMeta>();

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

  function isPlayerConnected(p: ServerPlayer): boolean {
    return Boolean(p.ws && p.ws.readyState === WebSocket.OPEN && p.disconnectedAt === null);
  }

  function clearPlayerDisconnectTimer(p: ServerPlayer): void {
    if (p.lobbyDisconnectTimer !== null) {
      clearTimeout(p.lobbyDisconnectTimer);
      p.lobbyDisconnectTimer = null;
    }
  }

  function detachAndCloseSocket(oldWs: WebSocket | null, reason: string): void {
    if (!oldWs) return;
    socketMeta.set(oldWs, {
      roomCode: null,
      playerId: null,
      failedJoinTimestamps: [],
    });
    if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
      try {
        oldWs.close(4001, reason);
      } catch {
        // Ignore close errors
      }
    }
  }

  function checkAndRecordFailedJoin(meta: SocketMeta): boolean {
    const now = Date.now();
    meta.failedJoinTimestamps = meta.failedJoinTimestamps.filter(
      (ts) => now - ts < JOIN_RATE_WINDOW_MS,
    );
    if (meta.failedJoinTimestamps.length >= MAX_FAILED_JOINS_PER_WINDOW) {
      return false;
    }
    meta.failedJoinTimestamps.push(now);
    return true;
  }

  function isJoinRateLimited(meta: SocketMeta): boolean {
    const now = Date.now();
    meta.failedJoinTimestamps = meta.failedJoinTimestamps.filter(
      (ts) => now - ts < JOIN_RATE_WINDOW_MS,
    );
    return meta.failedJoinTimestamps.length >= MAX_FAILED_JOINS_PER_WINDOW;
  }

  function getNextSeekerId(room: ServerRoom): string | null {
    const ordered = room.playerOrder.filter((id) => room.players.has(id));
    if (ordered.length === 0) return null;

    const connected = ordered.filter((id) => {
      const p = room.players.get(id);
      return Boolean(p && isPlayerConnected(p));
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
        connected: isPlayerConnected(p),
        customization: p.customization,
        role: p.role,
        caught: p.caught,
        caughtAtSeconds: p.caughtAtSeconds,
        isHiding: p.isHiding,
        liveStatus: p.liveStatus,
        x: round2(p.x),
        y: round2(p.y),
        z: round2(p.z),
        rotY: round3(p.rotY),
        moveSpeed: round2(p.moveSpeed),
        animState: p.animState,
        expression: p.expression,
      });
    }

    return {
      code: room.code,
      hostId: room.hostId,
      hostUnlockedLevel: room.hostUnlockedLevel,
      levelId: room.levelId,
      isLocked: room.isLocked,
      hasPasscode: Boolean(room.passcodeHash),
      serverTime: now,
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
    const msg: ServerToClientMessage = {
      type: 'room_state',
      room: snapshot,
      serverTime: snapshot.serverTime,
    };
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

  function pickNextHostId(room: ServerRoom): string | null {
    const connected = room.playerOrder.find((id) => {
      const candidate = room.players.get(id);
      return Boolean(candidate && isPlayerConnected(candidate));
    });
    if (connected) return connected;
    return room.playerOrder.find((id) => room.players.has(id)) ?? null;
  }

  function endOnlineMatch(room: ServerRoom, winner: MatchWinner, bannerMsg: string): void {
    if (room.phase !== 'playing') return;
    room.phase = 'ended';
    room.winner = winner;

    let leaderboardUpdated = false;
    const elapsedMs = Date.now() - room.matchStartedAt;
    if (
      winner !== null &&
      room.activeMatchId &&
      room.players.size >= MIN_PLAYERS_TO_START &&
      elapsedMs >= minVerifiedOnlineMatchMs
    ) {
      const winningRole: TeamRole = winner === 'seekers' ? 'seeker' : 'hider';
      const verifiedWinners: Array<{
        uid: string;
        username: string;
        avatarId: string;
      }> = [];
      for (const p of room.players.values()) {
        if (p.role === winningRole && p.authUid) {
          verifiedWinners.push({
            uid: p.authUid,
            username: p.name,
            avatarId: p.avatarId,
          });
        }
      }
      if (verifiedWinners.length > 0) {
        leaderboardUpdated = verifiedLeaderboardStore.recordVerifiedOnlineMatchWin({
          matchId: room.activeMatchId,
          levelId: room.levelId,
          winners: verifiedWinners,
        });
      }
    }
    room.activeMatchId = null;

    setRoomBanner(room, bannerMsg, 5000);
    broadcastRoomState(room);
    broadcastEvent(room, {
      type: 'match_event',
      eventKind: 'match_end',
      winner,
      message: bannerMsg,
      leaderboardUpdated,
      serverTime: Date.now(),
    });
  }

  function removePlayerFromRoom(
    room: ServerRoom,
    playerId: string,
    customReason?: string,
  ): void {
    const leaving = room.players.get(playerId);
    if (!leaving) return;

    clearPlayerDisconnectTimer(leaving);
    const wasSeeker = leaving.role === 'seeker';
    const leavingName = leaving.name;
    room.players.delete(playerId);
    room.playerOrder = room.playerOrder.filter((id) => id !== playerId);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }

    // Migrate host cleanly to a connected player if host left
    if (room.hostId === playerId) {
      const nextHostId = pickNextHostId(room);
      if (nextHostId) {
        room.hostId = nextHostId;
        const nextHost = room.players.get(nextHostId);
        if (nextHost) {
          setRoomBanner(
            room,
            `${leavingName} left. ${nextHost.name} is now the host.`,
            3200,
          );
        }
      }
    } else {
      setRoomBanner(
        room,
        customReason ?? `${leavingName} left the room.`,
        2800,
      );
    }

    // Check if active match should finish when a player leaves
    if (room.phase === 'playing') {
      const remainingHiders = Array.from(room.players.values()).filter(
        (p) => p.role === 'hider' && !p.caught,
      );
      if (room.players.size < MIN_PLAYERS_TO_START) {
        room.phase = 'lobby';
        room.winner = null;
        room.countdownTimer = 0;
        room.activeMatchId = null;
        for (const p of room.players.values()) {
          p.caught = false;
          p.caughtAtSeconds = null;
          p.isHiding = false;
          p.liveStatus = 'waiting';
        }
        setRoomBanner(
          room,
          'Not enough players remaining. Returned to waiting lobby.',
          4000,
        );
      } else if (wasSeeker) {
        endOnlineMatch(
          room,
          'hiders',
          `Seeker ${leavingName} left the match — Hiders win this round!`,
        );
        return;
      } else if (remainingHiders.length === 0) {
        endOnlineMatch(
          room,
          'seekers',
          'All remaining hiders are out — Seeker wins!',
        );
        return;
      }
    }

    broadcastRoomState(room);
  }

  function startOnlineMatch(room: ServerRoom): boolean {
    // Prune any disconnected lobby players before assigning roles so there are zero ghost actors
    for (const p of Array.from(room.players.values())) {
      if (!isPlayerConnected(p)) {
        clearPlayerDisconnectTimer(p);
        room.players.delete(p.id);
        room.playerOrder = room.playerOrder.filter((id) => id !== p.id);
      }
    }
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return false;
    }
    if (!room.players.has(room.hostId)) {
      const nextHost = pickNextHostId(room);
      if (nextHost) room.hostId = nextHost;
    }

    const activeIds = room.playerOrder.filter((id) => room.players.has(id));
    if (activeIds.length < MIN_PLAYERS_TO_START) {
      broadcastRoomState(room);
      return false;
    }

    const seekerId = getNextSeekerId(room) ?? activeIds[0];
    room.lastSeekerId = seekerId;
    room.seekerRotationIndex = (activeIds.indexOf(seekerId) + 1) % activeIds.length;
    room.roundNumber += 1;
    room.activeMatchId = crypto.randomUUID();
    const now = Date.now();
    room.matchStartedAt = now;
    room.phase = 'playing';
    room.winner = null;
    room.timeRemaining = matchDurationSeconds;
    room.countdownTimer = headstartSeconds;
    room.lastCountdownCeil = Math.ceil(headstartSeconds);
    room.dirtyPositions = true;
    room.lastFullSyncAt = now;

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
      p.expression = undefined;
      p.y = 0;
      p.lastStateAt = now;
      p.lastTagAt = 0;
      p.dirtyPosition = true;

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
    const secs = Math.ceil(headstartSeconds);
    setRoomBanner(
      room,
      `Round ${room.roundNumber} · ${seekerName} has eyes closed counting! ${secs}s to hide!`,
      3500,
    );
    broadcastRoomState(room);
    broadcastEvent(room, {
      type: 'match_event',
      eventKind: 'countdown_tick',
      secondsLeft: secs,
      serverTime: now,
    });
    return true;
  }

  function serializePlayerPosition(p: ServerPlayer) {
    return {
      id: p.id,
      x: round2(p.x),
      y: round2(p.y),
      z: round2(p.z),
      rotY: round3(p.rotY),
      moveSpeed: round2(p.moveSpeed),
      isHiding: p.isHiding,
      animState: p.animState,
      expression: p.expression,
      liveStatus: p.liveStatus,
    };
  }

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
      sendJson(ws, {
        type: 'pong',
        serverTime: Date.now(),
        clientSentAt:
          typeof msg.clientSentAt === 'number' && Number.isFinite(msg.clientSentAt)
            ? msg.clientSentAt
            : undefined,
      });
      return;
    }

    const meta = socketMeta.get(ws) ?? {
      roomCode: null,
      playerId: null,
      failedJoinTimestamps: [],
    };
    socketMeta.set(ws, meta);

    if (msg.type === 'create_room') {
      // Cleanly leave any previous room
      if (meta.roomCode && meta.playerId) {
        const oldRoom = rooms.get(meta.roomCode);
        if (oldRoom) removePlayerFromRoom(oldRoom, meta.playerId);
        meta.roomCode = null;
        meta.playerId = null;
      }

      const rawPasscode = typeof msg.passcode === 'string' ? msg.passcode.trim() : '';
      if (rawPasscode.length > 0 && (rawPasscode.length < 4 || rawPasscode.length > 12)) {
        sendJson(ws, {
          type: 'error',
          message: 'Optional room PIN must be 4 to 12 characters.',
        });
        return;
      }

      const code = generateUniqueRoomCode();
      const playerId = crypto.randomUUID();
      const reconnectToken = crypto.randomBytes(16).toString('hex');
      const clientSessionId = sanitizeClientSessionId(msg.clientSessionId);
      const customization = sanitizeCustomization(msg.customization);
      const unlockedLevel = clampUnlockedLevel(msg.unlockedLevel);
      const rawReq =
        typeof msg.levelId === 'number' && Number.isFinite(msg.levelId)
          ? Math.floor(msg.levelId)
          : 1;
      const requestedLevel =
        rawReq >= PIXAR_OPEN_START_LEVEL && rawReq <= TOTAL_LEVELS
          ? rawReq
          : Math.max(1, Math.min(unlockedLevel, rawReq));

      const hashedPass =
        rawPasscode.length >= 4 ? hashRoomPasscode(rawPasscode) : null;

      const now = Date.now();
      const hostPlayer: ServerPlayer = {
        id: playerId,
        reconnectToken,
        clientSessionId,
        authUid: null,
        avatarId: sanitizeAvatarId(msg.avatarId, customization.presetId),
        ws,
        disconnectedAt: null,
        lobbyDisconnectTimer: null,
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
        expression: undefined,
        dirtyPosition: false,
        lastStateAt: now,
        lastTagAt: 0,
        chatTimestamps: [],
        lastEmoteAt: 0,
        lastSlapAt: 0,
        lastHandshakeAt: 0,
        reportedTargetIds: new Set<string>(),
        seekCount: 0,
        lastSeekRound: 0,
      };

      attachVerifiedAuthAsync(hostPlayer, msg.authToken, msg.avatarId);

      const room: ServerRoom = {
        code,
        hostId: playerId,
        hostUnlockedLevel: unlockedLevel,
        levelId: requestedLevel,
        isLocked: false,
        passcodeSalt: hashedPass?.salt ?? null,
        passcodeHash: hashedPass?.hash ?? null,
        phase: 'lobby',
        roundNumber: 0,
        activeMatchId: null,
        matchStartedAt: 0,
        seekerRotationIndex: 0,
        lastSeekerId: null,
        timeRemaining: matchDurationSeconds,
        countdownTimer: 0,
        lastCountdownCeil: 0,
        winner: null,
        banner: null,
        bannerExpiresAt: 0,
        players: new Map([[playerId, hostPlayer]]),
        playerOrder: [playerId],
        dirtyPositions: false,
        lastFullSyncAt: now,
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
        serverTime: now,
      });
      return;
    }

    if (msg.type === 'join_room') {
      if (isJoinRateLimited(meta)) {
        sendJson(ws, {
          type: 'error',
          message: 'Too many room join attempts. Wait a few seconds and try again.',
        });
        return;
      }

      const code = sanitizeRoomCode(msg.roomCode);
      if (!code) {
        checkAndRecordFailedJoin(meta);
        sendJson(ws, { type: 'error', message: 'Enter a valid 6-character room code.' });
        return;
      }
      const room = rooms.get(code);
      if (!room) {
        checkAndRecordFailedJoin(meta);
        sendJson(ws, {
          type: 'error',
          message: `Room "${code}" was not found. Double-check the code.`,
        });
        return;
      }

      // Idempotent guard: same socket already inside this room
      if (meta.roomCode === code && meta.playerId && room.players.has(meta.playerId)) {
        const existingSelf = room.players.get(meta.playerId)!;
        sendJson(ws, {
          type: 'room_joined',
          playerId: existingSelf.id,
          reconnectToken: existingSelf.reconnectToken,
          room: buildRoomSnapshot(room),
          recentMessages: room.chatHistory,
          serverTime: Date.now(),
        });
        return;
      }

      // Verify private room passcode (if configured by host)
      const providedPasscode = sanitizePasscode(msg.passcode);
      if (!verifyRoomPasscode(providedPasscode, room.passcodeSalt, room.passcodeHash)) {
        checkAndRecordFailedJoin(meta);
        sendJson(ws, {
          type: 'error',
          message: providedPasscode
            ? 'Incorrect room PIN. Ask the host for the right PIN.'
            : 'This private room requires a PIN from the host.',
        });
        return;
      }

      // Prevent duplicate player if the same browser session rejoins the same room
      const incomingSessionId = sanitizeClientSessionId(msg.clientSessionId);
      if (incomingSessionId) {
        const existingBySession = Array.from(room.players.values()).find(
          (p) => p.clientSessionId === incomingSessionId,
        );
        if (existingBySession) {
          clearPlayerDisconnectTimer(existingBySession);
          if (existingBySession.ws && existingBySession.ws !== ws) {
            detachAndCloseSocket(existingBySession.ws, 'Reconnected in same room');
          }
          existingBySession.ws = ws;
          existingBySession.disconnectedAt = null;
          meta.roomCode = code;
          meta.playerId = existingBySession.id;
          sendJson(ws, {
            type: 'room_joined',
            playerId: existingBySession.id,
            reconnectToken: existingBySession.reconnectToken,
            room: buildRoomSnapshot(room),
            recentMessages: room.chatHistory,
            serverTime: Date.now(),
          });
          broadcastRoomState(room);
          return;
        }
      }

      if (room.isLocked) {
        checkAndRecordFailedJoin(meta);
        sendJson(ws, {
          type: 'error',
          message: `Room ${code} is locked by the host.`,
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

      const now = Date.now();
      const player: ServerPlayer = {
        id: playerId,
        reconnectToken,
        clientSessionId: incomingSessionId,
        authUid: null,
        avatarId: sanitizeAvatarId(msg.avatarId, customization.presetId),
        ws,
        disconnectedAt: null,
        lobbyDisconnectTimer: null,
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
        expression: undefined,
        dirtyPosition: false,
        lastStateAt: now,
        lastTagAt: 0,
        chatTimestamps: [],
        lastEmoteAt: 0,
        lastSlapAt: 0,
        lastHandshakeAt: 0,
        reportedTargetIds: new Set<string>(),
        seekCount: minExistingSeekCount,
        lastSeekRound: 0,
      };

      attachVerifiedAuthAsync(player, msg.authToken, msg.avatarId);

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
        serverTime: now,
      });
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'rejoin_room') {
      const code = sanitizeRoomCode(msg.roomCode);
      if (
        !code ||
        typeof msg.playerId !== 'string' ||
        typeof msg.reconnectToken !== 'string'
      ) {
        sendJson(ws, { type: 'room_left' });
        return;
      }
      const room = rooms.get(code);
      const existing = room?.players.get(msg.playerId);
      if (
        !room ||
        !existing ||
        !timingSafeStringEqual(existing.reconnectToken, msg.reconnectToken)
      ) {
        sendJson(ws, { type: 'room_left' });
        return;
      }

      clearPlayerDisconnectTimer(existing);
      if (existing.ws && existing.ws !== ws) {
        detachAndCloseSocket(existing.ws, 'Reconnected from new socket');
      }
      existing.ws = ws;
      existing.disconnectedAt = null;
      existing.lastStateAt = Date.now();
      existing.dirtyPosition = true;
      room.dirtyPositions = true;
      meta.roomCode = code;
      meta.playerId = existing.id;

      setRoomBanner(room, `${existing.name} reconnected!`, 2200);
      sendJson(ws, {
        type: 'room_joined',
        playerId: existing.id,
        reconnectToken: existing.reconnectToken,
        room: buildRoomSnapshot(room),
        recentMessages: room.chatHistory,
        serverTime: Date.now(),
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

    if (msg.type === 'identify_auth') {
      attachVerifiedAuthAsync(player, msg.authToken, msg.avatarId);
      return;
    }

    if (msg.type === 'update_profile') {
      const nextCust = sanitizeCustomization(msg.customization);
      player.customization = nextCust;
      player.name = nextCust.name;
      if (msg.avatarId !== undefined) {
        player.avatarId = sanitizeAvatarId(msg.avatarId, player.avatarId);
      }
      if (player.id === room.hostId && typeof msg.unlockedLevel === 'number') {
        room.hostUnlockedLevel = Math.max(
          room.hostUnlockedLevel,
          clampUnlockedLevel(msg.unlockedLevel),
        );
      }
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'toggle_room_lock') {
      if (player.id !== room.hostId) {
        sendJson(ws, {
          type: 'error',
          message: 'Only the room host can lock or unlock this room.',
        });
        return;
      }
      if (room.phase === 'playing') return;
      room.isLocked =
        typeof msg.locked === 'boolean' ? msg.locked : !room.isLocked;
      setRoomBanner(
        room,
        room.isLocked
          ? 'Room locked — new players cannot join.'
          : 'Room unlocked — friends with the code can join.',
        2400,
      );
      broadcastRoomState(room);
      return;
    }

    if (msg.type === 'kick_player') {
      if (player.id !== room.hostId) {
        sendJson(ws, {
          type: 'error',
          message: 'Only the room host can remove a player.',
        });
        return;
      }
      if (room.phase === 'playing') return;
      if (typeof msg.targetPlayerId !== 'string' || msg.targetPlayerId === player.id) {
        return;
      }
      const target = room.players.get(msg.targetPlayerId);
      if (!target) return;
      const targetWs = target.ws;
      sendJson(targetWs, {
        type: 'error',
        message: 'You were removed from the room by the host.',
      });
      sendJson(targetWs, { type: 'room_left' });
      if (targetWs) {
        socketMeta.set(targetWs, {
          roomCode: null,
          playerId: null,
          failedJoinTimestamps: [],
        });
      }
      removePlayerFromRoom(room, target.id, `${target.name} was removed by the host.`);
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
      const isAllowed =
        (requested >= 1 && requested <= room.hostUnlockedLevel) ||
        (requested >= PIXAR_OPEN_START_LEVEL && requested <= TOTAL_LEVELS);
      if (!isAllowed) {
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
      const connectedCount = Array.from(room.players.values()).filter(
        isPlayerConnected,
      ).length;
      if (connectedCount < MIN_PLAYERS_TO_START) {
        sendJson(ws, {
          type: 'error',
          message: 'Wait for at least 1 connected friend to join before starting.',
        });
        return;
      }
      startOnlineMatch(room);
      return;
    }

    if (msg.type === 'return_to_lobby') {
      if (player.id !== room.hostId) {
        sendJson(ws, {
          type: 'error',
          message: 'Only the room host can return everyone to the lobby.',
        });
        return;
      }
      room.phase = 'lobby';
      room.winner = null;
      room.countdownTimer = 0;
      room.activeMatchId = null;
      for (const p of room.players.values()) {
        p.caught = false;
        p.caughtAtSeconds = null;
        p.isHiding = false;
        p.y = 0;
        p.moveSpeed = 0;
        p.animState = 'idle';
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

      const now = Date.now();
      const dtSec = Math.max(0.05, Math.min(1.5, (now - player.lastStateAt) / 1000));
      player.lastStateAt = now;

      const st = msg.state;
      const maxR = (LEVEL_SERVER_SPAWNS[room.levelId]?.worldRadius ?? 45) + 2;

      const prevX = player.x;
      const prevY = player.y;
      const prevZ = player.z;
      const prevRotY = player.rotY;
      const prevSpeed = player.moveSpeed;
      const prevHiding = player.isHiding;
      const prevAnim = player.animState;
      const prevExpr = player.expression;

      let nextX = player.x;
      let nextY = player.y;
      let nextZ = player.z;
      if (typeof st.x === 'number' && Number.isFinite(st.x)) {
        nextX = Math.max(-maxR, Math.min(maxR, st.x));
      }
      if (typeof st.y === 'number' && Number.isFinite(st.y)) {
        nextY = Math.max(0, Math.min(9.5, st.y));
      }
      if (typeof st.z === 'number' && Number.isFinite(st.z)) {
        nextZ = Math.max(-maxR, Math.min(maxR, st.z));
      }

      // Server-side anti-teleport velocity clamping (allows legitimate lag bursts up to 1.5s)
      const dx = nextX - prevX;
      const dz = nextZ - prevZ;
      const horizStep = Math.hypot(dx, dz);
      const maxStep = SERVER_MAX_MOVE_SPEED * dtSec + 0.85;
      if (horizStep > maxStep && horizStep > 0.001) {
        const scale = maxStep / horizStep;
        nextX = prevX + dx * scale;
        nextZ = prevZ + dz * scale;
      }
      const dy = nextY - prevY;
      const maxDy = 10 * dtSec + 1.5;
      if (Math.abs(dy) > maxDy) {
        nextY = prevY + Math.sign(dy) * maxDy;
      }

      player.x = nextX;
      player.y = nextY;
      player.z = nextZ;

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
      if (st.expression && ALLOWED_EXPRESSIONS.has(st.expression)) {
        player.expression = st.expression;
      } else if (st.expression === undefined) {
        player.expression = undefined;
      }

      const nextStatus = computeLiveStatus(room, player);
      const statusChanged = nextStatus !== player.liveStatus;
      player.liveStatus = nextStatus;

      const changed =
        statusChanged ||
        Math.abs(player.x - prevX) >= 0.005 ||
        Math.abs(player.y - prevY) >= 0.005 ||
        Math.abs(player.z - prevZ) >= 0.005 ||
        Math.abs(player.rotY - prevRotY) >= 0.004 ||
        Math.abs(player.moveSpeed - prevSpeed) >= 0.02 ||
        player.isHiding !== prevHiding ||
        player.animState !== prevAnim ||
        player.expression !== prevExpr;

      if (changed) {
        player.dirtyPosition = true;
        room.dirtyPositions = true;
      }
      if (statusChanged) {
        broadcastRoomState(room);
      }
      return;
    }

    if (msg.type === 'try_tag') {
      if (room.phase !== 'playing' || room.countdownTimer > 0) return;
      if (player.role !== 'seeker' || !isPlayerConnected(player)) return;

      const now = Date.now();
      if (now - player.lastTagAt < SERVER_TAG_COOLDOWN_MS) return;

      // Server-authoritative 3D proximity check (horizontal + floor height) against target or nearest uncaught hider
      let target: ServerPlayer | null = null;
      if (typeof msg.targetPlayerId === 'string' && msg.targetPlayerId.trim()) {
        const candidate = room.players.get(msg.targetPlayerId);
        if (candidate && candidate.role === 'hider' && !candidate.caught) {
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= SERVER_TAG_RANGE && dy <= SERVER_TAG_MAX_DY) {
            target = candidate;
          }
        }
      } else {
        let bestDist = SERVER_TAG_RANGE;
        for (const candidate of room.players.values()) {
          if (candidate.role !== 'hider' || candidate.caught) continue;
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= bestDist && dy <= SERVER_TAG_MAX_DY) {
            bestDist = d;
            target = candidate;
          }
        }
      }

      if (!target || target.caught) return;

      player.lastTagAt = now;
      target.caught = true;
      target.isHiding = false;
      target.caughtAtSeconds = Math.max(0, Math.ceil(room.timeRemaining));
      target.liveStatus = 'caught';
      target.animState = 'caught_funny';
      target.moveSpeed = 0;
      target.dirtyPosition = true;

      player.animState = 'tag_lunge';
      player.dirtyPosition = true;
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
        serverTime: now,
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

    if (msg.type === 'try_slap_hider') {
      if (room.phase !== 'playing') return;
      if (player.role !== 'hider' || player.caught) return;

      const now = Date.now();
      if (now - player.lastSlapAt < HIDER_SLAP_COOLDOWN_MS) return;

      let target: ServerPlayer | null = null;
      if (typeof msg.targetPlayerId === 'string') {
        const candidate = room.players.get(msg.targetPlayerId);
        if (
          candidate &&
          candidate.id !== player.id &&
          candidate.role === 'hider' &&
          !candidate.caught
        ) {
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= SERVER_SLAP_RANGE && dy <= SERVER_TAG_MAX_DY) {
            target = candidate;
          }
        }
      }
      if (!target) {
        let bestDist = SERVER_SLAP_RANGE;
        for (const candidate of room.players.values()) {
          if (
            candidate.id === player.id ||
            candidate.role !== 'hider' ||
            candidate.caught
          ) {
            continue;
          }
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= bestDist && dy <= SERVER_TAG_MAX_DY) {
            bestDist = d;
            target = candidate;
          }
        }
      }

      if (!target) return;

      player.lastSlapAt = now;
      player.animState = 'tag_lunge';
      player.dirtyPosition = true;
      room.dirtyPositions = true;

      broadcastEvent(room, {
        type: 'match_event',
        eventKind: 'hider_slap',
        slapperPlayerId: player.id,
        targetPlayerId: target.id,
        message: `${player.name} playfully slapped ${target.name}!`,
        serverTime: now,
      });
      return;
    }

    if (msg.type === 'try_handshake') {
      if (room.phase !== 'playing') return;
      if (player.caught) return;
      if (player.role === 'seeker' && room.countdownTimer > 0) return;

      const now = Date.now();
      if (now - player.lastHandshakeAt < HANDSHAKE_COOLDOWN_MS) return;

      // Friendly players only (same role, uncaught)
      let target: ServerPlayer | null = null;
      if (typeof msg.targetPlayerId === 'string') {
        const candidate = room.players.get(msg.targetPlayerId);
        if (
          candidate &&
          candidate.id !== player.id &&
          candidate.role === player.role &&
          !candidate.caught
        ) {
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= SERVER_HANDSHAKE_RANGE && dy <= SERVER_TAG_MAX_DY) {
            target = candidate;
          }
        }
      }
      if (!target) {
        let bestDist = SERVER_HANDSHAKE_RANGE;
        for (const candidate of room.players.values()) {
          if (
            candidate.id === player.id ||
            candidate.role !== player.role ||
            candidate.caught
          ) {
            continue;
          }
          const d = Math.hypot(candidate.x - player.x, candidate.z - player.z);
          const dy = Math.abs(candidate.y - player.y);
          if (d <= bestDist && dy <= SERVER_TAG_MAX_DY) {
            bestDist = d;
            target = candidate;
          }
        }
      }

      if (!target) return;

      player.lastHandshakeAt = now;
      target.lastHandshakeAt = now;
      player.animState = 'handshake';
      target.animState = 'handshake';
      player.expression = 'happy';
      target.expression = 'happy';
      player.dirtyPosition = true;
      target.dirtyPosition = true;
      room.dirtyPositions = true;

      broadcastEvent(room, {
        type: 'match_event',
        eventKind: 'player_handshake',
        actorPlayerId: player.id,
        targetPlayerId: target.id,
        message: `🤝 ${player.name} and ${target.name} shook hands!`,
        serverTime: now,
      });
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

      const isSpectatorInLiveMatch =
        room.phase === 'playing' && player.role === 'hider' && player.caught;

      const chatMessage: ChatMessagePayload = {
        id: crypto.randomUUID(),
        senderId: player.id,
        senderName: player.name,
        senderRole: player.role,
        text: filtered.text,
        kind: msg.isQuickChat ? 'quick' : 'text',
        wasFiltered: filtered.wasFiltered,
        spectatorOnly: isSpectatorInLiveMatch || undefined,
        timestamp: now,
      };

      if (isSpectatorInLiveMatch) {
        // Fair-play isolation: spectator messages are ONLY delivered to other caught spectators,
        // never to the seeker or active hiders, preventing hidden-player callouts.
        for (const recipient of room.players.values()) {
          if (
            recipient.id === player.id ||
            (recipient.role === 'hider' && recipient.caught)
          ) {
            sendJson(recipient.ws, {
              type: 'chat_message',
              chatMessage,
            });
          }
        }
        return;
      }

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
      if (room.phase === 'playing' && player.role === 'hider' && player.caught) {
        return;
      }
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

  // Authoritative server tick: countdown, match clock, delta/full position fan-out, and disconnect cleanup
  const dt = tickIntervalMs / 1000;
  const tickHandle = setInterval(() => {
    const now = Date.now();

    for (const room of Array.from(rooms.values())) {
      // Clean up players disconnected past their grace window
      const graceMs =
        room.phase === 'playing' ? matchDisconnectGraceMs : lobbyDisconnectGraceMs;
      for (const p of Array.from(room.players.values())) {
        if (p.disconnectedAt !== null && now - p.disconnectedAt >= graceMs) {
          removePlayerFromRoom(
            room,
            p.id,
            `${p.name} disconnected from the room.`,
          );
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
                serverTime: now,
              });
            } else {
              for (const p of room.players.values()) {
                if (p.role === 'seeker' && p.animState === 'counting_eyes_closed') {
                  p.animState = 'idle';
                  p.dirtyPosition = true;
                  room.dirtyPositions = true;
                }
                p.liveStatus = computeLiveStatus(room, p);
              }
              setRoomBanner(room, 'Ready or not, here comes the Seeker!', 2600);
              broadcastEvent(room, {
                type: 'match_event',
                eventKind: 'seek_start',
                serverTime: now,
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

        const needsFullSync = now - room.lastFullSyncAt >= fullSyncIntervalMs;
        if (room.dirtyPositions || needsFullSync) {
          room.dirtyPositions = false;
          const positions = [];
          for (const p of room.players.values()) {
            if (needsFullSync || p.dirtyPosition) {
              p.dirtyPosition = false;
              positions.push(serializePlayerPosition(p));
            }
          }
          if (needsFullSync) {
            room.lastFullSyncAt = now;
          }
          if (positions.length > 0) {
            broadcastEvent(room, {
              type: 'player_positions',
              serverTime: now,
              delta: !needsFullSync,
              positions,
            });
          }
        }
      }
    }
  }, tickIntervalMs);

  wss.on('connection', (ws) => {
    socketMeta.set(ws, {
      roomCode: null,
      playerId: null,
      failedJoinTimestamps: [],
    });

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
        broadcastRoomState(room);

        // In lobby/ended, give a clean mobile-handoff grace window before removing
        if (room.phase !== 'playing') {
          clearPlayerDisconnectTimer(player);
          player.lobbyDisconnectTimer = setTimeout(() => {
            player.lobbyDisconnectTimer = null;
            const r = rooms.get(room.code);
            const p = r?.players.get(player.id);
            if (r && p && p.ws === null && r.phase !== 'playing') {
              removePlayerFromRoom(r, p.id, `${p.name} disconnected from the room.`);
            }
          }, lobbyDisconnectGraceMs);
        }
      }
    });
  });

  const dispose = (): void => {
    clearInterval(tickHandle);
    for (const room of rooms.values()) {
      for (const p of room.players.values()) {
        clearPlayerDisconnectTimer(p);
      }
    }
    rooms.clear();
  };

  return { rooms, dispose };
}

async function startServer(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '16kb' }));

  // Global Leaderboard (Daily / Weekly / All-Time Top 100 from server-verified wins)
  app.get('/api/leaderboard', async (req, res) => {
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'all_time';
    const period: LeaderboardPeriod =
      rawPeriod === 'daily' || rawPeriod === 'weekly' || rawPeriod === 'all_time'
        ? rawPeriod
        : 'all_time';

    const bearer = extractBearerToken(req.headers.authorization);
    const verifiedUser = bearer ? await verifyFirebaseIdToken(bearer) : null;

    const snapshot = verifiedLeaderboardStore.getLeaderboardSnapshot(
      period,
      verifiedUser?.uid ?? null,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json(snapshot);
  });

  // Start a single-use server-tracked solo match session (requires verified Firebase Auth)
  app.post('/api/matches/start', async (req, res) => {
    const bearer = extractBearerToken(req.headers.authorization);
    const verifiedUser = await verifyFirebaseIdToken(bearer);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Authentication required to record ranked matches.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const result = verifiedLeaderboardStore.startSoloMatchSession({
      uid: verifiedUser.uid,
      username: body.username ?? verifiedUser.name ?? 'Village Kid',
      avatarId: body.avatarId ?? 'raju',
      levelId: body.levelId,
      playerRole: body.playerRole,
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  // Finalize a server-tracked solo match session (rejects arbitrary/fake score submissions)
  app.post('/api/matches/complete', async (req, res) => {
    const bearer = extractBearerToken(req.headers.authorization);
    const verifiedUser = await verifyFirebaseIdToken(bearer);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const result = verifiedLeaderboardStore.completeSoloMatchSession({
      sessionId: body.sessionId,
      uid: verifiedUser.uid,
      outcome: body.outcome,
      remainingHiders: body.remainingHiders,
      caughtCount: body.caughtCount,
      username: body.username,
      avatarId: body.avatarId,
    });

    if (!result.verified) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // Update only display username & village avatar on existing verified leaderboard records
  app.post('/api/leaderboard/identity', async (req, res) => {
    const bearer = extractBearerToken(req.headers.authorization);
    const verifiedUser = await verifyFirebaseIdToken(bearer);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    verifiedLeaderboardStore.updatePlayerIdentity(
      verifiedUser.uid,
      body.username,
      body.avatarId,
    );
    res.json({ ok: true });
  });

  // Remove player's leaderboard records upon verified account deletion
  app.delete('/api/leaderboard/me', async (req, res) => {
    const bearer = extractBearerToken(req.headers.authorization);
    const verifiedUser = await verifyFirebaseIdToken(bearer);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    verifiedLeaderboardStore.removePlayer(verifiedUser.uid);
    res.json({ ok: true });
  });

  // Dedicated WebSocket server exclusively for /ws/multiplayer
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const mpHub = createMultiplayerHub(wss);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: mpHub.rooms.size });
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

const isDirectExecution =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

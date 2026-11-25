import type {
  CharacterAnimState,
  CharacterCustomization,
  MatchWinner,
  TeamRole,
} from './types';
import type { EmoteType, ReportReason } from './chatFilter';

export const MAX_ROOM_PLAYERS = 10;
export const MIN_ONLINE_PLAYERS_TO_START = 2;
export const ONLINE_MATCH_DURATION_SECONDS = 180;
export const ONLINE_HEADSTART_SECONDS = 12;

export type OnlineRoomPhase = 'lobby' | 'playing' | 'ended';

export type PlayerLiveStatus =
  | 'waiting'
  | 'counting'
  | 'seeking'
  | 'hiding'
  | 'moving'
  | 'caught';

export interface OnlinePlayerState {
  id: string;
  name: string;
  isHost: boolean;
  customization: CharacterCustomization;
  role: TeamRole;
  caught: boolean;
  caughtAtSeconds: number | null;
  isHiding: boolean;
  liveStatus: PlayerLiveStatus;
  x: number;
  y?: number;
  z: number;
  rotY: number;
  moveSpeed: number;
  animState: CharacterAnimState;
}

export interface ChatMessagePayload {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: TeamRole;
  text: string;
  kind: 'text' | 'quick' | 'emote';
  emote?: EmoteType;
  wasFiltered?: boolean;
  timestamp: number;
}

export interface PlayerEmotePayload {
  id: string;
  senderId: string;
  senderName: string;
  emote: EmoteType;
  timestamp: number;
}

export interface MultiplayerRoomSnapshot {
  code: string;
  hostId: string;
  hostUnlockedLevel: number;
  levelId: number;
  phase: OnlineRoomPhase;
  roundNumber: number;
  nextSeekerId: string | null;
  timeRemaining: number;
  countdownSeconds: number;
  winner: MatchWinner;
  banner: string | null;
  players: OnlinePlayerState[];
}

export interface PlayerTransformPayload {
  x: number;
  y?: number;
  z: number;
  rotY: number;
  moveSpeed: number;
  isHiding: boolean;
  animState: CharacterAnimState;
}

export interface ClientToServerMessage {
  type:
    | 'create_room'
    | 'join_room'
    | 'rejoin_room'
    | 'update_profile'
    | 'select_map'
    | 'start_match'
    | 'return_to_lobby'
    | 'leave_room'
    | 'player_state'
    | 'try_tag'
    | 'send_chat'
    | 'send_emote'
    | 'report_player'
    | 'ping';
  roomCode?: string;
  playerId?: string;
  reconnectToken?: string;
  customization?: CharacterCustomization;
  unlockedLevel?: number;
  levelId?: number;
  state?: PlayerTransformPayload;
  targetPlayerId?: string;
  text?: string;
  isQuickChat?: boolean;
  emote?: EmoteType;
  reason?: ReportReason;
  details?: string;
}

export interface ServerToClientMessage {
  type:
    | 'room_joined'
    | 'room_state'
    | 'player_positions'
    | 'match_event'
    | 'chat_message'
    | 'player_emote'
    | 'report_ack'
    | 'room_left'
    | 'error'
    | 'pong';
  playerId?: string;
  reconnectToken?: string;
  room?: MultiplayerRoomSnapshot;
  recentMessages?: ChatMessagePayload[];
  chatMessage?: ChatMessagePayload;
  playerEmote?: PlayerEmotePayload;
  reportedPlayerId?: string;
  positions?: Array<{
    id: string;
    x: number;
    y?: number;
    z: number;
    rotY: number;
    moveSpeed: number;
    isHiding: boolean;
    animState: CharacterAnimState;
    liveStatus: PlayerLiveStatus;
  }>;
  eventKind?: 'tag_caught' | 'countdown_tick' | 'seek_start' | 'match_end' | 'banner';
  message?: string;
  secondsLeft?: number;
  winner?: MatchWinner;
  taggedPlayerId?: string;
  seekerPlayerId?: string;
}

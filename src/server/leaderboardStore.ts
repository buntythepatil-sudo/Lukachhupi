import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time';

export interface LeaderboardEntryRecord {
  rank: number;
  uid: string;
  username: string;
  avatarId: string;
  wins: number;
  completedLevelsCount: number;
  completedLevels: number[];
  updatedAt: number;
}

export interface LeaderboardResponsePayload {
  period: LeaderboardPeriod;
  periodKey: string;
  resetLabel: string;
  totalPlayers: number;
  entries: LeaderboardEntryRecord[];
  currentUser: {
    uid: string;
    username: string;
    avatarId: string;
    rank: number | null;
    wins: number;
    completedLevelsCount: number;
    completedLevels: number[];
  } | null;
  serverTime: number;
}

interface StoredPlayerRecord {
  uid: string;
  username: string;
  avatarId: string;
  allTimeWins: number;
  completedLevels: number[];
  updatedAt: number;
}

interface StoredPeriodBucket {
  winsByUid: Record<string, { wins: number; updatedAt: number }>;
}

interface PersistedLeaderboardFile {
  version: 1;
  players: Record<string, StoredPlayerRecord>;
  dailyBuckets: Record<string, StoredPeriodBucket>;
  weeklyBuckets: Record<string, StoredPeriodBucket>;
}

interface ActiveSoloSession {
  sessionId: string;
  uid: string;
  username: string;
  avatarId: string;
  levelId: number;
  playerRole: 'hider' | 'seeker';
  startedAt: number;
  status: 'active' | 'completed';
}

const DATA_DIR = path.resolve(__dirname, '..', '..', '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'verified-leaderboard.json');

const TOTAL_LEVELS = 15;
const TOP_LIMIT = 100;

// Realistic minimum server-elapsed durations matching engine.ts (12s headstart + 180s match timer)
const MIN_SOLO_SEEKER_WIN_SEC = 15; // 12s mandatory headstart + realistic tagging
const MIN_SOLO_HIDER_WIN_SEC = 172; // 180s match survival with minor clock tolerance
const MAX_SESSION_AGE_SEC = 600; // 10 minutes max session validity
const SOLO_WIN_COOLDOWN_MS = 15_000;

const ALLOWED_AVATAR_PATTERN = /^[a-z0-9_-]{1,32}$/;

function sanitizeUsername(raw: unknown, fallback = 'Village Kid'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\r\n\t<>]/g, '').trim().slice(0, 20);
  return cleaned || fallback;
}

function sanitizeAvatarId(raw: unknown, fallback = 'raju'): string {
  if (typeof raw === 'string' && ALLOWED_AVATAR_PATTERN.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

function sanitizeLevelId(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > TOTAL_LEVELS) return null;
  return raw;
}

export function getDailyPeriodKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `daily_${year}-${month}-${day}`;
}

export function getWeeklyPeriodKey(date = new Date()): string {
  // ISO-8601 week in UTC (Monday starts new week)
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `weekly_${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getPeriodMetadata(period: LeaderboardPeriod): {
  period: LeaderboardPeriod;
  periodKey: string;
  resetLabel: string;
} {
  if (period === 'daily') {
    return {
      period,
      periodKey: getDailyPeriodKey(),
      resetLabel: 'Daily wins · Resets 00:00 UTC',
    };
  }
  if (period === 'weekly') {
    return {
      period,
      periodKey: getWeeklyPeriodKey(),
      resetLabel: 'Weekly wins · Resets Mon 00:00 UTC',
    };
  }
  return {
    period: 'all_time',
    periodKey: 'all_time',
    resetLabel: 'All-time verified match wins',
  };
}

class VerifiedLeaderboardStore {
  private data: PersistedLeaderboardFile = {
    version: 1,
    players: {},
    dailyBuckets: {},
    weeklyBuckets: {},
  };

  private activeSoloSessions = new Map<string, ActiveSoloSession>();
  private latestSessionByUid = new Map<string, string>();
  private lastSoloWinByUid = new Map<string, number>();
  private creditedOnlineMatchIds = new Set<string>();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedLeaderboardFile>;
      if (parsed && parsed.version === 1) {
        this.data = {
          version: 1,
          players:
            parsed.players && typeof parsed.players === 'object'
              ? parsed.players
              : {},
          dailyBuckets:
            parsed.dailyBuckets && typeof parsed.dailyBuckets === 'object'
              ? parsed.dailyBuckets
              : {},
          weeklyBuckets:
            parsed.weeklyBuckets && typeof parsed.weeklyBuckets === 'object'
              ? parsed.weeklyBuckets
              : {},
        };
      }
    } catch {
      // Keep clean in-memory state if file is missing or unreadable
    }
  }

  private persistToDisk(): void {
    try {
      this.pruneOldBuckets();
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch {
      // Avoid crashing gameplay if disk is temporarily read-only
    }
  }

  private pruneOldBuckets(): void {
    const dailyKeys = Object.keys(this.data.dailyBuckets).sort();
    while (dailyKeys.length > 14) {
      const oldest = dailyKeys.shift();
      if (oldest) delete this.data.dailyBuckets[oldest];
    }

    const weeklyKeys = Object.keys(this.data.weeklyBuckets).sort();
    while (weeklyKeys.length > 8) {
      const oldest = weeklyKeys.shift();
      if (oldest) delete this.data.weeklyBuckets[oldest];
    }
  }

  private creditVerifiedWinInternal(params: {
    uid: string;
    username: string;
    avatarId: string;
    levelId: number;
  }): StoredPlayerRecord {
    const now = Date.now();
    const cleanName = sanitizeUsername(params.username);
    const cleanAvatar = sanitizeAvatarId(params.avatarId);
    const levelId = Math.max(1, Math.min(TOTAL_LEVELS, params.levelId));

    const existing = this.data.players[params.uid];
    const completedSet = new Set<number>(existing?.completedLevels ?? []);
    completedSet.add(levelId);
    const completedLevels = Array.from(completedSet)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_LEVELS)
      .sort((a, b) => a - b);

    const record: StoredPlayerRecord = {
      uid: params.uid,
      username: cleanName,
      avatarId: cleanAvatar,
      allTimeWins: (existing?.allTimeWins ?? 0) + 1,
      completedLevels,
      updatedAt: now,
    };
    this.data.players[params.uid] = record;

    // Daily bucket
    const dailyKey = getDailyPeriodKey(new Date(now));
    if (!this.data.dailyBuckets[dailyKey]) {
      this.data.dailyBuckets[dailyKey] = { winsByUid: {} };
    }
    const prevDaily = this.data.dailyBuckets[dailyKey].winsByUid[params.uid];
    this.data.dailyBuckets[dailyKey].winsByUid[params.uid] = {
      wins: (prevDaily?.wins ?? 0) + 1,
      updatedAt: now,
    };

    // Weekly bucket
    const weeklyKey = getWeeklyPeriodKey(new Date(now));
    if (!this.data.weeklyBuckets[weeklyKey]) {
      this.data.weeklyBuckets[weeklyKey] = { winsByUid: {} };
    }
    const prevWeekly = this.data.weeklyBuckets[weeklyKey].winsByUid[params.uid];
    this.data.weeklyBuckets[weeklyKey].winsByUid[params.uid] = {
      wins: (prevWeekly?.wins ?? 0) + 1,
      updatedAt: now,
    };

    return record;
  }

  /**
   * Starts a single-use server-tracked solo match session for an authenticated player.
   */
  public startSoloMatchSession(params: {
    uid: string;
    username: unknown;
    avatarId: unknown;
    levelId: unknown;
    playerRole: unknown;
  }): { sessionId: string; startedAt: number } | { error: string } {
    const levelId = sanitizeLevelId(params.levelId);
    if (!levelId) {
      return { error: 'Invalid map level.' };
    }
    if (params.playerRole !== 'hider' && params.playerRole !== 'seeker') {
      return { error: 'Invalid player role.' };
    }

    // Invalidate previous active session for this player
    const prevId = this.latestSessionByUid.get(params.uid);
    if (prevId) {
      this.activeSoloSessions.delete(prevId);
    }

    // Prune expired sessions opportunistically
    const now = Date.now();
    if (this.activeSoloSessions.size > 500) {
      for (const [id, sess] of this.activeSoloSessions.entries()) {
        if ((now - sess.startedAt) / 1000 > MAX_SESSION_AGE_SEC) {
          this.activeSoloSessions.delete(id);
        }
      }
    }

    const sessionId = crypto.randomBytes(20).toString('hex');
    const session: ActiveSoloSession = {
      sessionId,
      uid: params.uid,
      username: sanitizeUsername(params.username),
      avatarId: sanitizeAvatarId(params.avatarId),
      levelId,
      playerRole: params.playerRole,
      startedAt: now,
      status: 'active',
    };
    this.activeSoloSessions.set(sessionId, session);
    this.latestSessionByUid.set(params.uid, sessionId);

    return { sessionId, startedAt: now };
  }

  /**
   * Verifies and finalizes a single-use solo match session. Clients can NEVER
   * submit win counts, scores, or arbitrary level completions.
   */
  public completeSoloMatchSession(params: {
    sessionId: unknown;
    uid: string;
    outcome: unknown;
    remainingHiders: unknown;
    caughtCount: unknown;
    username?: unknown;
    avatarId?: unknown;
  }): {
    verified: boolean;
    credited: boolean;
    reason?: string;
    allTimeWins?: number;
  } {
    if (typeof params.sessionId !== 'string' || !params.sessionId) {
      return { verified: false, credited: false, reason: 'Missing match session.' };
    }
    const session = this.activeSoloSessions.get(params.sessionId);
    if (!session || session.uid !== params.uid || session.status !== 'active') {
      return {
        verified: false,
        credited: false,
        reason: 'Match session is invalid or already finalized.',
      };
    }

    // Consume session immediately to prevent replay attacks
    session.status = 'completed';
    this.activeSoloSessions.delete(params.sessionId);
    if (this.latestSessionByUid.get(params.uid) === params.sessionId) {
      this.latestSessionByUid.delete(params.uid);
    }

    if (params.outcome !== 'win' && params.outcome !== 'loss') {
      return { verified: false, credited: false, reason: 'Invalid match outcome.' };
    }

    if (params.outcome === 'loss') {
      return { verified: true, credited: false };
    }

    const now = Date.now();
    const elapsedSec = (now - session.startedAt) / 1000;
    if (elapsedSec > MAX_SESSION_AGE_SEC) {
      return {
        verified: false,
        credited: false,
        reason: 'Match session expired.',
      };
    }

    const lastWinAt = this.lastSoloWinByUid.get(params.uid) ?? 0;
    if (now - lastWinAt < SOLO_WIN_COOLDOWN_MS) {
      return {
        verified: false,
        credited: false,
        reason: 'Match result rejected due to cooldown.',
      };
    }

    if (session.playerRole === 'seeker') {
      const remaining =
        typeof params.remainingHiders === 'number'
          ? params.remainingHiders
          : -1;
      const caught =
        typeof params.caughtCount === 'number' ? params.caughtCount : 0;
      if (
        elapsedSec < MIN_SOLO_SEEKER_WIN_SEC ||
        remaining !== 0 ||
        caught < 1
      ) {
        return {
          verified: false,
          credited: false,
          reason: 'Match duration did not meet verification checks.',
        };
      }
    } else {
      const remaining =
        typeof params.remainingHiders === 'number' ? params.remainingHiders : 0;
      if (elapsedSec < MIN_SOLO_HIDER_WIN_SEC || remaining < 1) {
        return {
          verified: false,
          credited: false,
          reason: 'Hider match survival duration did not meet verification checks.',
        };
      }
    }

    const updated = this.creditVerifiedWinInternal({
      uid: params.uid,
      username: sanitizeUsername(params.username, session.username),
      avatarId: sanitizeAvatarId(params.avatarId, session.avatarId),
      levelId: session.levelId,
    });
    this.lastSoloWinByUid.set(params.uid, now);
    this.persistToDisk();

    return {
      verified: true,
      credited: true,
      allTimeWins: updated.allTimeWins,
    };
  }

  /**
   * Authoritatively credits verified wins from a completed server-managed
   * online multiplayer match.
   */
  public recordVerifiedOnlineMatchWin(params: {
    matchId: string;
    levelId: number;
    winners: Array<{ uid: string; username: string; avatarId: string }>;
  }): boolean {
    if (!params.matchId || this.creditedOnlineMatchIds.has(params.matchId)) {
      return false;
    }
    if (params.winners.length === 0) return false;

    this.creditedOnlineMatchIds.add(params.matchId);
    if (this.creditedOnlineMatchIds.size > 2000) {
      const first = this.creditedOnlineMatchIds.values().next().value;
      if (first) this.creditedOnlineMatchIds.delete(first);
    }

    const seenUids = new Set<string>();
    for (const winner of params.winners) {
      if (!winner.uid || seenUids.has(winner.uid)) continue;
      seenUids.add(winner.uid);
      this.creditVerifiedWinInternal({
        uid: winner.uid,
        username: winner.username,
        avatarId: winner.avatarId,
        levelId: params.levelId,
      });
    }

    if (seenUids.size > 0) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  /**
   * Updates only display username and village avatar for an existing player.
   * Never creates wins or modifies scores.
   */
  public updatePlayerIdentity(
    uid: string,
    username: unknown,
    avatarId: unknown,
  ): void {
    const existing = this.data.players[uid];
    if (!existing) return;
    existing.username = sanitizeUsername(username, existing.username);
    existing.avatarId = sanitizeAvatarId(avatarId, existing.avatarId);
    this.persistToDisk();
  }

  /**
   * Removes a player's leaderboard records upon verified account deletion.
   */
  public removePlayer(uid: string): void {
    let changed = false;
    if (this.data.players[uid]) {
      delete this.data.players[uid];
      changed = true;
    }
    for (const bucket of Object.values(this.data.dailyBuckets)) {
      if (bucket.winsByUid[uid]) {
        delete bucket.winsByUid[uid];
        changed = true;
      }
    }
    for (const bucket of Object.values(this.data.weeklyBuckets)) {
      if (bucket.winsByUid[uid]) {
        delete bucket.winsByUid[uid];
        changed = true;
      }
    }
    if (changed) {
      this.persistToDisk();
    }
  }

  public getLeaderboardSnapshot(
    rawPeriod: LeaderboardPeriod,
    viewerUid?: string | null,
  ): LeaderboardResponsePayload {
    const meta = getPeriodMetadata(rawPeriod);
    const rankedList: Array<Omit<LeaderboardEntryRecord, 'rank'>> = [];

    if (meta.period === 'all_time') {
      for (const player of Object.values(this.data.players)) {
        if (player.allTimeWins <= 0) continue;
        rankedList.push({
          uid: player.uid,
          username: player.username,
          avatarId: player.avatarId,
          wins: player.allTimeWins,
          completedLevelsCount: player.completedLevels.length,
          completedLevels: player.completedLevels,
          updatedAt: player.updatedAt,
        });
      }
    } else {
      const bucket =
        meta.period === 'daily'
          ? this.data.dailyBuckets[meta.periodKey]
          : this.data.weeklyBuckets[meta.periodKey];

      if (bucket) {
        for (const [uid, score] of Object.entries(bucket.winsByUid)) {
          if (score.wins <= 0) continue;
          const player = this.data.players[uid];
          if (!player) continue;
          rankedList.push({
            uid,
            username: player.username,
            avatarId: player.avatarId,
            wins: score.wins,
            completedLevelsCount: player.completedLevels.length,
            completedLevels: player.completedLevels,
            updatedAt: score.updatedAt,
          });
        }
      }
    }

    rankedList.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.completedLevelsCount !== a.completedLevelsCount) {
        return b.completedLevelsCount - a.completedLevelsCount;
      }
      if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
      return a.uid.localeCompare(b.uid);
    });

    const entries: LeaderboardEntryRecord[] = rankedList
      .slice(0, TOP_LIMIT)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    let currentUser: LeaderboardResponsePayload['currentUser'] = null;
    if (viewerUid) {
      const rankIdx = rankedList.findIndex((item) => item.uid === viewerUid);
      if (rankIdx >= 0) {
        const entry = rankedList[rankIdx];
        currentUser = {
          uid: entry.uid,
          username: entry.username,
          avatarId: entry.avatarId,
          rank: rankIdx + 1,
          wins: entry.wins,
          completedLevelsCount: entry.completedLevelsCount,
          completedLevels: entry.completedLevels,
        };
      } else {
        const player = this.data.players[viewerUid];
        currentUser = {
          uid: viewerUid,
          username: player?.username ?? '',
          avatarId: player?.avatarId ?? 'raju',
          rank: null,
          wins: 0,
          completedLevelsCount: player?.completedLevels.length ?? 0,
          completedLevels: player?.completedLevels ?? [],
        };
      }
    }

    return {
      period: meta.period,
      periodKey: meta.periodKey,
      resetLabel: meta.resetLabel,
      totalPlayers: rankedList.length,
      entries,
      currentUser,
      serverTime: Date.now(),
    };
  }
}

export const verifiedLeaderboardStore = new VerifiedLeaderboardStore();

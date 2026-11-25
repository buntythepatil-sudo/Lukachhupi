import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  loadUnlockedLevel,
  saveUnlockedLevel,
  TOTAL_LEVELS,
} from './levels';
import { TeamRole } from './types';

// Constants synchronized verbatim with firebase-blueprint.json
export const PROFILE_USERNAME_MIN_LENGTH = 1;
export const PROFILE_USERNAME_MAX_LENGTH = 20;
export const PROFILE_AVATAR_ID_MAX_LENGTH = 32;
export const PROFILE_AVATAR_ID_PATTERN = /^[a-z0-9_-]+$/;
export const PROFILE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const MAX_STAT_VALUE = 1_000_000;

const PROFILE_STORAGE_KEY = 'gully_chhupan_chhupai_1995_player_profile_v1';
const PENDING_SYNC_DELTA_KEY = 'gully_chhupan_chhupai_1995_pending_delta_v1';

export interface PlayerStatsProfile {
  username: string;
  avatarId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  timesAsSeeker: number;
  successfulHidingRounds: number;
  currentWinStreak: number;
  bestWinStreak: number;
  unlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<string, number>;
  identityCustomized: boolean;
}

export interface PendingSyncDelta {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  timesAsSeeker: number;
  successfulHidingRounds: number;
  streakEvents: boolean[];
  unlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<string, number>;
}

export interface MatchResultSummary {
  matchId: number;
  levelId: number;
  playerRole: TeamRole;
  playerWon: boolean;
  playerCaught: boolean;
  timeRemaining: number;
  remainingHiders: number;
  totalHiders: number;
  caughtCount: number;
  isOnline: boolean;
}

export interface FirestorePlayerProfileDoc {
  uid: string;
  username: string;
  avatarId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  timesAsSeeker: number;
  successfulHidingRounds: number;
  currentWinStreak: number;
  bestWinStreak: number;
  unlockedLevel: number;
  completedLevels: number[];
  levelStars: Record<string, number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function clampUsername(raw: string, fallback = 'Raju'): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const clamped = cleaned.slice(0, PROFILE_USERNAME_MAX_LENGTH);
  return clamped.length >= PROFILE_USERNAME_MIN_LENGTH ? clamped : fallback;
}

export function sanitizeAvatarId(raw: unknown): string {
  if (
    typeof raw === 'string' &&
    raw.length >= 1 &&
    raw.length <= PROFILE_AVATAR_ID_MAX_LENGTH &&
    PROFILE_AVATAR_ID_PATTERN.test(raw)
  ) {
    return raw;
  }
  return 'raju';
}

function clampCount(val: unknown, max = MAX_STAT_VALUE): number {
  const n = typeof val === 'number' ? Math.floor(val) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function sanitizeCompletedLevels(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const entry of raw) {
    const num = typeof entry === 'number' ? Math.floor(entry) : NaN;
    if (Number.isFinite(num) && num >= 1 && num <= TOTAL_LEVELS) {
      unique.add(num);
    }
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function sanitizeLevelStars(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const key = String(lvl);
    const val = source[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      const clamped = Math.max(0, Math.min(3, Math.floor(val)));
      if (clamped >= 1) {
        out[key] = clamped;
      }
    }
  }
  return out;
}

export function sanitizePlayerProfile(
  raw: Partial<PlayerStatsProfile> | null | undefined,
): PlayerStatsProfile {
  const legacyUnlocked = loadUnlockedLevel();
  const matchesPlayed = clampCount(raw?.matchesPlayed);
  const matchesWon = clampCount(raw?.matchesWon, matchesPlayed);
  const matchesLost = clampCount(
    raw?.matchesLost,
    Math.max(0, matchesPlayed - matchesWon),
  );
  const timesAsSeeker = clampCount(raw?.timesAsSeeker, matchesPlayed);
  const successfulHidingRounds = clampCount(
    raw?.successfulHidingRounds,
    matchesPlayed,
  );
  const currentWinStreak = clampCount(raw?.currentWinStreak, matchesWon);
  const bestWinStreak = Math.max(
    currentWinStreak,
    clampCount(raw?.bestWinStreak, matchesWon),
  );
  const completedLevels = sanitizeCompletedLevels(raw?.completedLevels);
  const levelStars = sanitizeLevelStars(raw?.levelStars);

  // Ensure every level with stars is also included in completedLevels
  const completedSet = new Set(completedLevels);
  for (const k of Object.keys(levelStars)) {
    const lvlNum = parseInt(k, 10);
    if (lvlNum >= 1 && lvlNum <= TOTAL_LEVELS) {
      completedSet.add(lvlNum);
    }
  }
  const mergedCompleted = Array.from(completedSet).sort((a, b) => a - b);
  const highestCompleted =
    mergedCompleted.length > 0
      ? mergedCompleted[mergedCompleted.length - 1]
      : 0;
  const derivedUnlockFromCompleted = Math.min(
    TOTAL_LEVELS,
    Math.max(1, highestCompleted + 1),
  );
  const unlockedLevel = Math.max(
    1,
    Math.min(
      TOTAL_LEVELS,
      Math.max(
        legacyUnlocked,
        clampCount(raw?.unlockedLevel ?? 1, TOTAL_LEVELS),
        highestCompleted > 0 ? derivedUnlockFromCompleted : 1,
      ),
    ),
  );

  return {
    username: clampUsername(
      typeof raw?.username === 'string' ? raw.username : 'Raju',
    ),
    avatarId: sanitizeAvatarId(raw?.avatarId),
    matchesPlayed,
    matchesWon,
    matchesLost,
    timesAsSeeker,
    successfulHidingRounds,
    currentWinStreak,
    bestWinStreak,
    unlockedLevel,
    completedLevels: mergedCompleted,
    levelStars,
    identityCustomized: Boolean(raw?.identityCustomized),
  };
}

export function createDefaultPlayerProfile(): PlayerStatsProfile {
  return sanitizePlayerProfile({
    username: 'Raju',
    avatarId: 'raju',
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    timesAsSeeker: 0,
    successfulHidingRounds: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    unlockedLevel: loadUnlockedLevel(),
    completedLevels: [],
    levelStars: {},
    identityCustomized: false,
  });
}

export function loadLocalPlayerProfile(): PlayerStatsProfile {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultPlayerProfile();
    }
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return createDefaultPlayerProfile();
    }
    const parsed = JSON.parse(raw) as Partial<PlayerStatsProfile>;
    return sanitizePlayerProfile(parsed);
  } catch {
    return createDefaultPlayerProfile();
  }
}

export function saveLocalPlayerProfile(profile: PlayerStatsProfile): void {
  const sanitized = sanitizePlayerProfile(profile);
  saveUnlockedLevel(sanitized.unlockedLevel);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota errors
  }
}

export function createEmptySyncDelta(): PendingSyncDelta {
  return {
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    timesAsSeeker: 0,
    successfulHidingRounds: 0,
    streakEvents: [],
    unlockedLevel: 1,
    completedLevels: [],
    levelStars: {},
  };
}

export function loadPendingSyncDelta(): PendingSyncDelta {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptySyncDelta();
    }
    const raw = window.localStorage.getItem(PENDING_SYNC_DELTA_KEY);
    if (!raw) return createEmptySyncDelta();
    const parsed = JSON.parse(raw) as Partial<PendingSyncDelta>;
    const streakEvents = Array.isArray(parsed.streakEvents)
      ? parsed.streakEvents.filter((v): v is boolean => typeof v === 'boolean').slice(-200)
      : [];
    return {
      matchesPlayed: clampCount(parsed.matchesPlayed),
      matchesWon: clampCount(parsed.matchesWon),
      matchesLost: clampCount(parsed.matchesLost),
      timesAsSeeker: clampCount(parsed.timesAsSeeker),
      successfulHidingRounds: clampCount(parsed.successfulHidingRounds),
      streakEvents,
      unlockedLevel: Math.max(
        1,
        Math.min(TOTAL_LEVELS, clampCount(parsed.unlockedLevel ?? 1, TOTAL_LEVELS)),
      ),
      completedLevels: sanitizeCompletedLevels(parsed.completedLevels),
      levelStars: sanitizeLevelStars(parsed.levelStars),
    };
  } catch {
    return createEmptySyncDelta();
  }
}

export function savePendingSyncDelta(delta: PendingSyncDelta): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PENDING_SYNC_DELTA_KEY, JSON.stringify(delta));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPendingSyncDelta(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(PENDING_SYNC_DELTA_KEY);
  } catch {
    // Ignore storage quota errors
  }
}

export function computeEarnedStars(result: MatchResultSummary): number {
  if (!result.playerWon) return 0;

  if (result.playerRole === 'seeker') {
    if (result.timeRemaining >= 75) return 3;
    if (result.timeRemaining >= 35) return 2;
    return 1;
  }

  // Hider win: reward surviving personally & helping multiple hiders stay hidden
  if (!result.playerCaught) {
    const highTeamThreshold = Math.max(2, result.totalHiders - 1);
    if (result.remainingHiders >= highTeamThreshold) return 3;
    return 2;
  }

  return 1;
}

export function getTotalEarnedStars(profile: PlayerStatsProfile): number {
  let total = 0;
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    total += profile.levelStars[String(lvl)] ?? 0;
  }
  return total;
}

export function applyMatchOutcomeToProfile(
  current: PlayerStatsProfile,
  result: MatchResultSummary,
): {
  nextProfile: PlayerStatsProfile;
  earnedStars: number;
} {
  const earnedStars = computeEarnedStars(result);
  const nextPlayed = clampCount(current.matchesPlayed + 1);
  const nextWon = clampCount(
    current.matchesWon + (result.playerWon ? 1 : 0),
    nextPlayed,
  );
  const nextLost = clampCount(
    current.matchesLost + (result.playerWon ? 0 : 1),
    Math.max(0, nextPlayed - nextWon),
  );
  const nextAsSeeker = clampCount(
    current.timesAsSeeker + (result.playerRole === 'seeker' ? 1 : 0),
    nextPlayed,
  );
  const hidSuccessfully =
    result.playerRole === 'hider' &&
    result.playerWon &&
    !result.playerCaught;
  const nextSuccessfulHide = clampCount(
    current.successfulHidingRounds + (hidSuccessfully ? 1 : 0),
    nextPlayed,
  );
  const nextStreak = result.playerWon
    ? clampCount(current.currentWinStreak + 1, nextWon)
    : 0;
  const nextBestStreak = Math.max(current.bestWinStreak, nextStreak);

  const nextCompleted = new Set(current.completedLevels);
  const nextStars = { ...current.levelStars };
  let nextUnlocked = current.unlockedLevel;

  if (result.playerWon && result.levelId >= 1 && result.levelId <= TOTAL_LEVELS) {
    nextCompleted.add(result.levelId);
    const key = String(result.levelId);
    const prevStars = nextStars[key] ?? 0;
    if (earnedStars > prevStars) {
      nextStars[key] = earnedStars;
    }
    if (result.levelId === current.unlockedLevel && current.unlockedLevel < TOTAL_LEVELS) {
      nextUnlocked = result.levelId + 1;
    }
  }

  const nextProfile = sanitizePlayerProfile({
    ...current,
    matchesPlayed: nextPlayed,
    matchesWon: nextWon,
    matchesLost: nextLost,
    timesAsSeeker: nextAsSeeker,
    successfulHidingRounds: nextSuccessfulHide,
    currentWinStreak: nextStreak,
    bestWinStreak: nextBestStreak,
    unlockedLevel: nextUnlocked,
    completedLevels: Array.from(nextCompleted),
    levelStars: nextStars,
  });

  return { nextProfile, earnedStars };
}

export function appendMatchToSyncDelta(
  delta: PendingSyncDelta,
  result: MatchResultSummary,
  earnedStars: number,
  unlockedLevelAfter: number,
): PendingSyncDelta {
  const completed = new Set(delta.completedLevels);
  const stars = { ...delta.levelStars };
  if (result.playerWon && result.levelId >= 1 && result.levelId <= TOTAL_LEVELS) {
    completed.add(result.levelId);
    const key = String(result.levelId);
    stars[key] = Math.max(stars[key] ?? 0, earnedStars);
  }
  return {
    matchesPlayed: clampCount(delta.matchesPlayed + 1),
    matchesWon: clampCount(delta.matchesWon + (result.playerWon ? 1 : 0)),
    matchesLost: clampCount(delta.matchesLost + (result.playerWon ? 0 : 1)),
    timesAsSeeker: clampCount(
      delta.timesAsSeeker + (result.playerRole === 'seeker' ? 1 : 0),
    ),
    successfulHidingRounds: clampCount(
      delta.successfulHidingRounds +
        (result.playerRole === 'hider' && result.playerWon && !result.playerCaught
          ? 1
          : 0),
    ),
    streakEvents: [...delta.streakEvents.slice(-199), result.playerWon],
    unlockedLevel: Math.max(delta.unlockedLevel, unlockedLevelAfter),
    completedLevels: Array.from(completed).sort((a, b) => a - b),
    levelStars: stars,
  };
}

export function mergeCloudAndPendingDelta(
  cloud: PlayerStatsProfile,
  local: PlayerStatsProfile,
  delta: PendingSyncDelta,
): PlayerStatsProfile {
  const hasDelta = delta.matchesPlayed > 0;
  let currentStreak = cloud.currentWinStreak;
  let bestStreak = cloud.bestWinStreak;

  for (const won of delta.streakEvents) {
    currentStreak = won ? currentStreak + 1 : 0;
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
  }

  const completed = new Set<number>([
    ...cloud.completedLevels,
    ...delta.completedLevels,
    ...(cloud.matchesPlayed === 0 ? local.completedLevels : []),
  ]);

  const mergedStars: Record<string, number> = { ...cloud.levelStars };
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const key = String(lvl);
    const localContrib =
      cloud.matchesPlayed === 0 ? (local.levelStars[key] ?? 0) : 0;
    const best = Math.max(
      cloud.levelStars[key] ?? 0,
      delta.levelStars[key] ?? 0,
      localContrib,
    );
    if (best >= 1) {
      mergedStars[key] = best;
    }
  }

  const matchesPlayed = hasDelta
    ? cloud.matchesPlayed + delta.matchesPlayed
    : cloud.matchesPlayed;
  const matchesWon = hasDelta
    ? cloud.matchesWon + delta.matchesWon
    : cloud.matchesWon;
  const matchesLost = hasDelta
    ? cloud.matchesLost + delta.matchesLost
    : cloud.matchesLost;

  return sanitizePlayerProfile({
    username:
      local.identityCustomized && cloud.matchesPlayed === 0
        ? local.username
        : cloud.username,
    avatarId:
      local.identityCustomized && cloud.matchesPlayed === 0
        ? local.avatarId
        : cloud.avatarId,
    matchesPlayed,
    matchesWon,
    matchesLost,
    timesAsSeeker: hasDelta
      ? cloud.timesAsSeeker + delta.timesAsSeeker
      : cloud.timesAsSeeker,
    successfulHidingRounds: hasDelta
      ? cloud.successfulHidingRounds + delta.successfulHidingRounds
      : cloud.successfulHidingRounds,
    currentWinStreak: Math.min(currentStreak, matchesWon),
    bestWinStreak: Math.min(Math.max(bestStreak, currentStreak), matchesWon),
    unlockedLevel: Math.max(cloud.unlockedLevel, delta.unlockedLevel, local.unlockedLevel),
    completedLevels: Array.from(completed),
    levelStars: mergedStars,
    identityCustomized: true,
  });
}

function buildFirestorePayload(
  uid: string,
  profile: PlayerStatsProfile,
  includeCreatedAt: boolean,
  existingCreatedAt?: Timestamp,
) {
  const s = sanitizePlayerProfile(profile);
  if (!PROFILE_UID_PATTERN.test(uid) || uid.length > 128) {
    throw new Error('Invalid user UID for Firestore profile write.');
  }

  const cleanStars: Record<string, number> = {};
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const key = String(lvl);
    const val = s.levelStars[key];
    if (typeof val === 'number' && val >= 1 && val <= 3) {
      cleanStars[key] = Math.floor(val);
    }
  }

  return {
    uid,
    username: clampUsername(s.username),
    avatarId: sanitizeAvatarId(s.avatarId),
    matchesPlayed: s.matchesPlayed,
    matchesWon: s.matchesWon,
    matchesLost: s.matchesLost,
    timesAsSeeker: s.timesAsSeeker,
    successfulHidingRounds: s.successfulHidingRounds,
    currentWinStreak: s.currentWinStreak,
    bestWinStreak: s.bestWinStreak,
    unlockedLevel: s.unlockedLevel,
    completedLevels: s.completedLevels,
    levelStars: cleanStars,
    createdAt: includeCreatedAt
      ? serverTimestamp()
      : existingCreatedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export interface CloudProfileFetchResult {
  exists: boolean;
  profile: PlayerStatsProfile | null;
  createdAt?: Timestamp;
}

export async function fetchCloudProfile(
  uid: string,
): Promise<CloudProfileFetchResult> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      return { exists: false, profile: null };
    }
    const data = snap.data() as Partial<FirestorePlayerProfileDoc>;
    return {
      exists: true,
      profile: sanitizePlayerProfile({
        username: data.username,
        avatarId: data.avatarId,
        matchesPlayed: data.matchesPlayed,
        matchesWon: data.matchesWon,
        matchesLost: data.matchesLost,
        timesAsSeeker: data.timesAsSeeker,
        successfulHidingRounds: data.successfulHidingRounds,
        currentWinStreak: data.currentWinStreak,
        bestWinStreak: data.bestWinStreak,
        unlockedLevel: data.unlockedLevel,
        completedLevels: data.completedLevels,
        levelStars: data.levelStars,
        identityCustomized: true,
      }),
      createdAt: data.createdAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCloudProfile(
  uid: string,
  profile: PlayerStatsProfile,
  existingCreatedAt?: Timestamp,
): Promise<void> {
  const path = `users/${uid}`;
  const isCreate = !existingCreatedAt;
  const payload = buildFirestorePayload(
    uid,
    profile,
    isCreate,
    existingCreatedAt,
  );
  try {
    await setDoc(doc(db, 'users', uid), payload, { merge: !isCreate });
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      path,
    );
  }
}

export async function saveCloudProfileIdentity(
  uid: string,
  username: string,
  avatarId: string,
  existingCreatedAt?: Timestamp,
): Promise<void> {
  if (!PROFILE_UID_PATTERN.test(uid) || uid.length > 128) {
    throw new Error('Invalid user UID for Firestore profile identity update.');
  }
  const path = `users/${uid}`;
  const cleanName = clampUsername(username);
  const cleanAvatar = sanitizeAvatarId(avatarId);

  if (existingCreatedAt) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        username: cleanName,
        avatarId: cleanAvatar,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const initialZeroedPayload = {
    uid,
    username: cleanName,
    avatarId: cleanAvatar,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    timesAsSeeker: 0,
    successfulHidingRounds: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    unlockedLevel: 1,
    completedLevels: [],
    levelStars: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid), initialZeroedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToCloudProfile(
  uid: string,
  onProfileUpdate: (
    profile: PlayerStatsProfile,
    createdAt?: Timestamp,
  ) => void,
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Partial<FirestorePlayerProfileDoc>;
      const sanitized = sanitizePlayerProfile({
        username: data.username,
        avatarId: data.avatarId,
        matchesPlayed: data.matchesPlayed,
        matchesWon: data.matchesWon,
        matchesLost: data.matchesLost,
        timesAsSeeker: data.timesAsSeeker,
        successfulHidingRounds: data.successfulHidingRounds,
        currentWinStreak: data.currentWinStreak,
        bestWinStreak: data.bestWinStreak,
        unlockedLevel: data.unlockedLevel,
        completedLevels: data.completedLevels,
        levelStars: data.levelStars,
        identityCustomized: true,
      });
      onProfileUpdate(sanitized, data.createdAt);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

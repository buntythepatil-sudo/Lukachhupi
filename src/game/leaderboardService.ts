import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TeamRole } from './types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  username: string;
  avatarId: string;
  wins: number;
  completedLevelsCount: number;
  completedLevels: number[];
  updatedAt: number;
}

export interface CurrentUserRankSummary {
  uid: string;
  username: string;
  avatarId: string;
  rank: number | null;
  wins: number;
  completedLevelsCount: number;
  completedLevels: number[];
}

export interface LeaderboardSnapshot {
  period: LeaderboardPeriod;
  periodKey: string;
  resetLabel: string;
  totalPlayers: number;
  entries: LeaderboardEntry[];
  currentUser: CurrentUserRankSummary | null;
  serverTime: number;
}

async function getBearerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Proceed without token if refresh fails transiently
    }
  }
  return headers;
}

export async function getVerifiedAuthToken(): Promise<string | undefined> {
  const user = auth.currentUser;
  if (!user) return undefined;
  try {
    return await user.getIdToken();
  } catch {
    return undefined;
  }
}

async function fetchFirestoreLeaderboardEntries(
  periodKey: string,
): Promise<Array<Omit<LeaderboardEntry, 'rank'>>> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return [];

  try {
    const ref = collection(db, 'leaderboards', periodKey, 'entries');
    const q = query(ref, orderBy('wins', 'desc'), limit(100));
    const snap = await getDocs(q);
    const results: Array<Omit<LeaderboardEntry, 'rank'>> = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (typeof d.uid !== 'string' || typeof d.wins !== 'number' || d.wins <= 0) {
        return;
      }
      const levels = Array.isArray(d.completedLevels)
        ? d.completedLevels.filter(
            (n: unknown): n is number =>
              typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8,
          )
        : [];
      const updatedMs =
        d.updatedAt instanceof Timestamp
          ? d.updatedAt.toMillis()
          : typeof d.updatedAt === 'number'
            ? d.updatedAt
            : Date.now();
      results.push({
        uid: d.uid,
        username:
          typeof d.username === 'string' && d.username.trim()
            ? d.username.trim().slice(0, 20)
            : 'Village Kid',
        avatarId:
          typeof d.avatarId === 'string' && d.avatarId.trim()
            ? d.avatarId.trim()
            : 'raju',
        wins: Math.floor(d.wins),
        completedLevelsCount: levels.length,
        completedLevels: levels,
        updatedAt: updatedMs,
      });
    });

    return results;
  } catch {
    // Firestore leaderboard collection may be empty or rules-gated for unverified sessions
    return [];
  }
}

export async function fetchGlobalLeaderboard(
  period: LeaderboardPeriod,
): Promise<LeaderboardSnapshot> {
  const headers = await getBearerHeaders();
  const response = await fetch(
    `/api/leaderboard?period=${encodeURIComponent(period)}`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error('Could not load the global leaderboard right now.');
  }

  const serverData = (await response.json()) as LeaderboardSnapshot;

  // Merge any verified Firestore leaderboard entries if present without allowing duplicates
  const firestoreEntries = await fetchFirestoreLeaderboardEntries(
    serverData.periodKey,
  );
  if (firestoreEntries.length === 0) {
    return serverData;
  }

  const byUid = new Map<string, Omit<LeaderboardEntry, 'rank'>>();
  for (const entry of serverData.entries) {
    byUid.set(entry.uid, entry);
  }
  for (const fsEntry of firestoreEntries) {
    const existing = byUid.get(fsEntry.uid);
    if (!existing || fsEntry.wins > existing.wins) {
      byUid.set(fsEntry.uid, fsEntry);
    }
  }

  const merged = Array.from(byUid.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.completedLevelsCount !== a.completedLevelsCount) {
      return b.completedLevelsCount - a.completedLevelsCount;
    }
    if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
    return a.uid.localeCompare(b.uid);
  });

  const top100: LeaderboardEntry[] = merged.slice(0, 100).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  let currentUser = serverData.currentUser;
  const viewerUid = auth.currentUser?.uid;
  if (viewerUid) {
    const idx = merged.findIndex((item) => item.uid === viewerUid);
    if (idx >= 0) {
      const found = merged[idx];
      currentUser = {
        uid: found.uid,
        username: found.username,
        avatarId: found.avatarId,
        rank: idx + 1,
        wins: found.wins,
        completedLevelsCount: found.completedLevelsCount,
        completedLevels: found.completedLevels,
      };
    }
  }

  return {
    ...serverData,
    totalPlayers: Math.max(serverData.totalPlayers, merged.length),
    entries: top100,
    currentUser,
  };
}

export async function startVerifiedSoloMatch(params: {
  username: string;
  avatarId: string;
  levelId: number;
  playerRole: TeamRole;
}): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    const headers = await getBearerHeaders();
    if (!headers.Authorization) return null;
    const response = await fetch('/api/matches/start', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { sessionId?: unknown };
    return typeof data.sessionId === 'string' ? data.sessionId : null;
  } catch {
    return null;
  }
}

export async function completeVerifiedSoloMatch(params: {
  sessionId: string;
  outcome: 'win' | 'loss';
  remainingHiders: number;
  caughtCount: number;
  username: string;
  avatarId: string;
}): Promise<{ verified: boolean; credited: boolean }> {
  if (!auth.currentUser || !params.sessionId) {
    return { verified: false, credited: false };
  }
  try {
    const headers = await getBearerHeaders();
    if (!headers.Authorization) return { verified: false, credited: false };
    const response = await fetch('/api/matches/complete', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = (await response.json()) as {
      verified?: unknown;
      credited?: unknown;
    };
    return {
      verified: Boolean(data.verified),
      credited: Boolean(data.credited),
    };
  } catch {
    return { verified: false, credited: false };
  }
}

export async function syncLeaderboardIdentity(
  username: string,
  avatarId: string,
): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const headers = await getBearerHeaders();
    if (!headers.Authorization) return;
    await fetch('/api/leaderboard/identity', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, avatarId }),
    });
  } catch {
    // Non-blocking identity sync
  }
}

export async function removeLeaderboardAccountData(): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const headers = await getBearerHeaders();
    if (!headers.Authorization) return;
    await fetch('/api/leaderboard/me', {
      method: 'DELETE',
      headers,
    });
  } catch {
    // Non-blocking cleanup
  }
}

import {
  deleteUser,
  reauthenticateWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  clampUsername,
  clearPendingSyncDelta,
  PROFILE_UID_PATTERN,
} from './playerProfile';

export type FriendRequestPolicy = 'everyone' | 'nobody';
export type RoomInvitePolicy = 'friends' | 'nobody';

export type PlayerReportReason =
  | 'inappropriate_chat'
  | 'harassment'
  | 'spam'
  | 'cheating'
  | 'impersonation'
  | 'other';

export type PlayerReportSource =
  | 'privacy_settings'
  | 'multiplayer_room'
  | 'friends_list';

export const PLAYER_REPORT_REASONS: Array<{
  id: PlayerReportReason;
  label: string;
}> = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate_chat', label: 'Bad language / Inappropriate chat' },
  { id: 'spam', label: 'Spam requests or invites' },
  { id: 'cheating', label: 'Cheating or glitch abuse' },
  { id: 'impersonation', label: 'Fake or inappropriate username' },
  { id: 'other', label: 'Other safety issue' },
];

export const MAX_PLAYER_REPORT_DETAILS_LENGTH = 200;

export interface PrivacySafetySettings {
  friendRequestPolicy: FriendRequestPolicy;
  roomInvitePolicy: RoomInvitePolicy;
  appearOffline: boolean;
  hideProfileFromStrangers: boolean;
}

export interface PlayerReportRecord {
  id: string;
  reporterUid: string;
  targetUid: string;
  targetUsername: string;
  reason: PlayerReportReason;
  details: string;
  source: PlayerReportSource;
  createdAtMs: number;
}

const PRIVACY_STORAGE_KEY = 'gully_chhupan_chhupai_1995_privacy_settings_v1';

export function createDefaultPrivacySettings(): PrivacySafetySettings {
  return {
    friendRequestPolicy: 'everyone',
    roomInvitePolicy: 'friends',
    appearOffline: false,
    hideProfileFromStrangers: false,
  };
}

export function sanitizePrivacySettings(
  raw: Partial<PrivacySafetySettings> | null | undefined,
): PrivacySafetySettings {
  return {
    friendRequestPolicy:
      raw?.friendRequestPolicy === 'nobody' ? 'nobody' : 'everyone',
    roomInvitePolicy:
      raw?.roomInvitePolicy === 'nobody' ? 'nobody' : 'friends',
    appearOffline: Boolean(raw?.appearOffline),
    hideProfileFromStrangers: Boolean(raw?.hideProfileFromStrangers),
  };
}

export function loadLocalPrivacySettings(): PrivacySafetySettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultPrivacySettings();
    }
    const raw = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return createDefaultPrivacySettings();
    return sanitizePrivacySettings(
      JSON.parse(raw) as Partial<PrivacySafetySettings>,
    );
  } catch {
    return createDefaultPrivacySettings();
  }
}

export function saveLocalPrivacySettings(
  settings: PrivacySafetySettings,
): void {
  const clean = sanitizePrivacySettings(settings);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearLocalPrivacySettings(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function toMs(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return 0;
}

export async function fetchCloudPrivacySettings(
  uid: string,
): Promise<PrivacySafetySettings | null> {
  if (!PROFILE_UID_PATTERN.test(uid)) return null;
  const path = `users/${uid}/privacy/settings`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'privacy', 'settings'));
    if (!snap.exists()) return null;
    return sanitizePrivacySettings(
      snap.data() as Partial<PrivacySafetySettings>,
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCloudPrivacySettings(
  uid: string,
  settings: PrivacySafetySettings,
): Promise<void> {
  if (!PROFILE_UID_PATTERN.test(uid)) {
    throw new Error('Invalid user UID for privacy settings.');
  }
  const clean = sanitizePrivacySettings(settings);
  const path = `users/${uid}/privacy/settings`;
  const ref = doc(db, 'users', uid, 'privacy', 'settings');
  try {
    await setDoc(
      ref,
      {
        uid,
        friendRequestPolicy: clean.friendRequestPolicy,
        roomInvitePolicy: clean.roomInvitePolicy,
        appearOffline: clean.appearOffline,
        hideProfileFromStrangers: clean.hideProfileFromStrangers,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePrivacySettings(
  uid: string,
  onChange: (settings: PrivacySafetySettings) => void,
): Unsubscribe {
  const path = `users/${uid}/privacy/settings`;
  return onSnapshot(
    doc(db, 'users', uid, 'privacy', 'settings'),
    (snap) => {
      if (!snap.exists()) return;
      onChange(
        sanitizePrivacySettings(snap.data() as Partial<PrivacySafetySettings>),
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export async function submitPlayerReport(params: {
  reporterUid: string;
  reporterUsername: string;
  targetUid?: string;
  targetUsername: string;
  reason: PlayerReportReason;
  details: string;
  source: PlayerReportSource;
}): Promise<void> {
  const {
    reporterUid,
    reporterUsername,
    targetUid = '',
    targetUsername,
    reason,
    details,
    source,
  } = params;

  if (!PROFILE_UID_PATTERN.test(reporterUid)) {
    throw new Error('Invalid reporter UID.');
  }

  const cleanTargetUid =
    targetUid &&
    PROFILE_UID_PATTERN.test(targetUid) &&
    targetUid !== reporterUid
      ? targetUid.slice(0, 128)
      : '';
  const cleanTargetName = clampUsername(targetUsername, 'Player');
  const cleanDetails = details
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_PLAYER_REPORT_DETAILS_LENGTH);

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `playerReports/${reportId}`;

  try {
    await setDoc(doc(db, 'playerReports', reportId), {
      reporterUid,
      reporterUsername: clampUsername(reporterUsername),
      targetUid: cleanTargetUid,
      targetUsername: cleanTargetName,
      reason,
      details: cleanDetails,
      source,
      status: 'submitted',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeMySubmittedReports(
  myUid: string,
  onChange: (reports: PlayerReportRecord[]) => void,
): Unsubscribe {
  const path = 'playerReports';
  const q = query(collection(db, path), where('reporterUid', '==', myUid));
  return onSnapshot(
    q,
    (snap) => {
      const list: PlayerReportRecord[] = snap.docs.map((d) => {
        const data = d.data();
        const reason = PLAYER_REPORT_REASONS.some((r) => r.id === data.reason)
          ? (data.reason as PlayerReportReason)
          : 'other';
        const source: PlayerReportSource =
          data.source === 'multiplayer_room' || data.source === 'friends_list'
            ? data.source
            : 'privacy_settings';
        return {
          id: d.id,
          reporterUid: String(data.reporterUid ?? myUid),
          targetUid: typeof data.targetUid === 'string' ? data.targetUid : '',
          targetUsername: clampUsername(
            typeof data.targetUsername === 'string'
              ? data.targetUsername
              : 'Player',
          ),
          reason,
          details:
            typeof data.details === 'string'
              ? data.details.slice(0, MAX_PLAYER_REPORT_DETAILS_LENGTH)
              : '',
          source,
          createdAtMs: toMs(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(list.slice(0, 15));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

async function deleteSubcollectionDocs(
  uid: string,
  subcollection: 'friends' | 'blocked' | 'notifications',
): Promise<string[]> {
  const path = `users/${uid}/${subcollection}`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, subcollection));
    const ids: string[] = [];
    for (const d of snap.docs) {
      ids.push(d.id);
    }
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    if (!snap.empty) {
      await batch.commit();
    }
    return ids;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function deleteQueryMatches(
  collectionName: 'friendRequests' | 'roomInvites',
  fieldName: 'fromUid' | 'toUid',
  uid: string,
): Promise<void> {
  const path = collectionName;
  try {
    const q = query(collection(db, collectionName), where(fieldName, '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function deleteIfExists(pathSegments: [string, ...string[]]): Promise<void> {
  const joined = pathSegments.join('/');
  try {
    const [first, ...rest] = pathSegments;
    const ref = doc(db, first, ...rest);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, joined);
  }
}

export async function deleteUserAccountAndData(
  user: FirebaseUser,
): Promise<void> {
  const uid = user.uid;
  if (!PROFILE_UID_PATTERN.test(uid)) {
    throw new Error('Invalid account UID.');
  }

  // Ensure recent authentication BEFORE wiping Firestore data so deleteUser succeeds cleanly
  const lastSignInMs = user.metadata.lastSignInTime
    ? Date.parse(user.metadata.lastSignInTime)
    : 0;
  const ageMs = lastSignInMs > 0 ? Date.now() - lastSignInMs : Infinity;
  if (ageMs > 4 * 60_000) {
    await reauthenticateWithPopup(user, googleProvider);
  }

  // 1. Delete friends & reciprocal friend edges
  const friendIds = await deleteSubcollectionDocs(uid, 'friends');
  for (const friendUid of friendIds) {
    await deleteIfExists(['users', friendUid, 'friends', uid]).catch(() => {});
  }

  // 2. Delete blocked users list & private notifications
  await deleteSubcollectionDocs(uid, 'blocked');
  await deleteSubcollectionDocs(uid, 'notifications');

  // 3. Delete incoming/outgoing friend requests & room invites
  await deleteQueryMatches('friendRequests', 'fromUid', uid);
  await deleteQueryMatches('friendRequests', 'toUid', uid);
  await deleteQueryMatches('roomInvites', 'fromUid', uid);
  await deleteQueryMatches('roomInvites', 'toUid', uid);

  // 4. Delete privacy settings, presence status, directory entry, and user profile doc
  await deleteIfExists(['users', uid, 'privacy', 'settings']);
  await deleteIfExists(['users', uid, 'presence', 'status']);
  await deleteIfExists(['playerDirectory', uid]);
  await deleteIfExists(['users', uid]);

  // 5. Delete Firebase Auth account (reauthenticating once more if Firebase demands it)
  try {
    await deleteUser(user);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/requires-recent-login') {
      await reauthenticateWithPopup(user, googleProvider);
      await deleteUser(user);
    } else {
      throw err;
    }
  }

  // 6. Clear local queued cloud sync & privacy preferences
  clearPendingSyncDelta();
  clearLocalPrivacySettings();
}

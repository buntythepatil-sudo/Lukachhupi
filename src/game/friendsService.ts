import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TOTAL_LEVELS } from './levels';
import {
  clampUsername,
  PROFILE_AVATAR_ID_MAX_LENGTH,
  PROFILE_UID_PATTERN,
  sanitizeAvatarId,
} from './playerProfile';

import {
  createDefaultPrivacySettings,
  FriendRequestPolicy,
  PrivacySafetySettings,
  RoomInvitePolicy,
} from './privacyService';

export const ONLINE_HEARTBEAT_TTL_MS = 120_000;
export const DIRECTORY_SEARCH_LIMIT = 12;

export interface DirectoryPlayer {
  uid: string;
  username: string;
  usernameLower: string;
  avatarId: string;
  isOnline: boolean;
  friendRequestPolicy: FriendRequestPolicy;
  roomInvitePolicy: RoomInvitePolicy;
  hideProfileFromStrangers: boolean;
  lastSeenMs: number;
}

export interface FriendRecord {
  uid: string;
  username: string;
  avatarId: string;
  addedAtMs: number;
  isOnline: boolean;
  lastSeenMs: number;
  roomInvitePolicy: RoomInvitePolicy;
}

export interface BlockedRecord {
  uid: string;
  username: string;
  avatarId: string;
  blockedAtMs: number;
}

export interface FriendRequestRecord {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromAvatarId: string;
  toUid: string;
  toUsername: string;
  toAvatarId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtMs: number;
}

export interface RoomInviteRecord {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromAvatarId: string;
  toUid: string;
  roomCode: string;
  levelId: number;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAtMs: number;
  updatedAtMs: number;
}

function toMs(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return 0;
}

export function isPlayerCurrentlyOnline(
  isOnlineFlag: boolean,
  lastSeenMs: number,
  nowMs = Date.now(),
): boolean {
  if (!isOnlineFlag) return false;
  if (lastSeenMs <= 0) return true;
  return nowMs - lastSeenMs <= ONLINE_HEARTBEAT_TTL_MS;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function sanitizePublicDirectoryAvatar(raw: unknown): string {
  if (raw === 'private') return 'private';
  return sanitizeAvatarId(raw);
}

export async function upsertDirectoryPresence(
  uid: string,
  username: string,
  avatarId: string,
  isTabOnline: boolean,
  privacy: PrivacySafetySettings = createDefaultPrivacySettings(),
): Promise<void> {
  if (!PROFILE_UID_PATTERN.test(uid)) return;
  const cleanName = clampUsername(username);
  const cleanAvatar = sanitizeAvatarId(avatarId).slice(
    0,
    PROFILE_AVATAR_ID_MAX_LENGTH,
  );
  const friendVisibleOnline = privacy.appearOffline
    ? false
    : Boolean(isTabOnline);
  const publicVisibleOnline = privacy.hideProfileFromStrangers
    ? false
    : friendVisibleOnline;
  const publicAvatar = privacy.hideProfileFromStrangers
    ? 'private'
    : cleanAvatar;

  const dirPath = `playerDirectory/${uid}`;
  const presencePath = `users/${uid}/presence/status`;
  try {
    await setDoc(doc(db, 'playerDirectory', uid), {
      uid,
      username: cleanName,
      usernameLower: cleanName.toLowerCase(),
      avatarId: publicAvatar,
      isOnline: publicVisibleOnline,
      friendRequestPolicy: privacy.friendRequestPolicy,
      roomInvitePolicy: privacy.roomInvitePolicy,
      hideProfileFromStrangers: Boolean(privacy.hideProfileFromStrangers),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, dirPath);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'presence', 'status'), {
      uid,
      isOnline: friendVisibleOnline,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, presencePath);
  }
}

export async function searchPlayersByUsername(
  rawQuery: string,
  myUid: string,
): Promise<DirectoryPlayer[]> {
  const cleanLower = rawQuery.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 20);
  if (!cleanLower) return [];

  const path = 'playerDirectory';
  try {
    const q = query(
      collection(db, path),
      where('usernameLower', '>=', cleanLower),
      where('usernameLower', '<=', `${cleanLower}\uf8ff`),
      orderBy('usernameLower'),
      limit(DIRECTORY_SEARCH_LIMIT),
    );
    const snap = await getDocs(q);
    const now = Date.now();
    const results: DirectoryPlayer[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      const uid = typeof data.uid === 'string' ? data.uid : d.id;
      if (uid === myUid) continue;
      const lastSeenMs = toMs(data.lastSeenAt);
      const hideFromStrangers = Boolean(data.hideProfileFromStrangers);
      results.push({
        uid,
        username: clampUsername(
          typeof data.username === 'string' ? data.username : 'Player',
        ),
        usernameLower:
          typeof data.usernameLower === 'string' ? data.usernameLower : '',
        avatarId: hideFromStrangers
          ? 'private'
          : sanitizePublicDirectoryAvatar(data.avatarId),
        isOnline: hideFromStrangers
          ? false
          : isPlayerCurrentlyOnline(Boolean(data.isOnline), lastSeenMs, now),
        friendRequestPolicy:
          data.friendRequestPolicy === 'nobody' ? 'nobody' : 'everyone',
        roomInvitePolicy:
          data.roomInvitePolicy === 'nobody' ? 'nobody' : 'friends',
        hideProfileFromStrangers: hideFromStrangers,
        lastSeenMs,
      });
    }
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeFriendsWithPresence(
  myUid: string,
  onChange: (friends: FriendRecord[]) => void,
): Unsubscribe {
  const path = `users/${myUid}/friends`;
  const dirUnsubs = new Map<string, Unsubscribe>();
  const presenceUnsubs = new Map<string, Unsubscribe>();
  const hasDedicatedPresence = new Set<string>();
  const baseFriends = new Map<string, FriendRecord>();

  const emitSorted = () => {
    const now = Date.now();
    const list = Array.from(baseFriends.values()).map((f) => ({
      ...f,
      isOnline: isPlayerCurrentlyOnline(f.isOnline, f.lastSeenMs, now),
    }));
    list.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
    onChange(list);
  };

  const friendsUnsub = onSnapshot(
    collection(db, 'users', myUid, 'friends'),
    (snap) => {
      const currentIds = new Set<string>();

      for (const d of snap.docs) {
        const data = d.data();
        const fUid = typeof data.uid === 'string' ? data.uid : d.id;
        currentIds.add(fUid);

        const existing = baseFriends.get(fUid);
        baseFriends.set(fUid, {
          uid: fUid,
          username:
            existing?.username ?? clampUsername(String(data.username ?? 'Friend')),
          avatarId: existing?.avatarId ?? sanitizeAvatarId(data.avatarId),
          addedAtMs: toMs(data.addedAt),
          isOnline: existing?.isOnline ?? false,
          lastSeenMs: existing?.lastSeenMs ?? 0,
          roomInvitePolicy: existing?.roomInvitePolicy ?? 'friends',
        });

        if (!dirUnsubs.has(fUid)) {
          const dirPath = `playerDirectory/${fUid}`;
          const unsubDir = onSnapshot(
            doc(db, 'playerDirectory', fUid),
            (dirSnap) => {
              const cur = baseFriends.get(fUid);
              if (!cur || !dirSnap.exists()) return;
              const dd = dirSnap.data();
              const lastSeenMs = toMs(dd.lastSeenAt);
              const useDirPresence =
                !hasDedicatedPresence.has(fUid) && !dd.hideProfileFromStrangers;
              baseFriends.set(fUid, {
                ...cur,
                username: clampUsername(
                  typeof dd.username === 'string' ? dd.username : cur.username,
                ),
                avatarId:
                  dd.hideProfileFromStrangers || dd.avatarId === 'private'
                    ? cur.avatarId
                    : sanitizeAvatarId(dd.avatarId ?? cur.avatarId),
                roomInvitePolicy:
                  dd.roomInvitePolicy === 'nobody' ? 'nobody' : 'friends',
                isOnline: useDirPresence
                  ? isPlayerCurrentlyOnline(Boolean(dd.isOnline), lastSeenMs)
                  : cur.isOnline,
                lastSeenMs: useDirPresence ? lastSeenMs : cur.lastSeenMs,
              });
              emitSorted();
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, dirPath);
            },
          );
          dirUnsubs.set(fUid, unsubDir);
        }

        if (!presenceUnsubs.has(fUid)) {
          const presPath = `users/${fUid}/presence/status`;
          const unsubPres = onSnapshot(
            doc(db, 'users', fUid, 'presence', 'status'),
            (presSnap) => {
              const cur = baseFriends.get(fUid);
              if (!cur || !presSnap.exists()) return;
              hasDedicatedPresence.add(fUid);
              const pd = presSnap.data();
              const lastSeenMs = toMs(pd.lastSeenAt);
              baseFriends.set(fUid, {
                ...cur,
                isOnline: isPlayerCurrentlyOnline(Boolean(pd.isOnline), lastSeenMs),
                lastSeenMs,
              });
              emitSorted();
            },
            (err) => {
              handleFirestoreError(err, OperationType.GET, presPath);
            },
          );
          presenceUnsubs.set(fUid, unsubPres);
        }
      }

      // Clean up removed friends
      for (const [fUid, unsub] of dirUnsubs.entries()) {
        if (!currentIds.has(fUid)) {
          unsub();
          dirUnsubs.delete(fUid);
          presenceUnsubs.get(fUid)?.();
          presenceUnsubs.delete(fUid);
          hasDedicatedPresence.delete(fUid);
          baseFriends.delete(fUid);
        }
      }

      emitSorted();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );

  return () => {
    friendsUnsub();
    for (const unsub of dirUnsubs.values()) {
      unsub();
    }
    for (const unsub of presenceUnsubs.values()) {
      unsub();
    }
    dirUnsubs.clear();
    presenceUnsubs.clear();
    hasDedicatedPresence.clear();
  };
}

export function subscribeBlockedUsers(
  myUid: string,
  onChange: (blocked: BlockedRecord[]) => void,
): Unsubscribe {
  const path = `users/${myUid}/blocked`;
  return onSnapshot(
    collection(db, 'users', myUid, 'blocked'),
    (snap) => {
      const list: BlockedRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: typeof data.uid === 'string' ? data.uid : d.id,
          username: clampUsername(String(data.username ?? 'Player')),
          avatarId: sanitizeAvatarId(data.avatarId),
          blockedAtMs: toMs(data.blockedAt),
        };
      });
      list.sort((a, b) => b.blockedAtMs - a.blockedAtMs);
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeIncomingFriendRequests(
  myUid: string,
  onChange: (requests: FriendRequestRecord[]) => void,
): Unsubscribe {
  const path = 'friendRequests';
  const q = query(collection(db, path), where('toUid', '==', myUid));
  return onSnapshot(
    q,
    (snap) => {
      const list: FriendRequestRecord[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status !== 'pending') continue;
        list.push({
          id: d.id,
          fromUid: String(data.fromUid ?? ''),
          fromUsername: clampUsername(String(data.fromUsername ?? 'Player')),
          fromAvatarId: sanitizeAvatarId(data.fromAvatarId),
          toUid: String(data.toUid ?? myUid),
          toUsername: clampUsername(String(data.toUsername ?? 'You')),
          toAvatarId: sanitizeAvatarId(data.toAvatarId),
          status: 'pending',
          createdAtMs: toMs(data.createdAt),
        });
      }
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeOutgoingFriendRequests(
  myUid: string,
  onChange: (requests: FriendRequestRecord[]) => void,
): Unsubscribe {
  const path = 'friendRequests';
  const q = query(collection(db, path), where('fromUid', '==', myUid));
  return onSnapshot(
    q,
    (snap) => {
      const list: FriendRequestRecord[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status !== 'pending') continue;
        list.push({
          id: d.id,
          fromUid: String(data.fromUid ?? myUid),
          fromUsername: clampUsername(String(data.fromUsername ?? 'You')),
          fromAvatarId: sanitizeAvatarId(data.fromAvatarId),
          toUid: String(data.toUid ?? ''),
          toUsername: clampUsername(String(data.toUsername ?? 'Player')),
          toAvatarId: sanitizeAvatarId(data.toAvatarId),
          status: 'pending',
          createdAtMs: toMs(data.createdAt),
        });
      }
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeIncomingRoomInvites(
  myUid: string,
  onChange: (invites: RoomInviteRecord[]) => void,
): Unsubscribe {
  const path = 'roomInvites';
  const q = query(collection(db, path), where('toUid', '==', myUid));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const list: RoomInviteRecord[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.status !== 'pending') continue;
        const updatedAtMs = toMs(data.updatedAt) || toMs(data.createdAt);
        // Hide stale room invites older than 15 minutes
        if (updatedAtMs > 0 && now - updatedAtMs > 15 * 60_000) continue;
        list.push({
          id: d.id,
          fromUid: String(data.fromUid ?? ''),
          fromUsername: clampUsername(String(data.fromUsername ?? 'Friend')),
          fromAvatarId: sanitizeAvatarId(data.fromAvatarId),
          toUid: String(data.toUid ?? myUid),
          roomCode: normalizeRoomCode(String(data.roomCode ?? '')),
          levelId: Math.max(
            1,
            Math.min(TOTAL_LEVELS, Number(data.levelId ?? 1) || 1),
          ),
          status: 'pending',
          createdAtMs: toMs(data.createdAt),
          updatedAtMs,
        });
      }
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function sendFriendRequest(
  myUid: string,
  myUsername: string,
  myAvatarId: string,
  target: { uid: string; username: string; avatarId: string },
): Promise<void> {
  if (myUid === target.uid) {
    throw new Error('You cannot send a friend request to yourself.');
  }
  const requestId = `${myUid}__${target.uid}`;
  const path = `friendRequests/${requestId}`;
  const reqRef = doc(db, 'friendRequests', requestId);

  try {
    // Clear any stale accepted/declined request document before creating a fresh request
    const existingSnap = await getDoc(reqRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (existingData.status === 'pending') {
        return;
      }
      await deleteDoc(reqRef);
    }

    await setDoc(reqRef, {
      fromUid: myUid,
      fromUsername: clampUsername(myUsername),
      fromAvatarId: sanitizeAvatarId(myAvatarId),
      toUid: target.uid,
      toUsername: clampUsername(target.username),
      toAvatarId: target.avatarId === 'private' ? 'private' : sanitizeAvatarId(target.avatarId),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Missing or insufficient permissions')) {
      throw new Error(
        'Cannot send request (player may have disabled or blocked friend requests).',
      );
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cancelFriendRequest(
  myUid: string,
  targetUid: string,
): Promise<void> {
  const requestId = `${myUid}__${targetUid}`;
  const path = `friendRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function acceptFriendRequest(
  req: FriendRequestRecord,
  myUsername: string,
  myAvatarId: string,
): Promise<void> {
  const requestId = `${req.fromUid}__${req.toUid}`;
  const path = `friendRequests/${requestId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'friendRequests', requestId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', req.toUid, 'friends', req.fromUid), {
      uid: req.fromUid,
      username: clampUsername(req.fromUsername),
      avatarId: sanitizeAvatarId(req.fromAvatarId),
      addedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', req.fromUid, 'friends', req.toUid), {
      uid: req.toUid,
      username: clampUsername(myUsername),
      avatarId: sanitizeAvatarId(myAvatarId),
      addedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function declineFriendRequest(
  req: FriendRequestRecord,
): Promise<void> {
  const requestId = `${req.fromUid}__${req.toUid}`;
  const path = `friendRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function deleteDocIfExistsInBatch(
  batch: ReturnType<typeof writeBatch>,
  collectionName: string,
  docId: string,
): Promise<void> {
  try {
    const ref = doc(db, collectionName, docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      batch.delete(ref);
    }
  } catch {
    // Ignore permission errors if doc does not exist
  }
}

export async function removeFriend(
  myUid: string,
  friendUid: string,
): Promise<void> {
  const path = `users/${myUid}/friends/${friendUid}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', myUid, 'friends', friendUid));
    batch.delete(doc(db, 'users', friendUid, 'friends', myUid));
    await deleteDocIfExistsInBatch(batch, 'friendRequests', `${myUid}__${friendUid}`);
    await deleteDocIfExistsInBatch(batch, 'friendRequests', `${friendUid}__${myUid}`);
    await deleteDocIfExistsInBatch(batch, 'roomInvites', `${myUid}__${friendUid}`);
    await deleteDocIfExistsInBatch(batch, 'roomInvites', `${friendUid}__${myUid}`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function blockPlayer(
  myUid: string,
  target: { uid: string; username: string; avatarId: string },
): Promise<void> {
  const path = `users/${myUid}/blocked/${target.uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', myUid, 'blocked', target.uid), {
      uid: target.uid,
      username: clampUsername(target.username),
      avatarId: sanitizeAvatarId(target.avatarId),
      blockedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'users', myUid, 'friends', target.uid));
    batch.delete(doc(db, 'users', target.uid, 'friends', myUid));
    await deleteDocIfExistsInBatch(batch, 'friendRequests', `${myUid}__${target.uid}`);
    await deleteDocIfExistsInBatch(batch, 'friendRequests', `${target.uid}__${myUid}`);
    await deleteDocIfExistsInBatch(batch, 'roomInvites', `${myUid}__${target.uid}`);
    await deleteDocIfExistsInBatch(batch, 'roomInvites', `${target.uid}__${myUid}`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function unblockPlayer(
  myUid: string,
  targetUid: string,
): Promise<void> {
  const path = `users/${myUid}/blocked/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users', myUid, 'blocked', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendRoomInviteToFriend(
  myUid: string,
  myUsername: string,
  myAvatarId: string,
  friendUid: string,
  roomCode: string,
  levelId: number,
): Promise<void> {
  const cleanCode = normalizeRoomCode(roomCode);
  if (cleanCode.length < 4) {
    throw new Error('Invalid multiplayer room code.');
  }
  const cleanLevel = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(levelId)));
  const inviteId = `${myUid}__${friendUid}`;
  const path = `roomInvites/${inviteId}`;
  const ref = doc(db, 'roomInvites', inviteId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        fromUsername: clampUsername(myUsername),
        fromAvatarId: sanitizeAvatarId(myAvatarId),
        roomCode: cleanCode,
        levelId: cleanLevel,
        status: 'pending',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        fromUid: myUid,
        fromUsername: clampUsername(myUsername),
        fromAvatarId: sanitizeAvatarId(myAvatarId),
        toUid: friendUid,
        roomCode: cleanCode,
        levelId: cleanLevel,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Missing or insufficient permissions')) {
      throw new Error(
        'Cannot send room invite (player may have turned off invites or blocked you).',
      );
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function respondToRoomInvite(
  inviteId: string,
  status: 'accepted' | 'dismissed',
): Promise<void> {
  const path = `roomInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'roomInvites', inviteId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

const firebaseConfig = JSON.parse(
  readFileSync(new URL('./firebase-applet-config.json', import.meta.url), 'utf8'),
) as { projectId: string };

const PROJECT_ID = firebaseConfig.projectId || 'woven-advantage-blcf1';

const PLAYER_A_UID = 'playerA';
const PLAYER_B_UID = 'playerB';
const PLAYER_C_UID = 'playerC';
const UNVERIFIED_UID = 'unverifiedPlayer';

let testEnv: RulesTestEnvironment;
let ctxA: RulesTestContext;
let ctxB: RulesTestContext;
let ctxC: RulesTestContext;
let ctxUnverified: RulesTestContext;
let ctxUnauth: RulesTestContext;

function dbA() {
  return ctxA.firestore();
}
function dbB() {
  return ctxB.firestore();
}
function dbC() {
  return ctxC.firestore();
}
function dbUnverified() {
  return ctxUnverified.firestore();
}
function dbUnauth() {
  return ctxUnauth.firestore();
}

function buildInitialProfile(uid: string, username: string, avatarId = 'raju') {
  return {
    uid,
    username,
    avatarId,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    timesAsSeeker: 0,
    successfulHidingRounds: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    unlockedLevel: 1,
    completedLevels: [] as number[],
    levelStars: {} as Record<string, number>,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildDirectoryDoc(
  uid: string,
  username: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    uid,
    username,
    usernameLower: username.toLowerCase(),
    avatarId: 'raju',
    isOnline: true,
    friendRequestPolicy: 'everyone',
    roomInvitePolicy: 'friends',
    hideProfileFromStrangers: false,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function buildPrivacyDoc(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    friendRequestPolicy: 'everyone',
    roomInvitePolicy: 'friends',
    appearOffline: false,
    hideProfileFromStrangers: false,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function buildPresenceDoc(uid: string, isOnline = true) {
  return {
    uid,
    isOnline,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function seedUserDirectoryAndProfile(
  uid: string,
  username: string,
  avatarId = 'raju',
  dirOverrides: Record<string, unknown> = {},
) {
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    const adminDb = adminCtx.firestore();
    await adminDb.doc(`users/${uid}`).set(buildInitialProfile(uid, username, avatarId));
    await adminDb
      .doc(`playerDirectory/${uid}`)
      .set(buildDirectoryDoc(uid, username, { avatarId, ...dirOverrides }));
    await adminDb.doc(`users/${uid}/privacy/settings`).set(buildPrivacyDoc(uid));
    await adminDb.doc(`users/${uid}/presence/status`).set(buildPresenceDoc(uid, true));
  });
}

async function seedFriendship(
  uid1: string,
  name1: string,
  uid2: string,
  name2: string,
) {
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    const adminDb = adminCtx.firestore();
    await adminDb.doc(`users/${uid1}/friends/${uid2}`).set({
      uid: uid2,
      username: name2,
      avatarId: 'meena',
      addedAt: serverTimestamp(),
    });
    await adminDb.doc(`users/${uid2}/friends/${uid1}`).set({
      uid: uid1,
      username: name1,
      avatarId: 'raju',
      addedAt: serverTimestamp(),
    });
  });
}

beforeAll(async () => {
  firebase.firestore.setLogLevel('silent');
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = emulatorHost.split(':');
  const port = Number(portStr) || 8080;

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
      host,
      port,
    },
  });

  // Requirement 1: Create test users Player A, Player B, and Player C (+ unverified & unauth)
  ctxA = testEnv.authenticatedContext(PLAYER_A_UID, {
    email: 'playera@village1995.test',
    email_verified: true,
    name: 'PlayerA',
  });
  ctxB = testEnv.authenticatedContext(PLAYER_B_UID, {
    email: 'playerb@village1995.test',
    email_verified: true,
    name: 'PlayerB',
  });
  ctxC = testEnv.authenticatedContext(PLAYER_C_UID, {
    email: 'playerc@village1995.test',
    email_verified: true,
    name: 'PlayerC',
  });
  ctxUnverified = testEnv.authenticatedContext(UNVERIFIED_UID, {
    email: 'unverified@village1995.test',
    email_verified: false,
    name: 'Unverified',
  });
  ctxUnauth = testEnv.unauthenticatedContext();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('1. Multi-user test context creation (Player A, Player B, Player C)', () => {
  it('initializes isolated authenticated contexts for Player A, Player B, and Player C', async () => {
    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}`).set(buildInitialProfile(PLAYER_A_UID, 'AaravA', 'raju')),
    );
    await assertSucceeds(
      dbB().doc(`users/${PLAYER_B_UID}`).set(buildInitialProfile(PLAYER_B_UID, 'BhavnaB', 'meena')),
    );
    await assertSucceeds(
      dbC().doc(`users/${PLAYER_C_UID}`).set(buildInitialProfile(PLAYER_C_UID, 'ChetanC', 'chintu')),
    );

    const snapA = await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}`).get());
    const snapB = await assertSucceeds(dbB().doc(`users/${PLAYER_B_UID}`).get());
    const snapC = await assertSucceeds(dbC().doc(`users/${PLAYER_C_UID}`).get());

    expect(snapA.data()?.username).toBe('AaravA');
    expect(snapB.data()?.username).toBe('BhavnaB');
    expect(snapC.data()?.username).toBe('ChetanC');
  });
});

describe('2. Profile read & update authorization', () => {
  it('allows owner Player A to read own profile and update only username and avatarId', async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');

    const ownSnap = await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}`).get());
    expect(ownSnap.exists).toBe(true);

    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        username: 'VillageHeroA',
        avatarId: 'bhola',
        updatedAt: serverTimestamp(),
      }),
    );

    const updatedSnap = await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}`).get());
    expect(updatedSnap.data()?.username).toBe('VillageHeroA');
    expect(updatedSnap.data()?.avatarId).toBe('bhola');
  });

  it('denies cross-user profile reads, collection listing, and cross-user profile updates', async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');

    await assertFails(dbA().doc(`users/${PLAYER_B_UID}`).get());
    await assertFails(dbA().collection('users').limit(5).get());
    await assertFails(
      dbA().doc(`users/${PLAYER_B_UID}`).update({
        username: 'HackedB',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(dbUnauth().doc(`users/${PLAYER_A_UID}`).get());
  });

  it('denies shadow fields, immutable uid/createdAt changes, and unverified profile writes', async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');

    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        username: 'PlayerA2',
        isAdmin: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        uid: PLAYER_B_UID,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      dbUnverified()
        .doc(`users/${UNVERIFIED_UID}`)
        .set(buildInitialProfile(UNVERIFIED_UID, 'Unverified', 'raju')),
    );
  });

  it('restricts privacy settings to owner and live presence status to owner or confirmed friends', async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
    await seedFriendship(PLAYER_A_UID, 'PlayerA', PLAYER_B_UID, 'PlayerB');

    // Privacy settings: owner-only
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/privacy/settings`).get());
    await assertFails(dbB().doc(`users/${PLAYER_A_UID}/privacy/settings`).get());
    await assertFails(
      dbC().doc(`users/${PLAYER_A_UID}/privacy/settings`).update({
        appearOffline: true,
        updatedAt: serverTimestamp(),
      }),
    );

    // Presence: confirmed friend B allowed, stranger C denied
    await assertSucceeds(dbB().doc(`users/${PLAYER_A_UID}/presence/status`).get());
    await assertFails(dbC().doc(`users/${PLAYER_A_UID}/presence/status`).get());
  });
});

describe('3. Progression tamper protection (wins, stars, unlocked levels)', () => {
  it('denies creating a profile with forged non-zero wins, stars, or unlocked levels', async () => {
    await assertFails(
      dbA()
        .doc(`users/${PLAYER_A_UID}`)
        .set({
          ...buildInitialProfile(PLAYER_A_UID, 'PlayerA', 'raju'),
          matchesPlayed: 10,
          matchesWon: 10,
          unlockedLevel: 8,
          completedLevels: [1, 2, 3],
          levelStars: { '1': 3, '2': 3 },
        }),
    );
  });

  it('denies Player A modifying their own wins, matchesPlayed, win streaks, stars, or unlockedLevel', async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');

    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        matchesPlayed: 1,
        matchesWon: 1,
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        levelStars: { '1': 3 },
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        unlockedLevel: 8,
        completedLevels: [1, 2, 3, 4, 5, 6, 7],
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        currentWinStreak: 5,
        bestWinStreak: 5,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows reading server-seeded stats while keeping wins, stars, and unlockedLevel immutable to client updates', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().doc(`users/${PLAYER_A_UID}`).set({
        ...buildInitialProfile(PLAYER_A_UID, 'PlayerA', 'raju'),
        matchesPlayed: 4,
        matchesWon: 3,
        matchesLost: 1,
        timesAsSeeker: 2,
        successfulHidingRounds: 2,
        currentWinStreak: 2,
        bestWinStreak: 2,
        unlockedLevel: 3,
        completedLevels: [1, 2],
        levelStars: { '1': 3, '2': 2 },
      });
    });

    const snap = await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}`).get());
    expect(snap.data()?.matchesWon).toBe(3);
    expect(snap.data()?.unlockedLevel).toBe(3);
    expect(snap.data()?.levelStars).toEqual({ '1': 3, '2': 2 });

    // Authorized identity edit succeeds
    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        username: 'RenamedA',
        updatedAt: serverTimestamp(),
      }),
    );

    // Tampering with existing wins/stars fails
    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        matchesWon: 4,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}`).update({
        levelStars: { '1': 3, '2': 3 },
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('4. Friend request creation, acceptance, rejection, and unauthorized modification', () => {
  beforeEach(async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
  });

  it('allows Player A to send a friend request and Player B to accept atomically with reciprocal friend edges', async () => {
    const reqId = `${PLAYER_A_UID}__${PLAYER_B_UID}`;
    await assertSucceeds(
      dbA().doc(`friendRequests/${reqId}`).set({
        fromUid: PLAYER_A_UID,
        fromUsername: 'PlayerA',
        fromAvatarId: 'raju',
        toUid: PLAYER_B_UID,
        toUsername: 'PlayerB',
        toAvatarId: 'meena',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    const batch = dbB().batch();
    batch.update(dbB().doc(`friendRequests/${reqId}`), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
    batch.set(dbB().doc(`users/${PLAYER_B_UID}/friends/${PLAYER_A_UID}`), {
      uid: PLAYER_A_UID,
      username: 'PlayerA',
      avatarId: 'raju',
      addedAt: serverTimestamp(),
    });
    batch.set(dbB().doc(`users/${PLAYER_A_UID}/friends/${PLAYER_B_UID}`), {
      uid: PLAYER_B_UID,
      username: 'PlayerB',
      avatarId: 'meena',
      addedAt: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());

    const friendA = await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}/friends/${PLAYER_B_UID}`).get(),
    );
    const friendB = await assertSucceeds(
      dbB().doc(`users/${PLAYER_B_UID}/friends/${PLAYER_A_UID}`).get(),
    );
    expect(friendA.exists).toBe(true);
    expect(friendB.exists).toBe(true);
  });

  it('allows recipient rejection (decline or delete) and sender cancellation', async () => {
    const reqIdCA = `${PLAYER_C_UID}__${PLAYER_A_UID}`;
    await assertSucceeds(
      dbC().doc(`friendRequests/${reqIdCA}`).set({
        fromUid: PLAYER_C_UID,
        fromUsername: 'PlayerC',
        fromAvatarId: 'chintu',
        toUid: PLAYER_A_UID,
        toUsername: 'PlayerA',
        toAvatarId: 'raju',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Recipient declines
    await assertSucceeds(
      dbA().doc(`friendRequests/${reqIdCA}`).update({
        status: 'declined',
        updatedAt: serverTimestamp(),
      }),
    );

    // Once declined (terminal state), cannot revert back to pending or accepted
    await assertFails(
      dbA().doc(`friendRequests/${reqIdCA}`).update({
        status: 'pending',
        updatedAt: serverTimestamp(),
      }),
    );

    // Sender cancels a fresh pending request via delete
    const reqIdBC = `${PLAYER_B_UID}__${PLAYER_C_UID}`;
    await assertSucceeds(
      dbB().doc(`friendRequests/${reqIdBC}`).set({
        fromUid: PLAYER_B_UID,
        fromUsername: 'PlayerB',
        fromAvatarId: 'meena',
        toUid: PLAYER_C_UID,
        toUsername: 'PlayerC',
        toAvatarId: 'chintu',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(dbB().doc(`friendRequests/${reqIdBC}`).delete());
  });

  it('denies unauthorized friend request modifications, self-acceptance, non-atomic acceptance, and outsider access', async () => {
    const reqId = `${PLAYER_A_UID}__${PLAYER_B_UID}`;
    await assertSucceeds(
      dbA().doc(`friendRequests/${reqId}`).set({
        fromUid: PLAYER_A_UID,
        fromUsername: 'PlayerA',
        fromAvatarId: 'raju',
        toUid: PLAYER_B_UID,
        toUsername: 'PlayerB',
        toAvatarId: 'meena',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Sender A cannot self-accept
    await assertFails(
      dbA().doc(`friendRequests/${reqId}`).update({
        status: 'accepted',
        updatedAt: serverTimestamp(),
      }),
    );

    // Non-participant Player C cannot read, list, update, or delete A->B request
    await assertFails(dbC().doc(`friendRequests/${reqId}`).get());
    await assertFails(dbC().collection('friendRequests').where('toUid', '==', PLAYER_B_UID).get());
    await assertFails(
      dbC().doc(`friendRequests/${reqId}`).update({
        status: 'declined',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(dbC().doc(`friendRequests/${reqId}`).delete());

    // Recipient B cannot accept without writing both reciprocal friend docs
    await assertFails(
      dbB().doc(`friendRequests/${reqId}`).update({
        status: 'accepted',
        updatedAt: serverTimestamp(),
      }),
    );

    // Nobody can inject a friend edge directly without pending->accepted batch
    await assertFails(
      dbC().doc(`users/${PLAYER_A_UID}/friends/${PLAYER_C_UID}`).set({
        uid: PLAYER_C_UID,
        username: 'PlayerC',
        avatarId: 'chintu',
        addedAt: serverTimestamp(),
      }),
    );

    // Target with friendRequestPolicy = 'nobody' rejects incoming requests
    await assertSucceeds(
      dbA().doc(`playerDirectory/${PLAYER_A_UID}`).update({
        friendRequestPolicy: 'nobody',
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      dbC().doc(`friendRequests/${PLAYER_C_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_C_UID,
        fromUsername: 'PlayerC',
        fromAvatarId: 'chintu',
        toUid: PLAYER_A_UID,
        toUsername: 'PlayerA',
        toAvatarId: 'raju',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('5. Blocked users cannot send friend requests or room invitations', () => {
  beforeEach(async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
  });

  it('denies friend requests and room invitations in either direction when blocked, and blocks tamper on blocked list', async () => {
    // Make A and B friends first, then A blocks B
    await seedFriendship(PLAYER_A_UID, 'PlayerA', PLAYER_B_UID, 'PlayerB');

    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_B_UID}`).set({
        uid: PLAYER_B_UID,
        username: 'PlayerB',
        avatarId: 'meena',
        blockedAt: serverTimestamp(),
      }),
    );

    // Blocked user B cannot read or remove A's block entry
    await assertFails(dbB().doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_B_UID}`).get());
    await assertFails(dbB().doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_B_UID}`).delete());

    // Blocked B cannot send friend request to A
    await assertFails(
      dbB().doc(`friendRequests/${PLAYER_B_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_B_UID,
        fromUsername: 'PlayerB',
        fromAvatarId: 'meena',
        toUid: PLAYER_A_UID,
        toUsername: 'PlayerA',
        toAvatarId: 'raju',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Blocker A also cannot send friend request to blocked B
    await assertFails(
      dbA().doc(`friendRequests/${PLAYER_A_UID}__${PLAYER_B_UID}`).set({
        fromUid: PLAYER_A_UID,
        fromUsername: 'PlayerA',
        fromAvatarId: 'raju',
        toUid: PLAYER_B_UID,
        toUsername: 'PlayerB',
        toAvatarId: 'meena',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Blocked B cannot send room invite to A (even if friendship edge still existed)
    await assertFails(
      dbB().doc(`roomInvites/${PLAYER_B_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_B_UID,
        fromUsername: 'PlayerB',
        fromAvatarId: 'meena',
        toUid: PLAYER_A_UID,
        roomCode: 'VILL95',
        levelId: 2,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Blocker A cannot send room invite to blocked B
    await assertFails(
      dbA().doc(`roomInvites/${PLAYER_A_UID}__${PLAYER_B_UID}`).set({
        fromUid: PLAYER_A_UID,
        fromUsername: 'PlayerA',
        fromAvatarId: 'raju',
        toUid: PLAYER_B_UID,
        roomCode: 'VILL95',
        levelId: 2,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Non-friend C cannot send room invite to A
    await assertFails(
      dbC().doc(`roomInvites/${PLAYER_C_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_C_UID,
        fromUsername: 'PlayerC',
        fromAvatarId: 'chintu',
        toUid: PLAYER_A_UID,
        roomCode: 'VILL95',
        levelId: 1,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // After unblocking B, B can send a friend request (after removing stale friendship)
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_B_UID}`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/friends/${PLAYER_B_UID}`).delete());
    await assertSucceeds(dbB().doc(`users/${PLAYER_B_UID}/friends/${PLAYER_A_UID}`).delete());

    await assertSucceeds(
      dbB().doc(`friendRequests/${PLAYER_B_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_B_UID,
        fromUsername: 'PlayerB',
        fromAvatarId: 'meena',
        toUid: PLAYER_A_UID,
        toUsername: 'PlayerA',
        toAvatarId: 'raju',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies room invitations when recipient sets roomInvitePolicy to nobody', async () => {
    await seedFriendship(PLAYER_A_UID, 'PlayerA', PLAYER_B_UID, 'PlayerB');
    await assertSucceeds(
      dbA().doc(`playerDirectory/${PLAYER_A_UID}`).update({
        roomInvitePolicy: 'nobody',
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      dbB().doc(`roomInvites/${PLAYER_B_UID}__${PLAYER_A_UID}`).set({
        fromUid: PLAYER_B_UID,
        fromUsername: 'PlayerB',
        fromAvatarId: 'meena',
        toUid: PLAYER_A_UID,
        roomCode: 'MANGO4',
        levelId: 3,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('6. Multiplayer room access for members and non-members', () => {
  beforeEach(async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
    await seedFriendship(PLAYER_A_UID, 'PlayerA', PLAYER_B_UID, 'PlayerB');
  });

  it('allows host Player A and invited member Player B to access room & member docs, while blocking non-member Player C', async () => {
    // Host A creates room + host member doc atomically
    const createBatch = dbA().batch();
    createBatch.set(dbA().doc('rooms/ROOM01'), {
      roomCode: 'ROOM01',
      hostUid: PLAYER_A_UID,
      levelId: 2,
      phase: 'lobby',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    createBatch.set(dbA().doc(`rooms/ROOM01/members/${PLAYER_A_UID}`), {
      uid: PLAYER_A_UID,
      hostUid: PLAYER_A_UID,
      username: 'PlayerA',
      avatarId: 'raju',
      role: 'host',
      isReady: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(createBatch.commit());

    // Host A invites confirmed friend Player B to ROOM01
    await assertSucceeds(
      dbA().doc(`roomInvites/${PLAYER_A_UID}__${PLAYER_B_UID}`).set({
        fromUid: PLAYER_A_UID,
        fromUsername: 'PlayerA',
        fromAvatarId: 'raju',
        toUid: PLAYER_B_UID,
        roomCode: 'ROOM01',
        levelId: 2,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Non-member Player C cannot read room, list rooms, read/list members, or join without invite
    await assertFails(dbC().doc('rooms/ROOM01').get());
    await assertFails(dbC().collection('rooms').where('hostUid', '==', PLAYER_A_UID).get());
    await assertFails(dbC().doc(`rooms/ROOM01/members/${PLAYER_A_UID}`).get());
    await assertFails(dbC().collection('rooms/ROOM01/members').get());
    await assertFails(dbC().doc(`roomInvites/${PLAYER_A_UID}__${PLAYER_B_UID}`).get());
    await assertFails(
      dbC().doc(`rooms/ROOM01/members/${PLAYER_C_UID}`).set({
        uid: PLAYER_C_UID,
        hostUid: PLAYER_A_UID,
        username: 'PlayerC',
        avatarId: 'chintu',
        role: 'player',
        isReady: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Invited Player B joins room members subcollection
    await assertSucceeds(
      dbB().doc(`rooms/ROOM01/members/${PLAYER_B_UID}`).set({
        uid: PLAYER_B_UID,
        hostUid: PLAYER_A_UID,
        username: 'PlayerB',
        avatarId: 'meena',
        role: 'player',
        isReady: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Member B can read room, read fellow member A, and toggle own isReady
    const roomSnap = await assertSucceeds(dbB().doc('rooms/ROOM01').get());
    expect(roomSnap.data()?.roomCode).toBe('ROOM01');
    await assertSucceeds(dbB().doc(`rooms/ROOM01/members/${PLAYER_A_UID}`).get());
    await assertSucceeds(
      dbB().doc(`rooms/ROOM01/members/${PLAYER_B_UID}`).update({
        isReady: true,
        updatedAt: serverTimestamp(),
      }),
    );

    // Non-host member B cannot alter room settings, delete room, or edit Player A's member doc
    await assertFails(
      dbB().doc('rooms/ROOM01').update({
        levelId: 5,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(dbB().doc('rooms/ROOM01').delete());
    await assertFails(
      dbB().doc(`rooms/ROOM01/members/${PLAYER_A_UID}`).update({
        isReady: false,
        updatedAt: serverTimestamp(),
      }),
    );

    // Host transitions room to ended (terminal state), then further updates are denied
    await assertSucceeds(
      dbA().doc('rooms/ROOM01').update({
        phase: 'ended',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      dbA().doc('rooms/ROOM01').update({
        phase: 'lobby',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('7. Private notification access', () => {
  beforeEach(async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
  });

  it('allows recipient Player A to read, mark read, and delete own notifications while blocking sender B and outsider C', async () => {
    const reqId = `${PLAYER_B_UID}__${PLAYER_A_UID}`;
    const notifBatch = dbB().batch();
    notifBatch.set(dbB().doc(`friendRequests/${reqId}`), {
      fromUid: PLAYER_B_UID,
      fromUsername: 'PlayerB',
      fromAvatarId: 'meena',
      toUid: PLAYER_A_UID,
      toUsername: 'PlayerA',
      toAvatarId: 'raju',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    notifBatch.set(dbB().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`), {
      recipientUid: PLAYER_A_UID,
      senderUid: PLAYER_B_UID,
      type: 'friend_request',
      refId: reqId,
      message: 'PlayerB sent you a friend request.',
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(notifBatch.commit());

    // Recipient A reads, lists, and marks read
    const notifSnap = await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).get(),
    );
    expect(notifSnap.data()?.isRead).toBe(false);

    const listSnap = await assertSucceeds(
      dbA()
        .collection(`users/${PLAYER_A_UID}/notifications`)
        .where('recipientUid', '==', PLAYER_A_UID)
        .get(),
    );
    expect(listSnap.size).toBe(1);

    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).update({
        isRead: true,
        updatedAt: serverTimestamp(),
      }),
    );

    // Owner cannot tamper with immutable message or senderUid on notification update
    await assertFails(
      dbA().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).update({
        message: 'Tampered text',
        updatedAt: serverTimestamp(),
      }),
    );

    // Sender B and outsider C cannot read, list, update, or delete Player A's notification
    await assertFails(dbB().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).get());
    await assertFails(dbC().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).get());
    await assertFails(
      dbC()
        .collection(`users/${PLAYER_A_UID}/notifications`)
        .where('recipientUid', '==', PLAYER_A_UID)
        .get(),
    );
    await assertFails(
      dbB().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).update({
        isRead: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(dbC().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).delete());

    // Unlinked spam notification creation by Player C is denied
    await assertFails(
      dbC().doc(`users/${PLAYER_A_UID}/notifications/spam_1`).set({
        recipientUid: PLAYER_A_UID,
        senderUid: PLAYER_C_UID,
        type: 'friend_request',
        refId: `${PLAYER_C_UID}__${PLAYER_A_UID}`,
        message: 'Fake notification without request',
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // Non-participant Player C cannot read Player A's friend-request or room-invite notifications
    await assertFails(
      dbC().collection('friendRequests').where('toUid', '==', PLAYER_A_UID).get(),
    );
    await assertFails(
      dbC().collection('roomInvites').where('toUid', '==', PLAYER_A_UID).get(),
    );

    // Recipient A can delete own notification
    await assertSucceeds(
      dbA().doc(`users/${PLAYER_A_UID}/notifications/notif_req_1`).delete(),
    );
  });
});

describe('8. Account deletion permissions', () => {
  beforeEach(async () => {
    await seedUserDirectoryAndProfile(PLAYER_A_UID, 'PlayerA', 'raju');
    await seedUserDirectoryAndProfile(PLAYER_B_UID, 'PlayerB', 'meena');
    await seedUserDirectoryAndProfile(PLAYER_C_UID, 'PlayerC', 'chintu');
    await seedFriendship(PLAYER_A_UID, 'PlayerA', PLAYER_B_UID, 'PlayerB');
    await seedFriendship(PLAYER_B_UID, 'PlayerB', PLAYER_C_UID, 'PlayerC');

    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await adminDb.doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_C_UID}`).set({
        uid: PLAYER_C_UID,
        username: 'PlayerC',
        avatarId: 'chintu',
        blockedAt: serverTimestamp(),
      });
      await adminDb.doc(`users/${PLAYER_B_UID}/blocked/${PLAYER_A_UID}`).set({
        uid: PLAYER_A_UID,
        username: 'PlayerA',
        avatarId: 'raju',
        blockedAt: serverTimestamp(),
      });
      await adminDb.doc(`users/${PLAYER_A_UID}/notifications/notif_a`).set({
        recipientUid: PLAYER_A_UID,
        senderUid: PLAYER_B_UID,
        type: 'room_invite',
        refId: `${PLAYER_B_UID}__${PLAYER_A_UID}`,
        message: 'Join room!',
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await adminDb.doc(`users/${PLAYER_B_UID}/notifications/notif_b`).set({
        recipientUid: PLAYER_B_UID,
        senderUid: PLAYER_C_UID,
        type: 'friend_request',
        refId: `${PLAYER_C_UID}__${PLAYER_B_UID}`,
        message: 'Hi B',
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await adminDb.doc(`users/${UNVERIFIED_UID}`).set(
        buildInitialProfile(UNVERIFIED_UID, 'Unverified', 'raju'),
      );
    });
  });

  it('allows verified owner Player A to delete own account data and reciprocal friend edges', async () => {
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/friends/${PLAYER_B_UID}`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_B_UID}/friends/${PLAYER_A_UID}`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/blocked/${PLAYER_C_UID}`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/notifications/notif_a`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/privacy/settings`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}/presence/status`).delete());
    await assertSucceeds(dbA().doc(`playerDirectory/${PLAYER_A_UID}`).delete());
    await assertSucceeds(dbA().doc(`users/${PLAYER_A_UID}`).delete());
  });

  it('denies deleting another user account, block list, third-party friendships, notifications, immutable reports, or unverified self-delete', async () => {
    // Player A cannot delete Player B's data or B<->C friendship
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}`).delete());
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}/privacy/settings`).delete());
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}/presence/status`).delete());
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}/blocked/${PLAYER_A_UID}`).delete());
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}/friends/${PLAYER_C_UID}`).delete());
    await assertFails(dbA().doc(`users/${PLAYER_B_UID}/notifications/notif_b`).delete());
    await assertFails(dbA().doc(`playerDirectory/${PLAYER_B_UID}`).delete());

    // Player A creates a safety report, and cannot delete or update it afterward
    await assertSucceeds(
      dbA().doc('playerReports/rep_1').set({
        reporterUid: PLAYER_A_UID,
        reporterUsername: 'PlayerA',
        targetUid: PLAYER_C_UID,
        targetUsername: 'PlayerC',
        reason: 'spam',
        details: 'Spamming requests',
        source: 'privacy_settings',
        status: 'submitted',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(dbA().doc('playerReports/rep_1').delete());
    await assertFails(
      dbA().doc('playerReports/rep_1').update({
        status: 'resolved',
      }),
    );

    // Unverified user cannot delete even own profile
    await assertFails(dbUnverified().doc(`users/${UNVERIFIED_UID}`).delete());
  });
});

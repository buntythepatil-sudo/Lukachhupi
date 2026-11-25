import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
} from 'firebase/firestore';

const config = JSON.parse(
  readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'),
);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const checks = [];

async function expectDenied(name, fn) {
  try {
    await fn();
    checks.push({ name, passed: false, detail: 'Expected permission-denied, succeeded!' });
  } catch (err) {
    const code = err?.code || '';
    const msg = err?.message || String(err);
    const isDenied =
      code === 'permission-denied' ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('PERMISSION_DENIED');
    checks.push({
      name,
      passed: isDenied,
      detail: isDenied ? 'permission-denied' : `Unexpected error (${code}): ${msg}`,
    });
  }
}

async function main() {
  // 1. Global default-deny safety net
  await expectDenied('GET unknown path /test/connection', () =>
    getDocFromServer(doc(db, 'test', 'connection')),
  );
  await expectDenied('WRITE unknown path /secret/leak', () =>
    setDoc(doc(db, 'secret', 'leak'), { ok: true }),
  );

  // 2. Owner-only /users/{uid}
  await expectDenied('GET /users/someone', () =>
    getDocFromServer(doc(db, 'users', 'someone')),
  );
  await expectDenied('LIST /users', () =>
    getDocsFromServer(query(collection(db, 'users'), limit(5))),
  );
  await expectDenied('CREATE /users/someone', () =>
    setDoc(doc(db, 'users', 'someone'), { uid: 'someone', username: 'X' }),
  );
  await expectDenied('DELETE /users/someone', () =>
    deleteDoc(doc(db, 'users', 'someone')),
  );

  // 3. Owner-only /users/{uid}/privacy/settings
  await expectDenied('GET /users/someone/privacy/settings', () =>
    getDocFromServer(doc(db, 'users', 'someone', 'privacy', 'settings')),
  );
  await expectDenied('WRITE /users/someone/privacy/settings', () =>
    setDoc(doc(db, 'users', 'someone', 'privacy', 'settings'), {
      uid: 'someone',
      friendRequestPolicy: 'everyone',
      roomInvitePolicy: 'friends',
      appearOffline: false,
      hideProfileFromStrangers: false,
      updatedAt: serverTimestamp(),
    }),
  );

  // 4. Friends-only /users/{uid}/presence/status
  await expectDenied('GET /users/someone/presence/status', () =>
    getDocFromServer(doc(db, 'users', 'someone', 'presence', 'status')),
  );
  await expectDenied('WRITE /users/someone/presence/status', () =>
    setDoc(doc(db, 'users', 'someone', 'presence', 'status'), {
      uid: 'someone',
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  // 5. /users/{uid}/friends & /users/{uid}/blocked
  await expectDenied('LIST /users/someone/friends', () =>
    getDocsFromServer(collection(db, 'users', 'someone', 'friends')),
  );
  await expectDenied('CREATE /users/someone/friends/attacker', () =>
    setDoc(doc(db, 'users', 'someone', 'friends', 'attacker'), {
      uid: 'attacker',
      username: 'Attacker',
      avatarId: 'raju',
      addedAt: serverTimestamp(),
    }),
  );
  await expectDenied('LIST /users/someone/blocked', () =>
    getDocsFromServer(collection(db, 'users', 'someone', 'blocked')),
  );

  // 6. Auth-gated /playerDirectory
  await expectDenied('GET /playerDirectory/someone (unauthenticated)', () =>
    getDocFromServer(doc(db, 'playerDirectory', 'someone')),
  );
  await expectDenied('LIST /playerDirectory limit 10 (unauthenticated)', () =>
    getDocsFromServer(query(collection(db, 'playerDirectory'), limit(10))),
  );
  await expectDenied('WRITE /playerDirectory/someone (unauthenticated)', () =>
    setDoc(doc(db, 'playerDirectory', 'someone'), {
      uid: 'someone',
      username: 'Test',
      usernameLower: 'test',
      avatarId: 'raju',
      isOnline: true,
      friendRequestPolicy: 'everyone',
      roomInvitePolicy: 'friends',
      hideProfileFromStrangers: false,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  // 7. /friendRequests & /roomInvites
  await expectDenied('LIST /friendRequests (unauthenticated)', () =>
    getDocsFromServer(query(collection(db, 'friendRequests'), limit(5))),
  );
  await expectDenied('CREATE /friendRequests/a__b (unauthenticated)', () =>
    setDoc(doc(db, 'friendRequests', 'a__b'), {
      fromUid: 'a',
      toUid: 'b',
      status: 'pending',
    }),
  );
  await expectDenied('LIST /roomInvites (unauthenticated)', () =>
    getDocsFromServer(query(collection(db, 'roomInvites'), limit(5))),
  );
  await expectDenied('CREATE /roomInvites/a__b (unauthenticated)', () =>
    setDoc(doc(db, 'roomInvites', 'a__b'), {
      fromUid: 'a',
      toUid: 'b',
      roomCode: 'ABC123',
      levelId: 1,
      status: 'pending',
    }),
  );

  // 8. /playerReports
  await expectDenied('GET /playerReports/rep_1 (unauthenticated)', () =>
    getDocFromServer(doc(db, 'playerReports', 'rep_1')),
  );
  await expectDenied('LIST /playerReports (unauthenticated)', () =>
    getDocsFromServer(query(collection(db, 'playerReports'), limit(5))),
  );
  await expectDenied('CREATE /playerReports/rep_1 (unauthenticated)', () =>
    setDoc(doc(db, 'playerReports', 'rep_1'), {
      reporterUid: 'a',
      reporterUsername: 'A',
      targetUid: 'b',
      targetUsername: 'B',
      reason: 'harassment',
      details: 'test',
      source: 'privacy_settings',
      status: 'submitted',
      createdAt: serverTimestamp(),
    }),
  );
  await expectDenied('UPDATE /playerReports/rep_1 (unauthenticated)', () =>
    updateDoc(doc(db, 'playerReports', 'rep_1'), { status: 'resolved' }),
  );
  await expectDenied('DELETE /playerReports/rep_1 (unauthenticated)', () =>
    deleteDoc(doc(db, 'playerReports', 'rep_1')),
  );

  await terminate(db);

  const failed = checks.filter((c) => !c.passed);
  for (const c of checks) {
    console.log(`${c.passed ? 'PASS' : 'FAIL'} - ${c.name}: ${c.detail}`);
  }
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} deployed rule probes denied as expected.`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();

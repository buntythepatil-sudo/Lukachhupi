import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { createMultiplayerHub } from '../../../server.ts';
import type {
  ClientToServerMessage,
  MultiplayerRoomSnapshot,
  ServerToClientMessage,
} from '../multiplayerTypes';
import {
  lerpShortestAngle,
  RemotePlayerInterpolator,
} from '../remoteInterpolation';
import type { CharacterCustomization } from '../types';

function makeCustomization(name: string): CharacterCustomization {
  return {
    presetId: 'raju',
    name,
    outfitStyle: 'shirt_shorts',
    outfitColor: 0xc9522e,
    accessory: 'none',
  };
}

class TestWsClient {
  public readonly ws: WebSocket;
  public readonly messages: ServerToClientMessage[] = [];
  private waiters: Array<{
    predicate: (msg: ServerToClientMessage) => boolean;
    resolve: (msg: ServerToClientMessage) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private readIndex = 0;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerToClientMessage;
      this.messages.push(msg);
      this.flushWaiters();
    });
  }

  private flushWaiters(): void {
    while (this.readIndex < this.messages.length && this.waiters.length > 0) {
      const msg = this.messages[this.readIndex];
      const matchIdx = this.waiters.findIndex((w) => w.predicate(msg));
      if (matchIdx === -1) {
        this.readIndex += 1;
        continue;
      }
      const [waiter] = this.waiters.splice(matchIdx, 1);
      clearTimeout(waiter.timer);
      this.readIndex += 1;
      waiter.resolve(msg);
    }
  }

  public send(msg: ClientToServerMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  public nextMessage(
    predicate: (msg: ServerToClientMessage) => boolean,
    timeoutMs = 2500,
  ): Promise<ServerToClientMessage> {
    // Check unread backlog first
    for (let i = this.readIndex; i < this.messages.length; i++) {
      const msg = this.messages[i];
      if (predicate(msg)) {
        this.readIndex = i + 1;
        return Promise.resolve(msg);
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(
          new Error(
            `Timed out waiting for WS message. Received: ${JSON.stringify(
              this.messages.map((m) => m.type),
            )}`,
          ),
        );
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }

  public close(): Promise<void> {
    if (
      this.ws.readyState === WebSocket.CLOSED ||
      this.ws.readyState === WebSocket.CLOSING
    ) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Real-Time Multiplayer Server & Synchronization Integration', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let hub: ReturnType<typeof createMultiplayerHub>;
  let wsUrl: string;
  let openClients: TestWsClient[] = [];

  async function connectClient(): Promise<TestWsClient> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const client = new TestWsClient(ws);
    openClients.push(client);
    return client;
  }

  async function createHostedRoom(
    hostName: string,
    opts?: { passcode?: string; clientSessionId?: string; levelId?: number },
  ): Promise<{
    client: TestWsClient;
    room: MultiplayerRoomSnapshot;
    playerId: string;
    reconnectToken: string;
  }> {
    const client = await connectClient();
    client.send({
      type: 'create_room',
      customization: makeCustomization(hostName),
      unlockedLevel: 15,
      levelId: opts?.levelId ?? 1,
      passcode: opts?.passcode,
      clientSessionId: opts?.clientSessionId,
    });
    const joined = await client.nextMessage((m) => m.type === 'room_joined');
    return {
      client,
      room: joined.room!,
      playerId: joined.playerId!,
      reconnectToken: joined.reconnectToken!,
    };
  }

  async function joinExistingRoom(
    roomCode: string,
    name: string,
    opts?: { passcode?: string; clientSessionId?: string },
  ): Promise<{
    client: TestWsClient;
    room: MultiplayerRoomSnapshot;
    playerId: string;
    reconnectToken: string;
  }> {
    const client = await connectClient();
    client.send({
      type: 'join_room',
      roomCode,
      customization: makeCustomization(name),
      passcode: opts?.passcode,
      clientSessionId: opts?.clientSessionId,
    });
    const joined = await client.nextMessage((m) => m.type === 'room_joined');
    return {
      client,
      room: joined.room!,
      playerId: joined.playerId!,
      reconnectToken: joined.reconnectToken!,
    };
  }

  beforeEach(async () => {
    openClients = [];
    server = http.createServer();
    wss = new WebSocketServer({ server, path: '/ws/multiplayer' });
    hub = createMultiplayerHub(wss, {
      headstartSeconds: 0.25,
      matchDurationSeconds: 60,
      lobbyDisconnectGraceMs: 200,
      matchDisconnectGraceMs: 320,
      tickIntervalMs: 25,
      fullSyncIntervalMs: 140,
      minVerifiedOnlineMatchMs: 0,
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral port');
    }
    wsUrl = `ws://127.0.0.1:${addr.port}/ws/multiplayer`;
  });

  afterEach(async () => {
    await Promise.all(openClients.map((c) => c.close()));
    hub.dispose();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('supports up to 10 players per room and rejects the 11th player cleanly', async () => {
    const host = await createHostedRoom('Player1');
    const roomCode = host.room.code;

    for (let i = 2; i <= 10; i++) {
      const joined = await joinExistingRoom(roomCode, `Player${i}`);
      expect(joined.room.players).toHaveLength(i);
    }

    const eleventh = await connectClient();
    eleventh.send({
      type: 'join_room',
      roomCode,
      customization: makeCustomization('Player11'),
    });
    const err = await eleventh.nextMessage((m) => m.type === 'error');
    expect(err.message).toMatch(/full/i);
    expect(hub.rooms.get(roomCode)?.players.size).toBe(10);
  });

  it('enforces private room PINs, host-only locks, and join brute-force rate limiting', async () => {
    const host = await createHostedRoom('HostA', { passcode: '9519' });
    expect(host.room.hasPasscode).toBe(true);
    expect(JSON.stringify(host.room)).not.toContain('9519');

    // Missing PIN rejected
    const outsider = await connectClient();
    outsider.send({
      type: 'join_room',
      roomCode: host.room.code,
      customization: makeCustomization('Outsider'),
    });
    const missingPinErr = await outsider.nextMessage((m) => m.type === 'error');
    expect(missingPinErr.message).toMatch(/PIN/i);

    // Wrong PIN rejected
    outsider.send({
      type: 'join_room',
      roomCode: host.room.code,
      customization: makeCustomization('Outsider'),
      passcode: '0000',
    });
    const wrongPinErr = await outsider.nextMessage((m) => m.type === 'error');
    expect(wrongPinErr.message).toMatch(/incorrect/i);

    // Correct PIN succeeds
    const friend = await joinExistingRoom(host.room.code, 'FriendB', {
      passcode: '9519',
    });
    expect(friend.room.players).toHaveLength(2);

    // Non-host cannot lock room
    friend.client.send({ type: 'toggle_room_lock', locked: true });
    const nonHostErr = await friend.client.nextMessage((m) => m.type === 'error');
    expect(nonHostErr.message).toMatch(/only the room host/i);

    // Host locks room -> new player with valid PIN is blocked
    host.client.send({ type: 'toggle_room_lock', locked: true });
    const lockedState = await host.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.isLocked === true,
    );
    expect(lockedState.room?.isLocked).toBe(true);

    const latecomer = await connectClient();
    latecomer.send({
      type: 'join_room',
      roomCode: host.room.code,
      customization: makeCustomization('Latecomer'),
      passcode: '9519',
    });
    const lockedErr = await latecomer.nextMessage((m) => m.type === 'error');
    expect(lockedErr.message).toMatch(/locked/i);

    // Brute-force join rate limiter triggers after 6 failed attempts
    const bruteClient = await connectClient();
    let gotRateLimited = false;
    for (let i = 0; i < 8; i++) {
      bruteClient.send({
        type: 'join_room',
        roomCode: 'ZZZZ99',
        customization: makeCustomization('Brute'),
      });
      const err = await bruteClient.nextMessage((m) => m.type === 'error');
      if (err.message && /too many/i.test(err.message)) {
        gotRateLimited = true;
        break;
      }
    }
    expect(gotRateLimited).toBe(true);
  });

  it('synchronizes movement, rotation, animations, ping RTT, and clamps impossible teleports', async () => {
    const host = await createHostedRoom('Raju');
    const guest = await joinExistingRoom(host.room.code, 'Meena');

    // Ping/pong echoes clientSentAt & serverTime
    const sentAt = Date.now();
    host.client.send({ type: 'ping', clientSentAt: sentAt });
    const pong = await host.client.nextMessage((m) => m.type === 'pong');
    expect(pong.clientSentAt).toBe(sentAt);
    expect(typeof pong.serverTime).toBe('number');

    // Start match
    host.client.send({ type: 'start_match' });
    const hostPlaying = await host.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await guest.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );

    const hiderClient =
      hostPlaying.room!.players.find((p) => p.role === 'hider')!.id ===
      host.playerId
        ? host
        : guest;
    const observerClient =
      hiderClient.playerId === host.playerId ? guest : host;

    const initialHider = hostPlaying.room!.players.find(
      (p) => p.id === hiderClient.playerId,
    )!;

    // Normal short move syncs smoothly with animation + serverTime
    const targetX = initialHider.x + 1.0;
    const targetZ = initialHider.z + 0.6;
    hiderClient.client.send({
      type: 'player_state',
      state: {
        x: targetX,
        y: 0,
        z: targetZ,
        rotY: 1.25,
        moveSpeed: 4.5,
        isHiding: true,
        animState: 'hide_cover',
        expression: 'fear',
      },
    });

    const posUpdate = await observerClient.client.nextMessage(
      (m) =>
        m.type === 'player_positions' &&
        Boolean(
          m.positions?.some(
            (p) =>
              p.id === hiderClient.playerId &&
              Math.abs(p.x - targetX) < 0.05 &&
              p.animState === 'hide_cover',
          ),
        ),
    );
    expect(typeof posUpdate.serverTime).toBe('number');
    const synced = posUpdate.positions!.find(
      (p) => p.id === hiderClient.playerId,
    )!;
    expect(synced.isHiding).toBe(true);
    expect(synced.rotY).toBeCloseTo(1.25, 2);

    // Extreme instant teleport across map should be clamped by server anti-teleport
    hiderClient.client.send({
      type: 'player_state',
      state: {
        x: targetX + 45,
        y: 0,
        z: targetZ + 45,
        rotY: 0,
        moveSpeed: 5,
        isHiding: false,
        animState: 'run',
      },
    });
    await delay(80);
    const serverHider = hub.rooms
      .get(host.room.code)!
      .players.get(hiderClient.playerId)!;
    expect(Math.hypot(serverHider.x - targetX, serverHider.z - targetZ)).toBeLessThan(
      12,
    );
  });

  it('prevents duplicate players on reconnection and restores session cleanly', async () => {
    const host = await createHostedRoom('HostRaju', {
      clientSessionId: 'session-host-1',
    });
    const guest = await joinExistingRoom(host.room.code, 'GuestMeena', {
      clientSessionId: 'session-guest-1',
    });

    // Duplicate join_room with the same clientSessionId reclaims slot without duplicate
    const dupSocket = await connectClient();
    dupSocket.send({
      type: 'join_room',
      roomCode: host.room.code,
      customization: makeCustomization('GuestMeena'),
      clientSessionId: 'session-guest-1',
    });
    const reclaimed = await dupSocket.nextMessage(
      (m) => m.type === 'room_joined',
    );
    expect(reclaimed.playerId).toBe(guest.playerId);
    expect(reclaimed.room?.players).toHaveLength(2);

    // Start match and simulate temporary internet drop for guest
    host.client.send({ type: 'start_match' });
    await host.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await dupSocket.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );

    await dupSocket.close();

    // Host immediately sees guest marked connected: false while inside grace window
    const disconnectedState = await host.client.nextMessage(
      (m) =>
        m.type === 'room_state' &&
        m.room?.players.some(
          (p) => p.id === guest.playerId && p.connected === false,
        ) === true,
    );
    expect(disconnectedState.room?.players).toHaveLength(2);

    // Invalid reconnect token is rejected cleanly with room_left (slot untouched)
    const intruder = await connectClient();
    intruder.send({
      type: 'rejoin_room',
      roomCode: host.room.code,
      playerId: guest.playerId,
      reconnectToken: 'wrong-token-value',
    });
    const badTokenRes = await intruder.nextMessage((m) => m.type === 'room_left');
    expect(badTokenRes.type).toBe('room_left');

    // Valid reconnect token restores session with zero duplicate players
    const reconnected = await connectClient();
    reconnected.send({
      type: 'rejoin_room',
      roomCode: host.room.code,
      playerId: guest.playerId,
      reconnectToken: reclaimed.reconnectToken,
    });
    const rejoined = await reconnected.nextMessage(
      (m) => m.type === 'room_joined',
    );
    expect(rejoined.playerId).toBe(guest.playerId);
    expect(rejoined.room?.players).toHaveLength(2);
    expect(
      rejoined.room?.players.find((p) => p.id === guest.playerId)?.connected,
    ).toBe(true);
  });

  it('migrates host safely to the next connected player when host disconnects', async () => {
    const host = await createHostedRoom('OriginalHost');
    const p2 = await joinExistingRoom(host.room.code, 'SecondPlayer');
    const p3 = await joinExistingRoom(host.room.code, 'ThirdPlayer');

    // Drop host and wait past 200ms lobby grace period
    await host.client.close();

    const migrated = await p2.client.nextMessage(
      (m) =>
        m.type === 'room_state' &&
        m.room?.hostId === p2.playerId &&
        m.room.players.length === 2,
      1500,
    );
    expect(migrated.room?.hostId).toBe(p2.playerId);
    expect(migrated.room?.players.find((p) => p.id === p2.playerId)?.isHost).toBe(
      true,
    );

    // New host can select map and start match cleanly
    p2.client.send({ type: 'select_map', levelId: 4, unlockedLevel: 15 });
    const mapChanged = await p3.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.levelId === 4,
    );
    expect(mapChanged.room?.levelId).toBe(4);
  });

  it('handles mid-match join rejection, hider/seeker departures, and fair simultaneous catch verification', async () => {
    const p1 = await createHostedRoom('PlayerA');
    const p2 = await joinExistingRoom(p1.room.code, 'PlayerB');
    const p3 = await joinExistingRoom(p1.room.code, 'PlayerC');

    // Start match with 3 players (1 seeker, 2 hiders)
    p1.client.send({ type: 'start_match' });
    const startState = await p1.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await p2.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await p3.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );

    // Verify strictly 1 Seeker and 2 Hiders
    const seekers = startState.room!.players.filter((p) => p.role === 'seeker');
    const hiders = startState.room!.players.filter((p) => p.role === 'hider');
    expect(seekers).toHaveLength(1);
    expect(hiders).toHaveLength(2);

    // Mid-match join attempt is rejected
    const midJoiner = await connectClient();
    midJoiner.send({
      type: 'join_room',
      roomCode: p1.room.code,
      customization: makeCustomization('MidJoiner'),
    });
    const midErr = await midJoiner.nextMessage((m) => m.type === 'error');
    expect(midErr.message).toMatch(/currently in a match/i);

    const clientsById = new Map([
      [p1.playerId, p1],
      [p2.playerId, p2],
      [p3.playerId, p3],
    ]);
    const seeker = clientsById.get(seekers[0].id)!;
    const hider1 = clientsById.get(hiders[0].id)!;
    const hider2 = clientsById.get(hiders[1].id)!;

    // Position seeker and hider1 directly on top of each other on server to test countdown lock first
    const serverRoom = hub.rooms.get(p1.room.code)!;
    const serverSeeker = serverRoom.players.get(seeker.playerId)!;
    const serverHider1 = serverRoom.players.get(hider1.playerId)!;
    const serverHider2 = serverRoom.players.get(hider2.playerId)!;
    serverSeeker.x = 0;
    serverSeeker.y = 0;
    serverSeeker.z = 0;
    serverHider1.x = 0.5;
    serverHider1.y = 0;
    serverHider1.z = 0.5;
    serverHider2.x = 0.8;
    serverHider2.y = 4.2; // Different floor (dy > 2.35m)
    serverHider2.z = 0.5;

    // Tagging during headstart countdown must be rejected silently
    seeker.client.send({ type: 'try_tag', targetPlayerId: hider1.playerId });
    await delay(60);
    expect(serverHider1.caught).toBe(false);

    // Wait for 0.25s headstart countdown to finish
    await seeker.client.nextMessage(
      (m) => m.type === 'match_event' && m.eventKind === 'seek_start',
      1500,
    );

    // Non-seeker try_tag must be ignored
    hider1.client.send({ type: 'try_tag', targetPlayerId: hider2.playerId });
    await delay(50);
    expect(serverHider2.caught).toBe(false);

    // Tagging across floors (dy = 4.2m > 2.35m) must fail
    seeker.client.send({ type: 'try_tag', targetPlayerId: hider2.playerId });
    await delay(50);
    expect(serverHider2.caught).toBe(false);

    // Hider2 leaves mid-match -> 1 hider remains, match continues
    hider2.client.send({ type: 'leave_room' });
    const afterLeave = await seeker.client.nextMessage(
      (m) =>
        m.type === 'room_state' &&
        m.room?.phase === 'playing' &&
        m.room.players.length === 2,
    );
    expect(afterLeave.room?.players.map((p) => p.id)).not.toContain(
      hider2.playerId,
    );

    // Simultaneous duplicate try_tag packets on the final hider -> exactly 1 catch & 1 match_end
    seeker.client.send({ type: 'try_tag', targetPlayerId: hider1.playerId });
    seeker.client.send({ type: 'try_tag', targetPlayerId: hider1.playerId });
    seeker.client.send({ type: 'try_tag', targetPlayerId: hider1.playerId });

    const endState = await seeker.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'ended',
      1500,
    );
    await delay(100);

    expect(endState.room?.winner).toBe('seekers');
    const tagCaughtEvents = seeker.client.messages.filter(
      (m) =>
        m.type === 'match_event' &&
        m.eventKind === 'tag_caught' &&
        m.taggedPlayerId === hider1.playerId,
    );
    const matchEndEvents = seeker.client.messages.filter(
      (m) => m.type === 'match_event' && m.eventKind === 'match_end',
    );
    expect(tagCaughtEvents).toHaveLength(1);
    expect(matchEndEvents).toHaveLength(1);
  });

  it('awards Hiders win when seeker leaves mid-match with multiple hiders still playing', async () => {
    const p1 = await createHostedRoom('Alpha');
    const p2 = await joinExistingRoom(p1.room.code, 'Beta');
    const p3 = await joinExistingRoom(p1.room.code, 'Gamma');

    p1.client.send({ type: 'start_match' });
    const startState = await p1.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await p2.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await p3.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );

    const clientsById = new Map([
      [p1.playerId, p1],
      [p2.playerId, p2],
      [p3.playerId, p3],
    ]);
    const seekerId = startState.room!.players.find((p) => p.role === 'seeker')!.id;
    const hiderId = startState.room!.players.find((p) => p.role === 'hider')!.id;

    clientsById.get(seekerId)!.client.send({ type: 'leave_room' });

    const ended = await clientsById.get(hiderId)!.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'ended',
      1500,
    );
    expect(ended.room?.winner).toBe('hiders');
  });

  it('prunes disconnected lobby players when host starts a match so no ghost players spawn', async () => {
    const host = await createHostedRoom('HostOne');
    const p2 = await joinExistingRoom(host.room.code, 'ConnectedFriend');
    const p3 = await joinExistingRoom(host.room.code, 'DroppedFriend');

    // p3 drops in lobby (still inside 200ms lobby grace window)
    await p3.client.close();
    await host.client.nextMessage(
      (m) =>
        m.type === 'room_state' &&
        m.room?.players.some((p) => p.id === p3.playerId && p.connected === false) === true,
    );

    // Host starts match immediately while p3 is disconnected
    host.client.send({ type: 'start_match' });
    const started = await host.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );
    await p2.client.nextMessage(
      (m) => m.type === 'room_state' && m.room?.phase === 'playing',
    );

    expect(started.room?.players).toHaveLength(2);
    expect(started.room?.players.map((p) => p.id)).not.toContain(p3.playerId);
    expect(started.room?.players.filter((p) => p.role === 'seeker')).toHaveLength(1);
    expect(started.room?.players.filter((p) => p.role === 'hider')).toHaveLength(1);
  });
});

describe('RemotePlayerInterpolator smooth movement & anti-teleport', () => {
  it('smoothly interpolates positions and shortest-angle yaw across jittery snapshots', () => {
    const interp = new RemotePlayerInterpolator({
      x: 0,
      y: 0,
      z: 0,
      rotY: Math.PI - 0.1,
      moveSpeed: 0,
      isHiding: false,
      animState: 'idle',
    });

    // Feed jittery snapshots moving along +X and rotating across +PI -> -PI wrap boundary
    interp.pushSnapshot(
      {
        x: 0,
        y: 0,
        z: 0,
        rotY: Math.PI - 0.1,
        moveSpeed: 4,
        isHiding: false,
        animState: 'run',
      },
      1000,
      1000,
    );
    interp.pushSnapshot(
      {
        x: 2,
        y: 0.2,
        z: 0,
        rotY: -Math.PI + 0.1,
        moveSpeed: 4,
        isHiding: false,
        animState: 'run',
      },
      1100,
      1120,
    );
    interp.pushSnapshot(
      {
        x: 4,
        y: 0.4,
        z: 0,
        rotY: -Math.PI + 0.2,
        moveSpeed: 4,
        isHiding: false,
        animState: 'run',
      },
      1200,
      1205,
    );

    const mid = interp.sample(1185, 1 / 60);
    expect(mid).not.toBeNull();
    expect(mid!.teleported).toBe(false);
    expect(mid!.x).toBeGreaterThan(0);
    expect(mid!.x).toBeLessThan(4);
    // Shortest angle between +3.04 and -3.04 passes through PI, never 0
    const shortest = lerpShortestAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(Math.abs(Math.abs(shortest) - Math.PI)).toBeLessThan(0.05);
  });

  it('caps dead-reckoning distance when packets stall and snaps cleanly on large respawns', () => {
    const interp = new RemotePlayerInterpolator({
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      moveSpeed: 5,
      isHiding: false,
      animState: 'run',
    });

    interp.pushSnapshot(
      {
        x: 0,
        y: 0,
        z: 0,
        rotY: 0,
        moveSpeed: 5,
        isHiding: false,
        animState: 'run',
      },
      1000,
      1000,
    );
    interp.pushSnapshot(
      {
        x: 1,
        y: 0,
        z: 0,
        rotY: 0,
        moveSpeed: 5,
        isHiding: false,
        animState: 'run',
      },
      1100,
      1100,
    );

    // Simulate a 2-second packet stall: position must not run away infinitely
    const stalled = interp.sample(3100, 1 / 60);
    expect(stalled).not.toBeNull();
    expect(stalled!.x).toBeLessThan(3.0);

    // Large respawn jump (> 9.5m) snaps cleanly instead of streaking across the map
    interp.pushSnapshot(
      {
        x: 25,
        y: 0,
        z: -20,
        rotY: 1,
        moveSpeed: 0,
        isHiding: false,
        animState: 'idle',
      },
      3200,
      3200,
    );
    const snapped = interp.sample(3320, 1 / 60);
    expect(snapped).not.toBeNull();
    expect(snapped!.teleported).toBe(true);
    expect(snapped!.x).toBeCloseTo(25, 2);
    expect(snapped!.z).toBeCloseTo(-20, 2);
  });
});

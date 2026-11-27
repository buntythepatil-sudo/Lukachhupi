import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  MAX_STEP_UP_HEIGHT,
  resolveLargeAnimalCapsuleCollision,
  resolveWorldCollisions,
  type LargeAnimalColliderSpec,
} from '../collisionSolver';
import { buildLevelMap } from '../levelBuilder';
import { ThirdPersonCameraController } from '../cameraController';
import { TOTAL_LEVELS } from '../levels';
import { createVillageTextures, type VillageTextureSet } from '../textures';
import type { VillageColliders } from '../types';
import { VillageNpcSystem } from '../villageNpcSystem';
import fs from 'fs';
import path from 'path';

const CHAR_RADIUS = 0.42;
const GRAVITY = 20;

function installMinimalCanvasMock() {
  if (typeof globalThis.document !== 'undefined') return;
  const noop = () => {};
  const gradStub = { addColorStop: noop };
  const ctx2dStub = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 20 }),
    setLineDash: noop,
    drawImage: noop,
    createLinearGradient: () => gradStub,
    createRadialGradient: () => gradStub,
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
    }),
    putImageData: noop,
  };

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => ctx2dStub,
        };
      }
      return {};
    },
  };
}

/**
 * Simulates a player walking linearly from `start` along unit direction `(dirX, dirZ)`
 * at 60 FPS using the exact same collision and vertical step-damping logic as GameEngine.updatePlayer.
 */
function simulateWalk(
  colliders: VillageColliders,
  start: THREE.Vector3,
  dirX: number,
  dirZ: number,
  speed: number,
  durationSeconds: number,
  resolveAnimals?: (pos: THREE.Vector3, radius: number) => boolean,
): {
  pos: THREE.Vector3;
  visitedHeights: number[];
  maxSupportY: number;
} {
  const pos = start.clone();
  let grounded = true;
  let vy = 0;
  const dt = 1 / 60;
  const steps = Math.round(durationSeconds / dt);
  const visitedHeights: number[] = [];
  let maxSupportY = pos.y;

  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;

  for (let i = 0; i < steps; i++) {
    pos.x += nx * speed * dt;
    pos.z += nz * speed * dt;

    let supportY = resolveWorldCollisions(pos, CHAR_RADIUS, colliders, resolveAnimals);
    if (supportY > maxSupportY) maxSupportY = supportY;

    if (grounded && supportY > pos.y && supportY <= pos.y + MAX_STEP_UP_HEIGHT) {
      pos.y = THREE.MathUtils.damp(pos.y, supportY, 32, dt);
      if (supportY - pos.y < 0.015) pos.y = supportY;
    } else if (grounded && pos.y > supportY && pos.y - supportY <= MAX_STEP_UP_HEIGHT) {
      pos.y = THREE.MathUtils.damp(pos.y, supportY, 28, dt);
      if (pos.y - supportY < 0.015) pos.y = supportY;
    }

    if (grounded && pos.y > supportY + MAX_STEP_UP_HEIGHT) {
      grounded = false;
      vy = 0;
    }

    if (!grounded || pos.y > supportY) {
      vy -= GRAVITY * dt;
      pos.y += vy * dt;
      supportY = resolveWorldCollisions(pos, CHAR_RADIUS, colliders, resolveAnimals);
      if (pos.y <= supportY) {
        pos.y = supportY;
        vy = 0;
        grounded = true;
      }
    }

    visitedHeights.push(Number(pos.y.toFixed(3)));
  }

  return { pos, visitedHeights, maxSupportY };
}

describe('Gully Chhupan Chhupai 1995 — 3D Collision & Map Integrity', () => {
  let textures: VillageTextureSet;

  beforeAll(() => {
    installMinimalCanvasMock();
    const fakeRenderer = {
      capabilities: { getMaxAnisotropy: () => 4 },
    } as unknown as THREE.WebGLRenderer;
    textures = createVillageTextures(fakeRenderer);
  });

  describe('1. Haunted Haveli (Level 6) Staircases & Cellar Collisions', () => {
    it('climbs every step of the Grand Central Staircase smoothly up to Durbar Hall (y = 2.6m) and walks back down', () => {
      const haveli = buildLevelMap(6, textures);
      // Walk north up the Grand Central Staircase from courtyard (0, 0, -9.8) into Durbar Hall (z ~ -16.8)
      const climb = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(0, 0, -9.8),
        0,
        -1,
        5.2,
        1.55,
      );

      expect(climb.pos.z).toBeLessThan(-15.5);
      expect(climb.pos.y).toBeCloseTo(2.6, 1);
      expect(climb.maxSupportY).toBeCloseTo(2.6, 2);

      // Verify smooth monotonic step progression through intermediate steps (not jumping straight 0 -> 2.6)
      const midHeights = climb.visitedHeights.filter((y) => y > 0.3 && y < 2.3);
      expect(midHeights.length).toBeGreaterThan(15);

      // Walk back south down the Grand Central Staircase to the courtyard (y = 0)
      const descend = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(0, 2.6, -16.2),
        0,
        1,
        5.0,
        1.5,
      );
      expect(descend.pos.z).toBeGreaterThan(-10.2);
      expect(descend.pos.y).toBeCloseTo(0, 1);
    });

    it('blocks walking through the side of the Grand Central Staircase from ground level and seals the Underground Tehkhana south wall', () => {
      const haveli = buildLevelMap(6, textures);

      // Walk west at ground level into the east side of the Grand Staircase (x = 2.4, z = -13.2)
      const sideWalk = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(4.2, 0, -13.2),
        -1,
        0,
        5.0,
        0.9,
      );
      expect(sideWalk.pos.x).toBeGreaterThanOrEqual(2.4 + CHAR_RADIUS - 0.02);
      expect(sideWalk.pos.y).toBeCloseTo(0, 2);

      // Walk south from inside the Underground Tehkhana (y = 0) toward the south retaining wall (z = -15.2)
      const cellarWalk = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(0, 0, -17.5),
        0,
        1,
        5.0,
        1.0,
      );
      expect(cellarWalk.pos.z).toBeLessThanOrEqual(-15.45 - CHAR_RADIUS + 0.03);
    });

    it('climbs West & East Wooden Staircases (0 -> 3.2m), Upper Connectors (3.2 -> 2.6m), Rooftop Staircases (3.2 -> 5.8m), and Secret Tehkhana Stairs (0 <-> 2.6m)', () => {
      const haveli = buildLevelMap(6, textures);

      // West courtyard wooden staircase (x = -14.5, z = 12.6 -> 4.5, y: 0 -> 3.2)
      const westUp = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(-14.5, 0, 12.6),
        0,
        -1,
        5.0,
        1.8,
      );
      expect(westUp.pos.z).toBeLessThan(5.6);
      expect(westUp.pos.y).toBeCloseTo(3.2, 1);

      // East courtyard wooden staircase
      const eastUp = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(14.5, 0, 12.6),
        0,
        -1,
        5.0,
        1.8,
      );
      expect(eastUp.pos.z).toBeLessThan(5.6);
      expect(eastUp.pos.y).toBeCloseTo(3.2, 1);

      // Upper balcony -> North Wing 3-step connector (y = 3.2 -> 2.6)
      const conn = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(-14.5, 3.2, -13.0),
        0,
        -1,
        4.5,
        1.0,
      );
      expect(conn.pos.z).toBeLessThan(-15.8);
      expect(conn.pos.y).toBeCloseTo(2.6, 1);

      // West rooftop wooden staircase (x = -26.4, z = -9.0 -> -15.6, y: 3.2 -> 5.8)
      const roofUp = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(-26.4, 3.2, -9.0),
        0,
        -1,
        5.0,
        1.6,
      );
      expect(roofUp.pos.z).toBeLessThan(-14.7);
      expect(roofUp.pos.y).toBeCloseTo(5.8, 1);

      // Secret Tehkhana interior staircase climbing UP from cellar (x = -6.8, y = 0 -> x = -13.8, y = 2.6)
      const secretUp = simulateWalk(
        haveli.colliders,
        new THREE.Vector3(-6.8, 0, -28.4),
        -1,
        0,
        4.8,
        1.7,
      );
      expect(secretUp.pos.x).toBeLessThan(-12.8);
      expect(secretUp.pos.y).toBeCloseTo(2.6, 1);
    });
  });

  describe('2. Main Village Temple (Level 1) Entrance Step Collisions', () => {
    it('smoothly climbs all 3 front entrance steps (0 -> 0.16 -> 0.32 -> 0.48m), descends cleanly, and blocks sanctum walls and curbs', () => {
      const village = buildLevelMap(1, textures);
      // Temple is built at (24.5, -25.5); front entrance stairs span z = -21.75..-20.41
      const climb = simulateWalk(
        village.colliders,
        new THREE.Vector3(24.5, 0, -19.6),
        0,
        -1,
        4.6,
        0.7,
      );

      // Should land cleanly on upper temple platform (y = 0.48m) in front of the sanctum doorway
      expect(climb.pos.y).toBeCloseTo(0.48, 2);
      expect(climb.pos.z).toBeLessThan(-21.8);
      // Should be stopped before penetrating the solid sanctum wall (maxZ = -25.5 - 0.6 + 2.2 + 0.12 = -23.78)
      expect(climb.pos.z).toBeGreaterThanOrEqual(-23.78 + CHAR_RADIUS - 0.02);

      // Keep walking north into the sanctum wall: must NOT pass through!
      const intoSanctum = simulateWalk(
        village.colliders,
        climb.pos,
        0,
        -1,
        5.2,
        1.2,
      );
      expect(intoSanctum.pos.z).toBeGreaterThanOrEqual(-23.78 + CHAR_RADIUS - 0.02);

      // Walk south back down the 3 entrance steps to ground (y = 0)
      const descend = simulateWalk(
        village.colliders,
        new THREE.Vector3(24.5, 0.48, -22.2),
        0,
        1,
        4.6,
        0.9,
      );
      expect(descend.pos.z).toBeGreaterThan(-19.8);
      expect(descend.pos.y).toBeCloseTo(0, 2);

      // Walk west at ground level into the east front side curb (x = 24.5 + 1.55..1.79, z = -21.0)
      const intoCurb = simulateWalk(
        village.colliders,
        new THREE.Vector3(27.0, 0, -21.0),
        -1,
        0,
        4.5,
        0.5,
      );
      expect(intoCurb.pos.x).toBeGreaterThanOrEqual(24.5 + 1.79 + CHAR_RADIUS - 0.03);
    });
  });

  describe('3. Cow & Buffalo 3D Body Collisions', () => {
    const openArena: VillageColliders = {
      boxes: [],
      circles: [],
      worldRadius: 40,
    };

    for (const species of ['cow', 'buffalo'] as const) {
      it(`prevents players from walking through a ${species} from front, rear, and both flanks`, () => {
        const animal: LargeAnimalColliderSpec = {
          species,
          x: 0,
          z: 0,
          rotY: 0, // facing +Z
          isResting: false,
          scale: 1,
        };
        const expectedHalfW = species === 'buffalo' ? 0.46 : 0.4;
        const expectedFront = species === 'buffalo' ? 0.78 : 0.74;
        const expectedRear = species === 'buffalo' ? -0.64 : -0.6;
        const resolver = (p: THREE.Vector3, r: number) =>
          resolveLargeAnimalCapsuleCollision(p, r, animal);

        // Front approach (walking -Z into head/chest)
        const front = simulateWalk(openArena, new THREE.Vector3(0, 0, 3.0), 0, -1, 5.2, 1.2, resolver);
        expect(front.pos.z).toBeGreaterThanOrEqual(expectedFront + expectedHalfW + CHAR_RADIUS - 0.02);

        // Rear approach (walking +Z into rump)
        const rear = simulateWalk(openArena, new THREE.Vector3(0, 0, -3.0), 0, 1, 5.2, 1.2, resolver);
        expect(rear.pos.z).toBeLessThanOrEqual(expectedRear - expectedHalfW - CHAR_RADIUS + 0.02);

        // Right flank approach (walking -X into flank)
        const right = simulateWalk(openArena, new THREE.Vector3(3.0, 0, 0), -1, 0, 5.2, 1.2, resolver);
        expect(right.pos.x).toBeGreaterThanOrEqual(expectedHalfW + CHAR_RADIUS - 0.02);

        // Left flank approach (walking +X into flank)
        const left = simulateWalk(openArena, new THREE.Vector3(-3.0, 0, 0), 1, 0, 5.2, 1.2, resolver);
        expect(left.pos.x).toBeLessThanOrEqual(-(expectedHalfW + CHAR_RADIUS) + 0.02);

        // Elevated player (balcony y = 2.6m) passes freely above ground animal
        const above = simulateWalk(openArena, new THREE.Vector3(0, 2.6, 2.0), 0, -1, 5.2, 0.8, resolver);
        expect(above.pos.z).toBeLessThan(-1.5);
      });
    }

    it('stops players against live VillageNpcSystem cows & buffaloes on Level 1', () => {
      const village = buildLevelMap(1, textures);
      const npcSystem = new VillageNpcSystem(
        1,
        textures,
        village.colliders,
        village.minimapLayout,
        'high',
      );
      const liveAnimals = (
        npcSystem as unknown as {
          animals: Array<{
            species: string;
            x: number;
            z: number;
            rotY: number;
            minQuality: string;
          }>;
        }
      ).animals;

      const cow = liveAnimals.find((a) => a.species === 'cow');
      const buffalo = liveAnimals.find((a) => a.species === 'buffalo');
      expect(cow).toBeDefined();
      expect(buffalo).toBeDefined();

      for (const animal of [cow!, buffalo!]) {
        const probe = new THREE.Vector3(animal.x, 0, animal.z);
        const hit = npcSystem.resolveLargeAnimalCollisions(probe, CHAR_RADIUS);
        expect(hit).toBe(true);
        const distFromCenter = Math.hypot(probe.x - animal.x, probe.z - animal.z);
        expect(distFromCenter).toBeGreaterThanOrEqual(0.75);
      }

      npcSystem.dispose();
    });

    it('re-clamps against static circles & walls when an animal pushes a player toward an obstacle', () => {
      const tightArena: VillageColliders = {
        boxes: [{ minX: -4, maxX: -1.2, minZ: -3, maxZ: 3, blocksSight: true }],
        circles: [{ x: 1.5, z: 0, radius: 0.6, blocksSight: false }],
        worldRadius: 20,
      };
      const buffalo: LargeAnimalColliderSpec = {
        species: 'buffalo',
        x: 0,
        z: 0,
        rotY: 0,
      };
      const pos = new THREE.Vector3(0.7, 0, 0);
      resolveWorldCollisions(pos, CHAR_RADIUS, tightArena, (p, r) =>
        resolveLargeAnimalCapsuleCollision(p, r, buffalo),
      );
      // Must stay outside the circle collider at (1.5, 0, r=0.6)
      const distToCircle = Math.hypot(pos.x - 1.5, pos.z);
      expect(distToCircle).toBeGreaterThanOrEqual(0.6 + CHAR_RADIUS - 0.02);
    });
  });

  describe('4. All 15 Maps & Multiplayer Spawn Point Validation', () => {
    it('builds all 15 maps cleanly with valid colliders and unobstructed solo spawn points', () => {
      for (let levelId = 1; levelId <= TOTAL_LEVELS; levelId++) {
        const map = buildLevelMap(levelId, textures);
        expect(map.colliders.worldRadius, `Level ${levelId} worldRadius`).toBeGreaterThan(20);
        expect(map.patrolPoints.length, `Level ${levelId} patrolPoints`).toBeGreaterThan(0);
        expect(map.hidingSpots.length, `Level ${levelId} hidingSpots`).toBeGreaterThan(0);

        // Ensure VillageNpcSystem initializes cleanly on every single map (Levels 1-15) without runtime error
        const npcSystem = new VillageNpcSystem(
          levelId,
          textures,
          map.colliders,
          map.minimapLayout,
          'high',
        );
        npcSystem.update(0.016, new THREE.Vector3(0, 2, 10), new THREE.Vector3(0, 0, 0));
        npcSystem.dispose();

        if (map.spawnPoints) {
          const points: Array<[string, number, number]> = [
            ['seeker', map.spawnPoints.seeker[0], map.spawnPoints.seeker[1]],
            ...map.spawnPoints.hiders.map(
              ([hx, hz], idx): [string, number, number] => [`hider_${idx}`, hx, hz],
            ),
          ];
          for (const [label, sx, sz] of points) {
            const p = new THREE.Vector3(sx, 0, sz);
            resolveWorldCollisions(p, CHAR_RADIUS, map.colliders);
            const displacement = Math.hypot(p.x - sx, p.z - sz);
            expect(
              displacement,
              `Level ${levelId} ${label} spawn (${sx}, ${sz}) displaced by ${displacement.toFixed(2)}m`,
            ).toBeLessThan(0.85);
          }
        }
      }
    });

    it('keeps all server.ts multiplayer spawn points for Levels 1-15 unobstructed and within map bounds', () => {
      // Parse LEVEL_SERVER_SPAWNS coordinates directly from server.ts so tests stay synced with production server
      const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
      const blockMatch = serverSrc.match(
        /const LEVEL_SERVER_SPAWNS: Record<number, LevelServerSpawns> = (\{[\s\S]*?\n\});/,
      );
      expect(blockMatch).not.toBeNull();

      // Safe evaluation of static numeric spawn table (contains only Math.PI & number literals)
      const levelSpawns = new Function(`return ${blockMatch![1]};`)() as Record<
        number,
        {
          worldRadius: number;
          seeker: [number, number, number];
          hiders: Array<[number, number, number]>;
        }
      >;

      const issues: string[] = [];
      for (let levelId = 1; levelId <= TOTAL_LEVELS; levelId++) {
        const sp = levelSpawns[levelId];
        expect(sp, `server.ts missing spawns for level ${levelId}`).toBeDefined();
        expect(sp.hiders.length, `Level ${levelId} should support 10 players`).toBeGreaterThanOrEqual(10);

        const map = buildLevelMap(levelId, textures);
        const allSpawns: Array<[string, number, number]> = [
          ['seeker', sp.seeker[0], sp.seeker[1]],
          ...sp.hiders.map(([hx, hz], idx): [string, number, number] => [`hider_${idx}`, hx, hz]),
        ];

        for (const [label, sx, sz] of allSpawns) {
          const radialDist = Math.hypot(sx, sz);
          if (radialDist >= map.colliders.worldRadius - CHAR_RADIUS) {
            issues.push(`L${levelId} ${label} (${sx},${sz}) outside worldRadius ${map.colliders.worldRadius}`);
          }

          const p = new THREE.Vector3(sx, 0, sz);
          resolveWorldCollisions(p, CHAR_RADIUS, map.colliders);
          const displacement = Math.hypot(p.x - sx, p.z - sz);
          if (displacement >= 0.85) {
            issues.push(
              `L${levelId} ${label} (${sx},${sz}) -> (${p.x.toFixed(1)},${p.z.toFixed(1)}) disp=${displacement.toFixed(2)}m`,
            );
          }
        }
      }
      expect(issues, issues.join('\n')).toEqual([]);
    });
  });

  describe('5. Third-Person Camera Smoothness Inside Houses & Near Walls/Stairs', () => {
    function makeStubDom(): HTMLElement {
      return {
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      } as unknown as HTMLElement;
    }

    it('keeps a comfortable view distance inside a house without snapping into the player', () => {
      const village = buildLevelMap(1, textures);
      village.group.updateMatrixWorld(true);
      // Fade roofs of the NW Mud House (-10.8, -9.5) just like updateHouseRoofVisibility
      const nwHouse = village.houseInteriors.find((h) => h.id === 'house-nw');
      expect(nwHouse).toBeDefined();
      for (const m of nwHouse!.roofMeshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = 0.14;
      }

      const occluders: THREE.Mesh[] = [];
      const b = new THREE.Box3();
      const s = new THREE.Vector3();
      village.group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        b.setFromObject(obj);
        b.getSize(s);
        if (s.y < 1.15 || s.x > 35 || s.z > 35 || Math.max(s.x, s.z) < 0.72) return;
        occluders.push(obj);
      });

      const ctrl = new ThirdPersonCameraController(makeStubDom());
      ctrl.setWorldCollisionData(occluders, village.colliders);
      const cam = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 200);

      // Start outside doorway, then walk inside near the back wall
      const playerPos = new THREE.Vector3(nwHouse!.doorX, 0, nwHouse!.doorZ + 1.5);
      ctrl.snapBehind(playerPos, Math.PI, cam);

      let prevDist = cam.position.distanceTo(playerPos);
      let maxSingleFrameDrop = 0;

      // Walk smoothly inside the house for 1.5 seconds (90 frames)
      for (let i = 0; i < 90; i++) {
        playerPos.z -= 0.04;
        ctrl.update(
          cam,
          {
            position: playerPos,
            facingYaw: Math.PI,
            moveSpeed: 2.4,
            crouchBlend: 0,
            insideHouse: true,
            isPlayerControlled: true,
          },
          1 / 60,
        );
        const curDist = cam.position.distanceTo(playerPos);
        const drop = prevDist - curDist;
        if (drop > maxSingleFrameDrop) maxSingleFrameDrop = drop;
        prevDist = curDist;
        // Must never cram right on top of the player (< 1.8m)
        expect(curDist).toBeGreaterThan(1.8);
      }

      // No violent 1-frame camera snap (> 1.2m drop in 16ms)
      expect(maxSingleFrameDrop).toBeLessThan(1.2);
      // Settled indoor view should remain comfortably pulled back looking over walls
      expect(prevDist).toBeGreaterThan(3.5);
      ctrl.dispose();
    });

    it('does not snap close to the player when standing near a wall corner or stair block', () => {
      const ctrl = new ThirdPersonCameraController(makeStubDom());
      // Place a solid wall directly behind the player at z = +2.6 (3.2m tall)
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3.2, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x888888 }),
      );
      wallMesh.position.set(0, 1.6, 2.6);
      wallMesh.updateMatrixWorld(true);

      const colliders: VillageColliders = {
        boxes: [{ minX: -4, maxX: 4, minZ: 2.4, maxZ: 2.8, blocksSight: true, topY: 3.2 }],
        circles: [],
        worldRadius: 40,
      };
      ctrl.setWorldCollisionData([wallMesh], colliders);

      const cam = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 200);
      const playerPos = new THREE.Vector3(0, 0, 0.8);
      // Start unobstructed facing south (+Z), so camera starts north (-Z) at ~8.4m
      ctrl.snapBehind(playerPos, 0, cam);
      const initialDist = cam.position.distanceTo(playerPos);
      expect(initialDist).toBeGreaterThan(7.5);

      // Now place player facing north (Math.PI) so the wall at z=2.6 is behind them,
      // and run 1 frame: camera must smoothly damp rather than instantly jumping to < 2m in 1 frame
      ctrl.recenterBehind(Math.PI);
      let prevDist = cam.position.distanceTo(playerPos);
      let maxDrop = 0;
      for (let i = 0; i < 60; i++) {
        ctrl.update(
          cam,
          {
            position: playerPos,
            facingYaw: Math.PI,
            moveSpeed: 0,
            crouchBlend: 0,
            insideHouse: false,
            isPlayerControlled: true,
          },
          1 / 60,
        );
        const curDist = cam.position.distanceTo(playerPos);
        maxDrop = Math.max(maxDrop, prevDist - curDist);
        prevDist = curDist;
        expect(curDist).toBeGreaterThan(1.65);
      }

      expect(maxDrop).toBeLessThan(1.1);
      ctrl.dispose();
    });
  });
});

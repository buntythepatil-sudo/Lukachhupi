import * as THREE from 'three';
import type { VillageColliders } from './types';

export interface LargeAnimalColliderSpec {
  species: 'cow' | 'buffalo';
  x: number;
  z: number;
  rotY: number;
  isResting?: boolean;
  scale?: number;
}

export const MAX_STEP_UP_HEIGHT = 0.3;
export const STAIR_RISER_BAND = 0.68;
export const STAIR_RISER_FOOT_RADIUS = 0.16;

/**
 * Resolves a single oriented 3D capsule collision between an actor (sphere/cylinder at `pos`)
 * and a cow or buffalo body matching the actual 3D animal mesh proportions (rump to head/horns).
 */
export function resolveLargeAnimalCapsuleCollision(
  pos: THREE.Vector3,
  actorRadius: number,
  animal: LargeAnimalColliderSpec,
): boolean {
  const scale = animal.scale && animal.scale > 0 ? animal.scale : 1;
  const isBuffalo = animal.species === 'buffalo';

  // 3D vertical height check so players on balconies/rooftops above never hit ground animals
  const bodyTopY =
    (animal.isResting ? 0.98 : isBuffalo ? 1.56 : 1.48) * scale;
  if (pos.y >= bodyTopY) return false;

  // Oriented 3D torso-to-head capsule segment matching cow/buffalo visual geometry
  const rearOffset = (isBuffalo ? -0.64 : -0.6) * scale;
  const frontOffset = (isBuffalo ? 0.78 : 0.74) * scale;
  const bodyHalfWidth = (isBuffalo ? 0.46 : 0.4) * scale;

  const fx = Math.sin(animal.rotY);
  const fz = Math.cos(animal.rotY);

  const ax = animal.x + fx * rearOffset;
  const az = animal.z + fz * rearOffset;
  const bx = animal.x + fx * frontOffset;
  const bz = animal.z + fz * frontOffset;

  const segX = bx - ax;
  const segZ = bz - az;
  const segLenSq = segX * segX + segZ * segZ;

  let t = 0.5;
  if (segLenSq > 1e-6) {
    t = ((pos.x - ax) * segX + (pos.z - az) * segZ) / segLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }

  const closestX = ax + segX * t;
  const closestZ = az + segZ * t;
  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  const minDist = actorRadius + bodyHalfWidth;
  const dSq = dx * dx + dz * dz;

  if (dSq < minDist * minDist) {
    if (dSq > 1e-6) {
      const d = Math.sqrt(dSq);
      const overlap = minDist - d;
      pos.x += (dx / d) * overlap;
      pos.z += (dz / d) * overlap;
    } else {
      // Fallback push perpendicular to animal flank when centers coincide
      pos.x += fz * minDist;
      pos.z -= fx * minDist;
    }
    return true;
  }

  return false;
}

function pushOutOfBox(
  pos: THREE.Vector3,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  radius: number,
): void {
  const closestX = THREE.MathUtils.clamp(pos.x, minX, maxX);
  const closestZ = THREE.MathUtils.clamp(pos.z, minZ, maxZ);
  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  const dSq = dx * dx + dz * dz;

  if (dSq < radius * radius) {
    if (dSq > 1e-6) {
      const d = Math.sqrt(dSq);
      const overlap = radius - d;
      pos.x += (dx / d) * overlap;
      pos.z += (dz / d) * overlap;
    } else {
      const left = Math.abs(pos.x - minX);
      const right = Math.abs(maxX - pos.x);
      const top = Math.abs(pos.z - minZ);
      const bottom = Math.abs(maxZ - pos.z);
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = minX - radius;
      else if (m === right) pos.x = maxX + radius;
      else if (m === top) pos.z = minZ - radius;
      else pos.z = maxZ + radius;
    }
  }
}

/**
 * 2-pass 3D collision & climbable-staircase solver:
 *  - Pass 1 discovers the highest climbable surface (`supportY`) currently supporting the actor's feet.
 *  - Pass 2 resolves solid walls, unreached ledges, and circles using `effectiveY = max(pos.y, supportY)`
 *    so multi-step staircases with narrow treads (0.36m-0.46m) never push climbers off the current step,
 *    while approaching stairs/ledges from the side or below remains 100% solid.
 *  - Pass 3 resolves dynamic cow/buffalo 3D capsules and re-clamps against static world colliders.
 */
export function resolveWorldCollisions(
  pos: THREE.Vector3,
  radius: number,
  colliders: VillageColliders,
  resolveLargeAnimals?: (pos: THREE.Vector3, radius: number) => boolean,
): number {
  let supportY = 0;
  const maxR = colliders.worldRadius - radius;
  const distSq = pos.x * pos.x + pos.z * pos.z;
  if (distSq > maxR * maxR) {
    const dist = Math.sqrt(distSq);
    pos.x = (pos.x / dist) * maxR;
    pos.z = (pos.z / dist) * maxR;
  }

  const footTol = radius * 0.56;

  // Pass 1: Discover climbable support elevation under the actor's feet
  for (let i = 0; i < colliders.boxes.length; i++) {
    const box = colliders.boxes[i];
    if (!box.climbable || box.topY === undefined) continue;
    if (box.minY !== undefined && pos.y + 1.5 < box.minY) continue;
    if (pos.y < box.topY - MAX_STEP_UP_HEIGHT) continue;

    if (
      pos.x > box.minX - footTol &&
      pos.x < box.maxX + footTol &&
      pos.z > box.minZ - footTol &&
      pos.z < box.maxZ + footTol
    ) {
      if (box.topY > supportY) supportY = box.topY;
    }
  }

  for (let i = 0; i < colliders.circles.length; i++) {
    const c = colliders.circles[i];
    if (!c.climbable || c.topY === undefined) continue;
    if (pos.y < c.topY - MAX_STEP_UP_HEIGHT) continue;

    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const climbR = c.radius + footTol;
    if (dx * dx + dz * dz < climbR * climbR) {
      if (c.topY > supportY) supportY = c.topY;
    }
  }

  const effectiveY = Math.max(pos.y, supportY);

  // Pass 2: Resolve horizontal blocking against non-climbable walls & unreached ledges
  const resolveStaticPass = () => {
    for (let i = 0; i < colliders.boxes.length; i++) {
      const box = colliders.boxes[i];
      if (box.minY !== undefined && effectiveY + 1.5 < box.minY) {
        continue;
      }
      if (!box.climbable && box.topY !== undefined && effectiveY >= box.topY - 0.08) {
        continue;
      }
      if (
        box.climbable &&
        box.topY !== undefined &&
        effectiveY >= box.topY - MAX_STEP_UP_HEIGHT
      ) {
        continue;
      }

      // While actively climbing steps (`supportY > 0.05`), higher risers within the next 2-3 steps
      // use a tight foot-contact radius so they never push climbers off narrow treads (0.36m-0.46m),
      // while ground-level side approaches (`supportY <= 0.05`) and tall drops remain full-radius solid.
      let blockRadius = radius;
      if (
        box.climbable &&
        box.topY !== undefined &&
        supportY > 0.05 &&
        box.topY - effectiveY <= STAIR_RISER_BAND
      ) {
        blockRadius = Math.min(radius, STAIR_RISER_FOOT_RADIUS);
      }

      pushOutOfBox(pos, box.minX, box.maxX, box.minZ, box.maxZ, blockRadius);
    }

    for (let i = 0; i < colliders.circles.length; i++) {
      const c = colliders.circles[i];
      if (
        c.climbable &&
        c.topY !== undefined &&
        effectiveY >= c.topY - MAX_STEP_UP_HEIGHT
      ) {
        continue;
      }

      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minDist = radius + c.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const overlap = minDist - d;
        pos.x += (dx / d) * overlap;
        pos.z += (dz / d) * overlap;
      }
    }
  };

  resolveStaticPass();

  // Pass 3: Dynamic 3D oriented-capsule collisions against village cows & buffaloes
  if (resolveLargeAnimals?.(pos, radius)) {
    // Safety re-clamp against static boxes, circles, and world perimeter so animals never push actors into walls
    resolveStaticPass();

    const postDistSq = pos.x * pos.x + pos.z * pos.z;
    if (postDistSq > maxR * maxR) {
      const postDist = Math.sqrt(postDistSq);
      pos.x = (pos.x / postDist) * maxR;
      pos.z = (pos.z / postDist) * maxR;
    }
  }

  return supportY;
}

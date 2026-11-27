import {
  CharacterAnimState,
  HouseInterior,
  VillageMinimapLayout,
} from './types';

export type FootstepSurface =
  | 'dirt'
  | 'grass'
  | 'stone'
  | 'wood'
  | 'temple_steps'
  | 'haveli_interior'
  | 'school_corridor'
  | 'water';

export interface FootstepEnvironment {
  surface: FootstepSurface;
  indoors: boolean;
  /** 0 = dry outdoor, up to 0.65 = resonant corridor / eerie haveli hall */
  echoLevel: number;
}

export interface NearbyAudioActor {
  id: string;
  x: number;
  y: number;
  z: number;
  moveSpeed: number;
  animState: CharacterAnimState;
  grounded: boolean;
}

export const REMOTE_FOOTSTEP_MAX_DISTANCE = 18.5;
export const REMOTE_FOOTSTEP_NEAR_DISTANCE = 1.8;

/**
 * Computes smooth, realistic distance attenuation for nearby multiplayer footsteps.
 * Returns 0 beyond maxDistance so distant players skip Web Audio node allocation entirely.
 */
export function computeFootstepDistanceGain(
  distance: number,
  maxDistance = REMOTE_FOOTSTEP_MAX_DISTANCE,
): number {
  if (!Number.isFinite(distance) || distance >= maxDistance) return 0;
  if (distance <= REMOTE_FOOTSTEP_NEAR_DISTANCE) return 0.72;
  const norm =
    (distance - REMOTE_FOOTSTEP_NEAR_DISTANCE) /
    (maxDistance - REMOTE_FOOTSTEP_NEAR_DISTANCE);
  // Smooth quadratic-like rolloff sounds natural outdoors and indoors
  const atten = Math.pow(1 - Math.max(0, Math.min(1, norm)), 1.75);
  return atten * 0.72;
}

/**
 * Computes step cadence interval (seconds) directly from movement mode and speed.
 * Walking is slow and gentle; running is faster and heavier; sneaking is quiet and measured.
 */
export function computeStepIntervalSeconds(
  mode: 'walk' | 'run' | 'sneak',
  moveSpeed: number,
): number {
  const safeSpeed = Math.max(0.25, Math.min(9.0, moveSpeed));
  if (mode === 'run') {
    // Typical run speed ~4.0-5.8 m/s -> 0.25s-0.31s per step
    const t = Math.max(0, Math.min(1, (safeSpeed - 3.6) / 2.6));
    return 0.31 - t * 0.055;
  }
  if (mode === 'sneak') {
    const t = Math.max(0, Math.min(1, (safeSpeed - 0.8) / 2.2));
    return 0.58 - t * 0.08;
  }
  // Walking speed ~0.5-3.6 m/s -> 0.40s-0.52s per step
  const t = Math.max(0, Math.min(1, (safeSpeed - 0.8) / 2.8));
  return 0.52 - t * 0.11;
}

function pointInRotatedRect(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  halfW: number,
  halfL: number,
  rotY: number,
): boolean {
  const dx = px - cx;
  const dz = pz - cz;
  if (Math.abs(rotY) < 0.001) {
    return Math.abs(dx) <= halfW && Math.abs(dz) <= halfL;
  }
  const cos = Math.cos(-rotY);
  const sin = Math.sin(-rotY);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= halfW && Math.abs(lz) <= halfL;
}

function findContainingInterior(
  x: number,
  y: number,
  z: number,
  houseInteriors: HouseInterior[],
): HouseInterior | null {
  for (let i = 0; i < houseInteriors.length; i++) {
    const h = houseInteriors[i];
    if (x < h.minX || x > h.maxX || z < h.minZ || z > h.maxZ) continue;
    const minY = h.minY ?? -0.5;
    const maxY = h.maxY ?? 3.6;
    if (y >= minY - 0.25 && y <= maxY + 0.25) {
      return h;
    }
  }
  return null;
}

function isOnRoad(
  x: number,
  z: number,
  layout: VillageMinimapLayout,
  pad = 0.25,
): boolean {
  for (let i = 0; i < layout.roads.length; i++) {
    const r = layout.roads[i];
    if (
      pointInRotatedRect(
        x,
        z,
        r.x,
        r.z,
        r.width * 0.5 + pad,
        r.length * 0.5 + pad,
        r.rotY,
      )
    ) {
      return true;
    }
  }
  return false;
}

const STONE_ROAD_LEVELS = new Set([4, 5, 6, 8, 9, 10, 13]);
const WOOD_INTERIOR_LEVELS = new Set([3, 7, 9, 11, 12, 15]);
const GRASS_DEFAULT_LEVELS = new Set([1, 2, 3, 6, 7, 9, 11, 13]);

/**
 * Zero-allocation environment & surface classifier for all 15 maps in
 * Gully Chhupan Chhupai 1995.
 */
export function detectFootstepEnvironment(
  levelId: number,
  x: number,
  y: number,
  z: number,
  layout: VillageMinimapLayout,
  houseInteriors: HouseInterior[],
): FootstepEnvironment {
  // 1. Walkable bridges & wooden piers first (so crossing over water sounds like wood/stone, not splash)
  for (let i = 0; i < layout.buildings.length; i++) {
    const b = layout.buildings[i];
    if (b.kind !== 'bridge') continue;
    if (
      pointInRotatedRect(
        x,
        z,
        b.x,
        b.z,
        b.width * 0.5 + 0.35,
        b.depth * 0.5 + 0.35,
        b.rotY,
      )
    ) {
      // Level 11 (Monsoon Tea Estate) has arched stone bridges; others (River Village, Lighthouse pier, Snow Hamlet) are wood
      return levelId === 11
        ? { surface: 'stone', indoors: false, echoLevel: 0.08 }
        : { surface: 'wood', indoors: false, echoLevel: 0.08 };
    }
  }

  // 2. Temple steps & elevated temple stone plinths (Level 1 village temple + temples on other maps)
  if (levelId === 1) {
    const templeDist = Math.hypot(x - 24.5, z - -25.5);
    if (templeDist <= 7.2 && (y >= 0.06 || templeDist <= 5.4)) {
      return { surface: 'temple_steps', indoors: false, echoLevel: 0.2 };
    }
  }
  for (let i = 0; i < layout.buildings.length; i++) {
    const b = layout.buildings[i];
    if (b.kind !== 'temple') continue;
    const halfW = b.width * 0.5 + 1.9;
    const halfD = b.depth * 0.5 + 1.9;
    if (pointInRotatedRect(x, z, b.x, b.z, halfW, halfD, b.rotY)) {
      if (y >= 0.06 || levelId === 1 || levelId === 8 || levelId === 13 || levelId === 15) {
        return { surface: 'temple_steps', indoors: false, echoLevel: 0.2 };
      }
    }
  }

  // 3. Haunted Haveli (Level 6): upper wooden balconies, eerie mansion interiors, rooftop stone
  if (levelId === 6) {
    if (y >= 5.25) {
      return { surface: 'stone', indoors: false, echoLevel: 0.14 };
    }
    if (y >= 2.05 && y < 5.25) {
      return { surface: 'wood', indoors: true, echoLevel: 0.38 };
    }
    const interior = findContainingInterior(x, y, z, houseInteriors);
    if (interior || (Math.abs(x) <= 21.5 && z >= -22.5 && z <= 14.2)) {
      return { surface: 'haveli_interior', indoors: true, echoLevel: 0.56 };
    }
  }

  // 4. School Campus (Level 2): pillared verandas, corridors, upper school balcony & classrooms
  if (levelId === 2) {
    const onNorthCorridor =
      Math.abs(x) <= 23.0 && z >= -14.8 && z <= -8.4;
    const onWestCorridor =
      x >= -21.5 && x <= -15.5 && z >= -13.0 && z <= 21.0;
    const onEastCorridor =
      x >= 15.5 && x <= 21.5 && z >= -13.0 && z <= 21.0;
    const interior = findContainingInterior(x, y, z, houseInteriors);
    if (y >= 2.8 || onNorthCorridor || onWestCorridor || onEastCorridor || interior) {
      return {
        surface: 'school_corridor',
        indoors: true,
        echoLevel: interior ? 0.52 : 0.44,
      };
    }
  }

  // 5. Shallow water margins (ponds, rivers, streams, lotus pools, cove shore, orchard irrigation channels)
  if (y < 0.85) {
    for (let i = 0; i < layout.landmarks.length; i++) {
      const lm = layout.landmarks[i];
      if (lm.kind === 'pond') {
        const dist = Math.hypot(x - lm.x, z - lm.z);
        if (dist <= lm.radius + 1.85) {
          return { surface: 'water', indoors: false, echoLevel: 0.05 };
        }
      }
    }
    if (layout.waterRects) {
      for (let i = 0; i < layout.waterRects.length; i++) {
        const wr = layout.waterRects[i];
        if (
          pointInRotatedRect(
            x,
            z,
            wr.x,
            wr.z,
            wr.width * 0.5 + 1.55,
            wr.length * 0.5 + 1.55,
            wr.rotY,
          )
        ) {
          return { surface: 'water', indoors: false, echoLevel: 0.05 };
        }
      }
    }
    // Level 3 Mango Farm earthen irrigation channels
    if (levelId === 3 && y < 0.45) {
      const nearChannel =
        (Math.abs(z - 11.2) < 1.25 && Math.abs(x) < 32) ||
        (Math.abs(z + 24.5) < 1.25 && Math.abs(x) < 32) ||
        (Math.abs(x + 15.5) < 1.25 && z > -26 && z < 16) ||
        (Math.abs(x - 15.5) < 1.25 && z > -26 && z < 16);
      if (nearChannel) {
        return { surface: 'water', indoors: false, echoLevel: 0.04 };
      }
    }
  }

  // 6. House / Building Interiors across all remaining maps
  const interior = findContainingInterior(x, y, z, houseInteriors);
  if (interior) {
    const idLower = `${interior.id} ${interior.label}`.toLowerCase();
    if (idLower.includes('school') || idLower.includes('class')) {
      return { surface: 'school_corridor', indoors: true, echoLevel: 0.46 };
    }
    if (idLower.includes('haveli') || idLower.includes('cellar')) {
      return { surface: 'haveli_interior', indoors: true, echoLevel: 0.5 };
    }
    if (
      WOOD_INTERIOR_LEVELS.has(levelId) ||
      idLower.includes('cottage') ||
      idLower.includes('chalet') ||
      idLower.includes('bungalow') ||
      idLower.includes('hut') ||
      idLower.includes('shed')
    ) {
      return { surface: 'wood', indoors: true, echoLevel: 0.26 };
    }
    if (levelId === 4 || levelId === 5 || levelId === 8 || levelId === 10 || levelId === 13) {
      return { surface: 'stone', indoors: true, echoLevel: 0.3 };
    }
    // Traditional village mud house interior (warm packed earth + subtle room echo)
    return { surface: 'dirt', indoors: true, echoLevel: 0.24 };
  }

  // 7. Rooftops, elevated wooden decks, and platforms
  if (y >= 2.2) {
    if (WOOD_INTERIOR_LEVELS.has(levelId)) {
      return { surface: 'wood', indoors: false, echoLevel: 0.06 };
    }
    return { surface: 'stone', indoors: false, echoLevel: 0.08 };
  }

  for (let i = 0; i < layout.buildings.length; i++) {
    const b = layout.buildings[i];
    if (b.kind === 'platform') {
      if (
        pointInRotatedRect(
          x,
          z,
          b.x,
          b.z,
          b.width * 0.5 + 0.3,
          b.depth * 0.5 + 0.3,
          b.rotY,
        )
      ) {
        return { surface: 'stone', indoors: false, echoLevel: 0.12 };
      }
    } else if (b.kind === 'hut') {
      if (
        pointInRotatedRect(
          x,
          z,
          b.x,
          b.z,
          b.width * 0.5 + 0.2,
          b.depth * 0.5 + 0.2,
          b.rotY,
        )
      ) {
        return { surface: 'wood', indoors: true, echoLevel: 0.2 };
      }
    }
  }

  for (let i = 0; i < layout.landmarks.length; i++) {
    const lm = layout.landmarks[i];
    const dist = Math.hypot(x - lm.x, z - lm.z);
    if (lm.kind === 'stage' && dist <= lm.radius + 0.5) {
      return { surface: 'wood', indoors: false, echoLevel: 0.14 };
    }
    if (lm.kind === 'courtyard' && dist <= lm.radius) {
      return { surface: 'stone', indoors: false, echoLevel: 0.1 };
    }
    if (lm.kind === 'well' && dist <= lm.radius + 1.5) {
      return { surface: 'stone', indoors: false, echoLevel: 0.08 };
    }
  }

  // 8. Roads & walkways (stone paths vs village dirt roads)
  if (isOnRoad(x, z, layout)) {
    if (STONE_ROAD_LEVELS.has(levelId)) {
      return { surface: 'stone', indoors: false, echoLevel: 0.06 };
    }
    return { surface: 'dirt', indoors: false, echoLevel: 0 };
  }

  // 9. Explicit grass, farm, and garden zones
  for (let i = 0; i < layout.landmarks.length; i++) {
    const lm = layout.landmarks[i];
    if (
      lm.kind === 'farm' ||
      lm.kind === 'garden' ||
      lm.kind === 'grass' ||
      lm.kind === 'banyan'
    ) {
      if (Math.hypot(x - lm.x, z - lm.z) <= lm.radius) {
        return { surface: 'grass', indoors: false, echoLevel: 0 };
      }
    }
  }

  // 10. Map-level natural off-road ground
  if (GRASS_DEFAULT_LEVELS.has(levelId)) {
    // On Level 1 Traditional Village, keep central street plaza dusty dirt and outer meadows grassy
    if (levelId === 1 && Math.hypot(x, z) < 16.5) {
      return { surface: 'dirt', indoors: false, echoLevel: 0 };
    }
    return { surface: 'grass', indoors: false, echoLevel: 0 };
  }

  if (levelId === 10 || levelId === 4 || levelId === 5 || levelId === 8) {
    return { surface: 'stone', indoors: false, echoLevel: 0.05 };
  }

  return { surface: 'dirt', indoors: false, echoLevel: 0 };
}

import * as THREE from 'three';
import { VillageTextureSet } from './textures';
import {
  GraphicsQuality,
  SeatSpot,
  VillageColliders,
  VillageMinimapLayout,
} from './types';
import {
  AnimalAnimMode,
  AnimalRig,
  AnimalSpecies,
  createAmbientCharpaiMesh,
  createAmbientVendorDisplay,
  createCricketSetProps,
  createNpcAssetPool,
  createVillageAnimal,
  createVillagerNpc,
  NpcAssetPool,
  VillagerAnimMode,
  VillagerArchetype,
  VillagerRig,
} from './villageNpcModels';

type QualityTier = GraphicsQuality;
const QUALITY_RANK: Record<QualityTier, number> = { low: 0, medium: 1, high: 2 };

interface Waypoint2D {
  x: number;
  z: number;
}

interface SlappableHumanEntry {
  id: string;
  label: string;
  rig: VillagerRig;
  minQuality: QualityTier;
  isSeated: boolean;
  slapTimer: number;
  slapDuration: number;
  baseRotY: number;
  bubbleSprite: THREE.Sprite | null;
  bubbleTimer: number;
}

export interface SlappableNpcTarget {
  id: string;
  label: string;
  x: number;
  z: number;
}

function getHumanNpcLabel(archetype: VillagerArchetype, context?: string): string {
  if (context === 'teacher') return 'School Teacher';
  if (context === 'student') return 'School Student';
  if (context === 'cyclist') return 'Cyclist Kid';
  if (context === 'seller') return 'Shopkeeper';
  if (context === 'cricket') return 'Cricket Kid';
  switch (archetype) {
    case 'elder':
      return 'Village Elder';
    case 'woman':
      return 'Village Aunty';
    case 'vendor':
      return 'Shopkeeper';
    case 'child_boy':
    case 'child_girl':
      return 'Village Kid';
    case 'man':
    default:
      return 'Villager';
  }
}

function createNpcReactionBubbleSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 84;
  const ctx = canvas.getContext('2d')!;

  // Crisp 1990s comic speech pill
  ctx.fillStyle = 'rgba(255, 248, 232, 0.96)';
  ctx.strokeStyle = '#c84b24';
  ctx.lineWidth = 6;
  const rx = 10;
  const ry = 10;
  const rw = 236;
  const rh = 58;
  const rad = 20;
  ctx.beginPath();
  ctx.moveTo(rx + rad, ry);
  ctx.lineTo(rx + rw - rad, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
  ctx.lineTo(rx + rw, ry + rh - rad);
  ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
  ctx.lineTo(rx + rw * 0.5 + 10, ry + rh);
  ctx.lineTo(rx + rw * 0.5, ry + rh + 12);
  ctx.lineTo(rx + rw * 0.5 - 10, ry + rh);
  ctx.lineTo(rx + rad, ry + rh);
  ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
  ctx.lineTo(rx, ry + rad);
  ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#23160d';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.55, 0.52, 1);
  sprite.renderOrder = 20;
  return sprite;
}

interface WalkerNpc {
  kind: 'walker' | 'cyclist';
  rig: VillagerRig;
  slapState: SlappableHumanEntry;
  waypoints: Waypoint2D[];
  wpIndex: number;
  x: number;
  z: number;
  rotY: number;
  baseSpeed: number;
  currentSpeed: number;
  pauseTimer: number;
  pauseCooldown: number;
  radius: number;
  minQuality: QualityTier;
  lodOffset: number;
  accumDt: number;
}

interface StationaryNpc {
  rig: VillagerRig;
  slapState: SlappableHumanEntry;
  mode: VillagerAnimMode;
  x: number;
  z: number;
  rotY: number;
  minQuality: QualityTier;
  lodOffset: number;
  accumDt: number;
}

interface CricketScene {
  group: THREE.Group;
  batter: VillagerRig;
  bowler: VillagerRig;
  fielder: VillagerRig;
  batterSlap: SlappableHumanEntry;
  bowlerSlap: SlappableHumanEntry;
  fielderSlap: SlappableHumanEntry;
  ball: THREE.Mesh;
  centerX: number;
  centerZ: number;
  dirX: number;
  dirZ: number;
  pitchLen: number;
  phase: number;
  minQuality: QualityTier;
  lodOffset: number;
  accumDt: number;
}

interface AnimalNpc {
  rig: AnimalRig;
  species: AnimalSpecies;
  homeX: number;
  homeZ: number;
  roamRadius: number;
  waypoints: Waypoint2D[];
  wpIndex: number;
  x: number;
  z: number;
  rotY: number;
  baseSpeed: number;
  currentSpeed: number;
  state: AnimalAnimMode;
  stateTimer: number;
  radius: number;
  minQuality: QualityTier;
  lodOffset: number;
  accumDt: number;
}

interface MapNpcBlueprint {
  walkers: Array<{
    archetype: VillagerArchetype;
    waypoints: Waypoint2D[];
    speed: number;
    prop?: 'stick' | 'matka' | 'basket' | 'jhola';
    minQuality: QualityTier;
  }>;
  cyclists: Array<{
    archetype: 'child_boy' | 'child_girl';
    waypoints: Waypoint2D[];
    speed: number;
    minQuality: QualityTier;
  }>;
  charpaiSitters: Array<{
    x: number;
    z: number;
    rotY: number;
    spawnCharpaiMesh: boolean;
    occupants: Array<{ archetype: VillagerArchetype; sideOffset: number }>;
    minQuality: QualityTier;
  }>;
  marketPairs: Array<{
    sellerX: number;
    sellerZ: number;
    sellerRotY: number;
    buyerX: number;
    buyerZ: number;
    buyerRotY: number;
    buyerArchetype: VillagerArchetype;
    spawnDisplay?: boolean;
    minQuality: QualityTier;
  }>;
  chatGroups: Array<{
    x: number;
    z: number;
    archetypes: [VillagerArchetype, VillagerArchetype];
    minQuality: QualityTier;
  }>;
  cricket: {
    x: number;
    z: number;
    rotY: number;
    pitchLen?: number;
    minQuality: QualityTier;
  };
  classroomSessions?: Array<{
    teacher?: {
      x: number;
      z: number;
      rotY: number;
      archetype: 'elder' | 'man' | 'woman';
      minQuality: QualityTier;
    };
    students: Array<{
      x: number;
      z: number;
      rotY: number;
      archetype: 'child_boy' | 'child_girl';
      minQuality: QualityTier;
    }>;
  }>;
  animals: Array<{
    species: AnimalSpecies;
    x: number;
    z: number;
    roamRadius: number;
    waypoints?: Waypoint2D[];
    initialState?: AnimalAnimMode;
    minQuality: QualityTier;
  }>;
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = normalizeAngle(target - current);
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function getBlueprintForLevel(levelId: number): MapNpcBlueprint {
  switch (levelId) {
    // LEVEL 1: Traditional Village (uses existing static charpais & East Village Market)
    case 1:
      return {
        walkers: [
          {
            archetype: 'woman',
            prop: 'matka',
            speed: 1.25,
            minQuality: 'low',
            waypoints: [
              { x: 0.4, z: -16.5 },
              { x: 0.4, z: 4.5 },
              { x: 18.2, z: 4.5 },
              { x: 18.2, z: -15.5 },
            ],
          },
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.95,
            minQuality: 'low',
            waypoints: [
              { x: -19.2, z: -14.5 },
              { x: -19.2, z: 14.5 },
              { x: -2.5, z: 18.2 },
              { x: -2.5, z: -14.5 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.45,
            minQuality: 'medium',
            waypoints: [
              { x: 21.4, z: -16.5 },
              { x: 21.4, z: 14.5 },
              { x: 2.5, z: 18.5 },
              { x: 2.5, z: -16.5 },
            ],
          },
          {
            archetype: 'woman',
            prop: 'basket',
            speed: 1.3,
            minQuality: 'high',
            waypoints: [
              { x: -19.5, z: -17.5 },
              { x: 16.5, z: -17.5 },
              { x: 16.5, z: -3.0 },
              { x: -19.5, z: -3.0 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.2,
            minQuality: 'medium',
            waypoints: [
              { x: -29.8, z: -2.0 },
              { x: -29.8, z: 6.5 },
              { x: -20.5, z: 18.8 },
              { x: -20.5, z: -2.0 },
            ],
          },
          {
            archetype: 'woman',
            prop: 'matka',
            speed: 1.18,
            minQuality: 'high',
            waypoints: [
              { x: 28.8, z: -10.5 },
              { x: 29.0, z: 12.0 },
              { x: 22.0, z: 12.0 },
              { x: 22.0, z: -10.5 },
            ],
          },
        ],
        cyclists: [
          {
            archetype: 'child_boy',
            speed: 3.35,
            minQuality: 'low',
            waypoints: [
              { x: -19.5, z: -15.5 },
              { x: 19.5, z: -15.5 },
              { x: 19.5, z: 18.5 },
              { x: -19.5, z: 18.5 },
            ],
          },
        ],
        charpaiSitters: [
          // Existing static charpais in village.ts!
          {
            x: -4.6,
            z: -3.6,
            rotY: 0.3,
            spawnCharpaiMesh: false,
            occupants: [
              { archetype: 'elder', sideOffset: 0.28 },
            ],
            minQuality: 'low',
          },
          {
            x: -13.2,
            z: 14.2,
            rotY: Math.PI / 2,
            spawnCharpaiMesh: false,
            occupants: [
              { archetype: 'man', sideOffset: -0.35 },
              { archetype: 'elder', sideOffset: 0.38 },
            ],
            minQuality: 'medium',
          },
          {
            x: 13.0,
            z: 14.0,
            rotY: Math.PI / 2,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'woman', sideOffset: 0.0 }],
            minQuality: 'high',
          },
        ],
        marketPairs: [
          // East Village Market (x = 27.6, z = 4.5, stalls facing -X toward market street x ~ 24.5)
          {
            sellerX: 25.8,
            sellerZ: -0.7,
            sellerRotY: -Math.PI / 2,
            buyerX: 24.1,
            buyerZ: -0.6,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'man',
            minQuality: 'low',
          },
          {
            sellerX: 26.1,
            sellerZ: 5.3,
            sellerRotY: -Math.PI / 2,
            buyerX: 24.3,
            buyerZ: 5.4,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'woman',
            minQuality: 'low',
          },
          {
            sellerX: 25.8,
            sellerZ: 11.3,
            sellerRotY: -Math.PI / 2,
            buyerX: 24.1,
            buyerZ: 11.1,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'elder',
            minQuality: 'medium',
          },
        ],
        chatGroups: [
          {
            x: -7.5,
            z: 4.8,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
          {
            x: 8.6,
            z: -5.4,
            archetypes: ['woman', 'woman'],
            minQuality: 'high',
          },
          {
            x: 2.8,
            z: -4.2,
            archetypes: ['elder', 'man'],
            minQuality: 'medium',
          },
        ],
        cricket: {
          x: -2.2,
          z: 22.8,
          rotY: Math.PI / 2,
          pitchLen: 6.2,
          minQuality: 'low',
        },
        animals: [
          {
            species: 'cow',
            x: -6.5,
            z: -16.8,
            roamRadius: 6.5,
            minQuality: 'low',
          },
          {
            species: 'buffalo',
            x: 15.8,
            z: 25.5,
            roamRadius: 5.2,
            initialState: 'graze',
            minQuality: 'low',
          },
          {
            species: 'goat',
            x: -17.2,
            z: 19.8,
            roamRadius: 5.0,
            minQuality: 'low',
          },
          {
            species: 'dog',
            x: 4.2,
            z: 7.4,
            roamRadius: 8.5,
            minQuality: 'low',
          },
          {
            species: 'cow',
            x: 17.5,
            z: -19.5,
            roamRadius: 5.5,
            initialState: 'rest',
            minQuality: 'medium',
          },
          {
            species: 'goat',
            x: -18.5,
            z: 22.4,
            roamRadius: 4.5,
            minQuality: 'medium',
          },
          {
            species: 'dog',
            x: 22.2,
            z: 2.2,
            roamRadius: 6.5,
            minQuality: 'high',
          },
        ],
      };

    // LEVEL 2: School Campus (1995 Prathmik Vidyalaya)
    case 2:
      return {
        walkers: [
          {
            // School student strolling along North veranda & courtyard
            archetype: 'child_boy',
            prop: 'jhola',
            speed: 1.48,
            minQuality: 'low',
            waypoints: [
              { x: -16.2, z: -12.4 },
              { x: 14.5, z: -12.4 },
              { x: 16.5, z: 3.5 },
              { x: -16.5, z: 3.5 },
            ],
          },
          {
            // School girl walking between West wing classrooms & courtyard hand pump
            archetype: 'child_girl',
            prop: 'jhola',
            speed: 1.38,
            minQuality: 'low',
            waypoints: [
              { x: -17.4, z: -8.5 },
              { x: -17.4, z: 11.5 },
              { x: -8.5, z: 13.0 },
              { x: -12.5, z: -9.8 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.35,
            minQuality: 'medium',
            waypoints: [
              { x: -16.8, z: -10.8 },
              { x: 16.8, z: -10.8 },
              { x: 16.8, z: 16.8 },
              { x: -16.8, z: 16.8 },
            ],
          },
          {
            archetype: 'woman',
            prop: 'basket',
            speed: 1.25,
            minQuality: 'high',
            waypoints: [
              { x: -14.5, z: 17.2 },
              { x: 14.5, z: 17.2 },
              { x: 14.5, z: 25.0 },
              { x: -14.5, z: 25.0 },
            ],
          },
        ],
        cyclists: [
          {
            archetype: 'child_girl',
            speed: 3.15,
            minQuality: 'low',
            waypoints: [
              { x: -15.5, z: 17.5 },
              { x: 15.5, z: 17.5 },
              { x: 15.5, z: 24.5 },
              { x: -15.5, z: 24.5 },
            ],
          },
        ],
        charpaiSitters: [
          {
            x: -11.5,
            z: 24.5,
            rotY: 0,
            spawnCharpaiMesh: true,
            occupants: [{ archetype: 'elder', sideOffset: 0.0 }],
            minQuality: 'low',
          },
        ],
        marketPairs: [
          // Chaat/snack vendor right outside school south gate
          {
            sellerX: 8.4,
            sellerZ: 24.8,
            sellerRotY: -Math.PI / 2,
            buyerX: 6.6,
            buyerZ: 24.8,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'child_boy',
            spawnDisplay: true,
            minQuality: 'low',
          },
        ],
        chatGroups: [
          {
            x: -14.2,
            z: -7.5,
            archetypes: ['child_girl', 'child_girl'],
            minQuality: 'low',
          },
          {
            x: -8.6,
            z: 12.6,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
          {
            x: 13.5,
            z: 4.8,
            archetypes: ['child_boy', 'child_boy'],
            minQuality: 'medium',
          },
        ],
        classroomSessions: [
          {
            // Active 1995 village class inside Class 3-4 Room (center: x=-3.5, z=-17.5)
            teacher: {
              x: -3.5,
              z: -19.2,
              rotY: 0,
              archetype: 'elder',
              minQuality: 'low',
            },
            students: [
              { x: -5.62, z: -17.4, rotY: Math.PI, archetype: 'child_boy', minQuality: 'low' },
              { x: -1.38, z: -17.4, rotY: Math.PI, archetype: 'child_girl', minQuality: 'low' },
              { x: -5.62, z: -15.96, rotY: Math.PI, archetype: 'child_girl', minQuality: 'low' },
              { x: -1.38, z: -15.96, rotY: Math.PI, archetype: 'child_boy', minQuality: 'medium' },
            ],
          },
          {
            // Seated study pair inside Class 1-2 Room (center: x=-13.5, z=-17.5)
            students: [
              { x: -15.62, z: -17.4, rotY: Math.PI, archetype: 'child_boy', minQuality: 'medium' },
              { x: -11.38, z: -17.4, rotY: Math.PI, archetype: 'child_girl', minQuality: 'medium' },
            ],
          },
        ],
        cricket: {
          // Sunny school playground!
          x: -2.0,
          z: 5.5,
          rotY: 0.2,
          pitchLen: 6.6,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: -19.5, z: 23.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'buffalo', x: 20.5, z: 25.5, roamRadius: 4.2, initialState: 'graze', minQuality: 'low' },
          { species: 'goat', x: -16.2, z: 26.0, roamRadius: 4.0, minQuality: 'low' },
          { species: 'dog', x: 2.5, z: 21.5, roamRadius: 7.0, minQuality: 'low' },
          { species: 'dog', x: -9.5, z: 14.5, roamRadius: 5.5, minQuality: 'high' },
        ],
      };

    // LEVEL 3: Mango Farm (Upgraded 1990s Indian Village Mango Orchard)
    case 3:
      return {
        walkers: [
          // Orchard farmer carrying freshly picked mango basket along outer mud loop
          {
            archetype: 'man',
            prop: 'basket',
            speed: 1.32,
            minQuality: 'low',
            waypoints: [
              { x: -36, z: -26 },
              { x: -36, z: 26 },
              { x: 0, z: 36 },
              { x: 36, z: 26 },
              { x: 36, z: -26 },
              { x: 0, z: -36 },
            ],
          },
          // Village woman carrying clay water matka between hand pump, well & farmhouse
          {
            archetype: 'woman',
            prop: 'matka',
            speed: 1.18,
            minQuality: 'low',
            waypoints: [
              { x: 0, z: -9.5 },
              { x: 0, z: 2.0 },
              { x: -18, z: 2.0 },
              { x: -18, z: -4.5 },
              { x: 0, z: -4.5 },
            ],
          },
          // Elder orchard caretaker inspecting mango rows along main E-W track
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.92,
            minQuality: 'low',
            waypoints: [
              { x: -34, z: 2.0 },
              { x: 34, z: 2.0 },
            ],
          },
          // Farmer hauling harvested mangoes between North & South orchard tracks
          {
            archetype: 'man',
            prop: 'basket',
            speed: 1.28,
            minQuality: 'medium',
            waypoints: [
              { x: 0, z: -34 },
              { x: 0, z: 34 },
              { x: 18, z: 36 },
              { x: 36, z: 36 },
              { x: 36, z: 2.0 },
              { x: 0, z: 2.0 },
            ],
          },
          // Orchard helper carrying cloth harvest jhola along western packing lane
          {
            archetype: 'woman',
            prop: 'jhola',
            speed: 1.16,
            minQuality: 'medium',
            waypoints: [
              { x: -36, z: -34 },
              { x: -36, z: 34 },
              { x: -20, z: 36 },
              { x: 0, z: 36 },
            ],
          },
        ],
        // Keep Mango Farm strictly vehicle-free (no bicycles)
        cyclists: [],
        charpaiSitters: [
          // Farmers resting on the Farmhouse Courtyard shade charpais (use map's charpais)
          {
            x: -8.4,
            z: -4.6,
            rotY: Math.PI / 2,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'elder', sideOffset: -0.25 }],
            minQuality: 'low',
          },
          {
            x: -19.8,
            z: -8.8,
            rotY: 0.15,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'man', sideOffset: 0.15 }],
            minQuality: 'medium',
          },
        ],
        marketPairs: [
          // Farmers sorting & inspecting freshly harvested mangoes in the Farmhouse Courtyard
          {
            sellerX: 5.0,
            sellerZ: -5.6,
            sellerRotY: Math.PI,
            buyerX: 5.0,
            buyerZ: -4.0,
            buyerRotY: 0,
            buyerArchetype: 'woman',
            spawnDisplay: false,
            minQuality: 'low',
          },
          // Mango packing & weighing outside West Packing Shed
          {
            sellerX: -19.5,
            sellerZ: -4.2,
            sellerRotY: Math.PI / 2,
            buyerX: -17.9,
            buyerZ: -4.2,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'man',
            spawnDisplay: true,
            minQuality: 'medium',
          },
        ],
        chatGroups: [
          // Farmers chatting near the Courtyard Hand Pump
          {
            x: 6.2,
            z: 0.4,
            archetypes: ['man', 'woman'],
            minQuality: 'low',
          },
          // Orchard helpers talking near the Old Stone Well
          {
            x: -8.2,
            z: 8.6,
            archetypes: ['elder', 'man'],
            minQuality: 'medium',
          },
        ],
        cricket: {
          x: 8.2,
          z: 7.4,
          rotY: Math.PI / 2,
          pitchLen: 5.4,
          minQuality: 'medium',
        },
        animals: [
          { species: 'cow', x: -6.5, z: 16.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'buffalo', x: 10.5, z: 16.2, roamRadius: 4.8, initialState: 'graze', minQuality: 'low' },
          { species: 'goat', x: -28.0, z: 16.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'dog', x: 2.5, z: -2.2, roamRadius: 6.5, minQuality: 'low' },
          { species: 'cow', x: 28.5, z: -18.5, roamRadius: 4.5, minQuality: 'medium' },
          { species: 'goat', x: -28.5, z: -28.5, roamRadius: 4.5, minQuality: 'high' },
        ],
      };

    // LEVEL 4: Old Market (Upgraded 1990s Indian Village Bazaar)
    case 4:
      return {
        walkers: [
          {
            archetype: 'woman',
            prop: 'basket',
            speed: 1.25,
            minQuality: 'low',
            waypoints: [
              { x: 0, z: -32 },
              { x: 0, z: 32 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.35,
            minQuality: 'low',
            waypoints: [
              { x: -17.5, z: -18.0 },
              { x: 17.5, z: -18.0 },
              { x: 17.5, z: 18.0 },
              { x: -17.5, z: 18.0 },
            ],
          },
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.92,
            minQuality: 'medium',
            waypoints: [
              { x: -34.5, z: 0 },
              { x: 20.5, z: 0 },
            ],
          },
          {
            archetype: 'woman',
            prop: 'jhola',
            speed: 1.25,
            minQuality: 'high',
            waypoints: [
              { x: -35.0, z: -34.0 },
              { x: 35.0, z: -34.0 },
              { x: 35.0, z: 34.0 },
              { x: -35.0, z: 34.0 },
            ],
          },
        ],
        cyclists: [],
        charpaiSitters: [
          {
            x: 24.5,
            z: 6.2,
            rotY: Math.PI,
            spawnCharpaiMesh: true,
            occupants: [{ archetype: 'elder', sideOffset: 0 }],
            minQuality: 'low',
          },
        ],
        marketPairs: [
          // Outside Gupta Kirana Store (-3.4, -10.0)
          {
            sellerX: -2.4,
            sellerZ: -10.0,
            sellerRotY: Math.PI / 2,
            buyerX: -0.9,
            buyerZ: -10.0,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'woman',
            minQuality: 'low',
          },
          // Outside Sharma Mithai & Halwai (3.4, -10.0)
          {
            sellerX: 2.4,
            sellerZ: -10.0,
            sellerRotY: -Math.PI / 2,
            buyerX: 0.9,
            buyerZ: -10.0,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'man',
            minQuality: 'low',
          },
          // West Sabzi Mandi Vegetable Stall Vendor & Shopper (-26, -2.5)
          {
            sellerX: -22.8,
            sellerZ: -3.2,
            sellerRotY: 0,
            buyerX: -22.8,
            buyerZ: -1.6,
            buyerRotY: Math.PI,
            buyerArchetype: 'woman',
            minQuality: 'low',
          },
          // Outside Raju Chai & Samosa (3.4, 10.0)
          {
            sellerX: 2.4,
            sellerZ: 10.0,
            sellerRotY: -Math.PI / 2,
            buyerX: 0.9,
            buyerZ: 10.0,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'elder',
            minQuality: 'medium',
          },
          // Outside Verma Cloth House (-3.4, 10.0)
          {
            sellerX: -2.4,
            sellerZ: 10.0,
            sellerRotY: Math.PI / 2,
            buyerX: -0.9,
            buyerZ: 10.0,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'woman',
            minQuality: 'medium',
          },
          // Second Sabzi Mandi Stall Vendor (-29.2, 3.2)
          {
            sellerX: -29.2,
            sellerZ: 3.2,
            sellerRotY: Math.PI,
            buyerX: -29.2,
            buyerZ: 1.6,
            buyerRotY: 0,
            buyerArchetype: 'man',
            minQuality: 'high',
          },
        ],
        chatGroups: [
          {
            x: 23.0,
            z: -1.5,
            archetypes: ['man', 'elder'],
            minQuality: 'low',
          },
          {
            x: -5.2,
            z: 18.2,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'medium',
          },
        ],
        cricket: {
          x: 0.0,
          z: 38.5,
          rotY: Math.PI / 2,
          pitchLen: 5.8,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: -34.5, z: -20.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'buffalo', x: 34.5, z: -20.5, roamRadius: 4.5, initialState: 'rest', minQuality: 'low' },
          { species: 'goat', x: -34.5, z: 20.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'dog', x: 1.8, z: 18.0, roamRadius: 6.5, minQuality: 'low' },
          { species: 'dog', x: -17.5, z: 6.0, roamRadius: 5.0, minQuality: 'high' },
        ],
      };

    // LEVEL 5: Railway Colony (Upgraded 1990s Indian Railway Residential Colony)
    case 5:
      return {
        walkers: [
          // Railway station staff worker walking Platform No. 1 checking platform
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.38,
            minQuality: 'low',
            waypoints: [
              { x: -28, z: -21.0 },
              { x: 28, z: -21.0 },
            ],
          },
          // Colony resident carrying market basket along Station Road & Middle Lane
          {
            archetype: 'woman',
            prop: 'basket',
            speed: 1.22,
            minQuality: 'low',
            waypoints: [
              { x: -19.5, z: -5.5 },
              { x: 19.5, z: -5.5 },
              { x: 19.5, z: 16.5 },
              { x: -19.5, z: 16.5 },
            ],
          },
          // Retired railway elder strolling Central Avenue & South Garden Lane
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.94,
            minQuality: 'low',
            waypoints: [
              { x: 0, z: -5.5 },
              { x: 0, z: 16.5 },
              { x: 19.5, z: 16.5 },
              { x: 19.5, z: 36.5 },
              { x: -19.5, z: 36.5 },
              { x: -19.5, z: 16.5 },
              { x: 0, z: 16.5 },
            ],
          },
          // Railway lineman / technician walking outer station avenue & east alley
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.34,
            minQuality: 'medium',
            waypoints: [
              { x: -38.5, z: -5.5 },
              { x: 38.5, z: -5.5 },
              { x: 38.5, z: 36.5 },
              { x: 19.5, z: 36.5 },
            ],
          },
          // Colony homemaker walking with clay pot along west alley
          {
            archetype: 'woman',
            prop: 'matka',
            speed: 1.15,
            minQuality: 'medium',
            waypoints: [
              { x: -38.5, z: 16.5 },
              { x: -19.5, z: 16.5 },
              { x: -19.5, z: 36.5 },
              { x: -38.5, z: 36.5 },
            ],
          },
        ],
        // Keep Railway Colony strictly vehicle-free
        cyclists: [],
        charpaiSitters: [
          // Residents relaxing on Colony Garden Park benches (reusing map benches)
          {
            x: -7.8,
            z: 24.2,
            rotY: 0,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'elder', sideOffset: -0.22 }],
            minQuality: 'low',
          },
          {
            x: 7.8,
            z: 29.4,
            rotY: Math.PI,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'woman', sideOffset: 0.15 }],
            minQuality: 'medium',
          },
        ],
        marketPairs: [
          // Platform No. 1 Chai & Book Stall vendor with passenger
          {
            sellerX: -16.4,
            sellerZ: -19.4,
            sellerRotY: Math.PI / 2,
            buyerX: -14.8,
            buyerZ: -19.4,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'man',
            spawnDisplay: false,
            minQuality: 'low',
          },
          // Passenger & railway clerk outside Station Ticket Hall entrance
          {
            sellerX: -11.0,
            sellerZ: -8.6,
            sellerRotY: 0,
            buyerX: -11.0,
            buyerZ: -7.1,
            buyerRotY: Math.PI,
            buyerArchetype: 'woman',
            spawnDisplay: false,
            minQuality: 'medium',
          },
        ],
        chatGroups: [
          // Railway staff talking outside Waiting Hall entrance
          {
            x: 11.2,
            z: -8.2,
            archetypes: ['man', 'elder'],
            minQuality: 'low',
          },
          // Colony neighbors chatting on Central Garden walkway
          {
            x: 3.6,
            z: 26.8,
            archetypes: ['woman', 'child_girl'],
            minQuality: 'medium',
          },
        ],
        cricket: {
          x: 0.0,
          z: 40.5,
          rotY: Math.PI / 2,
          pitchLen: 5.8,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: -34.0, z: 16.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'buffalo', x: 35.5, z: 36.5, roamRadius: 4.5, initialState: 'graze', minQuality: 'low' },
          { species: 'goat', x: -24.5, z: 39.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'dog', x: 3.5, z: -5.5, roamRadius: 6.5, minQuality: 'low' },
          { species: 'dog', x: -22.5, z: -21.0, roamRadius: 5.0, minQuality: 'high' },
        ],
      };

    // LEVEL 6: Haunted Haveli (sparse mysterious exterior caretakers & garden animals)
    case 6:
      return {
        walkers: [
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.85,
            minQuality: 'low',
            waypoints: [
              { x: -36.0, z: -36.5 },
              { x: 36.0, z: -36.5 },
              { x: 36.0, z: 42.5 },
              { x: -36.0, z: 42.5 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.15,
            minQuality: 'medium',
            waypoints: [
              { x: -9.5, z: -6.5 },
              { x: 9.5, z: -6.5 },
              { x: 9.5, z: 18.5 },
              { x: -9.5, z: 18.5 },
            ],
          },
        ],
        cyclists: [
          {
            archetype: 'child_boy',
            speed: 3.0,
            minQuality: 'low',
            waypoints: [
              { x: -35.5, z: 43.0 },
              { x: 35.5, z: 43.0 },
              { x: 35.5, z: -36.5 },
              { x: -35.5, z: -36.5 },
            ],
          },
        ],
        charpaiSitters: [
          {
            x: 11.2,
            z: 36.5,
            rotY: Math.PI,
            spawnCharpaiMesh: true,
            occupants: [{ archetype: 'elder', sideOffset: 0 }],
            minQuality: 'low',
          },
        ],
        marketPairs: [
          // Lantern-lit evening tea & flower stall outside the old haveli entrance gate
          {
            sellerX: -9.5,
            sellerZ: 36.8,
            sellerRotY: Math.PI / 2,
            buyerX: -7.8,
            buyerZ: 36.8,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'woman',
            spawnDisplay: true,
            minQuality: 'low',
          },
        ],
        chatGroups: [
          {
            x: 7.5,
            z: 41.2,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
        ],
        cricket: {
          x: 0.0,
          z: 50.8,
          rotY: Math.PI / 2,
          pitchLen: 5.8,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: -36.5, z: 39.5, roamRadius: 4.5, initialState: 'rest', minQuality: 'low' },
          { species: 'buffalo', x: 36.5, z: 39.5, roamRadius: 4.5, initialState: 'rest', minQuality: 'low' },
          { species: 'goat', x: -36.5, z: -8.5, roamRadius: 4.0, minQuality: 'low' },
          { species: 'dog', x: 0.0, z: 22.5, roamRadius: 5.5, minQuality: 'low' },
        ],
      };

    // LEVEL 7: River Village (Additively Enhanced 1990s Riverside Village)
    case 7:
      return {
        walkers: [
          // Preserved woman with clay matka crossing bridges
          {
            archetype: 'woman',
            prop: 'matka',
            speed: 1.25,
            minQuality: 'low',
            waypoints: [
              { x: -12.5, z: -18.0 },
              { x: 12.5, z: -18.0 },
              { x: 12.5, z: 0.0 },
              { x: -12.5, z: 0.0 },
            ],
          },
          // Preserved fisherman carrying basket across center & south bridges
          {
            archetype: 'man',
            prop: 'basket',
            speed: 1.35,
            minQuality: 'low',
            waypoints: [
              { x: -12.5, z: 0.0 },
              { x: 12.5, z: 0.0 },
              { x: 12.5, z: 18.0 },
              { x: -12.5, z: 18.0 },
            ],
          },
          // Preserved village elder strolling the west lane
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.95,
            minQuality: 'low',
            waypoints: [
              { x: -26.5, z: -30.0 },
              { x: -26.5, z: 30.0 },
            ],
          },
          // Additional resident strolling the east courtyard lane & south footbridge
          {
            archetype: 'woman',
            prop: 'jhola',
            speed: 1.18,
            minQuality: 'medium',
            waypoints: [
              { x: 26.5, z: -30.0 },
              { x: 26.5, z: 36.0 },
              { x: -12.5, z: 36.0 },
              { x: -12.5, z: 18.0 },
              { x: 12.5, z: 18.0 },
              { x: 12.5, z: -36.0 },
              { x: 26.5, z: -36.0 },
            ],
          },
          // Additional villager walking the outer west stone path near courtyard houses
          {
            archetype: 'man',
            prop: 'basket',
            speed: 1.24,
            minQuality: 'medium',
            waypoints: [
              { x: -45.5, z: -26.0 },
              { x: -45.5, z: 26.0 },
              { x: -26.5, z: 36.0 },
              { x: -26.5, z: -36.0 },
            ],
          },
        ],
        // Strictly vehicle-free riverside village
        cyclists: [],
        charpaiSitters: [
          {
            x: -16.5,
            z: 8.5,
            rotY: 0,
            spawnCharpaiMesh: true,
            occupants: [{ archetype: 'elder', sideOffset: 0 }],
            minQuality: 'low',
          },
          {
            x: 16.5,
            z: -8.5,
            rotY: 0,
            spawnCharpaiMesh: true,
            occupants: [{ archetype: 'woman', sideOffset: 0 }],
            minQuality: 'medium',
          },
          // Elder resting on the new Chaupal shade charpai
          {
            x: 18.5,
            z: 26.2,
            rotY: 0,
            spawnCharpaiMesh: false,
            occupants: [{ archetype: 'elder', sideOffset: -0.22 }],
            minQuality: 'medium',
          },
        ],
        marketPairs: [
          // Preserved riverbank ghat produce & fish vendor
          {
            sellerX: -14.8,
            sellerZ: 14.5,
            sellerRotY: Math.PI / 2,
            buyerX: -13.1,
            buyerZ: 14.5,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'woman',
            spawnDisplay: true,
            minQuality: 'low',
          },
        ],
        chatGroups: [
          {
            x: 13.8,
            z: 4.5,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
          // Villagers chatting near West River Ghat steps
          {
            x: -11.2,
            z: -7.0,
            archetypes: ['woman', 'elder'],
            minQuality: 'medium',
          },
        ],
        cricket: {
          x: 20.0,
          z: 11.5,
          rotY: 0,
          pitchLen: 6.0,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: -22.5, z: -12.0, roamRadius: 5.0, minQuality: 'low' },
          { species: 'buffalo', x: 10.2, z: -9.5, roamRadius: 3.5, initialState: 'graze', minQuality: 'low' },
          { species: 'goat', x: 22.5, z: -14.0, roamRadius: 5.0, minQuality: 'low' },
          { species: 'dog', x: -12.5, z: 6.5, roamRadius: 6.5, minQuality: 'low' },
          { species: 'buffalo', x: -10.5, z: -24.5, roamRadius: 4.0, initialState: 'rest', minQuality: 'medium' },
          { species: 'cow', x: 34.5, z: 22.5, roamRadius: 4.5, minQuality: 'high' },
        ],
      };

    // LEVELS 9-15: Pixar 3D Maps ambient residents & animals
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
      return {
        walkers: [
          {
            archetype: 'woman',
            prop: 'basket',
            speed: 1.3,
            minQuality: 'low',
            waypoints: [
              { x: -12.0, z: -12.0 },
              { x: 12.0, z: -12.0 },
              { x: 12.0, z: 12.0 },
              { x: -12.0, z: 12.0 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.35,
            minQuality: 'low',
            waypoints: [
              { x: 14.0, z: -8.0 },
              { x: -14.0, z: -8.0 },
              { x: -14.0, z: 8.0 },
              { x: 14.0, z: 8.0 },
            ],
          },
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.95,
            minQuality: 'medium',
            waypoints: [
              { x: -18.0, z: -16.0 },
              { x: -18.0, z: 16.0 },
              { x: 18.0, z: 16.0 },
              { x: 18.0, z: -16.0 },
            ],
          },
        ],
        cyclists: [],
        sitters: [],
        marketPairs: [],
        chatGroups: [
          {
            x: -7.5,
            z: 6.5,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
          {
            x: 7.5,
            z: -6.5,
            archetypes: ['woman', 'elder'],
            minQuality: 'medium',
          },
        ],
        cricket: null,
        animals:
          levelId === 15
            ? [
                { species: 'dog', x: -8.5, z: 11.0, roamRadius: 5.0, minQuality: 'low' },
                { species: 'goat', x: 12.0, z: -11.5, roamRadius: 4.5, minQuality: 'medium' },
              ]
            : [
                { species: 'dog', x: -9.5, z: 9.5, roamRadius: 5.5, minQuality: 'low' },
                { species: 'goat', x: 10.5, z: -10.5, roamRadius: 5.0, minQuality: 'medium' },
                { species: 'cow', x: -19.0, z: 15.0, roamRadius: 4.0, minQuality: 'high' },
              ],
      };

    // LEVEL 8: Festival Village (Diwali & Mela)
    case 8:
    default:
      return {
        walkers: [
          {
            archetype: 'woman',
            prop: 'jhola',
            speed: 1.35,
            minQuality: 'low',
            waypoints: [
              { x: -16.5, z: -16.5 },
              { x: 16.5, z: -16.5 },
              { x: 16.5, z: 16.5 },
              { x: -16.5, z: 16.5 },
            ],
          },
          {
            archetype: 'man',
            prop: 'jhola',
            speed: 1.4,
            minQuality: 'low',
            waypoints: [
              { x: 0, z: -24 },
              { x: 0, z: 22 },
            ],
          },
          {
            archetype: 'elder',
            prop: 'stick',
            speed: 0.95,
            minQuality: 'medium',
            waypoints: [
              { x: -24, z: 0 },
              { x: 24, z: 0 },
            ],
          },
        ],
        cyclists: [
          {
            archetype: 'child_boy',
            speed: 3.15,
            minQuality: 'low',
            waypoints: [
              { x: -16.5, z: -16.5 },
              { x: 16.5, z: -16.5 },
              { x: 16.5, z: 16.5 },
              { x: -16.5, z: 16.5 },
            ],
          },
        ],
        charpaiSitters: [
          {
            x: -21.5,
            z: 10.5,
            rotY: 0,
            spawnCharpaiMesh: true,
            occupants: [
              { archetype: 'elder', sideOffset: -0.32 },
              { archetype: 'woman', sideOffset: 0.34 },
            ],
            minQuality: 'low',
          },
        ],
        marketPairs: [
          // Chaat & Golgappa Stall (-8.8, -7.5, facing +X)
          {
            sellerX: -7.1,
            sellerZ: -7.5,
            sellerRotY: Math.PI / 2,
            buyerX: -5.4,
            buyerZ: -7.5,
            buyerRotY: -Math.PI / 2,
            buyerArchetype: 'child_girl',
            minQuality: 'low',
          },
          // Hot Jalebi Stall (8.8, -7.5, facing -X)
          {
            sellerX: 7.1,
            sellerZ: -7.5,
            sellerRotY: -Math.PI / 2,
            buyerX: 5.4,
            buyerZ: -7.5,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'man',
            minQuality: 'low',
          },
          // Bangle & Mehndi Stall (8.8, 7.5, facing -X)
          {
            sellerX: 7.1,
            sellerZ: 7.5,
            sellerRotY: -Math.PI / 2,
            buyerX: 5.4,
            buyerZ: 7.5,
            buyerRotY: Math.PI / 2,
            buyerArchetype: 'woman',
            minQuality: 'medium',
          },
        ],
        chatGroups: [
          {
            x: -3.5,
            z: 5.2,
            archetypes: ['child_boy', 'child_girl'],
            minQuality: 'low',
          },
          {
            x: 3.5,
            z: -3.8,
            archetypes: ['woman', 'elder'],
            minQuality: 'high',
          },
        ],
        cricket: {
          x: -22.5,
          z: -21.5,
          rotY: 0.35,
          pitchLen: 5.8,
          minQuality: 'low',
        },
        animals: [
          { species: 'cow', x: 22.0, z: -12.0, roamRadius: 5.0, minQuality: 'low' },
          { species: 'buffalo', x: -24.5, z: 22.5, roamRadius: 4.5, initialState: 'rest', minQuality: 'low' },
          { species: 'goat', x: 23.0, z: 14.5, roamRadius: 4.5, minQuality: 'low' },
          { species: 'dog', x: 1.8, z: 12.5, roamRadius: 7.5, minQuality: 'low' },
          { species: 'dog', x: -16.5, z: -2.0, roamRadius: 6.0, minQuality: 'high' },
        ],
      };
  }
}

// Reusable scratch output to keep per-frame allocations at ZERO
const _avoidOut = { x: 0, z: 0 };

export class VillageNpcSystem {
  public readonly group: THREE.Group;
  private pool: NpcAssetPool;
  private colliders: VillageColliders;
  private waterRects: NonNullable<VillageMinimapLayout['waterRects']>;
  private levelId: number;
  private quality: QualityTier = 'high';

  private walkers: WalkerNpc[] = [];
  private stationary: StationaryNpc[] = [];
  private slappableHumans: SlappableHumanEntry[] = [];
  private cricket: CricketScene | null = null;
  private animals: AnimalNpc[] = [];
  private extraProps: Array<{ obj: THREE.Object3D; minQuality: QualityTier }> = [];
  private ambientSeats: Array<{ seat: SeatSpot; minQuality: QualityTier }> = [];

  private frameCounter = 0;

  private registerSlappableHuman(
    id: string,
    label: string,
    rig: VillagerRig,
    minQuality: QualityTier,
    isSeated: boolean,
    baseRotY: number,
  ): SlappableHumanEntry {
    const entry: SlappableHumanEntry = {
      id,
      label,
      rig,
      minQuality,
      isSeated,
      slapTimer: 0,
      slapDuration: 1.25,
      baseRotY,
      bubbleSprite: null,
      bubbleTimer: 0,
    };
    this.slappableHumans.push(entry);
    return entry;
  }

  constructor(
    levelId: number,
    textures: VillageTextureSet,
    colliders: VillageColliders,
    minimapLayout: VillageMinimapLayout,
    initialQuality: QualityTier,
  ) {
    this.levelId = levelId;
    this.colliders = colliders;
    this.waterRects = minimapLayout.waterRects ?? [];
    this.quality = initialQuality;

    this.group = new THREE.Group();
    this.group.name = `AmbientVillageLife_L${levelId}`;
    this.group.userData.isAmbientNpc = true;

    this.pool = createNpcAssetPool(textures);
    this.buildFromBlueprint(getBlueprintForLevel(levelId));
    this.setGraphicsQuality(initialQuality);
  }

  private isPointInWater(x: number, z: number, pad = 0.7): boolean {
    for (let i = 0; i < this.waterRects.length; i++) {
      const w = this.waterRects[i];
      if (
        x > w.x - w.width * 0.5 - pad &&
        x < w.x + w.width * 0.5 + pad &&
        z > w.z - w.length * 0.5 - pad &&
        z < w.z + w.length * 0.5 + pad
      ) {
        // Allow River Village wooden bridges (at z = -18, 0, +18)
        if (
          this.levelId === 7 &&
          (Math.abs(z + 18) < 2.2 || Math.abs(z) < 2.2 || Math.abs(z - 18) < 2.2)
        ) {
          continue;
        }
        return true;
      }
    }
    return false;
  }

  private isPointBlocked(x: number, z: number, radius: number): boolean {
    const maxR = this.colliders.worldRadius - 1.8;
    if (x * x + z * z > maxR * maxR) return true;
    if (this.isPointInWater(x, z, radius + 0.35)) return true;

    const boxes = this.colliders.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (
        x > b.minX - radius &&
        x < b.maxX + radius &&
        z > b.minZ - radius &&
        z < b.maxZ + radius
      ) {
        return true;
      }
    }
    const circles = this.colliders.circles;
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = c.radius + radius;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  /**
   * Finds the closest obstacle-free spot near (x, z) so no NPC or animal ever
   * spawns overlapping a wall, tree, stall, or water body.
   */
  private findClearSpot(x: number, z: number, radius: number): Waypoint2D {
    if (!this.isPointBlocked(x, z, radius)) return { x, z };
    for (let ring = 1; ring <= 8; ring++) {
      const dist = ring * 0.85;
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const nx = x + Math.cos(ang) * dist;
        const nz = z + Math.sin(ang) * dist;
        if (!this.isPointBlocked(nx, nz, radius)) {
          return { x: nx, z: nz };
        }
      }
    }
    return { x, z };
  }

  private resolveMovementObstacles(
    x: number,
    z: number,
    radius: number,
    out: { x: number; z: number },
  ): void {
    let rx = x;
    let rz = z;

    // Push gently out of boxes
    const boxes = this.colliders.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Inside box: eject along shallowest axis
          const dLeft = Math.abs(rx - b.minX);
          const dRight = Math.abs(b.maxX - rx);
          const dTop = Math.abs(rz - b.minZ);
          const dBot = Math.abs(b.maxZ - rz);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) rx = b.minX - radius;
          else if (m === dRight) rx = b.maxX + radius;
          else if (m === dTop) rz = b.minZ - radius;
          else rz = b.maxZ + radius;
        }
      }
    }

    // Push gently out of circles
    const circles = this.colliders.circles;
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dx = rx - c.x;
      const dz = rz - c.z;
      const rr = c.radius + radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < rr * rr && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = rr - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
      }
    }

    // Keep out of water rects (except bridges on River Village)
    if (this.isPointInWater(rx, rz, radius + 0.25)) {
      for (let i = 0; i < this.waterRects.length; i++) {
        const w = this.waterRects[i];
        const minX = w.x - w.width * 0.5 - radius - 0.3;
        const maxX = w.x + w.width * 0.5 + radius + 0.3;
        const minZ = w.z - w.length * 0.5 - radius - 0.3;
        const maxZ = w.z + w.length * 0.5 + radius + 0.3;
        if (rx > minX && rx < maxX && rz > minZ && rz < maxZ) {
          const dL = Math.abs(rx - minX);
          const dR = Math.abs(maxX - rx);
          const dT = Math.abs(rz - minZ);
          const dB = Math.abs(maxZ - rz);
          const m = Math.min(dL, dR, dT, dB);
          if (m === dL) rx = minX;
          else if (m === dR) rx = maxX;
          else if (m === dT) rz = minZ;
          else rz = maxZ;
        }
      }
    }

    // Clamp inside world boundary
    const maxR = this.colliders.worldRadius - 1.6;
    const lenSq = rx * rx + rz * rz;
    if (lenSq > maxR * maxR) {
      const len = Math.sqrt(lenSq);
      rx = (rx / len) * maxR;
      rz = (rz / len) * maxR;
    }

    out.x = rx;
    out.z = rz;
  }

  private buildFromBlueprint(bp: MapNpcBlueprint): void {
    let seed = this.levelId * 31 + 7;
    let lodCounter = 0;

    // 1. Walking villagers
    for (const w of bp.walkers) {
      const clearWaypoints = w.waypoints.map((pt) =>
        this.findClearSpot(pt.x, pt.z, 0.55),
      );
      const start = clearWaypoints[0];
      const next = clearWaypoints[1] ?? start;
      const rig = createVillagerNpc(this.pool, {
        archetype: w.archetype,
        seed: seed++,
        withWalkingStick: w.prop === 'stick',
        withMatka: w.prop === 'matka',
        withBasket: w.prop === 'basket',
        withJhola: w.prop === 'jhola',
      });
      const rotY = Math.atan2(next.x - start.x, next.z - start.z);
      rig.root.position.set(start.x, 0, start.z);
      rig.root.rotation.y = rotY;
      this.group.add(rig.root);

      const slapState = this.registerSlappableHuman(
        `npc_walk_${this.levelId}_${lodCounter}`,
        getHumanNpcLabel(w.archetype),
        rig,
        w.minQuality,
        false,
        rotY,
      );

      this.walkers.push({
        kind: 'walker',
        rig,
        slapState,
        waypoints: clearWaypoints,
        wpIndex: 1 % clearWaypoints.length,
        x: start.x,
        z: start.z,
        rotY,
        baseSpeed: w.speed,
        currentSpeed: w.speed,
        pauseTimer: 0,
        pauseCooldown: 5 + (seed % 6),
        radius: 0.45,
        minQuality: w.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      });
    }

    // 2. Cycling children
    for (const c of bp.cyclists) {
      const clearWaypoints = c.waypoints.map((pt) =>
        this.findClearSpot(pt.x, pt.z, 0.72),
      );
      const start = clearWaypoints[0];
      const next = clearWaypoints[1] ?? start;
      const rig = createVillagerNpc(this.pool, {
        archetype: c.archetype,
        seed: seed++,
        withBike: true,
      });
      const rotY = Math.atan2(next.x - start.x, next.z - start.z);
      rig.root.position.set(start.x, 0, start.z);
      rig.root.rotation.y = rotY;
      this.group.add(rig.root);

      const slapState = this.registerSlappableHuman(
        `npc_cycle_${this.levelId}_${lodCounter}`,
        getHumanNpcLabel(c.archetype, 'cyclist'),
        rig,
        c.minQuality,
        false,
        rotY,
      );

      this.walkers.push({
        kind: 'cyclist',
        rig,
        slapState,
        waypoints: clearWaypoints,
        wpIndex: 1 % clearWaypoints.length,
        x: start.x,
        z: start.z,
        rotY,
        baseSpeed: c.speed,
        currentSpeed: c.speed,
        pauseTimer: 0,
        pauseCooldown: 999,
        radius: 0.65,
        minQuality: c.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      });
    }

    // 3. Villagers sitting on charpais outside houses
    for (const ch of bp.charpaiSitters) {
      let cx = ch.x;
      let cz = ch.z;
      if (ch.spawnCharpaiMesh) {
        const spot = this.findClearSpot(cx, cz, 1.05);
        cx = spot.x;
        cz = spot.z;
        const charpaiMesh = createAmbientCharpaiMesh(this.pool);
        charpaiMesh.position.set(cx, 0, cz);
        charpaiMesh.rotation.y = ch.rotY;
        this.group.add(charpaiMesh);
        this.extraProps.push({ obj: charpaiMesh, minQuality: ch.minQuality });
      }

      // Compute charpai local axes: length along local Z, facing outward along local +X
      const cosR = Math.cos(ch.rotY);
      const sinR = Math.sin(ch.rotY);
      const seatFaceRot = ch.rotY + Math.PI / 2;

      for (const occ of ch.occupants) {
        // Sit slightly toward the outer edge (+0.24 along local X, sideOffset along local Z)
        const localX = 0.22;
        const localZ = occ.sideOffset;
        const wx = cx + localX * cosR + localZ * sinR;
        const wz = cz - localX * sinR + localZ * cosR;

        const rig = createVillagerNpc(this.pool, {
          archetype: occ.archetype,
          seed: seed++,
        });
        rig.root.position.set(wx, 0, wz);
        rig.root.rotation.y = seatFaceRot;
        rig.shadowPlane.visible = false; // Seated on charpai weave
        rig.updatePose('sit_charpai', 0.016, 0);
        this.group.add(rig.root);

        const slapState = this.registerSlappableHuman(
          `npc_sit_${this.levelId}_${lodCounter}`,
          getHumanNpcLabel(occ.archetype),
          rig,
          ch.minQuality,
          true,
          seatFaceRot,
        );

        this.stationary.push({
          rig,
          slapState,
          mode: 'sit_charpai',
          x: wx,
          z: wz,
          rotY: seatFaceRot,
          minQuality: ch.minQuality,
          lodOffset: lodCounter++,
          accumDt: 0,
        });
      }

      // Expose unoccupied spots on spawned ambient charpais so players can sit on charpais in every map!
      if (ch.spawnCharpaiMesh) {
        const candidateOffsets = [-0.45, 0.45];
        let addedOnFront = 0;
        for (let oi = 0; oi < candidateOffsets.length; oi++) {
          const offsetZ = candidateOffsets[oi];
          const occupied = ch.occupants.some(
            (occ) => Math.abs(occ.sideOffset - offsetZ) < 0.42,
          );
          if (occupied) continue;
          const localX = 0.24;
          const sx = cx + localX * cosR + offsetZ * sinR;
          const sz = cz - localX * sinR + offsetZ * cosR;
          this.ambientSeats.push({
            minQuality: ch.minQuality,
            seat: {
              id: `npc_charpai_${this.levelId}_${lodCounter}_${oi}`,
              x: sx,
              z: sz,
              seatY: 0.46,
              rotY: seatFaceRot,
              label: 'Charpai',
              kind: 'charpai',
            },
          });
          addedOnFront++;
        }
        // If both front spots are taken by villagers, offer the opposite long edge of the charpai
        if (addedOnFront === 0) {
          const localX = -0.24;
          const sx = cx + localX * cosR;
          const sz = cz - localX * sinR;
          this.ambientSeats.push({
            minQuality: ch.minQuality,
            seat: {
              id: `npc_charpai_back_${this.levelId}_${lodCounter}`,
              x: sx,
              z: sz,
              seatY: 0.46,
              rotY: ch.rotY - Math.PI / 2,
              label: 'Charpai',
              kind: 'charpai',
            },
          });
        }
      }
    }

    // 4. Market sellers & buyers
    for (const mp of bp.marketPairs) {
      const sPos = this.findClearSpot(mp.sellerX, mp.sellerZ, 0.42);
      const bPos = this.findClearSpot(mp.buyerX, mp.buyerZ, 0.42);

      const sellerFace = Math.atan2(bPos.x - sPos.x, bPos.z - sPos.z);
      const buyerFace = Math.atan2(sPos.x - bPos.x, sPos.z - bPos.z);

      if (mp.spawnDisplay) {
        const display = createAmbientVendorDisplay(this.pool);
        display.position.set(
          (sPos.x + bPos.x) * 0.5,
          0,
          (sPos.z + bPos.z) * 0.5,
        );
        display.rotation.y = sellerFace;
        this.group.add(display);
        this.extraProps.push({ obj: display, minQuality: mp.minQuality });
      }

      const sellerRig = createVillagerNpc(this.pool, {
        archetype: 'vendor',
        seed: seed++,
      });
      sellerRig.root.position.set(sPos.x, 0, sPos.z);
      sellerRig.root.rotation.y = sellerFace;
      sellerRig.updatePose('sell', 0.016, 0);
      this.group.add(sellerRig.root);
      const sellerSlap = this.registerSlappableHuman(
        `npc_sell_${this.levelId}_${lodCounter}`,
        getHumanNpcLabel('vendor', 'seller'),
        sellerRig,
        mp.minQuality,
        false,
        sellerFace,
      );
      this.stationary.push({
        rig: sellerRig,
        slapState: sellerSlap,
        mode: 'sell',
        x: sPos.x,
        z: sPos.z,
        rotY: sellerFace,
        minQuality: mp.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      });

      const buyerRig = createVillagerNpc(this.pool, {
        archetype: mp.buyerArchetype,
        seed: seed++,
        withBasket: mp.buyerArchetype === 'woman',
        withJhola: mp.buyerArchetype !== 'woman',
      });
      buyerRig.root.position.set(bPos.x, 0, bPos.z);
      buyerRig.root.rotation.y = buyerFace;
      buyerRig.updatePose('buy', 0.016, 0);
      this.group.add(buyerRig.root);
      const buyerSlap = this.registerSlappableHuman(
        `npc_buy_${this.levelId}_${lodCounter}`,
        getHumanNpcLabel(mp.buyerArchetype),
        buyerRig,
        mp.minQuality,
        false,
        buyerFace,
      );
      this.stationary.push({
        rig: buyerRig,
        slapState: buyerSlap,
        mode: 'buy',
        x: bPos.x,
        z: bPos.z,
        rotY: buyerFace,
        minQuality: mp.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      });
    }

    // 5. Chatting pairs (children & villagers)
    for (const cg of bp.chatGroups) {
      const center = this.findClearSpot(cg.x, cg.z, 0.9);
      const offsets = [-0.62, 0.62];
      for (let i = 0; i < 2; i++) {
        const px = center.x + offsets[i];
        const pz = center.z;
        const rotY = i === 0 ? Math.PI / 2 : -Math.PI / 2;
        const rig = createVillagerNpc(this.pool, {
          archetype: cg.archetypes[i],
          seed: seed++,
        });
        rig.root.position.set(px, 0, pz);
        rig.root.rotation.y = rotY;
        rig.updatePose('talk', 0.016, 0);
        this.group.add(rig.root);

        const slapState = this.registerSlappableHuman(
          `npc_chat_${this.levelId}_${lodCounter}`,
          getHumanNpcLabel(cg.archetypes[i]),
          rig,
          cg.minQuality,
          false,
          rotY,
        );

        this.stationary.push({
          rig,
          slapState,
          mode: 'talk',
          x: px,
          z: pz,
          rotY,
          minQuality: cg.minQuality,
          lodOffset: lodCounter++,
          accumDt: 0,
        });
      }
    }

    // 5b. Village school classroom sessions (Teacher at blackboard + Seated students at wooden benches)
    if (bp.classroomSessions) {
      for (const session of bp.classroomSessions) {
        if (session.teacher) {
          const t = session.teacher;
          const teacherRig = createVillagerNpc(this.pool, {
            archetype: t.archetype,
            seed: seed++,
            withSpectacles: true,
            withChalkStick: true,
          });
          teacherRig.root.position.set(t.x, 0, t.z);
          teacherRig.root.rotation.y = t.rotY;
          teacherRig.updatePose('teach', 0.016, 0);
          this.group.add(teacherRig.root);

          const slapState = this.registerSlappableHuman(
            `npc_teacher_${this.levelId}_${lodCounter}`,
            getHumanNpcLabel(t.archetype, 'teacher'),
            teacherRig,
            t.minQuality,
            false,
            t.rotY,
          );

          this.stationary.push({
            rig: teacherRig,
            slapState,
            mode: 'teach',
            x: t.x,
            z: t.z,
            rotY: t.rotY,
            minQuality: t.minQuality,
            lodOffset: lodCounter++,
            accumDt: 0,
          });
        }

        for (const st of session.students) {
          const stRig = createVillagerNpc(this.pool, {
            archetype: st.archetype,
            seed: seed++,
          });
          stRig.root.position.set(st.x, 0, st.z);
          stRig.root.rotation.y = st.rotY;
          stRig.updatePose('sit_bench', 0.016, 0);
          this.group.add(stRig.root);

          const slapState = this.registerSlappableHuman(
            `npc_student_${this.levelId}_${lodCounter}`,
            getHumanNpcLabel(st.archetype, 'student'),
            stRig,
            st.minQuality,
            true,
            st.rotY,
          );

          this.stationary.push({
            rig: stRig,
            slapState,
            mode: 'sit_bench',
            x: st.x,
            z: st.z,
            rotY: st.rotY,
            minQuality: st.minQuality,
            lodOffset: lodCounter++,
            accumDt: 0,
          });
        }
      }
    }

    // 6. Children playing gully cricket!
    {
      const cr = bp.cricket;
      const center = this.findClearSpot(cr.x, cr.z, 1.8);
      const pitchLen = cr.pitchLen ?? 6.0;
      const dirX = Math.sin(cr.rotY);
      const dirZ = Math.cos(cr.rotY);
      const perpX = dirZ;
      const perpZ = -dirX;

      const cGroup = new THREE.Group();
      this.group.add(cGroup);

      const { stumps, ball } = createCricketSetProps(this.pool);
      const halfP = pitchLen * 0.5;
      stumps.position.set(
        center.x - dirX * (halfP + 0.55),
        0,
        center.z - dirZ * (halfP + 0.55),
      );
      stumps.rotation.y = cr.rotY;
      cGroup.add(stumps, ball);

      const batter = createVillagerNpc(this.pool, {
        archetype: 'child_boy',
        seed: seed++,
        withCricketBat: true,
      });
      batter.root.position.set(center.x - dirX * halfP, 0, center.z - dirZ * halfP);
      batter.root.rotation.y = cr.rotY;
      cGroup.add(batter.root);

      const bowler = createVillagerNpc(this.pool, {
        archetype: 'child_boy',
        seed: seed++,
      });
      bowler.root.position.set(center.x + dirX * halfP, 0, center.z + dirZ * halfP);
      bowler.root.rotation.y = cr.rotY + Math.PI;
      cGroup.add(bowler.root);

      const fielder = createVillagerNpc(this.pool, {
        archetype: 'child_girl',
        seed: seed++,
      });
      fielder.root.position.set(
        center.x + perpX * 2.5 - dirX * 0.4,
        0,
        center.z + perpZ * 2.5 - dirZ * 0.4,
      );
      const fielderRot = Math.atan2(
        batter.root.position.x - fielder.root.position.x,
        batter.root.position.z - fielder.root.position.z,
      );
      fielder.root.rotation.y = fielderRot;
      cGroup.add(fielder.root);

      const batterSlap = this.registerSlappableHuman(
        `npc_cr_bat_${this.levelId}`,
        getHumanNpcLabel('child_boy', 'cricket'),
        batter,
        cr.minQuality,
        false,
        cr.rotY,
      );
      const bowlerSlap = this.registerSlappableHuman(
        `npc_cr_bowl_${this.levelId}`,
        getHumanNpcLabel('child_boy', 'cricket'),
        bowler,
        cr.minQuality,
        false,
        cr.rotY + Math.PI,
      );
      const fielderSlap = this.registerSlappableHuman(
        `npc_cr_fld_${this.levelId}`,
        getHumanNpcLabel('child_girl', 'cricket'),
        fielder,
        cr.minQuality,
        false,
        fielderRot,
      );

      this.cricket = {
        group: cGroup,
        batter,
        bowler,
        fielder,
        batterSlap,
        bowlerSlap,
        fielderSlap,
        ball,
        centerX: center.x,
        centerZ: center.z,
        dirX,
        dirZ,
        pitchLen,
        phase: 0,
        minQuality: cr.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      };
    }

    // 7. Village Animals: Cows, Buffaloes, Goats, Indie Dogs
    for (const an of bp.animals) {
      const anRadius =
        an.species === 'cow' || an.species === 'buffalo' ? 0.78 : 0.42;
      const home = this.findClearSpot(an.x, an.z, anRadius);
      const rig = createVillageAnimal(this.pool, an.species, seed++);
      const initRot = ((seed * 1.17) % (Math.PI * 2)) - Math.PI;
      rig.root.position.set(home.x, 0, home.z);
      rig.root.rotation.y = initRot;

      const baseSpeed =
        an.species === 'dog'
          ? 2.1
          : an.species === 'goat'
            ? 1.35
            : an.species === 'cow'
              ? 0.85
              : 0.72;

      // Build gentle natural roam loop around home spot
      const roamPoints: Waypoint2D[] = [];
      const count = 4;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (seed % 5) * 0.4;
        const r = an.roamRadius * (0.55 + ((i + seed) % 3) * 0.18);
        roamPoints.push(
          this.findClearSpot(
            home.x + Math.cos(ang) * r,
            home.z + Math.sin(ang) * r,
            anRadius,
          ),
        );
      }

      const initState = an.initialState ?? (seed % 2 === 0 ? 'walk' : 'graze');
      rig.updatePose(initState, 0.016, 0);
      this.group.add(rig.root);

      this.animals.push({
        rig,
        species: an.species,
        homeX: home.x,
        homeZ: home.z,
        roamRadius: an.roamRadius,
        waypoints: roamPoints,
        wpIndex: 0,
        x: home.x,
        z: home.z,
        rotY: initRot,
        baseSpeed,
        currentSpeed: 0,
        state: initState,
        stateTimer: 3.5 + (seed % 6),
        radius: anRadius,
        minQuality: an.minQuality,
        lodOffset: lodCounter++,
        accumDt: 0,
      });
    }
  }

  public setGraphicsQuality(quality: QualityTier): void {
    this.quality = quality;
    const rank = QUALITY_RANK[quality];
    const allowShadows = quality === 'high';

    const applyShadow = (obj: THREE.Object3D, cast: boolean) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry !== this.pool.shadowGeo) {
          child.castShadow = cast;
        }
      });
    };

    for (const w of this.walkers) {
      const enabled = QUALITY_RANK[w.minQuality] <= rank;
      w.rig.root.visible = enabled;
      applyShadow(w.rig.root, allowShadows && enabled);
    }
    for (const s of this.stationary) {
      const enabled = QUALITY_RANK[s.minQuality] <= rank;
      s.rig.root.visible = enabled;
      applyShadow(s.rig.root, allowShadows && enabled);
    }
    for (const p of this.extraProps) {
      p.obj.visible = QUALITY_RANK[p.minQuality] <= rank;
    }
    if (this.cricket) {
      const enabled = QUALITY_RANK[this.cricket.minQuality] <= rank;
      this.cricket.group.visible = enabled;
      applyShadow(this.cricket.group, allowShadows && enabled);
    }
    for (const a of this.animals) {
      const enabled = QUALITY_RANK[a.minQuality] <= rank;
      a.rig.root.visible = enabled;
      applyShadow(a.rig.root, allowShadows && enabled);
    }
  }

  /**
   * Advances all ambient villagers, children, cricket play, and animals.
   * Zero per-frame heap allocations; distance-based LOD keeps Android smooth.
   */
  public update(
    dt: number,
    cameraPos: THREE.Vector3,
    playerPos?: THREE.Vector3 | null,
  ): void {
    const safeDt = Math.min(dt, 0.05);
    this.frameCounter++;
    const rank = QUALITY_RANK[this.quality];
    const camX = cameraPos.x;
    const camZ = cameraPos.z;
    const nearSq = this.quality === 'low' ? 18 * 18 : 26 * 26;
    const midSq = this.quality === 'low' ? 38 * 38 : 48 * 48;
    const cullSq = this.quality === 'low' ? 48 * 48 : 64 * 64;

    const hasPlayer = Boolean(playerPos);
    const px = playerPos ? playerPos.x : 9999;
    const pz = playerPos ? playerPos.z : 9999;

    // 1. Update walking villagers & cycling children
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (QUALITY_RANK[w.minQuality] > rank) continue;

      const dCamSq = (w.x - camX) * (w.x - camX) + (w.z - camZ) * (w.z - camZ);
      const inRange = dCamSq < cullSq;
      w.rig.root.visible = inRange;
      if (!inRange) continue;

      // Distance-based LOD frame throttling (always 60Hz while actively reacting to a slap)
      const isSlapped = w.slapState.slapTimer > 0;
      const stride = isSlapped ? 1 : dCamSq < nearSq ? 1 : dCamSq < midSq ? 2 : 4;
      w.accumDt += safeDt;
      if ((this.frameCounter + w.lodOffset) % stride !== 0) continue;
      const stepDt = w.accumDt;
      w.accumDt = 0;

      if (isSlapped) {
        w.slapState.slapTimer = Math.max(0, w.slapState.slapTimer - stepDt);
        w.currentSpeed = THREE.MathUtils.damp(w.currentSpeed, 0, 12, stepDt);
        const progress = 1 - w.slapState.slapTimer / w.slapState.slapDuration;
        w.rig.updatePose('slapped', stepDt, 0, progress);
        continue;
      }

      // Brief natural walking pauses to look around (walkers only, not cyclists)
      if (w.kind === 'walker') {
        if (w.pauseTimer > 0) {
          w.pauseTimer -= stepDt;
          w.currentSpeed = THREE.MathUtils.damp(w.currentSpeed, 0, 7, stepDt);
          w.rig.updatePose('idle', stepDt, w.currentSpeed);
          continue;
        }
        w.pauseCooldown -= stepDt;
        if (w.pauseCooldown <= 0) {
          w.pauseTimer = 1.6 + ((i * 7 + this.frameCounter) % 3);
          w.pauseCooldown = 10 + ((i * 5) % 8);
          continue;
        }
      }

      const wp = w.waypoints[w.wpIndex];
      const toX = wp.x - w.x;
      const toZ = wp.z - w.z;
      const distSq = toX * toX + toZ * toZ;

      if (distSq < 1.35 * 1.35) {
        w.wpIndex = (w.wpIndex + 1) % w.waypoints.length;
      }

      const dist = Math.sqrt(distSq) || 1;
      let dirX = toX / dist;
      let dirZ = toZ / dist;

      // Polite soft yield away from player (NPC moves gently aside, never blocks player)
      if (hasPlayer) {
        const fromPx = w.x - px;
        const fromPz = w.z - pz;
        const pDistSq = fromPx * fromPx + fromPz * fromPz;
        if (pDistSq < 2.2 * 2.2 && pDistSq > 0.01) {
          const pDist = Math.sqrt(pDistSq);
          const push = (2.2 - pDist) / 2.2;
          dirX += (fromPx / pDist) * push * 0.9;
          dirZ += (fromPz / pDist) * push * 0.9;
        }
      }

      // Normalize desired direction
      const dLen = Math.hypot(dirX, dirZ) || 1;
      dirX /= dLen;
      dirZ /= dLen;

      const targetRot = Math.atan2(dirX, dirZ);
      const steerDelta = normalizeAngle(targetRot - w.rotY);
      w.rotY = dampAngle(w.rotY, targetRot, w.kind === 'cyclist' ? 4.5 : 5.5, stepDt);

      // Slow slightly on sharp turns
      const turnFactor = Math.max(0.45, 1 - Math.abs(steerDelta) * 0.45);
      w.currentSpeed = THREE.MathUtils.damp(
        w.currentSpeed,
        w.baseSpeed * turnFactor,
        6,
        stepDt,
      );

      const nextX = w.x + Math.sin(w.rotY) * w.currentSpeed * stepDt;
      const nextZ = w.z + Math.cos(w.rotY) * w.currentSpeed * stepDt;
      this.resolveMovementObstacles(nextX, nextZ, w.radius, _avoidOut);

      // If stuck against an obstacle, advance to next waypoint cleanly
      const movedSq =
        (_avoidOut.x - w.x) * (_avoidOut.x - w.x) +
        (_avoidOut.z - w.z) * (_avoidOut.z - w.z);
      if (movedSq < 0.0001 && w.currentSpeed > 0.4) {
        w.wpIndex = (w.wpIndex + 1) % w.waypoints.length;
      }

      w.x = _avoidOut.x;
      w.z = _avoidOut.z;
      w.rig.root.position.set(w.x, 0, w.z);
      w.rig.root.rotation.y = w.rotY;
      // Subtle lean into corners while cycling
      if (w.kind === 'cyclist') {
        w.rig.root.rotation.z = THREE.MathUtils.damp(
          w.rig.root.rotation.z,
          THREE.MathUtils.clamp(-steerDelta * 0.25, -0.18, 0.18),
          7,
          stepDt,
        );
      }

      w.rig.updatePose(
        w.kind === 'cyclist' ? 'cycle' : 'walk',
        stepDt,
        w.currentSpeed,
        0,
        THREE.MathUtils.clamp(steerDelta, -0.8, 0.8),
      );
    }

    // 2. Update stationary villagers (charpai sitters, market buyers/sellers, chatting kids)
    for (let i = 0; i < this.stationary.length; i++) {
      const s = this.stationary[i];
      if (QUALITY_RANK[s.minQuality] > rank) continue;

      const dCamSq = (s.x - camX) * (s.x - camX) + (s.z - camZ) * (s.z - camZ);
      const inRange = dCamSq < cullSq;
      s.rig.root.visible = inRange;
      if (!inRange) continue;

      const isSlapped = s.slapState.slapTimer > 0;
      const stride = isSlapped ? 1 : dCamSq < nearSq ? 1 : dCamSq < midSq ? 3 : 6;
      s.accumDt += safeDt;
      if ((this.frameCounter + s.lodOffset) % stride !== 0) continue;
      const stepDt = s.accumDt;
      s.accumDt = 0;

      if (isSlapped) {
        s.slapState.slapTimer = Math.max(0, s.slapState.slapTimer - stepDt);
        const progress = 1 - s.slapState.slapTimer / s.slapState.slapDuration;
        s.rig.updatePose(
          s.slapState.isSeated ? 'slapped_seated' : 'slapped',
          stepDt,
          0,
          progress,
        );
      } else {
        if (!s.slapState.isSeated) {
          s.rig.root.rotation.y = dampAngle(
            s.rig.root.rotation.y,
            s.rotY,
            6,
            stepDt,
          );
        }
        s.rig.updatePose(s.mode, stepDt, 0);
      }
    }

    // 3. Update gully cricket scene (bowler -> bouncing pitch delivery -> bat drive -> fielder return!)
    if (this.cricket && QUALITY_RANK[this.cricket.minQuality] <= rank) {
      const cr = this.cricket;
      const dCamSq =
        (cr.centerX - camX) * (cr.centerX - camX) +
        (cr.centerZ - camZ) * (cr.centerZ - camZ);
      const inRange = dCamSq < cullSq;
      cr.group.visible = inRange;
      if (inRange) {
        const stride = dCamSq < nearSq ? 1 : dCamSq < midSq ? 2 : 4;
        cr.accumDt += safeDt;
        if ((this.frameCounter + cr.lodOffset) % stride === 0) {
          const stepDt = cr.accumDt;
          cr.accumDt = 0;

          // 4.2-second full gully cricket delivery cycle
          cr.phase = (cr.phase + stepDt / 4.2) % 1;
          const p = cr.phase;

          const halfP = cr.pitchLen * 0.5;
          const batX = cr.centerX - cr.dirX * halfP;
          const batZ = cr.centerZ - cr.dirZ * halfP;
          const bowlX = cr.centerX + cr.dirX * halfP;
          const bowlZ = cr.centerZ + cr.dirZ * halfP;
          const fldX = cr.fielder.root.position.x;
          const fldZ = cr.fielder.root.position.z;

          // Bowler run-up position offset
          const runUpBack =
            p < 0.36 ? (1 - p / 0.36) * 1.45 : Math.min(1, (p - 0.85) / 0.15) * 1.45;
          cr.bowler.root.position.set(
            bowlX + cr.dirX * Math.max(0, runUpBack),
            0,
            bowlZ + cr.dirZ * Math.max(0, runUpBack),
          );

          // Ball trajectory across 4 phases
          if (p < 0.34) {
            // In bowler's hand during run-up
            cr.ball.position.set(
              cr.bowler.root.position.x + 0.18,
              0.92 + Math.sin(p * 18) * 0.12,
              cr.bowler.root.position.z,
            );
          } else if (p < 0.53) {
            // Bowled down the pitch with one crisp bounce at 70% length!
            const u = (p - 0.34) / 0.19;
            const bx = THREE.MathUtils.lerp(bowlX, batX, u);
            const bz = THREE.MathUtils.lerp(bowlZ, batZ, u);
            const bounceY =
              u < 0.72
                ? Math.max(0.08, (1 - (u / 0.72) * (u / 0.72)) * 1.18)
                : Math.sin(((u - 0.72) / 0.28) * Math.PI * 0.85) * 0.68 + 0.08;
            cr.ball.position.set(bx, bounceY, bz);
          } else if (p < 0.78) {
            // Hit sweetly off the bat in an arc toward the fielder!
            const u = (p - 0.53) / 0.25;
            const bx = THREE.MathUtils.lerp(batX, fldX, u);
            const bz = THREE.MathUtils.lerp(batZ, fldZ, u);
            const arcY = 0.45 + Math.sin(u * Math.PI) * 1.35;
            cr.ball.position.set(bx, arcY, bz);
          } else {
            // Fielder lobs ball cleanly back to bowler
            const u = (p - 0.78) / 0.22;
            const bx = THREE.MathUtils.lerp(fldX, bowlX, u);
            const bz = THREE.MathUtils.lerp(fldZ, bowlZ, u);
            const arcY = 0.85 + Math.sin(u * Math.PI) * 1.1;
            cr.ball.position.set(bx, arcY, bz);
          }

          const anyCricketSlapped =
            cr.batterSlap.slapTimer > 0 ||
            cr.bowlerSlap.slapTimer > 0 ||
            cr.fielderSlap.slapTimer > 0;
          const updateCricketer = (
            rig: VillagerRig,
            slap: SlappableHumanEntry,
            normalMode: VillagerAnimMode,
          ) => {
            if (slap.slapTimer > 0) {
              slap.slapTimer = Math.max(0, slap.slapTimer - stepDt);
              const prog = 1 - slap.slapTimer / slap.slapDuration;
              rig.updatePose('slapped', stepDt, 0, prog);
            } else {
              rig.root.rotation.y = dampAngle(
                rig.root.rotation.y,
                slap.baseRotY,
                6,
                stepDt,
              );
              rig.updatePose(normalMode, stepDt, 0, p);
            }
          };

          updateCricketer(cr.batter, cr.batterSlap, 'cricket_bat');
          updateCricketer(cr.bowler, cr.bowlerSlap, 'cricket_bowl');
          updateCricketer(cr.fielder, cr.fielderSlap, 'cricket_field');
          if (anyCricketSlapped) {
            cr.ball.visible = true;
          }
        }
      }
    }

    // 4. Update village animals (cows, buffaloes, goats, dogs)
    for (let i = 0; i < this.animals.length; i++) {
      const an = this.animals[i];
      if (QUALITY_RANK[an.minQuality] > rank) continue;

      const dCamSq = (an.x - camX) * (an.x - camX) + (an.z - camZ) * (an.z - camZ);
      const inRange = dCamSq < cullSq;
      an.rig.root.visible = inRange;
      if (!inRange) continue;

      const stride = dCamSq < nearSq ? 1 : dCamSq < midSq ? 2 : 4;
      an.accumDt += safeDt;
      if ((this.frameCounter + an.lodOffset) % stride !== 0) continue;
      const stepDt = an.accumDt;
      an.accumDt = 0;

      // Measure gentle player proximity for lifelike ambient curiosity (never interferes with match)
      let pDistSq = 9999;
      let lookYawOffset = 0;
      let excited = false;
      if (hasPlayer) {
        const toPx = px - an.x;
        const toPz = pz - an.z;
        pDistSq = toPx * toPx + toPz * toPz;
        const watchRadius = an.species === 'dog' ? 5.6 : 5.0;
        if (pDistSq < watchRadius * watchRadius && pDistSq > 0.04) {
          const angleToPlayer = Math.atan2(toPx, toPz);
          lookYawOffset = normalizeAngle(angleToPlayer - an.rotY);
          if (an.species === 'dog' && pDistSq < 4.5 * 4.5) {
            excited = true;
          }
        }
      }

      an.stateTimer -= stepDt;
      if (an.stateTimer <= 0) {
        // Rich species-authentic behavioral cycling
        const roll = (this.frameCounter + i * 7) % 6;
        if (an.state === 'walk') {
          if (an.species === 'dog') {
            an.state = roll === 0 ? 'rest' : roll <= 2 ? 'sniff' : 'idle';
            an.stateTimer = an.state === 'rest' ? 6.5 + (i % 4) : 3.2 + ((i * 3) % 4);
          } else if (an.species === 'goat') {
            an.state = roll === 0 ? 'idle' : 'graze';
            an.stateTimer = 4.2 + ((i * 3) % 5);
          } else {
            an.state = roll === 0 ? 'rest' : roll === 1 ? 'idle' : 'graze';
            an.stateTimer =
              an.state === 'rest' ? 8.5 + (i % 5) : 5.2 + ((i * 5) % 6);
          }
        } else {
          an.state = 'walk';
          an.wpIndex = (an.wpIndex + 1) % an.waypoints.length;
          an.stateTimer = 6.2 + ((i * 4) % 7);
        }
      }

      // Dogs perk up curiously into alert stance when player strolls nearby
      if (
        an.species === 'dog' &&
        (an.state === 'idle' || an.state === 'sniff') &&
        pDistSq < 4.0 * 4.0 &&
        pDistSq > 2.2 * 2.2
      ) {
        an.state = 'alert';
        an.stateTimer = Math.max(an.stateTimer, 1.8);
      } else if (an.state === 'alert' && pDistSq > 5.0 * 5.0) {
        an.state = 'idle';
      }

      // Nimble goats step briskly aside if player runs right next to them
      const goatStartled =
        an.species === 'goat' && pDistSq < 2.4 * 2.4 && an.state !== 'walk';
      if (goatStartled) {
        an.state = 'walk';
        an.stateTimer = 3.5;
      }

      if (an.state === 'walk') {
        const wp = an.waypoints[an.wpIndex];
        const toX = wp.x - an.x;
        const toZ = wp.z - an.z;
        const distSq = toX * toX + toZ * toZ;

        if (distSq < 1.1 * 1.1) {
          an.wpIndex = (an.wpIndex + 1) % an.waypoints.length;
          an.state =
            an.species === 'dog'
              ? (i + this.frameCounter) % 2 === 0
                ? 'sniff'
                : 'idle'
              : 'graze';
          an.stateTimer = 4.2 + (i % 4);
          an.currentSpeed = 0;
        } else {
          const dist = Math.sqrt(distSq) || 1;
          let dirX = toX / dist;
          let dirZ = toZ / dist;

          // Gentle yield if player gets close so animals never walk through standing players
          let speedBoost = 1.0;
          if (hasPlayer && pDistSq < 2.65 * 2.65 && pDistSq > 0.01) {
            const pDist = Math.sqrt(pDistSq);
            const fromPx = an.x - px;
            const fromPz = an.z - pz;
            const repulseWeight =
              an.species === 'cow' || an.species === 'buffalo' ? 1.55 : 1.05;
            dirX += (fromPx / pDist) * repulseWeight;
            dirZ += (fromPz / pDist) * repulseWeight;
            if (an.species === 'goat' || an.species === 'dog') {
              speedBoost = 1.38;
            }
          }

          // Smooth animal-to-animal separation so cows, buffaloes & other animals never block or overlap each other
          for (let j = 0; j < this.animals.length; j++) {
            if (j === i) continue;
            const other = this.animals[j];
            if (QUALITY_RANK[other.minQuality] > rank) continue;
            const sepDx = an.x - other.x;
            const sepDz = an.z - other.z;
            const minSep = an.radius + other.radius + 0.45;
            const sepSq = sepDx * sepDx + sepDz * sepDz;
            if (sepSq < minSep * minSep && sepSq > 0.0001) {
              const sepD = Math.sqrt(sepSq);
              const push = ((minSep - sepD) / minSep) * 1.9;
              dirX += (sepDx / sepD) * push;
              dirZ += (sepDz / sepD) * push;
            }
          }

          const dLen = Math.hypot(dirX, dirZ) || 1;
          const targetRot = Math.atan2(dirX / dLen, dirZ / dLen);
          an.rotY = dampAngle(
            an.rotY,
            targetRot,
            an.species === 'dog' || an.species === 'goat' ? 5.6 : 3.8,
            stepDt,
          );
          an.currentSpeed = THREE.MathUtils.damp(
            an.currentSpeed,
            an.baseSpeed * speedBoost,
            5.5,
            stepDt,
          );

          let nextX = an.x + Math.sin(an.rotY) * an.currentSpeed * stepDt;
          let nextZ = an.z + Math.cos(an.rotY) * an.currentSpeed * stepDt;

          // Keep walking cows/buffaloes from encroaching directly onto the player's personal space
          if (
            hasPlayer &&
            (an.species === 'cow' || an.species === 'buffalo')
          ) {
            const minPlayerDist = an.species === 'buffalo' ? 1.25 : 1.15;
            const pdx = nextX - px;
            const pdz = nextZ - pz;
            const pdSq = pdx * pdx + pdz * pdz;
            if (pdSq < minPlayerDist * minPlayerDist && pdSq > 0.0001) {
              const pd = Math.sqrt(pdSq);
              nextX = px + (pdx / pd) * minPlayerDist;
              nextZ = pz + (pdz / pd) * minPlayerDist;
              an.currentSpeed *= 0.65;
            }
          }

          this.resolveMovementObstacles(nextX, nextZ, an.radius, _avoidOut);

          // Pairwise non-blocking nudge so two animals never intersect
          for (let j = 0; j < this.animals.length; j++) {
            if (j === i) continue;
            const other = this.animals[j];
            if (QUALITY_RANK[other.minQuality] > rank) continue;
            const odx = _avoidOut.x - other.x;
            const odz = _avoidOut.z - other.z;
            const minSpace = an.radius + other.radius + 0.12;
            const odSq = odx * odx + odz * odz;
            if (odSq < minSpace * minSpace && odSq > 0.0001) {
              const od = Math.sqrt(odSq);
              const overlap = (minSpace - od) * 0.55;
              _avoidOut.x += (odx / od) * overlap;
              _avoidOut.z += (odz / od) * overlap;
            }
          }

          const movedSq =
            (_avoidOut.x - an.x) * (_avoidOut.x - an.x) +
            (_avoidOut.z - an.z) * (_avoidOut.z - an.z);
          if (movedSq < 0.0001 && an.currentSpeed > 0.35) {
            an.wpIndex = (an.wpIndex + 1) % an.waypoints.length;
          }

          an.x = _avoidOut.x;
          an.z = _avoidOut.z;
          an.rig.root.position.set(an.x, 0, an.z);
          an.rig.root.rotation.y = an.rotY;
        }
      } else {
        an.currentSpeed = THREE.MathUtils.damp(an.currentSpeed, 0, 6, stepDt);
        // Subtle body turn toward player when dog is alert & excited
        if (an.state === 'alert' && hasPlayer && pDistSq < 4.5 * 4.5) {
          const targetRot = Math.atan2(px - an.x, pz - an.z);
          an.rotY = dampAngle(an.rotY, targetRot, 3.2, stepDt);
          an.rig.root.rotation.y = an.rotY;
          lookYawOffset = normalizeAngle(targetRot - an.rotY);
        }
      }

      an.rig.updatePose(an.state, stepDt, an.currentSpeed, lookYawOffset, excited);
    }

    // 5. Animate floating 3D reaction bubbles over recently slapped human NPCs
    for (let i = 0; i < this.slappableHumans.length; i++) {
      const h = this.slappableHumans[i];
      if (!h.bubbleSprite || h.bubbleTimer <= 0) continue;
      h.bubbleTimer -= safeDt;
      if (h.bubbleTimer <= 0) {
        h.bubbleSprite.visible = false;
      } else {
        const life = h.bubbleTimer / 1.65;
        h.bubbleSprite.position.y = 2.02 + (1 - life) * 0.28;
        const mat = h.bubbleSprite.material as THREE.SpriteMaterial;
        mat.opacity = life < 0.25 ? life / 0.25 : 1;
      }
    }
  }

  /**
   * Resolves accurate 3D oriented-capsule body collisions against all active cows and buffaloes.
   * Prevents players and AI actors from walking through cows/buffaloes while preserving smooth
   * natural sliding along their flanks, chest, and rump (and ignoring upper-floor actors above them).
   */
  public resolveLargeAnimalCollisions(
    pos: THREE.Vector3,
    actorRadius: number,
  ): boolean {
    const rank = QUALITY_RANK[this.quality];
    let collided = false;

    for (let i = 0; i < this.animals.length; i++) {
      const an = this.animals[i];
      if (an.species !== 'cow' && an.species !== 'buffalo') continue;
      if (QUALITY_RANK[an.minQuality] > rank) continue;

      // 3D vertical height check so players on balconies/rooftops above never hit ground animals
      const bodyTopY =
        an.state === 'rest'
          ? 0.96
          : an.species === 'buffalo'
            ? 1.54
            : 1.46;
      if (pos.y >= bodyTopY) continue;

      // Oriented 3D torso capsule segment matching actual cow/buffalo 3D mesh proportions
      const isBuffalo = an.species === 'buffalo';
      const rearOffset = isBuffalo ? -0.62 : -0.58;
      const frontOffset = isBuffalo ? 0.72 : 0.66;
      const bodyHalfWidth = isBuffalo ? 0.45 : 0.38;

      const fx = Math.sin(an.rotY);
      const fz = Math.cos(an.rotY);

      const ax = an.x + fx * rearOffset;
      const az = an.z + fz * rearOffset;
      const bx = an.x + fx * frontOffset;
      const bz = an.z + fz * frontOffset;

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
        collided = true;
        if (dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          const overlap = minDist - d;
          pos.x += (dx / d) * overlap;
          pos.z += (dz / d) * overlap;
        } else {
          // Fallback push perpendicular to animal flank
          pos.x += fz * minDist;
          pos.z -= fx * minDist;
        }
      }
    }

    return collided;
  }

  /**
   * Finds the nearest visible human NPC within slap range.
   * Strictly excludes animals (cows, buffaloes, goats, dogs).
   */
  public findNearestSlappableHuman(
    x: number,
    z: number,
    maxRange = 2.9,
  ): SlappableNpcTarget | null {
    const rank = QUALITY_RANK[this.quality];
    let best: SlappableNpcTarget | null = null;
    let bestDistSq = maxRange * maxRange;

    for (let i = 0; i < this.slappableHumans.length; i++) {
      const h = this.slappableHumans[i];
      if (QUALITY_RANK[h.minQuality] > rank) continue;
      if (!h.rig.root.visible) continue;
      if (h.slapTimer > 0.45) continue;

      const hx = h.rig.root.position.x;
      const hz = h.rig.root.position.z;
      const dx = hx - x;
      const dz = hz - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        best = { id: h.id, label: h.label, x: hx, z: hz };
      }
    }
    return best;
  }

  /**
   * Triggers a comical slap flinch & village exclamation bubble on a human NPC.
   */
  public slapHumanNpc(
    npcId: string,
    slapperX: number,
    slapperZ: number,
  ): { label: string; x: number; z: number } | null {
    const target = this.slappableHumans.find((h) => h.id === npcId);
    if (!target) return null;

    const hx = target.rig.root.position.x;
    const hz = target.rig.root.position.z;
    target.slapTimer = target.slapDuration;

    // Turn standing/walking/cricket human NPC to face the player in surprise
    if (!target.isSeated) {
      target.rig.root.rotation.y = Math.atan2(slapperX - hx, slapperZ - hz);
    }

    const reactions =
      target.rig.archetype === 'child_boy' || target.rig.archetype === 'child_girl'
        ? ['Ouch! 👋', 'Oye! 👋', 'Hey! 👋', 'Arre! 👋']
        : target.rig.archetype === 'elder'
          ? ['Arre Shaitan!', 'Oye Badmash!', 'Ayyo! 👋', 'Arre! 👋']
          : ['Arre! 👋', 'Oye! 👋', 'Kya karta hai!', 'Ayyo! 👋'];
    const msg = reactions[Math.floor(Math.random() * reactions.length)] ?? 'Arre! 👋';

    if (target.bubbleSprite) {
      const oldMat = target.bubbleSprite.material as THREE.SpriteMaterial;
      oldMat.map?.dispose();
      oldMat.dispose();
      target.rig.root.remove(target.bubbleSprite);
    }
    const sprite = createNpcReactionBubbleSprite(msg);
    sprite.position.set(0, 2.02, 0);
    target.rig.root.add(sprite);
    target.bubbleSprite = sprite;
    target.bubbleTimer = 1.65;

    return { label: target.label, x: hx, z: hz };
  }

  /**
   * Returns unoccupied charpai seats spawned by the ambient village system
   * that are currently visible at the active graphics quality level.
   */
  public getAvailableSeats(): SeatSpot[] {
    const qRank = QUALITY_RANK[this.quality];
    const out: SeatSpot[] = [];
    for (let i = 0; i < this.ambientSeats.length; i++) {
      const entry = this.ambientSeats[i];
      if (QUALITY_RANK[entry.minQuality] <= qRank) {
        out.push(entry.seat);
      }
    }
    return out;
  }

  /**
   * Checks whether a seated/stationary NPC already occupies a seat spot.
   */
  public isSpotOccupiedByNpc(x: number, z: number, minDist = 0.55): boolean {
    const minSq = minDist * minDist;
    const qRank = QUALITY_RANK[this.quality];
    for (let i = 0; i < this.stationary.length; i++) {
      const s = this.stationary[i];
      if (QUALITY_RANK[s.minQuality] > qRank) continue;
      const dx = s.x - x;
      const dz = s.z - z;
      if (dx * dx + dz * dz < minSq) return true;
    }
    return false;
  }

  /**
   * Finds the nearest visible human NPC head position for realistic player eye/head glances.
   */
  public getNearestHumanNpcHead(
    x: number,
    z: number,
    maxRange = 4.2,
  ): { x: number; y: number; z: number } | null {
    const qRank = QUALITY_RANK[this.quality];
    let bestDistSq = maxRange * maxRange;
    let best: { x: number; y: number; z: number } | null = null;
    for (let i = 0; i < this.slappableHumans.length; i++) {
      const h = this.slappableHumans[i];
      if (QUALITY_RANK[h.minQuality] > qRank) continue;
      const pos = h.rig.root.position;
      const dx = pos.x - x;
      const dz = pos.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq && dSq > 0.04) {
        bestDistSq = dSq;
        best = {
          x: pos.x,
          y: pos.y + (h.isSeated ? 1.16 : 1.48),
          z: pos.z,
        };
      }
    }
    return best;
  }

  public dispose(): void {
    for (const h of this.slappableHumans) {
      if (h.bubbleSprite) {
        const mat = h.bubbleSprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
        h.rig.root.remove(h.bubbleSprite);
        h.bubbleSprite = null;
      }
    }
    this.slappableHumans.length = 0;
    this.walkers.length = 0;
    this.stationary.length = 0;
    this.animals.length = 0;
    this.extraProps.length = 0;
    this.ambientSeats.length = 0;
    this.cricket = null;
    this.pool.dispose();
  }
}

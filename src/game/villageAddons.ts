import * as THREE from 'three';
import { VillageTextureSet } from './textures';
import {
  BoxCollider,
  CircleCollider,
  HidingSpot,
  HouseInterior,
  MinimapBuilding,
  MinimapLandmark,
  MinimapRoad,
  SeatSpot,
} from './types';

export interface VillageAddonsResult {
  roads: MinimapRoad[];
  buildings: MinimapBuilding[];
  landmarks: MinimapLandmark[];
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural parallel earthen bullock-cart wheel ruts pressed into village mud roads */
function createBullockTrackTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);

      // Subtle worn dusty strip center
      const centerGrad = ctx.createLinearGradient(0, 0, w, 0);
      centerGrad.addColorStop(0, 'rgba(138, 102, 66, 0)');
      centerGrad.addColorStop(0.18, 'rgba(132, 95, 58, 0.24)');
      centerGrad.addColorStop(0.5, 'rgba(148, 112, 74, 0.12)');
      centerGrad.addColorStop(0.82, 'rgba(132, 95, 58, 0.24)');
      centerGrad.addColorStop(1, 'rgba(138, 102, 66, 0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, w, h);

      // Two parallel wooden bullock-cart wheel ruts with raised dusty ridges
      for (const cx of [w * 0.24, w * 0.76]) {
        // Outer sunlit ridge
        ctx.fillStyle = 'rgba(218, 184, 138, 0.34)';
        ctx.fillRect(cx - 22, 0, 7, h);
        ctx.fillRect(cx + 15, 0, 7, h);

        // Deep shadowed wheel groove
        const rutGrad = ctx.createLinearGradient(cx - 15, 0, cx + 15, 0);
        rutGrad.addColorStop(0, 'rgba(84, 56, 33, 0.08)');
        rutGrad.addColorStop(0.35, 'rgba(68, 44, 24, 0.56)');
        rutGrad.addColorStop(0.5, 'rgba(58, 36, 18, 0.68)');
        rutGrad.addColorStop(0.65, 'rgba(68, 44, 24, 0.56)');
        rutGrad.addColorStop(1, 'rgba(84, 56, 33, 0.08)');
        ctx.fillStyle = rutGrad;
        ctx.fillRect(cx - 15, 0, 30, h);

        // Subtle iron-rimmed wheel impressions
        ctx.fillStyle = 'rgba(52, 32, 16, 0.22)';
        for (let y = 0; y < h; y += 16) {
          ctx.fillRect(cx - 10, y + ((y * 7) % 5), 20, 3);
        }
      }

      // Light hoof-print scuffs down the center between tracks
      ctx.fillStyle = 'rgba(78, 52, 30, 0.24)';
      for (let y = 12; y < h; y += 34) {
        const side = (y / 34) % 2 === 0 ? -16 : 16;
        ctx.beginPath();
        ctx.ellipse(w * 0.5 + side, y, 5, 7, 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    1,
    12,
  );
}

/** Colorful 1990s Indian village painted limewash plaster with terracotta dado & white folk border */
function createPaintedVillageWallTexture(
  upperHex: string,
  dadoHex: string,
): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = upperHex;
      ctx.fillRect(0, 0, w, h);

      // Subtle hand-troweled limewash mottling
      for (let i = 0; i < 420; i++) {
        const px = (i * 73) % w;
        const py = (i * 131) % h;
        const r = 4 + (i % 14);
        ctx.fillStyle =
          i % 2 === 0 ? 'rgba(255,250,235,0.06)' : 'rgba(60,36,18,0.05)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Traditional lower terracotta/ochre painted dado band (geru)
      const dadoTop = Math.floor(h * 0.68);
      ctx.fillStyle = dadoHex;
      ctx.fillRect(0, dadoTop, w, h - dadoTop);

      // Crisp hand-painted white chuna folk triangle border along dado edge
      ctx.fillStyle = '#f5eedc';
      ctx.fillRect(0, dadoTop - 4, w, 5);
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x + 2, dadoTop - 4);
        ctx.lineTo(x + 12, dadoTop - 16);
        ctx.lineTo(x + 22, dadoTop - 4);
        ctx.closePath();
        ctx.fill();
        // Small marigold dot above each triangle
        ctx.fillStyle = '#e59a32';
        ctx.beginPath();
        ctx.arc(x + 12, dadoTop - 21, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5eedc';
      }

      // Subtle earthen weathering at the very bottom
      const baseGrad = ctx.createLinearGradient(0, h - 24, 0, h);
      baseGrad.addColorStop(0, 'rgba(65, 42, 22, 0)');
      baseGrad.addColorStop(1, 'rgba(55, 34, 16, 0.32)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, h - 24, w, 24);
    },
    2,
    1,
  );
}

/** Furrowed dark alluvial farm soil texture for the north village farm plot */
function createFarmSoilTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#5e442c';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 22) {
        ctx.fillStyle = '#47321e';
        ctx.fillRect(0, y, w, 8);
        ctx.fillStyle = '#755739';
        ctx.fillRect(0, y + 8, w, 6);
      }
      for (let i = 0; i < 320; i++) {
        const px = (i * 97) % w;
        const py = (i * 53) % h;
        ctx.fillStyle =
          i % 3 === 0 ? 'rgba(150, 118, 78, 0.22)' : 'rgba(38, 24, 12, 0.22)';
        ctx.fillRect(px, py, 3, 2);
      }
    },
    3,
    3,
  );
}

/**
 * Adds a cohesive 1995 Indian village interior set (bed, steel cupboard, earthen kitchen chulha,
 * cooking pots & burlap storage sacks) to an enterable mud house group without obstructing doorways.
 */
export function addMudHouseInteriorFurnishings(
  houseGroup: THREE.Group,
  width: number,
  depth: number,
  plinthH: number,
  wallThick: number,
  trimColor: number,
  textures: VillageTextureSet,
): void {
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.84,
    metalness: 0.04,
  });
  const wovenMat = new THREE.MeshStandardMaterial({
    color: 0xc9a36b,
    roughness: 0.94,
  });
  const bedsheetMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.88,
  });
  const pillowMat = new THREE.MeshStandardMaterial({
    color: 0xf0e4cc,
    roughness: 0.9,
  });
  const cupboardMat = new THREE.MeshStandardMaterial({
    color: 0x3b6778,
    roughness: 0.56,
    metalness: 0.32,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc8963e,
    roughness: 0.34,
    metalness: 0.72,
  });
  const clayMat = new THREE.MeshStandardMaterial({
    color: 0xb66542,
    roughness: 0.88,
  });
  const sackMat = new THREE.MeshStandardMaterial({
    color: 0xb79664,
    roughness: 0.95,
  });
  const hearthMat = new THREE.MeshStandardMaterial({
    color: 0x9c7b59,
    roughness: 0.94,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0x382016,
    emissive: 0xc94a16,
    emissiveIntensity: 0.45,
    roughness: 0.9,
  });

  const innerW = width - wallThick * 2;
  const innerD = depth - wallThick * 2;
  const floorY = plinthH + 0.02;

  // 1. Woven Wooden Cot / Bed tucked along the back-right corner
  const bedX = innerW * 0.25;
  const bedZ = -innerD * 0.28;
  const bedW = Math.min(1.75, innerW * 0.4);
  const bedD = Math.min(0.95, innerD * 0.26);
  const bedFrame = new THREE.Mesh(
    new THREE.BoxGeometry(bedW, 0.08, bedD),
    woodMat,
  );
  bedFrame.position.set(bedX, floorY + 0.36, bedZ);
  houseGroup.add(bedFrame);

  const bedWoven = new THREE.Mesh(
    new THREE.BoxGeometry(bedW - 0.12, 0.05, bedD - 0.12),
    wovenMat,
  );
  bedWoven.position.set(bedX, floorY + 0.41, bedZ);
  houseGroup.add(bedWoven);

  const quilt = new THREE.Mesh(
    new THREE.BoxGeometry(bedW * 0.62, 0.05, bedD - 0.16),
    bedsheetMat,
  );
  quilt.position.set(bedX + bedW * 0.12, floorY + 0.44, bedZ);
  houseGroup.add(quilt);

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.1, bedD * 0.56),
    pillowMat,
  );
  pillow.position.set(bedX - bedW * 0.32, floorY + 0.47, bedZ);
  houseGroup.add(pillow);

  const legGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.36, 6);
  for (const lx of [-bedW * 0.44, bedW * 0.44]) {
    for (const lz of [-bedD * 0.42, bedD * 0.42]) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(bedX + lx, floorY + 0.18, bedZ + lz);
      houseGroup.add(leg);
    }
  }

  // 2. Vintage Painted Steel Village Cupboard (Almirah) in back-left corner
  const almX = -innerW * 0.36;
  const almZ = -innerD * 0.34;
  const almirah = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.62, 0.46),
    cupboardMat,
  );
  almirah.position.set(almX, floorY + 0.81, almZ);
  almirah.castShadow = true;
  houseGroup.add(almirah);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.18, 0.04),
    brassMat,
  );
  handle.position.set(almX + 0.04, floorY + 0.88, almZ + 0.24);
  houseGroup.add(handle);

  // 3. Earthen Kitchen Hearth (Chulha) with brass handi pot against left wall
  const chulhaX = -innerW * 0.38;
  const chulhaZ = innerD * 0.08;
  const chulhaBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.26, 0.48),
    hearthMat,
  );
  chulhaBase.position.set(chulhaX, floorY + 0.13, chulhaZ);
  houseGroup.add(chulhaBase);

  const embers = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.06, 8),
    emberMat,
  );
  embers.position.set(chulhaX + 0.04, floorY + 0.24, chulhaZ);
  houseGroup.add(embers);

  const cookingPot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    brassMat,
  );
  cookingPot.scale.set(1.05, 0.78, 1.05);
  cookingPot.position.set(chulhaX + 0.04, floorY + 0.35, chulhaZ);
  houseGroup.add(cookingPot);

  // Stacked clay storage matkas beside kitchen corner
  const pot1 = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), clayMat);
  pot1.scale.set(1.0, 0.92, 1.0);
  pot1.position.set(chulhaX, floorY + 0.17, chulhaZ + 0.44);
  houseGroup.add(pot1);

  const pot2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), clayMat);
  pot2.position.set(chulhaX, floorY + 0.43, chulhaZ + 0.44);
  houseGroup.add(pot2);

  // 4. Storage Corner: Burlap Grain Sacks (Bori) + Metal Trunk (Sandook) on right wall
  const storeX = innerW * 0.36;
  const storeZ = innerD * 0.12;
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.36, 0.76),
    cupboardMat,
  );
  trunk.position.set(storeX, floorY + 0.18, storeZ);
  houseGroup.add(trunk);

  const sack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.27, 0.62, 8),
    sackMat,
  );
  sack.position.set(storeX - 0.06, floorY + 0.31, storeZ + 0.56);
  houseGroup.add(sack);
}

/** Builds a warm vintage 1990s brass kerosene lantern (Laltain) on a carved wooden post (zero dynamic PointLight!) */
function buildKeroseneLanternPost(
  x: number,
  z: number,
  woodMat: THREE.Material,
  brassMat: THREE.Material,
  glowMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.072, 2.35, 6),
    woodMat,
  );
  post.position.y = 1.175;
  post.castShadow = true;
  g.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.06), woodMat);
  arm.position.set(0.18, 2.26, 0);
  g.add(arm);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.1, 8),
    brassMat,
  );
  cap.position.set(0.35, 2.12, 0);
  g.add(cap);

  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.065, 0.2, 8),
    glowMat,
  );
  glass.position.set(0.35, 1.98, 0);
  g.add(glass);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.11, 0.09, 8),
    brassMat,
  );
  base.position.set(0.35, 1.84, 0);
  g.add(base);

  return g;
}

/** Builds a traditional conical golden Indian haystack (Bhoosa stack) with circle cover */
function buildHaystack(
  x: number,
  z: number,
  radius: number,
  height: number,
  thatchMat: THREE.Material,
  ropeMat: THREE.Material,
): { group: THREE.Group; collider: CircleCollider } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, height * 0.44, 12),
    thatchMat,
  );
  base.position.y = height * 0.22;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.96, height * 0.62, 12),
    thatchMat,
  );
  cone.position.y = height * 0.44 + height * 0.31;
  cone.castShadow = true;
  cone.receiveShadow = true;
  g.add(cone);

  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.92, 0.035, 6, 14),
    ropeMat,
  );
  rope.rotation.x = Math.PI / 2;
  rope.position.y = height * 0.43;
  g.add(rope);

  return {
    group: g,
    collider: {
      x,
      z,
      radius: radius * 0.88,
      blocksSight: true,
    },
  };
}

/**
 * Builds an exterior climbable stone staircase rising along the X axis with a genuine hollow
 * under-stair hiding pocket beneath its upper half!
 */
function buildClimbableStaircaseWithUnderPocket(
  startX: number,
  dirX: 1 | -1,
  centerZ: number,
  stairWidthZ: number,
  targetTopY: number,
  steps: number,
  stepRun: number,
  stoneMat: THREE.Material,
  trimMat: THREE.Material,
  boxes: BoxCollider[],
  hidingSpots: HidingSpot[],
  spotLabel: string,
): THREE.Group {
  const g = new THREE.Group();

  for (let i = 0; i < steps; i++) {
    const stepTop = ((i + 1) / steps) * targetTopY;
    const sx = startX + dirX * (i * stepRun);
    const isHollowPocket = i >= Math.floor(steps * 0.5);

    if (isHollowPocket) {
      // Elevated vaulted stair tread with open walkable hiding alcove underneath!
      const treadH = 0.36;
      const treadMinY = stepTop - treadH;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun + 0.05, treadH, stairWidthZ),
        stoneMat,
      );
      mesh.position.set(sx, treadMinY + treadH * 0.5, centerZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);

      boxes.push({
        minX: sx - (stepRun + 0.04) * 0.5,
        maxX: sx + (stepRun + 0.04) * 0.5,
        minZ: centerZ - stairWidthZ * 0.5,
        maxZ: centerZ + stairWidthZ * 0.5,
        blocksSight: true,
        minY: treadMinY,
        topY: stepTop,
        climbable: true,
      });
    } else {
      // Lower solid masonry steps
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun + 0.05, stepTop, stairWidthZ),
        stoneMat,
      );
      mesh.position.set(sx, stepTop * 0.5, centerZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);

      boxes.push({
        minX: sx - (stepRun + 0.04) * 0.5,
        maxX: sx + (stepRun + 0.04) * 0.5,
        minZ: centerZ - stairWidthZ * 0.5,
        maxZ: centerZ + stairWidthZ * 0.5,
        blocksSight: true,
        topY: stepTop,
        climbable: true,
      });
    }
  }

  // Thin end masonry support pillar at the top landing so the stairs look architecturally grounded
  const endX = startX + dirX * ((steps - 0.5) * stepRun + 0.14);
  const supportPillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, targetTopY, stairWidthZ),
    stoneMat,
  );
  supportPillar.position.set(endX, targetTopY * 0.5, centerZ);
  supportPillar.castShadow = true;
  supportPillar.receiveShadow = true;
  g.add(supportPillar);

  boxes.push({
    minX: endX - 0.14,
    maxX: endX + 0.14,
    minZ: centerZ - stairWidthZ * 0.5,
    maxZ: centerZ + stairWidthZ * 0.5,
    blocksSight: true,
    topY: targetTopY,
  });

  // Low outer handrail curb along the open edge of the stairs
  const railSpan = steps * stepRun;
  const railLen = Math.hypot(railSpan, targetTopY);
  const railAngle = Math.atan2(targetTopY, railSpan);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(railLen, 0.1, 0.1),
    trimMat,
  );
  rail.position.set(
    startX + dirX * ((steps - 1) * stepRun * 0.5),
    targetTopY * 0.5 + 0.58,
    centerZ + (centerZ < 0 ? -stairWidthZ * 0.46 : stairWidthZ * 0.46),
  );
  rail.rotation.z = dirX > 0 ? railAngle : -railAngle;
  g.add(rail);

  // Register the shadowed hollow alcove right underneath steps 5..8 as an authentic hiding spot!
  const pocketX = startX + dirX * ((steps - 2.1) * stepRun);
  hidingSpots.push({
    x: pocketX,
    z: centerZ,
    label: spotLabel,
    kind: 'wall',
  });

  return g;
}

/**
 * Applies all additive 1995 Traditional Village enhancements directly onto the existing Level 1
 * world without removing or displacing any original building, road, landmark, or spawn point.
 */
export function applyTraditionalVillageAddons(
  group: THREE.Group,
  textures: VillageTextureSet,
  boxes: BoxCollider[],
  circles: CircleCollider[],
  hidingSpots: HidingSpot[],
  houseInteriors: HouseInterior[],
  seats: SeatSpot[],
  patrolPoints: THREE.Vector3[],
): VillageAddonsResult {
  const addonsGroup = new THREE.Group();
  addonsGroup.name = 'TraditionalVillageAddons';

  const roads: MinimapRoad[] = [];
  const buildings: MinimapBuilding[] = [];
  const landmarks: MinimapLandmark[] = [];

  // Shared procedural textures & materials (Android-optimized)
  const bullockTrackTex = createBullockTrackTexture();
  const paintedBlueWallTex = createPaintedVillageWallTexture('#78a6c4', '#9e472d');
  const paintedOchreWallTex = createPaintedVillageWallTexture('#e0b363', '#8c3d26');
  const farmSoilTex = createFarmSoilTexture();

  const trackMat = new THREE.MeshStandardMaterial({
    map: bullockTrackTex,
    transparent: true,
    opacity: 0.86,
    roughness: 0.98,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const blueMudMat = new THREE.MeshStandardMaterial({
    map: paintedBlueWallTex,
    roughness: 0.9,
  });
  const ochreMudMat = new THREE.MeshStandardMaterial({
    map: paintedOchreWallTex,
    roughness: 0.9,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.courtyard,
    color: 0xbba98e,
    roughness: 0.92,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    roughness: 0.88,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.84,
  });
  const thatchMat = new THREE.MeshStandardMaterial({
    map: textures.thatchRoof,
    roughness: 0.96,
  });
  const tileRoofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    roughness: 0.78,
  });
  const terraceMat = new THREE.MeshStandardMaterial({
    map: textures.courtyard,
    color: 0xc9b394,
    roughness: 0.92,
  });
  const terracottaMat = new THREE.MeshStandardMaterial({
    color: 0xb65e3b,
    roughness: 0.82,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9963c,
    roughness: 0.34,
    metalness: 0.76,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffdf99,
    emissive: 0xffa630,
    emissiveIntensity: 1.55,
    roughness: 0.3,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    roughness: 0.45,
    metalness: 0.82,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xc7a76c,
    roughness: 0.95,
  });
  const plasterSiloMat = new THREE.MeshStandardMaterial({
    map: textures.mudWall,
    color: 0xddc39d,
    roughness: 0.93,
  });
  const burlapMat = new THREE.MeshStandardMaterial({
    color: 0xb89661,
    roughness: 0.96,
  });

  // ============================================================================
  // 1. BULLOCK-CART TRACKS (Scenery only — embossed ruts along village mud lanes)
  // ============================================================================
  const cartTrackSegments = [
    // South Cross Lane leading straight toward SW Farm Area
    { x: -2.0, z: 19.2, width: 2.2, length: 50, rotY: Math.PI / 2 },
    // Spur turning south into the SW Farm Area entrance
    { x: -20.6, z: 21.6, width: 2.0, length: 5.8, rotY: 0.26 },
    // West Alley connecting North & South lanes
    { x: -19.8, z: 0.6, width: 1.95, length: 36, rotY: 0 },
    // North Cross Lane passing the North Farm & Well
    { x: 0.0, z: -18.2, width: 2.1, length: 46, rotY: Math.PI / 2 },
  ];
  for (const seg of cartTrackSegments) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(seg.width, seg.length),
      trackMat,
    );
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = seg.rotY;
    strip.position.set(seg.x, 0.028, seg.z);
    strip.receiveShadow = true;
    addonsGroup.add(strip);
  }

  // ============================================================================
  // 2. CENTRAL BANYAN SQUARE CHAUPAL LEDGE, PYAAU WATER POTS & KEROSENE LANTERNS
  // ============================================================================
  // Raised circular brick-and-plaster Chaupal sitting rim hugging the existing Banyan base (-0.5, -1.8)
  const chaupalLedge = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.7, 0.36, 18),
    brickMat,
  );
  chaupalLedge.position.set(-0.5, 0.18, -1.8);
  chaupalLedge.receiveShadow = true;
  addonsGroup.add(chaupalLedge);

  const chaupalCap = new THREE.Mesh(
    new THREE.CylinderGeometry(2.62, 2.62, 0.06, 18),
    stoneMat,
  );
  chaupalCap.position.set(-0.5, 0.38, -1.8);
  chaupalCap.receiveShadow = true;
  addonsGroup.add(chaupalCap);

  seats.push(
    {
      id: 'banyan-chaupal-south',
      x: -0.5,
      z: 0.72,
      seatY: 0.42,
      rotY: 0,
      label: 'Banyan Chaupal',
      kind: 'bench',
    },
    {
      id: 'banyan-chaupal-east',
      x: 2.02,
      z: -1.8,
      seatY: 0.42,
      rotY: Math.PI / 2,
      label: 'Banyan Chaupal',
      kind: 'bench',
    },
  );

  // Village Pyaau (terracotta drinking-water pot stand) near the well in the square
  const pyaauGroup = new THREE.Group();
  pyaauGroup.position.set(4.5, 0, -4.5);
  const standTable = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.56, 0.56),
    woodMat,
  );
  standTable.position.y = 0.28;
  standTable.castShadow = true;
  standTable.receiveShadow = true;
  pyaauGroup.add(standTable);
  for (const px of [-0.44, 0, 0.44]) {
    const pot = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 8),
      terracottaMat,
    );
    pot.scale.set(1, 0.92, 1);
    pot.position.set(px, 0.72, 0);
    pot.castShadow = true;
    pyaauGroup.add(pot);
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.05, 8),
      brassMat,
    );
    lid.position.set(px, 0.93, 0);
    pyaauGroup.add(lid);
  }
  addonsGroup.add(pyaauGroup);
  circles.push({ x: 4.5, z: -4.5, radius: 0.78, blocksSight: false });

  // 14 Old Brass Kerosene Lantern Posts (Laltain) along square, lanes, wells & sheds
  const lanternSpots: Array<[number, number, number]> = [
    [-3.4, 2.2, 0.4],
    [3.8, 3.6, -0.5],
    [4.4, -6.2, -1.2],
    [-6.2, -6.6, 0.9],
    [-17.4, -8.5, 0],
    [-17.6, 6.2, 0],
    [17.8, -6.5, Math.PI],
    [18.2, 9.2, Math.PI],
    [-8.5, 16.5, 0.2],
    [8.2, 16.5, -0.3],
    [-28.8, -3.5, 0.4],
    [30.5, -2.5, Math.PI],
    [-4.2, -29.5, 0.6],
    [29.8, 12.2, Math.PI],
  ];
  for (const [lx, lz, rotY] of lanternSpots) {
    const lantern = buildKeroseneLanternPost(
      lx,
      lz,
      woodMat,
      brassMat,
      lanternGlowMat,
    );
    lantern.rotation.y = rotY;
    addonsGroup.add(lantern);
  }

  // ============================================================================
  // 3. CONNECTED ROOFTOPS & CLIMBABLE EXTERIOR STAIRS WITH UNDER-STAIR POCKETS
  // ============================================================================
  // A) Make existing `house-nw-alley` (-25.8, -8.8, w=6.2, d=4.8, topY=3.46) rooftop walkable!
  boxes.push({
    minX: -29.05,
    maxX: -22.55,
    minZ: -11.35,
    maxZ: -6.25,
    blocksSight: false,
    minY: 3.16,
    topY: 3.46,
    climbable: true,
  });
  hidingSpots.push({
    x: -25.8,
    z: -8.8,
    label: 'West Connected Rooftop',
    kind: 'house',
  });

  // Climbable stone staircase along the north edge of `house-nw-alley` with hollow under-stair hiding pocket!
  const westStairs = buildClimbableStaircaseWithUnderPocket(
    -23.0,
    -1,
    -11.9,
    1.15,
    3.46,
    8,
    0.76,
    stoneMat,
    terracottaMat,
    boxes,
    hidingSpots,
    'Under West Terrace Stairs',
  );
  addonsGroup.add(westStairs);

  // B) NEW Enterable Colorful Painted West Terrace House at (-34.2, -8.8) linked by a rooftop bridge!
  {
    const hx = -34.2;
    const hz = -8.8;
    const hw = 5.6;
    const hd = 4.8;
    const hh = 3.1;
    const plinthH = 0.14;
    const wallT = 0.28;
    const roofTopY = plinthH + hh + 0.22; // 3.46 — exact match with `house-nw-alley`!

    const hGroup = new THREE.Group();
    hGroup.position.set(hx, 0, hz);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(hw + 0.55, plinthH, hd + 0.7),
      stoneMat,
    );
    plinth.position.set(0, plinthH * 0.5, 0.15);
    plinth.receiveShadow = true;
    hGroup.add(plinth);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(hw - wallT * 2, hd - wallT * 2),
      new THREE.MeshStandardMaterial({ color: 0x8f6b47, roughness: 0.96 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, plinthH + 0.015, 0);
    floor.receiveShadow = true;
    hGroup.add(floor);

    const wallY = plinthH + hh * 0.5;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(hw, hh, wallT),
      blueMudMat,
    );
    backWall.position.set(0, wallY, -hd * 0.5 + wallT * 0.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    hGroup.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, hh, hd - wallT * 2),
      blueMudMat,
    );
    leftWall.position.set(-hw * 0.5 + wallT * 0.5, wallY, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    hGroup.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, hh, hd - wallT * 2),
      blueMudMat,
    );
    rightWall.position.set(hw * 0.5 - wallT * 0.5, wallY, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    hGroup.add(rightWall);

    const doorW = 1.5;
    const doorH = 2.08;
    const frontSideW = (hw - doorW) * 0.5;
    const frontZ = hd * 0.5 - wallT * 0.5;
    for (const dir of [-1, 1]) {
      const fw = new THREE.Mesh(
        new THREE.BoxGeometry(frontSideW, hh, wallT),
        blueMudMat,
      );
      fw.position.set(dir * (hw * 0.5 - frontSideW * 0.5), wallY, frontZ);
      fw.castShadow = true;
      fw.receiveShadow = true;
      hGroup.add(fw);
    }
    const lintelH = hh - doorH;
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, lintelH, wallT),
      blueMudMat,
    );
    lintel.position.set(0, plinthH + doorH + lintelH * 0.5, frontZ);
    hGroup.add(lintel);

    // Interior furnishings: bed, cupboard, kitchen chulha, storage trunk & sacks
    addMudHouseInteriorFurnishings(
      hGroup,
      hw,
      hd,
      plinthH,
      wallT,
      0x2f5d8a,
      textures,
    );

    // Flat terrace roof slab + low parapet (open on East edge for the connected rooftop bridge!)
    const houseRoofMeshes: THREE.Mesh[] = [];
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(hw + 0.4, 0.22, hd + 0.4),
      terraceMat,
    );
    roofSlab.position.set(0, plinthH + hh + 0.11, 0);
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    hGroup.add(roofSlab);
    houseRoofMeshes.push(roofSlab);

    const paraY = roofTopY + 0.28;
    const northPara = new THREE.Mesh(
      new THREE.BoxGeometry(hw + 0.3, 0.56, 0.18),
      blueMudMat,
    );
    northPara.position.set(0, paraY, -hd * 0.5 - 0.08);
    const southPara = northPara.clone();
    southPara.position.z = hd * 0.5 + 0.08;
    const westPara = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.56, hd + 0.2),
      blueMudMat,
    );
    westPara.position.set(-hw * 0.5 - 0.08, paraY, 0);
    for (const p of [northPara, southPara, westPara]) {
      p.castShadow = true;
      p.receiveShadow = true;
      hGroup.add(p);
      houseRoofMeshes.push(p);
    }

    // Small walled front courtyard (Aangan) with open southern gate
    const yardW = 5.4;
    const yardD = 2.6;
    const yardWallH = 1.08;
    const yardLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, yardWallH, yardD),
      ochreMudMat,
    );
    yardLeft.position.set(-yardW * 0.5, yardWallH * 0.5, hd * 0.5 + yardD * 0.5);
    const yardRight = yardLeft.clone();
    yardRight.position.x = yardW * 0.5;
    const yardFrontL = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, yardWallH, 0.22),
      ochreMudMat,
    );
    yardFrontL.position.set(-1.85, yardWallH * 0.5, hd * 0.5 + yardD);
    const yardFrontR = yardFrontL.clone();
    yardFrontR.position.x = 1.85;
    for (const yw of [yardLeft, yardRight, yardFrontL, yardFrontR]) {
      yw.castShadow = true;
      yw.receiveShadow = true;
      hGroup.add(yw);
    }

    addonsGroup.add(hGroup);

    // Wall colliders (topY = plinthH + hh so players can walk freely on the terrace above!)
    const wallTopY = plinthH + hh;
    boxes.push(
      {
        minX: hx - hw * 0.5,
        maxX: hx + hw * 0.5,
        minZ: hz - hd * 0.5,
        maxZ: hz - hd * 0.5 + wallT,
        blocksSight: true,
        topY: wallTopY,
      },
      {
        minX: hx - hw * 0.5,
        maxX: hx - hw * 0.5 + wallT,
        minZ: hz - hd * 0.5,
        maxZ: hz + hd * 0.5,
        blocksSight: true,
        topY: wallTopY,
      },
      {
        minX: hx + hw * 0.5 - wallT,
        maxX: hx + hw * 0.5,
        minZ: hz - hd * 0.5,
        maxZ: hz + hd * 0.5,
        blocksSight: true,
        topY: wallTopY,
      },
      {
        minX: hx - hw * 0.5,
        maxX: hx - doorW * 0.5,
        minZ: hz + hd * 0.5 - wallT,
        maxZ: hz + hd * 0.5,
        blocksSight: true,
        topY: wallTopY,
      },
      {
        minX: hx + doorW * 0.5,
        maxX: hx + hw * 0.5,
        minZ: hz + hd * 0.5 - wallT,
        maxZ: hz + hd * 0.5,
        blocksSight: true,
        topY: wallTopY,
      },
      // Walkable rooftop slab
      {
        minX: hx - hw * 0.5 - 0.2,
        maxX: hx + hw * 0.5 + 0.2,
        minZ: hz - hd * 0.5 - 0.2,
        maxZ: hz + hd * 0.5 + 0.2,
        blocksSight: false,
        minY: roofTopY - 0.3,
        topY: roofTopY,
        climbable: true,
      },
      // Courtyard walls
      {
        minX: hx - yardW * 0.5 - 0.11,
        maxX: hx - yardW * 0.5 + 0.11,
        minZ: hz + hd * 0.5,
        maxZ: hz + hd * 0.5 + yardD,
        blocksSight: false,
        topY: yardWallH,
      },
      {
        minX: hx + yardW * 0.5 - 0.11,
        maxX: hx + yardW * 0.5 + 0.11,
        minZ: hz + hd * 0.5,
        maxZ: hz + hd * 0.5 + yardD,
        blocksSight: false,
        topY: yardWallH,
      },
      {
        minX: hx - 2.7,
        maxX: hx - 1.0,
        minZ: hz + hd * 0.5 + yardD - 0.11,
        maxZ: hz + hd * 0.5 + yardD + 0.11,
        blocksSight: false,
        topY: yardWallH,
      },
      {
        minX: hx + 1.0,
        maxX: hx + 2.7,
        minZ: hz + hd * 0.5 + yardD - 0.11,
        maxZ: hz + hd * 0.5 + yardD + 0.11,
        blocksSight: false,
        topY: yardWallH,
      },
    );

    houseInteriors.push({
      id: 'house-far-west-terrace',
      label: 'Blue Painted Courtyard House',
      minX: hx - (hw - wallT * 2) * 0.5,
      maxX: hx + (hw - wallT * 2) * 0.5,
      minZ: hz - (hd - wallT * 2) * 0.5,
      maxZ: hz + (hd - wallT * 2) * 0.5,
      minY: -0.2,
      maxY: wallTopY - 0.15,
      doorX: hx,
      doorZ: hz + hd * 0.5 + 1.1,
      insideX: hx + 0.5,
      insideZ: hz - 0.4,
      roofMeshes: houseRoofMeshes,
    });

    hidingSpots.push(
      {
        x: hx + 0.4,
        z: hz - 0.5,
        label: 'Inside Blue Painted House',
        kind: 'house',
      },
      {
        x: hx,
        z: hz - 1.2,
        label: 'Far-West Connected Rooftop',
        kind: 'house',
      },
    );
    buildings.push({
      x: hx,
      z: hz,
      width: hw,
      depth: hd,
      rotY: 0,
      kind: 'house',
    });

    // Connected Rooftop Timber-and-Brick Walkway Bridge linking (-34.2, -8.8) <-> (-25.8, -8.8)
    const bridgeX = -30.15;
    const bridgeZ = -8.8;
    const bridgeSpanX = 2.8;
    const bridgeW = 1.8;
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeSpanX, 0.2, bridgeW),
      woodMat,
    );
    bridgeDeck.position.set(bridgeX, roofTopY - 0.1, bridgeZ);
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    addonsGroup.add(bridgeDeck);

    // Timber guard rails along bridge edges
    for (const rz of [-bridgeW * 0.46, bridgeW * 0.46]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeSpanX, 0.08, 0.08),
        woodMat,
      );
      rail.position.set(bridgeX, roofTopY + 0.55, bridgeZ + rz);
      addonsGroup.add(rail);
      for (const px of [-1.0, 0, 1.0]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.56, 0.08),
          woodMat,
        );
        post.position.set(bridgeX + px, roofTopY + 0.28, bridgeZ + rz);
        addonsGroup.add(post);
      }
    }

    // Elevated bridge collider (players run freely through the narrow alley underneath!)
    boxes.push({
      minX: bridgeX - bridgeSpanX * 0.5,
      maxX: bridgeX + bridgeSpanX * 0.5,
      minZ: bridgeZ - bridgeW * 0.5,
      maxZ: bridgeZ + bridgeW * 0.5,
      blocksSight: false,
      minY: roofTopY - 0.24,
      topY: roofTopY,
      climbable: true,
    });
    roads.push({
      x: bridgeX,
      z: -8.8,
      width: 2.2,
      length: 12,
      rotY: 0,
    });
    patrolPoints.push(new THREE.Vector3(-30.1, 0, -4.5));
  }

  // C) Make existing `house-south-gully` (10.2, 25.0, w=5.8, d=4.6, topY=3.36) rooftop climbable!
  boxes.push({
    minX: 7.1,
    maxX: 13.3,
    minZ: 22.5,
    maxZ: 27.5,
    blocksSight: false,
    minY: 3.06,
    topY: 3.36,
    climbable: true,
  });
  const southStairs = buildClimbableStaircaseWithUnderPocket(
    7.5,
    1,
    28.0,
    1.15,
    3.36,
    8,
    0.74,
    stoneMat,
    terracottaMat,
    boxes,
    hidingSpots,
    'Under Pond Lane Stairs',
  );
  addonsGroup.add(southStairs);
  hidingSpots.push({
    x: 10.2,
    z: 25.0,
    label: 'Pond Lane Rooftop Terrace',
    kind: 'house',
  });

  // ============================================================================
  // 4. EAST PAINTED COURTYARD MUD HOUSE (35.5, 12.5) WITH TILED ROOF & AANGAN
  // ============================================================================
  {
    const hx = 35.5;
    const hz = 12.5;
    const hw = 5.4;
    const hd = 4.6;
    const hh = 2.95;
    const plinthH = 0.14;
    const wallT = 0.28;

    const eGroup = new THREE.Group();
    eGroup.position.set(hx, 0, hz);
    eGroup.rotation.y = -Math.PI / 2; // Door faces -X toward East Market Street!

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(hw + 0.55, plinthH, hd + 0.65),
      stoneMat,
    );
    plinth.position.set(0, plinthH * 0.5, 0.15);
    plinth.receiveShadow = true;
    eGroup.add(plinth);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(hw - wallT * 2, hd - wallT * 2),
      new THREE.MeshStandardMaterial({ color: 0x8f6b47, roughness: 0.96 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, plinthH + 0.015, 0);
    floor.receiveShadow = true;
    eGroup.add(floor);

    const wallY = plinthH + hh * 0.5;
    const backW = new THREE.Mesh(
      new THREE.BoxGeometry(hw, hh, wallT),
      ochreMudMat,
    );
    backW.position.set(0, wallY, -hd * 0.5 + wallT * 0.5);
    backW.castShadow = true;
    backW.receiveShadow = true;
    eGroup.add(backW);

    const leftW = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, hh, hd - wallT * 2),
      ochreMudMat,
    );
    leftW.position.set(-hw * 0.5 + wallT * 0.5, wallY, 0);
    leftW.castShadow = true;
    leftW.receiveShadow = true;
    eGroup.add(leftW);

    const rightW = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, hh, hd - wallT * 2),
      ochreMudMat,
    );
    rightW.position.set(hw * 0.5 - wallT * 0.5, wallY, 0);
    rightW.castShadow = true;
    rightW.receiveShadow = true;
    eGroup.add(rightW);

    const doorW = 1.48;
    const doorH = 2.05;
    const frontSideW = (hw - doorW) * 0.5;
    const frontZ = hd * 0.5 - wallT * 0.5;
    for (const dir of [-1, 1]) {
      const fw = new THREE.Mesh(
        new THREE.BoxGeometry(frontSideW, hh, wallT),
        ochreMudMat,
      );
      fw.position.set(dir * (hw * 0.5 - frontSideW * 0.5), wallY, frontZ);
      fw.castShadow = true;
      fw.receiveShadow = true;
      eGroup.add(fw);
    }
    const lintelH = hh - doorH;
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, lintelH, wallT),
      ochreMudMat,
    );
    lintel.position.set(0, plinthH + doorH + lintelH * 0.5, frontZ);
    eGroup.add(lintel);

    addMudHouseInteriorFurnishings(
      eGroup,
      hw,
      hd,
      plinthH,
      wallT,
      0x99422c,
      textures,
    );

    // Pitched Khaprail tiled roof (fades smoothly when player enters!)
    const eastRoofMeshes: THREE.Mesh[] = [];
    const roofRise = 1.35;
    const halfD = hd * 0.5 + 0.55;
    const slopeLen = Math.hypot(halfD, roofRise);
    const slopeAngle = Math.atan2(roofRise, halfD);
    const slopeGeo = new THREE.BoxGeometry(hw + 0.9, 0.16, slopeLen);
    const fSlope = new THREE.Mesh(slopeGeo, tileRoofMat);
    fSlope.position.set(0, plinthH + hh + roofRise * 0.5 - 0.04, halfD * 0.5);
    fSlope.rotation.x = slopeAngle;
    fSlope.castShadow = true;
    fSlope.receiveShadow = true;
    const bSlope = new THREE.Mesh(slopeGeo, tileRoofMat);
    bSlope.position.set(0, plinthH + hh + roofRise * 0.5 - 0.04, -halfD * 0.5);
    bSlope.rotation.x = -slopeAngle;
    bSlope.castShadow = true;
    bSlope.receiveShadow = true;
    eGroup.add(fSlope, bSlope);
    eastRoofMeshes.push(fSlope, bSlope);

    // Wooden bench in front courtyard
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.42, 0.52),
      woodMat,
    );
    bench.position.set(-1.6, 0.21, hd * 0.5 + 1.2);
    bench.castShadow = true;
    eGroup.add(bench);

    addonsGroup.add(eGroup);

    // World-space wall colliders (house rotated -PI/2: local +Z is world -X, local +X is world +Z!)
    const halfWorldX = hd * 0.5;
    const halfWorldZ = hw * 0.5;
    boxes.push(
      // Back wall (world +X)
      {
        minX: hx + halfWorldX - wallT,
        maxX: hx + halfWorldX,
        minZ: hz - halfWorldZ,
        maxZ: hz + halfWorldZ,
        blocksSight: true,
      },
      // North wall (world -Z)
      {
        minX: hx - halfWorldX,
        maxX: hx + halfWorldX,
        minZ: hz - halfWorldZ,
        maxZ: hz - halfWorldZ + wallT,
        blocksSight: true,
      },
      // South wall (world +Z)
      {
        minX: hx - halfWorldX,
        maxX: hx + halfWorldX,
        minZ: hz + halfWorldZ - wallT,
        maxZ: hz + halfWorldZ,
        blocksSight: true,
      },
      // Front wall north & south of doorway (world -X)
      {
        minX: hx - halfWorldX,
        maxX: hx - halfWorldX + wallT,
        minZ: hz - halfWorldZ,
        maxZ: hz - doorW * 0.5,
        blocksSight: true,
      },
      {
        minX: hx - halfWorldX,
        maxX: hx - halfWorldX + wallT,
        minZ: hz + doorW * 0.5,
        maxZ: hz + halfWorldZ,
        blocksSight: true,
      },
    );

    houseInteriors.push({
      id: 'house-far-east-aangan',
      label: 'Ochre Courtyard Mud House',
      minX: hx - (hd - wallT * 2) * 0.5,
      maxX: hx + (hd - wallT * 2) * 0.5,
      minZ: hz - (hw - wallT * 2) * 0.5,
      maxZ: hz + (hw - wallT * 2) * 0.5,
      minY: -0.2,
      maxY: plinthH + hh - 0.15,
      doorX: hx - halfWorldX - 1.1,
      doorZ: hz,
      insideX: hx + 0.3,
      insideZ: hz - 0.4,
      roofMeshes: eastRoofMeshes,
    });
    seats.push({
      id: 'east-aangan-bench',
      x: hx - halfWorldX - 1.2,
      z: hz - 1.6,
      seatY: 0.44,
      rotY: -Math.PI / 2,
      label: 'Courtyard Bench',
      kind: 'bench',
    });
    hidingSpots.push({
      x: hx + 0.3,
      z: hz - 0.4,
      label: 'Inside Ochre Courtyard House',
      kind: 'house',
    });
    buildings.push({
      x: hx,
      z: hz,
      width: hw,
      depth: hd,
      rotY: -Math.PI / 2,
      kind: 'house',
    });
  }

  // ============================================================================
  // 5. OPEN CATTLE SHED (GOSHALA / TABELA) AT (-33.5, 1.5)
  // ============================================================================
  {
    const sx = -33.5;
    const sz = 1.5;
    const sw = 6.2;
    const sd = 4.2;
    const shedG = new THREE.Group();
    shedG.position.set(sx, 0, sz);

    // Compacted mud & straw floor pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(sw + 0.6, 0.1, sd + 0.6),
      stoneMat,
    );
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    shedG.add(pad);

    // 6 weathered timber support posts (open sides so players can sprint right through!)
    const postGeo = new THREE.CylinderGeometry(0.11, 0.13, 2.75, 7);
    for (const px of [-sw * 0.46, 0, sw * 0.46]) {
      for (const pz of [-sd * 0.44, sd * 0.44]) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(px, 1.38, pz);
        post.castShadow = true;
        shedG.add(post);
      }
    }

    // Sloped golden thatched roof
    const shedRoof = new THREE.Mesh(
      new THREE.BoxGeometry(sw + 1.1, 0.22, sd + 1.1),
      thatchMat,
    );
    shedRoof.position.set(0, 2.86, 0);
    shedRoof.rotation.x = 0.12;
    shedRoof.castShadow = true;
    shedRoof.receiveShadow = true;
    shedG.add(shedRoof);

    // Back half-wall for wind shelter + hiding cover
    const backShelter = new THREE.Mesh(
      new THREE.BoxGeometry(sw - 0.2, 1.55, 0.26),
      ochreMudMat,
    );
    backShelter.position.set(0, 0.78, -sd * 0.44);
    backShelter.castShadow = true;
    backShelter.receiveShadow = true;
    shedG.add(backShelter);

    // Brick cattle feed manger (Naand) filled with golden fodder
    const manger = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.72, 0.85),
      brickMat,
    );
    manger.position.set(-0.7, 0.36, -0.55);
    manger.castShadow = true;
    manger.receiveShadow = true;
    shedG.add(manger);

    const fodder = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.24, 0.65),
      thatchMat,
    );
    fodder.position.set(-0.7, 0.76, -0.55);
    shedG.add(fodder);

    // Stone water trough
    const trough = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.54, 0.72),
      stoneMat,
    );
    trough.position.set(1.75, 0.27, -0.55);
    trough.castShadow = true;
    shedG.add(trough);

    addonsGroup.add(shedG);

    // Colliders for cattle shed shelter wall & manger
    boxes.push(
      {
        minX: sx - sw * 0.48,
        maxX: sx + sw * 0.48,
        minZ: sz - sd * 0.44 - 0.14,
        maxZ: sz - sd * 0.44 + 0.14,
        blocksSight: true,
        topY: 1.55,
      },
      {
        minX: sx - 2.1,
        maxX: sx + 0.7,
        minZ: sz - 0.98,
        maxZ: sz - 0.12,
        blocksSight: false,
        topY: 0.85,
      },
    );
    hidingSpots.push({
      x: sx + 0.2,
      z: sz + 0.6,
      label: 'Inside Cattle Shed',
      kind: 'wall',
    });
    buildings.push({
      x: sx,
      z: sz,
      width: sw,
      depth: sd,
      rotY: 0,
      kind: 'shed',
    });
    patrolPoints.push(new THREE.Vector3(-29.5, 0, 1.5));

    // Haystack beside the cattle shed
    const shedHay = buildHaystack(-36.2, 5.4, 1.45, 2.35, thatchMat, ropeMat);
    addonsGroup.add(shedHay.group);
    circles.push(shedHay.collider);
    hidingSpots.push({
      x: -34.8,
      z: 6.1,
      label: 'Behind Cattle Shed Haystack',
      kind: 'wall',
    });
  }

  // ============================================================================
  // 6. GRAIN STORAGE AREA (ANAJ KOTHAR) & GOLDEN HAYSTACKS AT (33.5, -6.5)
  // ============================================================================
  {
    const gx = 33.5;
    const gz = -6.5;
    const grainG = new THREE.Group();
    grainG.position.set(gx, 0, gz);

    // Raised plastered mud threshing floor
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.4, 0.08, 16),
      stoneMat,
    );
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    grainG.add(floor);

    // 3 Traditional Plastered Clay Grain Silos (Kothis) with conical thatch roofs
    const siloSpecs = [
      { ox: -1.6, oz: -1.6, r: 1.02, h: 2.35 },
      { ox: 1.4, oz: -1.4, r: 0.94, h: 2.15 },
      { ox: 0.2, oz: 1.4, r: 1.08, h: 2.45 },
    ];
    for (const s of siloSpecs) {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(s.r * 0.92, s.r, s.h, 12),
        plasterSiloMat,
      );
      body.position.set(s.ox, s.h * 0.5 + 0.06, s.oz);
      body.castShadow = true;
      body.receiveShadow = true;
      grainG.add(body);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(s.r * 1.18, 0.85, 12),
        thatchMat,
      );
      cap.position.set(s.ox, s.h + 0.45, s.oz);
      cap.castShadow = true;
      grainG.add(cap);

      circles.push({
        x: gx + s.ox,
        z: gz + s.oz,
        radius: s.r + 0.06,
        blocksSight: true,
      });
    }

    // Stacked burlap grain sacks (Bori)
    const sackOffsets: Array<[number, number, number]> = [
      [-2.4, 0.34, 1.3],
      [-1.85, 0.34, 1.55],
      [-2.15, 0.88, 1.42],
      [2.1, 0.34, 1.05],
    ];
    for (const [bx, by, bz] of sackOffsets) {
      const sack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.31, 0.68, 8),
        burlapMat,
      );
      sack.position.set(bx, by, bz);
      sack.castShadow = true;
      grainG.add(sack);
    }

    addonsGroup.add(grainG);

    // 2 Conical Golden Haystacks beside the Grain Storage Yard
    const hay1 = buildHaystack(36.2, -11.4, 1.5, 2.5, thatchMat, ropeMat);
    const hay2 = buildHaystack(31.2, -12.0, 1.25, 2.1, thatchMat, ropeMat);
    addonsGroup.add(hay1.group, hay2.group);
    circles.push(hay1.collider, hay2.collider);

    hidingSpots.push(
      {
        x: gx + 0.2,
        z: gz - 0.2,
        label: 'Among Grain Storage Silos',
        kind: 'wall',
      },
      {
        x: 34.4,
        z: -11.6,
        label: 'Behind Grain Yard Haystack',
        kind: 'wall',
      },
    );
    buildings.push({
      x: gx,
      z: gz,
      width: 5.8,
      depth: 5.4,
      rotY: 0,
      kind: 'shed',
    });
    patrolPoints.push(new THREE.Vector3(29.2, 0, -6.5));
  }

  // ============================================================================
  // 7. NORTH SMALL FARM PLOT (6.5, -31.5), SECOND STONE WELL (-1.8, -32.0) & HAND PUMP
  // ============================================================================
  {
    const fx = 6.5;
    const fz = -31.5;
    const farmPad = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 6.8),
      new THREE.MeshStandardMaterial({ map: farmSoilTex, roughness: 0.96 }),
    );
    farmPad.rotation.x = -Math.PI / 2;
    farmPad.position.set(fx, 0.03, fz);
    farmPad.receiveShadow = true;
    addonsGroup.add(farmPad);

    // Low mud irrigation bund border around farm plot
    const bundMat = new THREE.MeshStandardMaterial({
      color: 0x8e6b46,
      roughness: 0.96,
    });
    for (const bz of [-3.45, 3.45]) {
      const bund = new THREE.Mesh(
        new THREE.BoxGeometry(9.8, 0.22, 0.28),
        bundMat,
      );
      bund.position.set(fx, 0.11, fz + bz);
      addonsGroup.add(bund);
    }

    // Instanced leafy mustard/vegetable crop rows (ultra-fast single draw call!)
    const cropGeo = new THREE.ConeGeometry(0.24, 0.88, 5);
    const cropMat = new THREE.MeshStandardMaterial({
      color: 0x4d8033,
      roughness: 0.9,
    });
    const cropCount = 72;
    const cropInst = new THREE.InstancedMesh(cropGeo, cropMat, cropCount);
    cropInst.castShadow = false;
    cropInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12; col++) {
        dummy.position.set(
          fx - 4.1 + col * 0.74,
          0.44,
          fz - 2.5 + row * 1.0,
        );
        dummy.rotation.set(0, (row * 1.1 + col * 0.7) % 6.28, 0);
        const s = 0.85 + ((row + col) % 3) * 0.14;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        cropInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    cropInst.instanceMatrix.needsUpdate = true;
    cropInst.computeBoundingSphere();
    addonsGroup.add(cropInst);

    // Conical haystack on the east edge of the north farm
    const northHay = buildHaystack(12.2, -33.0, 1.38, 2.25, thatchMat, ropeMat);
    addonsGroup.add(northHay.group);
    circles.push(northHay.collider);

    landmarks.push({ x: fx, z: fz, radius: 5.6, kind: 'farm' });
    hidingSpots.push({
      x: 10.6,
      z: -33.2,
      label: 'North Farm Haystack',
      kind: 'wall',
    });

    // Second Traditional Stone Village Well at (-1.8, -32.0)
    const wx = -1.8;
    const wz = -32.0;
    const wellG = new THREE.Group();
    wellG.position.set(wx, 0, wz);

    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 2.08, 0.16, 16),
      stoneMat,
    );
    apron.position.y = 0.08;
    apron.receiveShadow = true;
    wellG.add(apron);

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.22, 1.3, 1.06, 16),
      brickMat,
    );
    drum.position.y = 0.58;
    drum.castShadow = true;
    drum.receiveShadow = true;
    wellG.add(drum);

    const wellWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.02, 14),
      new THREE.MeshStandardMaterial({
        color: 0x1b424c,
        roughness: 0.2,
        metalness: 0.15,
      }),
    );
    wellWater.rotation.x = -Math.PI / 2;
    wellWater.position.y = 0.86;
    wellG.add(wellWater);

    for (const px of [-1.15, 1.15]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.09, 2.15, 7),
        woodMat,
      );
      post.position.set(px, 1.65, 0);
      post.castShadow = true;
      wellG.add(post);
    }
    const crossBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 2.55, 7),
      woodMat,
    );
    crossBeam.rotation.z = Math.PI / 2;
    crossBeam.position.y = 2.62;
    wellG.add(crossBeam);

    const pulley = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 6, 12),
      ironMat,
    );
    pulley.position.y = 2.38;
    wellG.add(pulley);

    // 2 terracotta water pots resting beside the north well
    for (const [mx, mz] of [
      [1.45, 0.6],
      [1.25, 1.12],
    ]) {
      const matka = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        terracottaMat,
      );
      matka.position.set(mx, 0.34, mz);
      matka.castShadow = true;
      wellG.add(matka);
    }
    addonsGroup.add(wellG);
    circles.push({ x: wx, z: wz, radius: 1.48, blocksSight: true });
    landmarks.push({ x: wx, z: wz, radius: 1.5, kind: 'well' });
    hidingSpots.push({
      x: wx - 1.75,
      z: wz - 0.5,
      label: 'Behind North Village Well',
      kind: 'well',
    });

    // Extra Vintage Cast-Iron Hand Pump at (-30.5, -15.5) near West Terrace & School Lane
    const hpx = -30.5;
    const hpz = -15.5;
    const hpG = new THREE.Group();
    hpG.position.set(hpx, 0, hpz);

    const hpPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.95, 0.14, 12),
      stoneMat,
    );
    hpPad.position.y = 0.07;
    hpPad.receiveShadow = true;
    hpG.add(hpPad);

    const hpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.15, 10),
      ironMat,
    );
    hpBody.position.y = 0.68;
    hpBody.castShadow = true;
    hpG.add(hpBody);

    const hpSpout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.36, 8),
      ironMat,
    );
    hpSpout.rotation.z = Math.PI / 2.4;
    hpSpout.position.set(0.2, 0.84, 0);
    hpG.add(hpSpout);

    const hpHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6),
      ironMat,
    );
    hpHandle.rotation.z = -Math.PI / 3.2;
    hpHandle.position.set(-0.24, 1.24, 0);
    hpG.add(hpHandle);

    const hpPot = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      terracottaMat,
    );
    hpPot.position.set(0.42, 0.32, 0.18);
    hpG.add(hpPot);

    addonsGroup.add(hpG);
    circles.push({ x: hpx, z: hpz, radius: 0.65, blocksSight: false });
    hidingSpots.push({
      x: hpx - 0.95,
      z: hpz + 0.5,
      label: 'Near West Lane Hand Pump',
      kind: 'pump',
    });
  }

  // ============================================================================
  // 8. LOW ALLEY HIDING WALLS & INSTANCED TALL GRASS + LEAFY BUSHES (ANDROID-SAFE)
  // ============================================================================
  const alleyWalls: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    label: string;
    blue: boolean;
  }> = [
    {
      x: -15.4,
      z: -15.6,
      w: 2.8,
      d: 0.34,
      label: 'Behind West Alley Wall',
      blue: true,
    },
    {
      x: 15.6,
      z: 16.0,
      w: 2.8,
      d: 0.34,
      label: 'Behind South-East Courtyard Wall',
      blue: false,
    },
    {
      x: -29.2,
      z: 16.2,
      w: 0.34,
      d: 3.0,
      label: 'Behind Farm Lane Wall',
      blue: false,
    },
    {
      x: 28.4,
      z: -14.8,
      w: 3.0,
      d: 0.34,
      label: 'Behind Temple Back Wall',
      blue: true,
    },
    {
      x: -13.6,
      z: -22.2,
      w: 0.34,
      d: 2.8,
      label: 'Behind School Lane Wall',
      blue: false,
    },
  ];
  for (const w of alleyWalls) {
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, 1.38, w.d),
      w.blue ? blueMudMat : ochreMudMat,
    );
    wallMesh.position.set(w.x, 0.69, w.z);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    addonsGroup.add(wallMesh);

    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(w.w + 0.08, 0.1, w.d + 0.08),
      terracottaMat,
    );
    coping.position.set(w.x, 1.42, w.z);
    addonsGroup.add(coping);

    boxes.push({
      minX: w.x - w.w * 0.5,
      maxX: w.x + w.w * 0.5,
      minZ: w.z - w.d * 0.5,
      maxZ: w.z + w.d * 0.5,
      blocksSight: true,
      topY: 1.48,
    });
    hidingSpots.push({
      x: w.x + (w.w > w.d ? 0 : 0.95),
      z: w.z + (w.w > w.d ? 0.95 : 0),
      label: w.label,
      kind: 'wall',
    });
  }

  // Instanced Tall Village Grass & Leafy Hiding Bushes around outer lanes, farms, cattle shed & pond
  const bushPositions: Array<[number, number, number]> = [
    // Around SW Farm & Cattle Shed
    [-31.2, 8.8, 1.15],
    [-35.8, 11.4, 1.28],
    [-29.5, 22.8, 1.18],
    [-12.4, 24.5, 1.12],
    [-11.8, 30.8, 1.25],
    [-33.8, -1.8, 1.05],
    [-37.5, -4.5, 1.22],
    // Around North Farm & Second Well
    [-5.2, -33.6, 1.2],
    [1.8, -35.2, 1.26],
    [13.4, -27.5, 1.15],
    [14.2, -35.8, 1.22],
    [-15.8, -28.8, 1.1],
    // Around Grain Yard, East House & Pond Bank
    [35.6, -1.2, 1.18],
    [37.2, 5.8, 1.24],
    [31.8, 18.2, 1.2],
    [29.5, 21.8, 1.15],
    [16.8, 30.5, 1.22],
    [13.5, 33.4, 1.16],
    [2.8, 31.2, 1.18],
    [-2.5, 34.0, 1.24],
    // Outer green village pockets
    [-36.5, -14.2, 1.22],
    [-24.2, -16.8, 1.05],
    [19.5, -16.2, 1.05],
    [34.8, -22.5, 1.22],
    [-6.5, 26.5, 1.1],
    [6.2, 29.8, 1.15],
  ];

  const bushGeo = new THREE.DodecahedronGeometry(0.76, 1);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0x3f7531,
    roughness: 0.92,
  });
  const bushInst = new THREE.InstancedMesh(
    bushGeo,
    bushMat,
    bushPositions.length * 2,
  );
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let bIdx = 0;
  for (let i = 0; i < bushPositions.length; i++) {
    const [bx, bz, sc] = bushPositions[i];
    dummy.position.set(bx, 0.56 * sc, bz);
    dummy.rotation.set(0, i * 0.9, 0);
    dummy.scale.set(1.2 * sc, 0.88 * sc, 1.1 * sc);
    dummy.updateMatrix();
    bushInst.setMatrixAt(bIdx++, dummy.matrix);

    dummy.position.set(bx + 0.55 * sc, 0.44 * sc, bz - 0.32 * sc);
    dummy.rotation.set(0, i * 1.4, 0);
    dummy.scale.set(0.88 * sc, 0.72 * sc, 0.86 * sc);
    dummy.updateMatrix();
    bushInst.setMatrixAt(bIdx++, dummy.matrix);
  }
  bushInst.instanceMatrix.needsUpdate = true;
  bushInst.computeBoundingSphere();
  addonsGroup.add(bushInst);

  // Register key dense bush clusters as natural hiding spots
  hidingSpots.push(
    { x: -35.8, z: 11.4, label: 'In Farm Hedge Bushes', kind: 'tree' },
    { x: 1.8, z: -35.2, label: 'In North Field Bushes', kind: 'tree' },
    { x: 31.8, z: 18.2, label: 'In Pond-Side Bushes', kind: 'tree' },
    { x: -11.8, z: 30.8, label: 'In Tall Farm Grass', kind: 'tree' },
  );

  // Instanced Tall Village Grass Tufts (130 tufts, zero shadow casting for silky Android FPS)
  const grassGeo = new THREE.ConeGeometry(0.18, 0.95, 4);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x5c8c38,
    roughness: 0.94,
  });
  const grassCount = 130;
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassInst.castShadow = false;
  grassInst.receiveShadow = true;

  for (let i = 0; i < grassCount; i++) {
    const cluster = bushPositions[i % bushPositions.length];
    const angle = (i * 2.399) % (Math.PI * 2);
    const dist = 0.8 + ((i * 37) % 100) * 0.024;
    const gx = cluster[0] + Math.cos(angle) * dist;
    const gz = cluster[1] + Math.sin(angle) * dist;
    const s = 0.75 + (i % 5) * 0.14;
    dummy.position.set(gx, 0.45 * s, gz);
    dummy.rotation.set(0.08 * Math.sin(i), angle, 0.08 * Math.cos(i));
    dummy.scale.set(s, s * 1.15, s);
    dummy.updateMatrix();
    grassInst.setMatrixAt(i, dummy.matrix);
  }
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.computeBoundingSphere();
  addonsGroup.add(grassInst);

  group.add(addonsGroup);

  return { roads, buildings, landmarks };
}

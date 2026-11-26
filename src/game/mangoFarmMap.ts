import * as THREE from 'three';
import {
  addRoadSegment,
  addSolidBox,
  addTree,
  addVisualBox,
  createMapContext,
  MapBuildContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helper for organic orchard rows & props
// ---------------------------------------------------------------------------
function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Procedural 1990s Indian Mango Farm Canvas Textures (Android-friendly)
// ---------------------------------------------------------------------------
interface MangoFarmTextures {
  soil: THREE.CanvasTexture;
  mudPath: THREE.CanvasTexture;
  courtyard: THREE.CanvasTexture;
  farmWall: THREE.CanvasTexture;
  shedBrick: THREE.CanvasTexture;
  thatch: THREE.CanvasTexture;
  tileRoof: THREE.CanvasTexture;
  crateWood: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
}

function makeCanvasTex(
  width: number,
  height: number,
  repeatX: number,
  repeatY: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
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
  return tex;
}

function createMangoFarmTextures(): MangoFarmTextures {
  // 1. Rich alluvial Indian orchard soil with dappled grass & fallen dry leaves
  const soil = makeCanvasTex(256, 256, 26, 26, (c, w, h) => {
    const rand = seededRand(301);
    c.fillStyle = '#8b7148';
    c.fillRect(0, 0, w, h);

    // Subtle earthy humus patches
    for (let i = 0; i < 60; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 10 + rand() * 28;
      c.fillStyle =
        rand() < 0.52
          ? 'rgba(98, 122, 54, 0.28)'
          : rand() < 0.78
            ? 'rgba(116, 86, 48, 0.34)'
            : 'rgba(164, 134, 86, 0.24)';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    // Fine soil grain & grass speckles
    for (let i = 0; i < 420; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.fillStyle =
        rand() < 0.45
          ? 'rgba(72, 96, 38, 0.42)'
          : rand() < 0.75
            ? 'rgba(84, 58, 32, 0.35)'
            : 'rgba(186, 154, 96, 0.32)';
      c.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 2);
    }

    // Fallen dry mango leaves
    for (let i = 0; i < 42; i++) {
      c.save();
      c.translate(rand() * w, rand() * h);
      c.rotate(rand() * Math.PI);
      c.fillStyle = rand() < 0.5 ? '#a47936' : '#7b5a28';
      c.beginPath();
      c.ellipse(0, 0, 4.5, 1.6, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });

  // 2. Compacted village mud pathway (Pagdandi)
  const mudPath = makeCanvasTex(256, 256, 4, 18, (c, w, h) => {
    const rand = seededRand(302);
    c.fillStyle = '#c4a26e';
    c.fillRect(0, 0, w, h);

    // Worn footpath streaks
    for (let i = 0; i < 24; i++) {
      const x = 18 + rand() * (w - 36);
      c.fillStyle =
        rand() < 0.5 ? 'rgba(154, 118, 72, 0.22)' : 'rgba(218, 192, 142, 0.2)';
      c.fillRect(x, 0, 8 + rand() * 14, h);
    }
    // Dusty pebbles & edge tufts
    for (let i = 0; i < 320; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.fillStyle =
        x < 24 || x > w - 24
          ? 'rgba(92, 116, 48, 0.36)'
          : rand() < 0.5
            ? 'rgba(120, 88, 52, 0.35)'
            : 'rgba(232, 212, 170, 0.32)';
      c.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 2);
    }
  });

  // 3. Traditional hand-plastered cow-dung & mud courtyard floor (Lipai Aangan)
  const courtyard = makeCanvasTex(256, 256, 6, 5, (c, w, h) => {
    const rand = seededRand(303);
    c.fillStyle = '#d4ba8b';
    c.fillRect(0, 0, w, h);

    // Sweeping arc plaster strokes
    c.strokeStyle = 'rgba(156, 126, 84, 0.24)';
    c.lineWidth = 4;
    for (let y = 12; y < h; y += 26) {
      for (let x = 0; x < w; x += 38) {
        c.beginPath();
        c.arc(x + 19, y, 16, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();
      }
    }
    for (let i = 0; i < 240; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(148, 118, 78, 0.24)' : 'rgba(238, 224, 192, 0.26)';
      c.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });

  // 4. Lime-washed rural ochre farmhouse plaster wall with weathered base
  const farmWall = makeCanvasTex(256, 256, 2, 1, (c, w, h) => {
    const rand = seededRand(304);
    c.fillStyle = '#e4cf9f';
    c.fillRect(0, 0, w, h);

    // Lower terracotta geru (red-ochre) traditional village dado band
    c.fillStyle = '#b45a3c';
    c.fillRect(0, h * 0.72, w, h * 0.28);
    c.fillStyle = '#f2e6ca';
    c.fillRect(0, h * 0.7, w, 5);

    // Subtle lime wash streaks & weathering
    for (let i = 0; i < 90; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.fillStyle =
        rand() < 0.5 ? 'rgba(166, 134, 88, 0.18)' : 'rgba(252, 244, 222, 0.2)';
      c.fillRect(x, y, 10 + rand() * 24, 6 + rand() * 14);
    }
  });

  // 5. Rustic rural kiln-fired red brick for storage sheds
  const shedBrick = makeCanvasTex(256, 256, 3, 2, (c, w, h) => {
    const rand = seededRand(305);
    c.fillStyle = '#c4ae8c'; // Mud mortar
    c.fillRect(0, 0, w, h);

    const rows = 12;
    const cols = 6;
    const bh = h / rows;
    const bw = w / cols;
    const tones = ['#a8563c', '#b76244', '#944832', '#bf6d4c', '#8c432e'];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw * 0.5);
      for (let col = -1; col <= cols; col++) {
        c.fillStyle = tones[Math.floor(rand() * tones.length)];
        c.fillRect(col * bw + offset + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    // Weathered mud splash near bottom
    c.fillStyle = 'rgba(122, 92, 58, 0.25)';
    c.fillRect(0, h * 0.78, w, h * 0.22);
  });

  // 6. Golden straw / thatch (Paraali / Phoos) for haystacks & huts
  const thatch = makeCanvasTex(256, 256, 2, 2, (c, w, h) => {
    const rand = seededRand(306);
    c.fillStyle = '#cca24c';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.strokeStyle =
        rand() < 0.35 ? '#e4bf6a' : rand() < 0.72 ? '#a87d30' : '#855f22';
      c.lineWidth = 1.4 + rand() * 1.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rand() - 0.5) * 14, y + 12 + rand() * 20);
      c.stroke();
    }
  });

  // 7. Terracotta country tiles (Khaprail) for farmhouse roof
  const tileRoof = makeCanvasTex(256, 256, 5, 3, (c, w, h) => {
    const rand = seededRand(307);
    c.fillStyle = '#9e472d';
    c.fillRect(0, 0, w, h);
    const cols = 10;
    const rows = 8;
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        c.fillStyle =
          rand() < 0.4 ? '#b65638' : rand() < 0.75 ? '#8f3f27' : '#c46442';
        c.fillRect(col * cw + 1, r * rh + 1, cw - 2, rh - 2);
        c.fillStyle = 'rgba(42, 16, 10, 0.3)';
        c.fillRect(col * cw, (r + 1) * rh - 3, cw, 3);
      }
    }
  });

  // 8. Slatted rustic wooden mango crate (Peti) texture
  const crateWood = makeCanvasTex(128, 128, 1, 1, (c, w, h) => {
    const rand = seededRand(308);
    c.fillStyle = '#6c4928';
    c.fillRect(0, 0, w, h);
    const slats = 5;
    const sh = h / slats;
    for (let i = 0; i < slats; i++) {
      c.fillStyle = i % 2 === 0 ? '#b68952' : '#a97b45';
      c.fillRect(4, i * sh + 3, w - 8, sh - 6);
      for (let g = 0; g < 8; g++) {
        c.fillStyle = 'rgba(92, 60, 28, 0.25)';
        c.fillRect(6, i * sh + 4 + rand() * (sh - 8), w - 12, 1.5);
      }
    }
    // Side framing battens
    c.fillStyle = '#92683a';
    c.fillRect(0, 0, 10, h);
    c.fillRect(w - 10, 0, 10, h);
  });

  // 9. Furrowed orchard mango bark
  const bark = makeCanvasTex(128, 128, 1, 2, (c, w, h) => {
    const rand = seededRand(309);
    c.fillStyle = '#5f4935';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 85; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.fillStyle =
        rand() < 0.5 ? 'rgba(54, 38, 25, 0.55)' : 'rgba(116, 94, 70, 0.35)';
      c.fillRect(x, y, 2 + rand() * 4, 14 + rand() * 28);
    }
  });

  // 10. Cool shimmering shallow irrigation channel water (Naali)
  const water = makeCanvasTex(256, 256, 2, 16, (c, w, h) => {
    const rand = seededRand(310);
    c.fillStyle = '#3b848c';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.fillStyle =
        rand() < 0.5 ? 'rgba(168, 224, 232, 0.34)' : 'rgba(42, 98, 108, 0.35)';
      c.beginPath();
      c.ellipse(x, y, 6 + rand() * 14, 18 + rand() * 24, 0, 0, Math.PI * 2);
      c.fill();
    }
  });

  return {
    soil,
    mudPath,
    courtyard,
    farmWall,
    shedBrick,
    thatch,
    tileRoof,
    crateWood,
    bark,
    water,
  };
}

// ---------------------------------------------------------------------------
// Reusable Pass-Through Farmhouse / Storage Shed Builder (2+ Doorways!)
// ---------------------------------------------------------------------------
interface FarmBuildingSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  wallMat: THREE.Material;
  roofMat: THREE.Material;
  trimMat: THREE.Material;
  floorMat: THREE.Material;
  roofStyle: 'gable' | 'hip' | 'lean';
  doors: Array<'north' | 'south' | 'east' | 'west'>;
  doorWidth?: number;
  verandaSide?: 'south' | 'east' | 'west';
  minimapKind: 'house' | 'shed' | 'hut';
}

function buildPassThroughFarmBuilding(
  ctx: MapBuildContext,
  spec: FarmBuildingSpec,
): THREE.Group {
  const g = new THREE.Group();
  const { x, z, width, depth, wallHeight } = spec;
  const wallT = 0.34;
  const doorW = spec.doorWidth ?? 2.35;
  const doorH = 2.25;

  // Raised mud-plinth floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.14, depth + 0.3),
    spec.floorMat,
  );
  floor.position.set(x, 0.07, z);
  floor.receiveShadow = true;
  g.add(floor);

  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  const buildHorizontalWall = (
    wz: number,
    hasDoor: boolean,
  ) => {
    if (!hasDoor) {
      addSolidBox(ctx, x, wz, width, wallHeight, wallT, spec.wallMat, true, 0);
      return;
    }
    const segW = Math.max(0.6, (width - doorW) * 0.5);
    addSolidBox(
      ctx,
      x - halfW + segW * 0.5,
      wz,
      segW,
      wallHeight,
      wallT,
      spec.wallMat,
      true,
      0,
    );
    addSolidBox(
      ctx,
      x + halfW - segW * 0.5,
      wz,
      segW,
      wallHeight,
      wallT,
      spec.wallMat,
      true,
      0,
    );
    // Lintel & wooden door frame header
    const lintelH = Math.max(0.45, wallHeight - doorH);
    addVisualBox(
      g,
      x,
      doorH + lintelH * 0.5,
      wz,
      doorW + 0.12,
      lintelH,
      wallT + 0.02,
      spec.wallMat,
    );
    addVisualBox(g, x, doorH + 0.06, wz, doorW + 0.24, 0.12, wallT + 0.08, spec.trimMat);
    addVisualBox(g, x - doorW * 0.5, doorH * 0.5, wz, 0.12, doorH, wallT + 0.08, spec.trimMat);
    addVisualBox(g, x + doorW * 0.5, doorH * 0.5, wz, 0.12, doorH, wallT + 0.08, spec.trimMat);
  };

  const buildVerticalWall = (
    wx: number,
    hasDoor: boolean,
  ) => {
    if (!hasDoor) {
      addSolidBox(ctx, wx, z, wallT, wallHeight, depth, spec.wallMat, true, 0);
      return;
    }
    const segD = Math.max(0.6, (depth - doorW) * 0.5);
    addSolidBox(
      ctx,
      wx,
      z - halfD + segD * 0.5,
      wallT,
      wallHeight,
      segD,
      spec.wallMat,
      true,
      0,
    );
    addSolidBox(
      ctx,
      wx,
      z + halfD - segD * 0.5,
      wallT,
      wallHeight,
      segD,
      spec.wallMat,
      true,
      0,
    );
    const lintelH = Math.max(0.45, wallHeight - doorH);
    addVisualBox(
      g,
      wx,
      doorH + lintelH * 0.5,
      z,
      wallT + 0.02,
      lintelH,
      doorW + 0.12,
      spec.wallMat,
    );
    addVisualBox(g, wx, doorH + 0.06, z, wallT + 0.08, 0.12, doorW + 0.24, spec.trimMat);
    addVisualBox(g, wx, doorH * 0.5, z - doorW * 0.5, wallT + 0.08, doorH, 0.12, spec.trimMat);
    addVisualBox(g, wx, doorH * 0.5, z + doorW * 0.5, wallT + 0.08, doorH, 0.12, spec.trimMat);
  };

  buildHorizontalWall(z - halfD + wallT * 0.5, spec.doors.includes('north'));
  buildHorizontalWall(z + halfD - wallT * 0.5, spec.doors.includes('south'));
  buildVerticalWall(x - halfW + wallT * 0.5, spec.doors.includes('west'));
  buildVerticalWall(x + halfW - wallT * 0.5, spec.doors.includes('east'));

  // Rustic wooden shuttered windows on non-door walls
  const windowDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c1e,
    roughness: 0.9,
  });
  if (!spec.doors.includes('east')) {
    addVisualBox(g, x + halfW + 0.03, 1.75, z, 0.12, 0.92, 1.12, spec.trimMat);
    addVisualBox(g, x + halfW + 0.05, 1.75, z, 0.08, 0.76, 0.92, windowDarkMat);
  }
  if (!spec.doors.includes('west')) {
    addVisualBox(g, x - halfW - 0.03, 1.75, z, 0.12, 0.92, 1.12, spec.trimMat);
    addVisualBox(g, x - halfW - 0.05, 1.75, z, 0.08, 0.76, 0.92, windowDarkMat);
  }

  // Roof meshes (fade out smoothly when player walks inside!)
  const roofMeshes: THREE.Mesh[] = [];
  const roofMatClone = spec.roofMat.clone();
  roofMatClone.transparent = true;
  roofMatClone.opacity = 1;

  if (spec.roofStyle === 'gable') {
    const slopeDepth = halfD + 0.95;
    const slopeLen = Math.hypot(slopeDepth, 1.25);
    const slopeAngle = Math.atan2(1.25, slopeDepth);
    for (const dir of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(width + 1.2, 0.16, slopeLen),
        roofMatClone,
      );
      panel.position.set(x, wallHeight + 0.58, z + dir * (slopeDepth * 0.5));
      panel.rotation.x = dir * slopeAngle;
      panel.castShadow = true;
      panel.receiveShadow = true;
      g.add(panel);
      roofMeshes.push(panel);
    }
    // Ridge beam
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.35, 0.22, 0.28),
      spec.trimMat,
    );
    ridge.position.set(x, wallHeight + 1.24, z);
    g.add(ridge);
    roofMeshes.push(ridge);
  } else if (spec.roofStyle === 'hip') {
    const hip = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(width, depth) * 0.76, 1.75, 4),
      roofMatClone,
    );
    hip.rotation.y = Math.PI / 4;
    hip.scale.set(width / Math.max(width, depth) * 1.08, 1, depth / Math.max(width, depth) * 1.08);
    hip.position.set(x, wallHeight + 0.82, z);
    hip.castShadow = true;
    hip.receiveShadow = true;
    g.add(hip);
    roofMeshes.push(hip);
  } else {
    const lean = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.2, 0.18, depth + 1.3),
      roofMatClone,
    );
    lean.position.set(x, wallHeight + 0.35, z);
    lean.rotation.x = 0.14;
    lean.castShadow = true;
    lean.receiveShadow = true;
    g.add(lean);
    roofMeshes.push(lean);
  }

  // Optional shaded front veranda with wooden posts
  if (spec.verandaSide === 'south') {
    const vDepth = 2.3;
    const vFloor = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, 0.12, vDepth),
      spec.floorMat,
    );
    vFloor.position.set(x, 0.06, z + halfD + vDepth * 0.5);
    vFloor.receiveShadow = true;
    g.add(vFloor);

    const vRoof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.0, 0.14, vDepth + 0.7),
      roofMatClone,
    );
    vRoof.position.set(x, wallHeight - 0.18, z + halfD + vDepth * 0.5);
    vRoof.rotation.x = 0.22;
    vRoof.castShadow = true;
    g.add(vRoof);
    roofMeshes.push(vRoof);

    const postXs = [-halfW + 0.35, -doorW * 0.72, doorW * 0.72, halfW - 0.35];
    for (const px of postXs) {
      addVisualBox(
        g,
        x + px,
        (wallHeight - 0.4) * 0.5,
        z + halfD + vDepth - 0.22,
        0.18,
        wallHeight - 0.4,
        0.18,
        spec.trimMat,
      );
      ctx.circles.push({
        x: x + px,
        z: z + halfD + vDepth - 0.22,
        radius: 0.22,
        blocksSight: false,
      });
    }
  }

  // Compute primary door coordinates for HouseInterior
  const primaryDoor = spec.doors[0] ?? 'south';
  const doorX =
    primaryDoor === 'west'
      ? x - halfW - 0.8
      : primaryDoor === 'east'
        ? x + halfW + 0.8
        : x;
  const doorZ =
    primaryDoor === 'north'
      ? z - halfD - 0.8
      : primaryDoor === 'south'
        ? z + halfD + 0.8
        : z;

  ctx.group.add(g);
  ctx.houseInteriors.push({
    id: spec.id,
    label: spec.label,
    minX: x - halfW - 0.3,
    maxX: x + halfW + 0.3,
    minZ: z - halfD - 0.3,
    maxZ: z + halfD + 0.3,
    doorX,
    doorZ,
    insideX: x,
    insideZ: z,
    roofMeshes,
  });
  ctx.buildings.push({
    x,
    z,
    width,
    depth,
    rotY: 0,
    kind: spec.minimapKind,
  });

  return g;
}

// ---------------------------------------------------------------------------
// Authentic 1990s Indian Farm Props: Charpai, Hand Pump, Well, Haystacks,
// Stationary Wooden Farm Carts, Mango Baskets, Farm Tools & Ladders
// ---------------------------------------------------------------------------
function addSittableCharpai(
  ctx: MapBuildContext,
  x: number,
  z: number,
  rotY: number,
  woodMat: THREE.Material,
  ropeMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // 4 carved wooden legs
  for (const lx of [-0.95, 0.95]) {
    for (const lz of [-0.46, 0.46]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.038, 0.48, 6),
        woodMat,
      );
      leg.position.set(lx, 0.24, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  // Wooden frame rails
  addVisualBox(g, 0, 0.46, -0.46, 2.02, 0.08, 0.08, woodMat);
  addVisualBox(g, 0, 0.46, 0.46, 2.02, 0.08, 0.08, woodMat);
  addVisualBox(g, -0.95, 0.46, 0, 0.08, 0.08, 0.96, woodMat);
  addVisualBox(g, 0.95, 0.46, 0, 0.08, 0.08, 0.96, woodMat);

  // Woven jute/cotton rope mesh bed
  addVisualBox(g, 0, 0.47, 0, 1.84, 0.045, 0.84, ropeMat);

  ctx.group.add(g);

  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const halfX = 1.02 * cos + 0.52 * sin;
  const halfZ = 1.02 * sin + 0.52 * cos;
  ctx.boxes.push({
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
    blocksSight: false,
    topY: 0.5,
  });

  ctx.seats.push({
    id: `mango-charpai-${x.toFixed(1)}-${z.toFixed(1)}`,
    label,
    kind: 'charpai',
    x,
    z,
    seatY: 0.5,
    rotY: rotY + Math.PI / 2,
  });
}

function addVillageHandPump(
  ctx: MapBuildContext,
  x: number,
  z: number,
  stoneMat: THREE.Material,
  waterMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2f6c56, // Classic 1990s Indian cast-iron green hand pump
    roughness: 0.52,
    metalness: 0.45,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x2c3638,
    roughness: 0.5,
    metalness: 0.55,
  });
  const bucketMat = new THREE.MeshStandardMaterial({
    color: 0x9aa4a8,
    roughness: 0.42,
    metalness: 0.55,
  });

  // Raised concrete/brick plinth with wet drain apron
  addVisualBox(g, 0, 0.09, 0, 2.3, 0.18, 2.1, stoneMat);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.68, 12), waterMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0.52, 0.19, 0.12);
  g.add(puddle);

  // Cast-iron vertical column & flared base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 0.24, 8),
    ironMat,
  );
  base.position.set(-0.22, 0.3, 0);
  base.castShadow = true;
  g.add(base);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.12, 0.92, 8),
    ironMat,
  );
  body.position.set(-0.22, 0.86, 0);
  body.castShadow = true;
  g.add(body);

  // Top head cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), ironMat);
  cap.position.set(-0.22, 1.34, 0);
  g.add(cap);

  // Water spout
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.42, 7),
    ironMat,
  );
  spout.rotation.z = -Math.PI / 2.4;
  spout.position.set(0.02, 0.98, 0);
  g.add(spout);

  // Long lever handle
  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.86, 6),
    handleMat,
  );
  lever.rotation.z = Math.PI / 2.8;
  lever.position.set(-0.56, 1.15, 0);
  g.add(lever);

  // Galvanized water bucket sitting under spout
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.17, 0.36, 10),
    bucketMat,
  );
  bucket.position.set(0.32, 0.36, 0.04);
  bucket.castShadow = true;
  g.add(bucket);

  // Stone water trough feeding the irrigation ditch
  addVisualBox(g, 0.98, 0.24, 0, 0.56, 0.32, 1.25, stoneMat);
  const troughWater = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 1.08),
    waterMat,
  );
  troughWater.rotation.x = -Math.PI / 2;
  troughWater.position.set(0.98, 0.39, 0);
  g.add(troughWater);

  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 1.05, blocksSight: false });
  ctx.hidingSpots.push({
    x: x - 1.5,
    z: z + 0.6,
    label: 'Beside Courtyard Hand Pump',
    kind: 'pump',
  });
  ctx.landmarks.push({ x, z, radius: 1.8, kind: 'well' });
}

function addOldOrchardWell(
  ctx: MapBuildContext,
  x: number,
  z: number,
  stoneMat: THREE.Material,
  woodMat: THREE.Material,
  waterMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Stone platform base
  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.5, 0.16, 14),
    stoneMat,
  );
  apron.position.y = 0.08;
  apron.receiveShadow = true;
  g.add(apron);

  // Circular stone parapet wall
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.64, 1.06, 14),
    stoneMat,
  );
  rim.position.y = 0.62;
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  // Dark deep water inside well
  const innerWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.22, 14),
    new THREE.MeshStandardMaterial({
      color: 0x16383e,
      roughness: 0.2,
      metalness: 0.15,
    }),
  );
  innerWater.rotation.x = -Math.PI / 2;
  innerWater.position.y = 1.08;
  g.add(innerWater);

  // Twin wooden pulley posts & crossbar
  for (const sx of [-1.25, 1.25]) {
    addVisualBox(g, sx, 1.75, 0, 0.16, 2.2, 0.16, woodMat);
  }
  addVisualBox(g, 0, 2.75, 0, 2.78, 0.16, 0.16, woodMat);

  // Pulley wheel & hanging rope
  const pulley = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10),
    woodMat,
  );
  pulley.rotation.z = Math.PI / 2;
  pulley.position.set(0, 2.5, 0);
  g.add(pulley);

  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.35, 5),
    new THREE.MeshStandardMaterial({ color: 0xc2a062, roughness: 0.95 }),
  );
  rope.position.set(0, 1.82, 0);
  g.add(rope);

  // Stone irrigation catch-basin (Hauz) next to well pouring toward the west branch canal
  addVisualBox(g, -2.05, 0.36, 0, 1.35, 0.62, 1.45, stoneMat);
  const basinWater = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 1.18),
    waterMat,
  );
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.set(-2.05, 0.66, 0);
  g.add(basinWater);

  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 1.75, blocksSight: true });
  ctx.boxes.push({
    minX: x - 2.75,
    maxX: x - 1.35,
    minZ: z - 0.78,
    maxZ: z + 0.78,
    blocksSight: false,
    topY: 0.68,
  });
  ctx.hidingSpots.push({
    x: x + 2.35,
    z: z + 0.4,
    label: 'Behind Old Stone Well',
    kind: 'well',
  });
  ctx.landmarks.push({ x, z, radius: 2.6, kind: 'well' });
}

function addGoldenHaystack(
  ctx: MapBuildContext,
  x: number,
  z: number,
  scale: number,
  thatchMat: THREE.Material,
  woodMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Broad settled hay base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22 * scale, 1.48 * scale, 1.15 * scale, 10),
    thatchMat,
  );
  base.position.y = 0.58 * scale;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Conical thatched cap (Bhoosa / Paraali kuppi)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.36 * scale, 1.55 * scale, 10),
    thatchMat,
  );
  cone.position.y = 1.85 * scale;
  cone.castShadow = true;
  cone.receiveShadow = true;
  g.add(cone);

  // Center bamboo anchor pole peeking out the top
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 2.95 * scale, 6),
    woodMat,
  );
  pole.position.y = 1.48 * scale;
  g.add(pole);

  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 1.48 * scale, blocksSight: true });
  ctx.hidingSpots.push({
    x: x + 2.0 * scale,
    z: z + 0.35,
    label,
    kind: 'gully',
  });
}

/**
 * Stationary rustic wooden farm cart (Bailgaadi) as 1990s orchard scenery & crouch cover.
 * Strictly static scenery prop (not a drivable vehicle).
 */
function addStationaryWoodenFarmCart(
  ctx: MapBuildContext,
  x: number,
  z: number,
  rotY: number,
  woodMat: THREE.Material,
  darkWoodMat: THREE.Material,
  thatchMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // Flatbed wooden planks
  addVisualBox(g, 0, 0.78, 0, 1.42, 0.14, 2.38, woodMat);
  // Slatted wooden side rails
  addVisualBox(g, -0.68, 1.08, 0, 0.08, 0.48, 2.32, darkWoodMat);
  addVisualBox(g, 0.68, 1.08, 0, 0.08, 0.48, 2.32, darkWoodMat);
  addVisualBox(g, 0, 1.06, -1.14, 1.38, 0.44, 0.08, darkWoodMat);

  // Two large rustic spoked wooden wheels
  const wheelGeo = new THREE.TorusGeometry(0.62, 0.065, 6, 12);
  for (const sx of [-0.82, 0.82]) {
    const rim = new THREE.Mesh(wheelGeo, darkWoodMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(sx, 0.66, -0.05);
    rim.castShadow = true;
    g.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.18, 8),
      woodMat,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(sx, 0.66, -0.05);
    g.add(hub);

    // 4 crossed spokes
    for (let sp = 0; sp < 4; sp++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.18, 0.06),
        woodMat,
      );
      spoke.position.set(sx, 0.66, -0.05);
      spoke.rotation.x = (sp * Math.PI) / 4;
      g.add(spoke);
    }
  }

  // Front wooden tow shafts resting gently on the ground
  for (const sx of [-0.36, 0.36]) {
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 1.75),
      darkWoodMat,
    );
    shaft.position.set(sx, 0.45, 1.85);
    shaft.rotation.x = 0.34;
    g.add(shaft);
  }
  addVisualBox(g, 0, 0.2, 2.55, 1.18, 0.09, 0.1, woodMat);

  // Load of golden hay + woven mango harvest basket on the cart bed
  addVisualBox(g, 0, 1.16, -0.25, 1.18, 0.62, 1.48, thatchMat);
  const mangoMat = new THREE.MeshStandardMaterial({
    color: 0xf4b626,
    roughness: 0.48,
  });
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.26, 0.32, 9),
    woodMat,
  );
  basket.position.set(0, 1.02, 0.72);
  g.add(basket);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mangoMat);
    m.scale.set(0.85, 1.25, 0.85);
    m.position.set(
      (i % 2 === 0 ? -0.11 : 0.11),
      1.21,
      0.72 + (i < 2 ? -0.09 : 0.09),
    );
    g.add(m);
  }

  ctx.group.add(g);

  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const halfX = 1.05 * cos + 1.5 * sin;
  const halfZ = 1.05 * sin + 1.5 * cos;
  ctx.boxes.push({
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
    blocksSight: true,
    topY: 1.45,
  });
  ctx.hidingSpots.push({
    x: x - Math.sin(rotY) * 2.15,
    z: z - Math.cos(rotY) * 2.15,
    label,
    kind: 'wall',
  });
}

function addMangoBasketCluster(
  parent: THREE.Object3D,
  x: number,
  z: number,
  basketMat: THREE.Material,
  mangoColors: number[],
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const offsets = [
    { dx: 0, dz: 0, s: 1.0 },
    { dx: 0.76, dz: 0.24, s: 0.86 },
    { dx: -0.62, dz: 0.44, s: 0.9 },
  ];
  const mangoGeo = new THREE.SphereGeometry(0.1, 6, 5);

  for (let b = 0; b < offsets.length; b++) {
    const { dx, dz, s } = offsets[b];
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36 * s, 0.24 * s, 0.34 * s, 9),
      basketMat,
    );
    basket.position.set(dx, 0.17 * s, dz);
    basket.castShadow = true;
    g.add(basket);

    for (let m = 0; m < 5; m++) {
      const ang = (m / 5) * Math.PI * 2 + b;
      const rad = m === 4 ? 0 : 0.14 * s;
      const mango = new THREE.Mesh(
        mangoGeo,
        new THREE.MeshStandardMaterial({
          color: mangoColors[(m + b) % mangoColors.length],
          roughness: 0.46,
        }),
      );
      mango.scale.set(0.85, 1.25, 0.85);
      mango.position.set(
        dx + Math.cos(ang) * rad,
        0.34 * s + (m === 4 ? 0.08 : 0),
        dz + Math.sin(ang) * rad,
      );
      g.add(mango);
    }
  }
  parent.add(g);
}

function addFarmToolsCluster(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  woodMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x454a4d,
    roughness: 0.5,
    metalness: 0.55,
  });

  // Traditional wooden plough (Hal) resting on ground
  addVisualBox(g, 0, 0.14, 0, 0.14, 0.14, 1.85, woodMat);
  const ploughHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.92, 0.11),
    woodMat,
  );
  ploughHandle.position.set(0, 0.5, -0.78);
  ploughHandle.rotation.x = -0.35;
  g.add(ploughHandle);
  addVisualBox(g, 0, 0.11, -0.92, 0.16, 0.18, 0.34, ironMat);

  // Two leaning spades (Phawda)
  for (const sx of [0.46, 0.72]) {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 1.38, 6),
      woodMat,
    );
    handle.position.set(sx, 0.66, -0.15);
    handle.rotation.x = 0.22;
    g.add(handle);
    addVisualBox(g, sx, 0.12, -0.3, 0.24, 0.22, 0.04, ironMat);
  }

  parent.add(g);
}

function addBambooLadder(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  bambooMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const ladderGroup = new THREE.Group();
  ladderGroup.rotation.x = -0.32;
  for (const sx of [-0.24, 0.24]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 3.1, 6),
      bambooMat,
    );
    rail.position.set(sx, 1.48, 0);
    rail.castShadow = true;
    ladderGroup.add(rail);
  }
  for (let r = 0; r < 7; r++) {
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.52, 5),
      bambooMat,
    );
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.36 + r * 0.38, 0);
    ladderGroup.add(rung);
  }
  g.add(ladderGroup);
  parent.add(g);
}

function addMangoCrateStack(
  ctx: MapBuildContext,
  x: number,
  z: number,
  crateMat: THREE.Material,
  registerSpot = false,
  spotLabel = 'Behind Mango Crates',
): void {
  addSolidBox(ctx, x, z, 1.65, 1.05, 1.15, crateMat, true, 0, {
    topY: 1.05,
    climbable: true,
  });
  addVisualBox(ctx.group, x - 0.32, 1.38, z, 0.72, 0.62, 0.78, crateMat);
  addVisualBox(ctx.group, x + 0.42, 1.28, z - 0.08, 0.66, 0.44, 0.68, crateMat);

  // Ripe mangoes peeking out of top crate
  const mangoMat = new THREE.MeshStandardMaterial({
    color: 0xf4b824,
    roughness: 0.46,
  });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mangoMat);
    m.scale.set(0.85, 1.25, 0.85);
    m.position.set(
      x - 0.48 + (i % 2) * 0.3,
      1.72,
      z - 0.12 + Math.floor(i / 2) * 0.24,
    );
    ctx.group.add(m);
  }

  if (registerSpot) {
    ctx.hidingSpots.push({
      x: x + 1.45,
      z: z + 0.2,
      label: spotLabel,
      kind: 'wall',
    });
  }
}

function addIrrigationChannel(
  ctx: MapBuildContext,
  x: number,
  z: number,
  width: number,
  length: number,
  isHorizontal: boolean,
  waterMat: THREE.Material,
  bundMat: THREE.Material,
): void {
  const g = new THREE.Group();
  const w = isHorizontal ? length : width;
  const d = isHorizontal ? width : length;

  // Shallow shimmering irrigation water strip (walkable — zero blocking collider)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.032, z);
  water.receiveShadow = true;
  g.add(water);

  // Low mossy mud-and-stone channel embankments (0.08m high — smooth stepping)
  const bundT = 0.22;
  if (isHorizontal) {
    addVisualBox(g, x, 0.04, z - width * 0.5 - bundT * 0.4, length, 0.08, bundT, bundMat);
    addVisualBox(g, x, 0.04, z + width * 0.5 + bundT * 0.4, length, 0.08, bundT, bundMat);
  } else {
    addVisualBox(g, x - width * 0.5 - bundT * 0.4, 0.04, z, bundT, 0.08, length, bundMat);
    addVisualBox(g, x + width * 0.5 + bundT * 0.4, 0.04, z, bundT, 0.08, length, bundMat);
  }

  ctx.group.add(g);
  ctx.waterRects.push({
    x,
    z,
    width: w,
    length: d,
    rotY: 0,
  });
}

function addWoodenFootPlank(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  woodMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);
  g.rotation.y = rotY;
  for (let i = -2; i <= 2; i++) {
    addVisualBox(g, i * 0.42, 0, 0, 0.36, 0.06, 1.75, woodMat);
  }
  parent.add(g);
}

// ---------------------------------------------------------------------------
// Main Level 3 Builder: Upgraded 1990s Indian Village Mango Farm
// ---------------------------------------------------------------------------
export function buildMangoFarmMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  const farmTex = createMangoFarmTextures();
  const rand = seededRand(199503);

  // -------------------------------------------------------------------------
  // 1. Sun-Dappled Indian Alluvial Orchard Ground & Mud Pathways
  // -------------------------------------------------------------------------
  const groundMat = new THREE.MeshStandardMaterial({
    map: farmTex.soil,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.04,
    roughness: 0.96,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(148, 48),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ctx.group.add(ground);

  // Mud pathways (Pagdandis) linking the farmhouse, sheds & all 4 orchard quadrants
  const pathMat = new THREE.MeshStandardMaterial({
    map: farmTex.mudPath,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.028,
    roughness: 0.94,
  });
  const addMudTrack = (x: number, z: number, width: number, length: number, rotY = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), pathMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, 0.018, z);
    mesh.receiveShadow = true;
    ctx.group.add(mesh);
    ctx.roads.push({ x, z, width, length, rotY });
  };

  // Main cross tracks
  addMudTrack(0, 0, 4.8, 112, 0);
  addMudTrack(0, 2.0, 4.6, 112, Math.PI / 2);

  // Outer scenic orchard loop tracks (great for 10-player chases!)
  addMudTrack(-36, 0, 3.4, 75, 0);
  addMudTrack(36, 0, 3.4, 75, 0);
  addMudTrack(0, -36, 3.4, 75, Math.PI / 2);
  addMudTrack(0, 36, 3.4, 75, Math.PI / 2);

  // Also add short mud apron tracks into shed entrances
  addRoadSegment(ctx, -21.5, -5.5, 3.2, 7.5, Math.PI / 2, textures, 0xd8bd92, 0.016);
  addRoadSegment(ctx, 21.5, 8.5, 3.2, 7.5, Math.PI / 2, textures, 0xd8bd92, 0.016);

  // -------------------------------------------------------------------------
  // 2. Shared Materials
  // -------------------------------------------------------------------------
  const farmWallMat = new THREE.MeshStandardMaterial({
    map: farmTex.farmWall,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.03,
    roughness: 0.92,
  });
  const brickWallMat = new THREE.MeshStandardMaterial({
    map: farmTex.shedBrick,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.04,
    roughness: 0.93,
  });
  const tileRoofMat = new THREE.MeshStandardMaterial({
    map: farmTex.tileRoof,
    roughness: 0.88,
  });
  const thatchMat = new THREE.MeshStandardMaterial({
    map: farmTex.thatch,
    roughness: 0.95,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x9b6d41,
    roughness: 0.88,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x6b4728,
    roughness: 0.9,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xb99d56,
    roughness: 0.82,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xd4b678,
    roughness: 0.94,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    map: farmTex.crateWood,
    roughness: 0.88,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xb4ab9a,
    roughness: 0.92,
  });
  const courtyardMat = new THREE.MeshStandardMaterial({
    map: farmTex.courtyard,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.025,
    roughness: 0.93,
  });
  const bundMat = new THREE.MeshStandardMaterial({
    color: 0x766440,
    roughness: 0.96,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    map: farmTex.water,
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const basketMat = new THREE.MeshStandardMaterial({
    color: 0xc29855,
    roughness: 0.92,
  });
  const burlapMat = new THREE.MeshStandardMaterial({
    color: 0xb39764,
    roughness: 0.95,
  });

  // -------------------------------------------------------------------------
  // 3. Old Farmhouse Courtyard (Aangan) & Main Farmhouse
  // -------------------------------------------------------------------------
  const aangan = new THREE.Mesh(
    new THREE.PlaneGeometry(23.0, 17.5),
    courtyardMat,
  );
  aangan.rotation.x = -Math.PI / 2;
  aangan.position.set(0, 0.024, -4.2);
  aangan.receiveShadow = true;
  ctx.group.add(aangan);

  // Low decorative courtyard boundary wall segments with wide open gateways
  addSolidBox(ctx, -7.8, 4.4, 7.2, 0.82, 0.34, farmWallMat, false, 0);
  addSolidBox(ctx, 7.8, 4.4, 7.2, 0.82, 0.34, farmWallMat, false, 0);
  addSolidBox(ctx, -11.4, -7.8, 0.34, 0.88, 9.6, farmWallMat, false, 0);
  addSolidBox(ctx, 11.4, -7.8, 0.34, 0.88, 9.6, farmWallMat, false, 0);

  // Grand shade tree inside the courtyard with circular mud platform (Chabutra)
  const chabutra = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.9, 0.36, 12),
    courtyardMat,
  );
  chabutra.position.set(-5.4, 0.18, -4.2);
  chabutra.receiveShadow = true;
  ctx.group.add(chabutra);
  addTree(
    ctx,
    -5.4,
    -4.2,
    1.28,
    textures,
    0x2f6b28,
    true,
    true,
    'Courtyard Shade Mango Tree',
  );

  // Main Mango Farmer's Farmhouse (Kisan Ghar) on north edge of courtyard
  const mainFarmhouse = buildPassThroughFarmBuilding(ctx, {
    id: 'mango-main-farmhouse',
    label: 'Old Mango Farmhouse',
    x: 0,
    z: -16.6,
    width: 13.6,
    depth: 7.4,
    wallHeight: 3.35,
    wallMat: farmWallMat,
    roofMat: tileRoofMat,
    trimMat: darkWoodMat,
    floorMat: courtyardMat,
    roofStyle: 'gable',
    doors: ['south', 'north'],
    doorWidth: 2.45,
    verandaSide: 'south',
    minimapKind: 'house',
  });
  ctx.landmarks.push({ x: 0, z: -4.2, radius: 10.5, kind: 'courtyard' });

  // Main Farmhouse interior props (tucked against west/east walls for open walk-through)
  addSittableCharpai(
    ctx,
    3.9,
    -17.1,
    0,
    woodMat,
    ropeMat,
    'Farmhouse Indoor Charpai',
  );
  // Clay grain storage kothi & terracotta matkas inside west wing
  const clayMat = new THREE.MeshStandardMaterial({
    color: 0xb6623d,
    roughness: 0.86,
  });
  const kothi = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.76, 1.52, 10),
    courtyardMat,
  );
  kothi.position.set(-4.8, 0.84, -18.2);
  kothi.castShadow = true;
  mainFarmhouse.add(kothi);
  ctx.circles.push({ x: -4.8, z: -18.2, radius: 0.82, blocksSight: true });

  for (const [mx, mz] of [
    [-4.6, -15.2],
    [-3.8, -14.8],
    [5.2, -14.6],
  ]) {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), clayMat);
    pot.scale.set(1, 1.12, 1);
    pot.position.set(mx, 0.38, mz);
    mainFarmhouse.add(pot);
  }
  ctx.hidingSpots.push(
    { x: -4.6, z: -16.4, label: 'Inside Farmhouse Grain Corner', kind: 'house' },
    { x: 4.8, z: -15.6, label: 'Inside Farmhouse East Room', kind: 'house' },
  );

  // Courtyard Charpais, Harvest Sorting Baskets, Tools & Cast-Iron Hand Pump
  addSittableCharpai(
    ctx,
    -8.4,
    -4.6,
    Math.PI / 2,
    woodMat,
    ropeMat,
    'Courtyard Shade Charpai',
  );
  addSittableCharpai(
    ctx,
    -4.8,
    -8.2,
    0,
    woodMat,
    ropeMat,
    'Veranda Front Charpai',
  );
  addVillageHandPump(ctx, 7.6, -2.2, stoneMat, waterMat);
  addMangoBasketCluster(ctx.group, 5.4, -7.2, basketMat, [0xf6bd22, 0xe86c20, 0x86b834]);
  addMangoBasketCluster(ctx.group, 7.8, -7.8, basketMat, [0xf5cd34, 0xe97822, 0xf2b11e]);
  addFarmToolsCluster(ctx.group, 8.8, -10.4, -0.5, darkWoodMat);

  // -------------------------------------------------------------------------
  // 4. Storage Sheds, Packing House, Hay Barn & Orchard Watch Hut
  // -------------------------------------------------------------------------
  // West Mango Packing Shed (Aam Godown)
  buildPassThroughFarmBuilding(ctx, {
    id: 'mango-west-packing-shed',
    label: 'West Mango Packing Shed',
    x: -26.5,
    z: -5.5,
    width: 9.6,
    depth: 7.2,
    wallHeight: 3.1,
    wallMat: brickWallMat,
    roofMat: thatchMat,
    trimMat: darkWoodMat,
    floorMat: courtyardMat,
    roofStyle: 'lean',
    doors: ['east', 'west'],
    doorWidth: 2.45,
    minimapKind: 'shed',
  });
  addMangoCrateStack(ctx, -28.4, -7.6, crateMat, true, 'Inside Packing Shed Crates');
  addMangoCrateStack(ctx, -24.2, -3.4, crateMat, true, 'Behind Packing Shed Crates');
  addMangoBasketCluster(ctx.group, -23.4, -7.6, basketMat, [0xf6bd22, 0xe86c20, 0x80b432]);
  addSittableCharpai(ctx, -19.8, -8.8, 0.15, woodMat, ropeMat, 'Packing Shed Charpai');
  ctx.landmarks.push({ x: -26.5, z: -5.5, radius: 4.5, kind: 'farm' });

  // East Tool & Harvest Storage Shed (Bhandar Ghar)
  buildPassThroughFarmBuilding(ctx, {
    id: 'mango-east-tool-shed',
    label: 'East Farm Tool Shed',
    x: 26.5,
    z: 8.5,
    width: 9.2,
    depth: 6.8,
    wallHeight: 3.05,
    wallMat: brickWallMat,
    roofMat: tileRoofMat,
    trimMat: darkWoodMat,
    floorMat: courtyardMat,
    roofStyle: 'gable',
    doors: ['west', 'east'],
    doorWidth: 2.35,
    minimapKind: 'shed',
  });
  addMangoCrateStack(ctx, 28.4, 6.6, crateMat, true, 'Inside Tool Shed Crates');
  addFarmToolsCluster(ctx.group, 24.4, 10.6, 0.8, darkWoodMat);
  addFarmToolsCluster(ctx.group, 21.2, 5.2, -0.4, darkWoodMat);
  ctx.hidingSpots.push({
    x: 25.0,
    z: 6.6,
    label: 'Inside East Tool Shed',
    kind: 'house',
  });
  ctx.landmarks.push({ x: 26.5, z: 8.5, radius: 4.5, kind: 'farm' });

  // South-West Hay & Grain Barn (Bhoosa Ghar)
  buildPassThroughFarmBuilding(ctx, {
    id: 'mango-sw-hay-barn',
    label: 'South-West Hay Barn',
    x: -21.5,
    z: 25.5,
    width: 8.4,
    depth: 6.4,
    wallHeight: 2.95,
    wallMat: farmWallMat,
    roofMat: thatchMat,
    trimMat: darkWoodMat,
    floorMat: courtyardMat,
    roofStyle: 'gable',
    doors: ['north', 'east'],
    doorWidth: 2.35,
    minimapKind: 'shed',
  });
  // Burlap grain sacks inside SW barn
  addSolidBox(ctx, -23.6, 26.8, 1.5, 0.96, 1.4, burlapMat, true, 0);
  addSolidBox(ctx, -22.2, 27.2, 1.1, 0.72, 1.0, thatchMat, false, 0);
  ctx.hidingSpots.push({
    x: -23.8,
    z: 24.5,
    label: 'Inside Hay Barn Corner',
    kind: 'house',
  });

  // South-East Orchard Watchman Hut (Rakhwala Jhopdi)
  buildPassThroughFarmBuilding(ctx, {
    id: 'mango-se-watch-hut',
    label: 'Orchard Watchman Hut',
    x: 22.0,
    z: 25.0,
    width: 6.2,
    depth: 5.4,
    wallHeight: 2.75,
    wallMat: farmWallMat,
    roofMat: thatchMat,
    trimMat: bambooMat,
    floorMat: courtyardMat,
    roofStyle: 'hip',
    doors: ['west', 'north'],
    doorWidth: 2.15,
    minimapKind: 'hut',
  });
  addSittableCharpai(
    ctx,
    17.6,
    25.6,
    Math.PI / 2,
    woodMat,
    ropeMat,
    'Watchman Hut Charpai',
  );
  ctx.hidingSpots.push({
    x: 23.4,
    z: 26.2,
    label: 'Inside Watchman Hut',
    kind: 'house',
  });

  // -------------------------------------------------------------------------
  // 5. Old Stone Farm Well & Orchard Irrigation Channels (Naalis)
  // -------------------------------------------------------------------------
  addOldOrchardWell(ctx, -11.5, 7.5, stoneMat, darkWoodMat, waterMat);

  // Main East-West irrigation canals
  addIrrigationChannel(ctx, 0, 11.2, 1.02, 104, true, waterMat, bundMat);
  addIrrigationChannel(ctx, 0, -24.5, 0.96, 104, true, waterMat, bundMat);

  // North-South lateral orchard irrigation branches
  addIrrigationChannel(ctx, -15.5, 0, 0.9, 100, false, waterMat, bundMat);
  addIrrigationChannel(ctx, 15.5, 0, 0.9, 100, false, waterMat, bundMat);

  // Short feeder channel linking Courtyard Hand Pump trough to East Branch
  addIrrigationChannel(ctx, 12.1, -2.2, 0.52, 7.2, true, waterMat, bundMat);
  // Short feeder channel linking Old Stone Well catch-basin to West Branch
  addIrrigationChannel(ctx, -14.2, 7.5, 0.56, 2.8, true, waterMat, bundMat);

  // Rustic wooden plank footbridges wherever mud tracks cross irrigation channels
  const plankCrossings: Array<[number, number, number]> = [
    [0, 11.2, 0],
    [0, -24.5, 0],
    [-36, 11.2, 0],
    [36, 11.2, 0],
    [-36, -24.5, 0],
    [36, -24.5, 0],
    [-15.5, 2.0, Math.PI / 2],
    [15.5, 2.0, Math.PI / 2],
    [-15.5, -36, Math.PI / 2],
    [15.5, -36, Math.PI / 2],
    [-15.5, 36, Math.PI / 2],
    [15.5, 36, Math.PI / 2],
  ];
  for (const [px, pz, rot] of plankCrossings) {
    addWoodenFootPlank(ctx.group, px, pz, rot, darkWoodMat);
  }

  // -------------------------------------------------------------------------
  // 6. Golden Indian Haystacks & Stationary Wooden Farm Carts (Scenery)
  // -------------------------------------------------------------------------
  const haystacks: Array<[number, number, number, string]> = [
    [-12.5, -18.5, 1.05, 'Farmhouse West Haystack'],
    [11.8, -19.2, 0.98, 'Farmhouse East Haystack'],
    [-28.5, 26.5, 1.15, 'Hay Barn Big Stack'],
    [-19.5, 31.4, 0.96, 'South Barn Haystack'],
    [29.5, 25.5, 1.04, 'Watch Hut Haystack'],
    [-31.0, -14.5, 0.95, 'Packing Shed Haystack'],
    [30.5, -5.5, 1.02, 'East Orchard Haystack'],
    [-8.5, 29.5, 1.06, 'South-Central Haystack'],
    [9.2, -31.5, 0.94, 'North Orchard Haystack'],
    [10.2, 22.0, 0.98, 'Irrigation Bank Haystack'],
  ];
  for (const [hx, hz, hs, hLabel] of haystacks) {
    addGoldenHaystack(ctx, hx, hz, hs, thatchMat, bambooMat, hLabel);
  }

  // 4 Stationary wooden farm carts (Bailgaadi scenery props)
  addStationaryWoodenFarmCart(
    ctx,
    -13.2,
    -13.2,
    0.45,
    woodMat,
    darkWoodMat,
    thatchMat,
    'Behind Courtyard Wooden Cart',
  );
  addStationaryWoodenFarmCart(
    ctx,
    13.2,
    -14.2,
    -0.65,
    woodMat,
    darkWoodMat,
    thatchMat,
    'Behind East Wooden Cart',
  );
  addStationaryWoodenFarmCart(
    ctx,
    -21.5,
    16.2,
    1.2,
    woodMat,
    darkWoodMat,
    thatchMat,
    'Behind Barn Wooden Cart',
  );
  addStationaryWoodenFarmCart(
    ctx,
    31.5,
    -11.5,
    -1.35,
    woodMat,
    darkWoodMat,
    thatchMat,
    'Behind Orchard Harvest Cart',
  );

  // -------------------------------------------------------------------------
  // 7. HUNDREDS OF MANGO TREES IN NATURAL ROWS + HANGING MANGOES
  //    (GPU InstancedMesh batching for silky-smooth Android FPS!)
  // -------------------------------------------------------------------------
  interface OrchardTreeInstance {
    x: number;
    z: number;
    scale: number;
    rotY: number;
    playable: boolean;
  }

  const isTreeSpotBlocked = (x: number, z: number): boolean => {
    const r = Math.hypot(x, z);
    if (r > 73.5) return true;
    // Leave clean perimeter fence buffer between playable edge & outer scenic orchard
    if (r > 55.6 && r < 60.4) return true;

    // Farmhouse Courtyard & Main Farmhouse
    if (x > -14.2 && x < 14.2 && z > -23.0 && z < 7.6) return true;
    // West Packing Shed + apron
    if (x > -34.0 && x < -18.6 && z > -12.0 && z < 0.4) return true;
    // East Tool Shed + apron
    if (x > 18.8 && x < 33.8 && z > 2.6 && z < 14.6) return true;
    // SW Hay Barn
    if (x > -30.5 && x < -14.8 && z > 19.6 && z < 33.2) return true;
    // SE Watchman Hut
    if (x > 16.0 && x < 31.8 && z > 19.8 && z < 30.8) return true;

    // Old Stone Well & Haystacks / Carts clearance
    if (Math.hypot(x - -11.5, z - 7.5) < 4.2) return true;
    for (const [hx, hz] of haystacks) {
      if (Math.hypot(x - hx, z - hz) < 3.6) return true;
    }
    if (Math.hypot(x - -13.2, z - -13.2) < 3.8) return true;
    if (Math.hypot(x - 13.2, z - -14.2) < 3.8) return true;
    if (Math.hypot(x - -21.5, z - 16.2) < 3.8) return true;
    if (Math.hypot(x - 31.5, z - -11.5) < 3.8) return true;

    // Mud pathways clearance
    if (Math.abs(x) < 3.9 && Math.abs(z) < 57) return true;
    if (Math.abs(z - 2.0) < 3.8 && Math.abs(x) < 57) return true;
    if (Math.abs(x + 36) < 2.9 && Math.abs(z) < 40) return true;
    if (Math.abs(x - 36) < 2.9 && Math.abs(z) < 40) return true;
    if (Math.abs(z + 36) < 2.9 && Math.abs(x) < 40) return true;
    if (Math.abs(z - 36) < 2.9 && Math.abs(x) < 40) return true;

    // Irrigation channels clearance
    if (Math.abs(z - 11.2) < 1.9 && Math.abs(x) < 54) return true;
    if (Math.abs(z + 24.5) < 1.9 && Math.abs(x) < 54) return true;
    if (Math.abs(x + 15.5) < 1.8 && Math.abs(z) < 52) return true;
    if (Math.abs(x - 15.5) < 1.8 && Math.abs(z) < 52) return true;

    return false;
  };

  const orchardTrees: OrchardTreeInstance[] = [];
  const rowStepX = 6.35;
  const rowStepZ = 6.55;

  for (let gx = -69; gx <= 69; gx += rowStepX) {
    for (let gz = -69; gz <= 69; gz += rowStepZ) {
      const x = gx + (rand() - 0.5) * 1.15;
      const z = gz + (rand() - 0.5) * 1.15;
      if (isTreeSpotBlocked(x, z)) continue;

      const dist = Math.hypot(x, z);
      orchardTrees.push({
        x,
        z,
        scale: 0.86 + rand() * 0.4,
        rotY: rand() * Math.PI * 2,
        playable: dist <= 56.0,
      });
    }
  }

  const treeCount = orchardTrees.length;
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();

  // Instanced Mesh 1: Tapered gnarled mango trunks
  const trunkGeo = new THREE.CylinderGeometry(0.23, 0.38, 2.75, 7);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: farmTex.bark,
    roughness: 0.94,
  });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  // Instanced Mesh 2: Forked upper wooden branches (2 per tree)
  const branchGeo = new THREE.CylinderGeometry(0.09, 0.16, 1.55, 5);
  const branchInst = new THREE.InstancedMesh(branchGeo, trunkMat, treeCount * 2);
  branchInst.castShadow = false;
  branchInst.receiveShadow = true;

  // Instanced Mesh 3: Broad spreading dark-emerald lower mango canopy domes
  const lowerCrownGeo = new THREE.DodecahedronGeometry(2.08, 1);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
  });
  const lowerCrownInst = new THREE.InstancedMesh(lowerCrownGeo, crownMat, treeCount);
  lowerCrownInst.castShadow = true;
  lowerCrownInst.receiveShadow = true;

  // Instanced Mesh 4: Offset sunlit upper mango crowns
  const upperCrownGeo = new THREE.DodecahedronGeometry(1.48, 1);
  const upperCrownInst = new THREE.InstancedMesh(upperCrownGeo, crownMat, treeCount);
  upperCrownInst.castShadow = false;
  upperCrownInst.receiveShadow = true;

  // Instanced Mesh 5: Hundreds of realistic hanging mangoes (4 per tree!)
  const mangoesPerTree = 4;
  const mangoGeo = new THREE.SphereGeometry(0.145, 7, 6);
  const mangoInstMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.44,
    metalness: 0.04,
  });
  const mangoInst = new THREE.InstancedMesh(
    mangoGeo,
    mangoInstMat,
    treeCount * mangoesPerTree,
  );
  mangoInst.castShadow = false;
  mangoInst.receiveShadow = false;

  const lowerGreens = [0x2a5f23, 0x336d28, 0x265620, 0x3b782c, 0x2f6525];
  const upperGreens = [0x458630, 0x529635, 0x3c792b, 0x5da03b];
  const mangoPalette = [
    0xf7bc22, // Ripe Alphonso golden-amber
    0xeb6e1f, // Kesari reddish-orange blush
    0xf5cf36, // Sun-ripened yellow
    0x7fb332, // Raw green orchard mango
    0xf29f20, // Deep saffron-gold mango
  ];

  let mangoIdx = 0;
  let treeHideSpotCounter = 0;
  const ladderCandidateTrees: OrchardTreeInstance[] = [];

  for (let i = 0; i < treeCount; i++) {
    const t = orchardTrees[i];
    const s = t.scale;

    // Trunk
    dummy.position.set(t.x, 1.35 * s, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    // 2 spreading branches
    for (let b = 0; b < 2; b++) {
      const ang = t.rotY + b * Math.PI + 0.45;
      dummy.position.set(
        t.x + Math.cos(ang) * 0.48 * s,
        2.58 * s,
        t.z + Math.sin(ang) * 0.48 * s,
      );
      dummy.rotation.set(
        Math.sin(ang) * 0.58,
        ang,
        -Math.cos(ang) * 0.58,
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      branchInst.setMatrixAt(i * 2 + b, dummy.matrix);
    }

    // Broad spreading mango canopy
    dummy.position.set(t.x, 3.85 * s, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.set(s * 1.15, s * 0.82, s * 1.12);
    dummy.updateMatrix();
    lowerCrownInst.setMatrixAt(i, dummy.matrix);
    colorTmp.setHex(lowerGreens[i % lowerGreens.length]);
    lowerCrownInst.setColorAt(i, colorTmp);

    // Sunlit upper offset foliage cluster
    dummy.position.set(
      t.x + Math.cos(t.rotY) * 0.55 * s,
      4.92 * s,
      t.z + Math.sin(t.rotY) * 0.55 * s,
    );
    dummy.rotation.set(0.12, t.rotY * 1.3, -0.08);
    dummy.scale.set(s * 1.05, s * 0.86, s * 1.02);
    dummy.updateMatrix();
    upperCrownInst.setMatrixAt(i, dummy.matrix);
    colorTmp.setHex(upperGreens[i % upperGreens.length]);
    upperCrownInst.setColorAt(i, colorTmp);

    // 4 realistic mangoes hanging beneath the canopy branches
    for (let m = 0; m < mangoesPerTree; m++) {
      const mAng = t.rotY + (m / mangoesPerTree) * Math.PI * 2 + rand() * 0.45;
      const mRad = (1.18 + rand() * 0.72) * s;
      const mY = (2.42 + rand() * 0.68) * s;
      const mScale = 0.85 + rand() * 0.32;
      dummy.position.set(
        t.x + Math.cos(mAng) * mRad,
        mY,
        t.z + Math.sin(mAng) * mRad,
      );
      dummy.rotation.set(0.15, mAng, 0.12);
      dummy.scale.set(0.84 * mScale, 1.34 * mScale, 0.84 * mScale);
      dummy.updateMatrix();
      mangoInst.setMatrixAt(mangoIdx, dummy.matrix);
      colorTmp.setHex(mangoPalette[(i + m * 2) % mangoPalette.length]);
      mangoInst.setColorAt(mangoIdx, colorTmp);
      mangoIdx++;
    }

    // Playable tree colliders + distributed hiding spots
    if (t.playable) {
      ctx.circles.push({
        x: t.x,
        z: t.z,
        radius: 0.42 * Math.min(1.15, s),
        blocksSight: true,
      });

      if (i % 10 === 0 && treeHideSpotCounter < 18) {
        treeHideSpotCounter++;
        const quad =
          t.x < 0
            ? t.z < 0
              ? 'NW Orchard'
              : 'SW Orchard'
            : t.z < 0
              ? 'NE Orchard'
              : 'SE Orchard';
        ctx.hidingSpots.push({
          x: t.x + 1.05,
          z: t.z + 0.55,
          label: `${quad} Mango Tree #${treeHideSpotCounter}`,
          kind: 'tree',
        });
      }

      if (
        ladderCandidateTrees.length < 6 &&
        Math.hypot(t.x, t.z) > 14 &&
        Math.hypot(t.x, t.z) < 42 &&
        i % 19 === 3
      ) {
        ladderCandidateTrees.push(t);
      }
    }
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  branchInst.instanceMatrix.needsUpdate = true;
  lowerCrownInst.instanceMatrix.needsUpdate = true;
  upperCrownInst.instanceMatrix.needsUpdate = true;
  mangoInst.instanceMatrix.needsUpdate = true;
  if (lowerCrownInst.instanceColor) lowerCrownInst.instanceColor.needsUpdate = true;
  if (upperCrownInst.instanceColor) upperCrownInst.instanceColor.needsUpdate = true;
  if (mangoInst.instanceColor) mangoInst.instanceColor.needsUpdate = true;

  trunkInst.computeBoundingSphere();
  branchInst.computeBoundingSphere();
  lowerCrownInst.computeBoundingSphere();
  upperCrownInst.computeBoundingSphere();
  mangoInst.computeBoundingSphere();

  ctx.group.add(trunkInst);
  ctx.group.add(branchInst);
  ctx.group.add(lowerCrownInst);
  ctx.group.add(upperCrownInst);
  ctx.group.add(mangoInst);

  // Add bamboo ladders & harvested mango baskets beneath select fruiting trees
  for (let i = 0; i < ladderCandidateTrees.length; i++) {
    const lt = ladderCandidateTrees[i];
    addBambooLadder(ctx.group, lt.x + 0.95, lt.z + 0.35, i * 1.1, bambooMat);
    if (i % 2 === 0) {
      addMangoBasketCluster(ctx.group, lt.x - 1.1, lt.z + 0.8, basketMat, mangoPalette);
    }
  }

  // -------------------------------------------------------------------------
  // 8. Tall Orchard Grass Tufts & Wild Bushes (GPU InstancedMesh)
  // -------------------------------------------------------------------------
  const grassPositions: Array<{ x: number; z: number; s: number; rot: number }> = [];
  for (let i = 0; i < 290; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 7.5 + Math.sqrt(rand()) * 49.5;
    const gx = Math.cos(ang) * rad;
    const gz = Math.sin(ang) * rad;

    // Keep farmhouse courtyard & building interiors free of tall grass
    if (gx > -12.5 && gx < 12.5 && gz > -21.0 && gz < 5.5) continue;
    if (gx > -32 && gx < -21 && gz > -10 && gz < -1) continue;
    if (gx > 21 && gx < 32 && gz > 4 && gz < 13) continue;
    if (gx > -26.5 && gx < -16.5 && gz > 21.5 && gz < 29.5) continue;
    if (gx > 18 && gx < 26 && gz > 21.5 && gz < 28.5) continue;
    // Keep main mud pathways tidy
    if (Math.abs(gx) < 2.6 || Math.abs(gz - 2.0) < 2.5) continue;

    grassPositions.push({
      x: gx,
      z: gz,
      s: 0.75 + rand() * 0.65,
      rot: rand() * Math.PI,
    });
  }

  // Crossed tall grass cluster geometry (lightweight 2-plane tuft)
  const grassBladeGeo = new THREE.ConeGeometry(0.42, 1.05, 5, 1, true);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    side: THREE.DoubleSide,
  });
  const tallGrassInst = new THREE.InstancedMesh(
    grassBladeGeo,
    grassMat,
    grassPositions.length,
  );
  tallGrassInst.castShadow = false;
  tallGrassInst.receiveShadow = true;

  const grassPalette = [0x588432, 0x67943a, 0x4d782b, 0x7a9e40, 0x8ea044];
  for (let i = 0; i < grassPositions.length; i++) {
    const gp = grassPositions[i];
    dummy.position.set(gp.x, 0.45 * gp.s, gp.z);
    dummy.rotation.set(0, gp.rot, 0);
    dummy.scale.set(gp.s * 1.1, gp.s * 1.05, gp.s * 1.1);
    dummy.updateMatrix();
    tallGrassInst.setMatrixAt(i, dummy.matrix);
    colorTmp.setHex(grassPalette[i % grassPalette.length]);
    tallGrassInst.setColorAt(i, colorTmp);
  }
  tallGrassInst.instanceMatrix.needsUpdate = true;
  if (tallGrassInst.instanceColor) tallGrassInst.instanceColor.needsUpdate = true;
  tallGrassInst.computeBoundingSphere();
  ctx.group.add(tallGrassInst);

  // Wild Orchard Bushes (crouch hiding spots!)
  const bushPositions: Array<{ x: number; z: number; s: number; rot: number }> = [];
  for (let i = 0; i < 86; i++) {
    const ang = (i / 86) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const rad = 11.5 + rand() * 44.5;
    const bx = Math.cos(ang) * rad;
    const bz = Math.sin(ang) * rad;
    if (isTreeSpotBlocked(bx, bz)) continue;
    bushPositions.push({
      x: bx,
      z: bz,
      s: 0.85 + rand() * 0.55,
      rot: rand() * Math.PI * 2,
    });
  }

  const bushGeo = new THREE.DodecahedronGeometry(0.88, 1);
  const bushInst = new THREE.InstancedMesh(bushGeo, crownMat, bushPositions.length);
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;
  const bushColors = [0x397029, 0x457f2f, 0x2f6323, 0x4f8933];

  for (let i = 0; i < bushPositions.length; i++) {
    const bp = bushPositions[i];
    dummy.position.set(bp.x, 0.55 * bp.s, bp.z);
    dummy.rotation.set(0, bp.rot, 0);
    dummy.scale.set(bp.s * 1.25, bp.s * 0.82, bp.s * 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    colorTmp.setHex(bushColors[i % bushColors.length]);
    bushInst.setColorAt(i, colorTmp);

    if (i % 7 === 0) {
      ctx.hidingSpots.push({
        x: bp.x,
        z: bp.z,
        label: 'Dense Orchard Bush',
        kind: 'tree',
      });
    }
  }
  bushInst.instanceMatrix.needsUpdate = true;
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  bushInst.computeBoundingSphere();
  ctx.group.add(bushInst);

  // -------------------------------------------------------------------------
  // 9. Rustic Orchard Boundary Fence (Bamboo & Thorn Hedge around r = 59.2m)
  // -------------------------------------------------------------------------
  const fencePosts = 56;
  const fenceR = 59.2;
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.38, 6);
  const postInst = new THREE.InstancedMesh(postGeo, darkWoodMat, fencePosts);
  const railGeo = new THREE.BoxGeometry(0.08, 0.09, (2 * Math.PI * fenceR) / fencePosts + 0.15);
  const railInst = new THREE.InstancedMesh(railGeo, bambooMat, fencePosts * 2);

  for (let i = 0; i < fencePosts; i++) {
    const a0 = (i / fencePosts) * Math.PI * 2;
    const a1 = ((i + 1) / fencePosts) * Math.PI * 2;
    const px = Math.cos(a0) * fenceR;
    const pz = Math.sin(a0) * fenceR;

    dummy.position.set(px, 0.68, pz);
    dummy.rotation.set(0, -a0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);

    const mx = (Math.cos(a0) + Math.cos(a1)) * 0.5 * fenceR;
    const mz = (Math.sin(a0) + Math.sin(a1)) * 0.5 * fenceR;
    const midA = (a0 + a1) * 0.5;
    for (let r = 0; r < 2; r++) {
      dummy.position.set(mx, 0.48 + r * 0.52, mz);
      dummy.rotation.set(0, -midA, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railInst.setMatrixAt(i * 2 + r, dummy.matrix);
    }
  }
  postInst.instanceMatrix.needsUpdate = true;
  railInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  railInst.computeBoundingSphere();
  ctx.group.add(postInst);
  ctx.group.add(railInst);

  // -------------------------------------------------------------------------
  // 10. Patrol Points & 10-Player Verified Unobstructed Spawns
  // -------------------------------------------------------------------------
  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 2.0),
    new THREE.Vector3(0, 0, -6.5),
    new THREE.Vector3(0, 0, -28.0),
    new THREE.Vector3(0, 0, 28.0),
    new THREE.Vector3(-22.0, 0, 2.0),
    new THREE.Vector3(22.0, 0, 2.0),
    new THREE.Vector3(-36.0, 0, -20.0),
    new THREE.Vector3(36.0, 0, -20.0),
    new THREE.Vector3(-36.0, 0, 20.0),
    new THREE.Vector3(36.0, 0, 20.0),
    new THREE.Vector3(0, 0, -36.0),
    new THREE.Vector3(0, 0, 36.0),
    new THREE.Vector3(-26.5, 0, -5.5),
    new THREE.Vector3(26.5, 0, 8.5),
    new THREE.Vector3(-21.5, 0, 25.5),
    new THREE.Vector3(22.0, 0, 25.0),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 58.5,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: ctx.pondWater,
    seats: ctx.seats,
    minimapLayout: {
      worldRadius: 58.5,
      groundTint: '#938552',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.0, -5.5, 0.0],
      previewCamPos: [4.2, 2.6, 1.5],
      previewLookAt: [0.0, 1.1, -6.5],
      seeker: [0.0, 2.0, Math.PI],
      hiders: [
        [0.0, -6.5, 0.0],
        [0.0, -28.0, 0.0],
        [0.0, 28.0, Math.PI],
        [-22.0, 2.0, 1.57],
        [22.0, 2.0, -1.57],
        [-36.0, -20.0, 0.8],
        [36.0, -20.0, -0.8],
        [-36.0, 20.0, 2.3],
        [36.0, 20.0, -2.3],
        [0.0, -36.0, 0.0],
      ],
    },
  };
}

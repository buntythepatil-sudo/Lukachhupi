import * as THREE from 'three';
import {
  addCrateStack,
  addRoadSegment,
  addSolidBox,
  addStoneWell,
  addTree,
  addVisualBox,
  buildEnterableRoom,
  createMapContext,
  MapBuildContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

// ---------------------------------------------------------------------------
// Deterministic seeded RNG for organic riverside foliage & bamboo groves
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
// Procedural 1990s Indian River Village Textures (Android-friendly)
// ---------------------------------------------------------------------------
interface RiverVillageTextures {
  ground: THREE.CanvasTexture;
  sandBank: THREE.CanvasTexture;
  stonePath: THREE.CanvasTexture;
  ghatStone: THREE.CanvasTexture;
  houseWall: THREE.CanvasTexture;
  houseWallOchre: THREE.CanvasTexture;
  terraceRoof: THREE.CanvasTexture;
  thatch: THREE.CanvasTexture;
  farmSoil: THREE.CanvasTexture;
  riverRipples: THREE.CanvasTexture;
}

function makeTex(
  width: number,
  height: number,
  repX: number,
  repY: number,
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
  tex.repeat.set(repX, repY);
  tex.anisotropy = 4;
  return tex;
}

function createRiverVillageTextures(): RiverVillageTextures {
  // 1. Lush fertile riverside alluvial meadow & soil
  const ground = makeTex(256, 256, 26, 26, (c, w, h) => {
    const rand = seededRand(701);
    c.fillStyle = '#8b9659';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      c.fillStyle =
        rand() < 0.55 ? 'rgba(92, 128, 56, 0.3)' : 'rgba(154, 140, 92, 0.25)';
      c.beginPath();
      c.arc(rand() * w, rand() * h, 10 + rand() * 26, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 340; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(72, 104, 42, 0.36)' : 'rgba(176, 158, 106, 0.28)';
      c.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 2);
    }
  });

  // 2. Soft golden-tan river silt & pebbled riverbank sand
  const sandBank = makeTex(256, 256, 3, 22, (c, w, h) => {
    const rand = seededRand(702);
    c.fillStyle = '#d7be8c';
    c.fillRect(0, 0, w, h);
    // Subtle moist dark silt near water edge
    for (let i = 0; i < 24; i++) {
      c.fillStyle = 'rgba(158, 134, 92, 0.22)';
      c.fillRect(rand() * w, 0, 6 + rand() * 14, h);
    }
    for (let i = 0; i < 380; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(142, 118, 82, 0.34)' : 'rgba(244, 228, 192, 0.34)';
      c.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 2);
    }
  });

  // 3. Hand-laid village flagstone path (Kharanja / Patthar gali)
  const stonePath = makeTex(256, 256, 2, 12, (c, w, h) => {
    const rand = seededRand(703);
    c.fillStyle = '#a9936d';
    c.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 8;
    const cw = w / cols;
    const rh = h / rows;
    const tones = ['#c8b594', '#baa582', '#d2c09e', '#b09b79'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.45);
      for (let col = -1; col <= cols; col++) {
        c.fillStyle = tones[Math.floor(rand() * tones.length)];
        c.fillRect(col * cw + off + 3, r * rh + 3, cw - 6, rh - 6);
      }
    }
  });

  // 4. Weathered mossy river ghat sandstone steps
  const ghatStone = makeTex(256, 256, 3, 2, (c, w, h) => {
    const rand = seededRand(704);
    c.fillStyle = '#baab8f';
    c.fillRect(0, 0, w, h);
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 4; col++) {
        c.fillStyle =
          rand() < 0.5 ? '#c6b698' : rand() < 0.8 ? '#ad9d81' : '#9c8e74';
        c.fillRect(col * 64 + 2, r * 42 + 2, 60, 38);
      }
    }
    // River-moss damp patina along lower edges
    for (let i = 0; i < 45; i++) {
      c.fillStyle = 'rgba(72, 102, 62, 0.24)';
      c.beginPath();
      c.arc(rand() * w, h * 0.65 + rand() * h * 0.35, 6 + rand() * 14, 0, Math.PI * 2);
      c.fill();
    }
  });

  // 5. Traditional lime-washed riverside village house plaster with terracotta border
  const houseWall = makeTex(256, 256, 2, 1, (c, w, h) => {
    const rand = seededRand(705);
    c.fillStyle = '#ead9b7';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#a8553b';
    c.fillRect(0, h * 0.75, w, h * 0.25);
    c.fillStyle = '#f8f0dc';
    c.fillRect(0, h * 0.73, w, 5);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = 'rgba(154, 128, 88, 0.16)';
      c.fillRect(rand() * w, rand() * h * 0.72, 12 + rand() * 20, 8 + rand() * 16);
    }
  });

  // 6. Warm village ochre mud-plaster house wall
  const houseWallOchre = makeTex(256, 256, 2, 1, (c, w, h) => {
    const rand = seededRand(706);
    c.fillStyle = '#dfbd82';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#8b4b32';
    c.fillRect(0, h * 0.75, w, h * 0.25);
    c.fillStyle = '#f4e4c4';
    c.fillRect(0, h * 0.73, w, 5);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = 'rgba(138, 102, 54, 0.16)';
      c.fillRect(rand() * w, rand() * h * 0.72, 10 + rand() * 20, 8 + rand() * 18);
    }
  });

  // 7. Flat brick-lime rooftop terrace floor (Chhat)
  const terraceRoof = makeTex(256, 256, 3, 2, (c, w, h) => {
    const rand = seededRand(707);
    c.fillStyle = '#b99c7b';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(134, 98, 68, 0.22)' : 'rgba(202, 180, 146, 0.22)';
      c.beginPath();
      c.arc(rand() * w, rand() * h, 8 + rand() * 20, 0, Math.PI * 2);
      c.fill();
    }
  });

  // 8. Golden straw thatch for haystacks & sheds
  const thatch = makeTex(256, 256, 2, 2, (c, w, h) => {
    const rand = seededRand(708);
    c.fillStyle = '#cda450';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 460; i++) {
      const x = rand() * w;
      const y = rand() * h;
      c.strokeStyle = rand() < 0.4 ? '#e4c270' : '#9c732c';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rand() - 0.5) * 12, y + 14 + rand() * 18);
      c.stroke();
    }
  });

  // 9. Furrowed dark alluvial farm soil beds
  const farmSoil = makeTex(256, 256, 4, 4, (c, w, h) => {
    const rand = seededRand(709);
    c.fillStyle = '#6c5436';
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 24) {
      c.fillStyle = '#584228';
      c.fillRect(0, y, w, 10);
      c.fillStyle = '#7e6340';
      c.fillRect(0, y + 10, w, 12);
    }
    for (let i = 0; i < 220; i++) {
      c.fillStyle = rand() < 0.5 ? 'rgba(66, 98, 38, 0.35)' : 'rgba(110, 86, 54, 0.3)';
      c.fillRect(rand() * w, rand() * h, 3, 3);
    }
  });

  // 10. Flowing turquoise-blue river surface shimmer
  const riverRipples = makeTex(256, 256, 2, 18, (c, w, h) => {
    const rand = seededRand(710);
    c.fillStyle = '#267896';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      c.fillStyle =
        rand() < 0.55 ? 'rgba(138, 214, 232, 0.28)' : 'rgba(22, 82, 108, 0.32)';
      c.beginPath();
      c.ellipse(rand() * w, rand() * h, 5 + rand() * 14, 16 + rand() * 26, 0, 0, Math.PI * 2);
      c.fill();
    }
  });

  return {
    ground,
    sandBank,
    stonePath,
    ghatStone,
    houseWall,
    houseWallOchre,
    terraceRoof,
    thatch,
    farmSoil,
    riverRipples,
  };
}

// ---------------------------------------------------------------------------
// Reusable Riverside Village Helpers (Ghat, Charpai, Hand Pump, Haystacks,
// Courtyard Houses with Balconies & Accessible Rooftops, Storage Sheds, Farms)
// ---------------------------------------------------------------------------
function addVillageCharpai(
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
  for (const lx of [-0.94, 0.94]) {
    for (const lz of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.036, 0.48, 6),
        woodMat,
      );
      leg.position.set(lx, 0.24, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  addVisualBox(g, 0, 0.46, -0.45, 2.0, 0.08, 0.08, woodMat);
  addVisualBox(g, 0, 0.46, 0.45, 2.0, 0.08, 0.08, woodMat);
  addVisualBox(g, -0.94, 0.46, 0, 0.08, 0.08, 0.94, woodMat);
  addVisualBox(g, 0.94, 0.46, 0, 0.08, 0.08, 0.94, woodMat);
  addVisualBox(g, 0, 0.47, 0, 1.82, 0.045, 0.82, ropeMat);
  ctx.group.add(g);

  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const hx = 1.0 * cos + 0.5 * sin;
  const hz = 1.0 * sin + 0.5 * cos;
  ctx.boxes.push({
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
    blocksSight: false,
    topY: 0.5,
  });
  ctx.seats.push({
    id: `river-charpai-${x.toFixed(1)}-${z.toFixed(1)}`,
    label,
    kind: 'charpai',
    x,
    z,
    seatY: 0.5,
    rotY: rotY + Math.PI / 2,
  });
}

function addRiverGhat(
  ctx: MapBuildContext,
  side: 'west' | 'east',
  centerZ: number,
  ghatMat: THREE.Material,
  trimMat: THREE.Material,
  woodMat: THREE.Material,
): void {
  const g = new THREE.Group();
  const dir = side === 'west' ? 1 : -1; // direction toward river center (x = 0)
  const bankX = side === 'west' ? -9.6 : 9.6;

  // 4 wide sandstone ghat steps descending gently toward the river edge (x = ±5.3)
  const stepWidths = [1.2, 1.2, 1.2, 1.2];
  const stepHeights = [0.36, 0.27, 0.18, 0.09];
  for (let i = 0; i < 4; i++) {
    const sx = bankX + dir * (i * 1.12 + 0.55);
    const sh = stepHeights[i];
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepWidths[i], sh, 8.6),
      ghatMat,
    );
    step.position.set(sx, sh * 0.5, centerZ);
    step.receiveShadow = true;
    step.castShadow = true;
    g.add(step);
  }

  // Low stepped stone side parapets flanking the ghat stairs
  for (const dz of [-4.45, 4.45]) {
    addVisualBox(g, bankX + dir * 2.1, 0.42, centerZ + dz, 4.4, 0.68, 0.36, ghatMat);
    // Carved stone ghat lamp pillar (Diya Stambh) near water edge
    const postX = bankX + dir * 4.1;
    addVisualBox(g, postX, 0.92, centerZ + dz, 0.44, 1.65, 0.44, ghatMat);
    addVisualBox(g, postX, 1.82, centerZ + dz, 0.56, 0.16, 0.56, trimMat);
    ctx.circles.push({ x: postX, z: centerZ + dz, radius: 0.32, blocksSight: false });
  }

  // Small riverside sandstone shade Chhatri pavilion on the upper ghat terrace
  const chhatriX = bankX - dir * 0.5;
  const chhatriZ = centerZ - 3.6;
  for (const px of [-0.95, 0.95]) {
    for (const pz of [-0.95, 0.95]) {
      addVisualBox(g, chhatriX + px, 1.38, chhatriZ + pz, 0.22, 2.35, 0.22, ghatMat);
    }
  }
  const dome = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.15, 6), trimMat);
  dome.position.set(chhatriX, 3.05, chhatriZ);
  dome.castShadow = true;
  g.add(dome);

  // Sittable riverside stone ghat bench
  const benchX = bankX - dir * 0.35;
  const benchZ = centerZ + 2.55;
  addVisualBox(g, benchX, 0.28, benchZ, 0.68, 0.48, 2.1, ghatMat);
  addVisualBox(g, benchX, 0.54, benchZ, 0.72, 0.08, 2.16, woodMat);
  ctx.seats.push({
    id: `ghat-bench-${side}`,
    label: side === 'west' ? 'West River Ghat Bench' : 'East River Ghat Bench',
    kind: 'bench',
    x: benchX,
    z: benchZ,
    seatY: 0.56,
    rotY: side === 'west' ? Math.PI / 2 : -Math.PI / 2,
  });

  ctx.group.add(g);
  ctx.hidingSpots.push({
    x: chhatriX - dir * 0.4,
    z: chhatriZ,
    label: side === 'west' ? 'Under West Ghat Chhatri' : 'Under East Ghat Chhatri',
    kind: 'well',
  });
  ctx.landmarks.push({ x: bankX + dir * 1.5, z: centerZ, radius: 4.2, kind: 'well' });
}

function addRiversideHandPump(
  ctx: MapBuildContext,
  x: number,
  z: number,
  stoneMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2a6955,
    roughness: 0.52,
    metalness: 0.42,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3b8ea6,
    roughness: 0.16,
    transparent: true,
    opacity: 0.85,
  });
  addVisualBox(g, 0, 0.08, 0, 2.1, 0.16, 1.9, stoneMat);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), waterMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0.45, 0.17, 0);
  g.add(puddle);

  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.15, 8), ironMat);
  col.position.set(-0.2, 0.68, 0);
  col.castShadow = true;
  g.add(col);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.38, 6), ironMat);
  spout.rotation.z = -Math.PI / 2.4;
  spout.position.set(0.04, 0.94, 0);
  g.add(spout);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.82, 6), ironMat);
  lever.rotation.z = Math.PI / 2.7;
  lever.position.set(-0.52, 1.08, 0);
  g.add(lever);

  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 0.95, blocksSight: false });
  ctx.hidingSpots.push({ x: x + 1.35, z: z + 0.4, label, kind: 'pump' });
}

function addVillageHaystack(
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
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18 * scale, 1.44 * scale, 1.1 * scale, 10),
    thatchMat,
  );
  base.position.y = 0.55 * scale;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.32 * scale, 1.48 * scale, 10),
    thatchMat,
  );
  top.position.y = 1.78 * scale;
  top.castShadow = true;
  g.add(top);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 2.85 * scale, 6),
    woodMat,
  );
  pole.position.y = 1.42 * scale;
  g.add(pole);
  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 1.44 * scale, blocksSight: true });
  ctx.hidingSpots.push({ x: x + 1.9 * scale, z: z + 0.35, label, kind: 'gully' });
}

/**
 * Builds a traditional 1990s riverside village courtyard house with:
 * - Walled front courtyard (Aangan) & open gateway
 * - Upper wooden balcony (Baramda) facing the river village lane
 * - Pass-through East & West doorways + accessible interior (fade-out roof)
 * - Optional climbable stone staircase leading up to a flat rooftop terrace with parapet hiding cover!
 */
interface CourtyardHouseSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  facingDir: 1 | -1; // +1 = front courtyard faces East (toward river), -1 = faces West
  wallMat: THREE.Material;
  roofMat: THREE.Material;
  woodMat: THREE.Material;
  ropeMat: THREE.Material;
  stoneMat: THREE.Material;
  hasRooftopStairs: boolean;
}

function buildRiversideCourtyardHouse(
  ctx: MapBuildContext,
  spec: CourtyardHouseSpec,
): void {
  const g = new THREE.Group();
  const { x, z, facingDir } = spec;
  const w = 8.4;
  const d = 10.6;
  const wallH = 3.25;
  const wallT = 0.34;
  const halfW = w * 0.5;
  const halfD = d * 0.5;
  const doorW = 2.15;
  const doorH = 2.25;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xb69d78,
    roughness: 0.93,
  });
  const clayMat = new THREE.MeshStandardMaterial({
    color: 0xb45e3a,
    roughness: 0.85,
  });

  // Raised lipai floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.14, d + 0.2), floorMat);
  floor.position.set(x, 0.07, z);
  floor.receiveShadow = true;
  g.add(floor);

  // North & South solid walls
  addSolidBox(ctx, x, z - halfD + wallT * 0.5, w, wallH, wallT, spec.wallMat, true, 0);
  addSolidBox(ctx, x, z + halfD - wallT * 0.5, w, wallH, wallT, spec.wallMat, true, 0);

  // East & West walls both have pass-through doorways!
  const segD = (d - doorW) * 0.5;
  for (const wx of [x - halfW + wallT * 0.5, x + halfW - wallT * 0.5]) {
    addSolidBox(ctx, wx, z - halfD + segD * 0.5, wallT, wallH, segD, spec.wallMat, true, 0);
    addSolidBox(ctx, wx, z + halfD - segD * 0.5, wallT, wallH, segD, spec.wallMat, true, 0);
    addVisualBox(g, wx, doorH + (wallH - doorH) * 0.5, z, wallT + 0.02, wallH - doorH, doorW + 0.12, spec.wallMat);
    addVisualBox(g, wx, doorH + 0.06, z, wallT + 0.08, 0.12, doorW + 0.2, spec.woodMat);
  }

  // Interior partition niche & village furnishings (clay grain kothi + matkas)
  addSolidBox(ctx, x, z - 2.6, 3.2, wallH - 0.2, 0.24, spec.wallMat, true, 0);
  const kothi = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.48, 10), floorMat);
  kothi.position.set(x - facingDir * 2.5, 0.82, z - 3.6);
  kothi.castShadow = true;
  g.add(kothi);
  ctx.circles.push({ x: x - facingDir * 2.5, z: z - 3.6, radius: 0.78, blocksSight: true });

  for (const dz of [3.2, 4.0]) {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), clayMat);
    pot.position.set(x - facingDir * 2.8, 0.36, z + dz);
    g.add(pot);
  }

  // Front Courtyard (Aangan) facing the river village lane
  const yardX = x + facingDir * (halfW + 2.4);
  const yardFloor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, d + 0.4), floorMat);
  yardFloor.rotation.x = -Math.PI / 2;
  yardFloor.position.set(yardX, 0.024, z);
  yardFloor.receiveShadow = true;
  g.add(yardFloor);

  // Low courtyard compound walls with wide open front gate
  const frontGateX = x + facingDir * (halfW + 4.65);
  addSolidBox(ctx, frontGateX, z - 3.4, 0.28, 0.95, 3.8, spec.wallMat, false, 0);
  addSolidBox(ctx, frontGateX, z + 3.4, 0.28, 0.95, 3.8, spec.wallMat, false, 0);
  addSolidBox(ctx, yardX, z - halfD, 4.7, 0.95, 0.28, spec.wallMat, false, 0);
  addSolidBox(ctx, yardX, z + halfD, 4.7, 0.95, 0.28, spec.wallMat, false, 0);

  // Sittable Charpai inside the courtyard
  addVillageCharpai(
    ctx,
    yardX,
    z + 2.8,
    Math.PI / 2,
    spec.woodMat,
    spec.ropeMat,
    `${spec.label} Courtyard Charpai`,
  );

  // Upper Wooden Balcony overlooking the courtyard & river village
  const balcX = x + facingDir * (halfW + 0.9);
  for (const pz of [-halfD + 0.5, -1.8, 1.8, halfD - 0.5]) {
    addVisualBox(g, x + facingDir * (halfW + 1.65), wallH * 0.5, z + pz, 0.2, wallH, 0.2, spec.woodMat);
    ctx.circles.push({ x: x + facingDir * (halfW + 1.65), z: z + pz, radius: 0.18, blocksSight: false });
  }

  // Roof terrace & balcony slab (registered in houseInteriors so roof fades cleanly when inside!)
  const roofMeshes: THREE.Mesh[] = [];
  const roofClone = spec.roofMat.clone();
  roofClone.transparent = true;
  roofClone.opacity = 1;

  const mainRoof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 2.0, 0.26, d + 0.6),
    roofClone,
  );
  mainRoof.position.set(x + facingDir * 0.85, wallH + 0.13, z);
  mainRoof.castShadow = true;
  mainRoof.receiveShadow = true;
  g.add(mainRoof);
  roofMeshes.push(mainRoof);

  // Wooden balcony railing & roof parapet walls (provide rooftop crouch cover!)
  const railX = x + facingDir * (halfW + 1.78);
  const balcRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, d + 0.2), spec.woodMat);
  balcRail.position.set(railX, wallH + 0.72, z);
  g.add(balcRail);
  roofMeshes.push(balcRail);

  const backParapet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, d + 0.4), spec.wallMat);
  backParapet.position.set(x - facingDir * (halfW - 0.1), wallH + 0.7, z);
  g.add(backParapet);
  roofMeshes.push(backParapet);

  const sideParapetN = new THREE.Mesh(new THREE.BoxGeometry(w + 1.8, 0.88, 0.24), spec.wallMat);
  sideParapetN.position.set(x + facingDir * 0.85, wallH + 0.7, z - halfD);
  g.add(sideParapetN);
  roofMeshes.push(sideParapetN);

  const sideParapetS = new THREE.Mesh(new THREE.BoxGeometry(w + 1.8, 0.88, 0.24), spec.wallMat);
  sideParapetS.position.set(x + facingDir * 0.85, wallH + 0.7, z + halfD);
  g.add(sideParapetS);
  roofMeshes.push(sideParapetS);

  // Optional Climbable Exterior Stone Staircase leading up onto the Rooftop Terrace!
  if (spec.hasRooftopStairs) {
    // Walkable rooftop slab collider (minY = wallH - 0.1 so players underneath walk freely inside!)
    ctx.boxes.push({
      minX: Math.min(x - halfW, balcX - 0.8),
      maxX: Math.max(x + halfW, balcX + 0.9),
      minZ: z - halfD,
      maxZ: z + halfD,
      blocksSight: false,
      minY: wallH - 0.15,
      topY: wallH + 0.28,
      climbable: true,
    });

    const stairZ = z - halfD - 0.85;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const sh = ((i + 1) / steps) * (wallH + 0.24);
      const sx = x + facingDir * (halfW - 0.5 - i * 0.9);
      addSolidBox(ctx, sx, stairZ, 0.95, sh, 1.35, spec.stoneMat, false, 0, {
        topY: sh,
        climbable: true,
      });
    }
    ctx.hidingSpots.push({
      x: x,
      z: z + 2.8,
      label: `${spec.label} Rooftop Parapet`,
      kind: 'house',
    });
  }

  ctx.group.add(g);

  ctx.houseInteriors.push({
    id: spec.id,
    label: spec.label,
    minX: x - halfW - 0.3,
    maxX: x + halfW + 0.3,
    minZ: z - halfD - 0.3,
    maxZ: z + halfD + 0.3,
    maxY: wallH - 0.1,
    doorX: x + facingDir * (halfW + 0.9),
    doorZ: z,
    insideX: x,
    insideZ: z,
    roofMeshes,
  });

  ctx.buildings.push({
    x,
    z,
    width: w,
    depth: d,
    rotY: 0,
    kind: 'house',
  });

  ctx.hidingSpots.push(
    {
      x: x - facingDir * 2.2,
      z: z - 1.0,
      label: `Inside ${spec.label}`,
      kind: 'house',
    },
    {
      x: yardX,
      z: z - 3.2,
      label: `${spec.label} Courtyard Corner`,
      kind: 'wall',
    },
  );
}

function addOpenVillageShed(
  ctx: MapBuildContext,
  x: number,
  z: number,
  wallMat: THREE.Material,
  thatchMat: THREE.Material,
  woodMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const w = 7.2;
  const d = 5.4;
  // Back & one side wall (open front & side so players run freely through!)
  addSolidBox(ctx, x, z - d * 0.5, w, 2.7, 0.3, wallMat, true, 0);
  addSolidBox(ctx, x - w * 0.5, z, 0.3, 2.7, d, wallMat, true, 0);
  // Corner wooden roof posts
  for (const [px, pz] of [
    [w * 0.5 - 0.15, -d * 0.5 + 0.15],
    [w * 0.5 - 0.15, d * 0.5 - 0.15],
    [-w * 0.5 + 0.15, d * 0.5 - 0.15],
  ]) {
    addVisualBox(g, px, 1.38, pz, 0.2, 2.75, 0.2, woodMat);
    ctx.circles.push({ x: x + px, z: z + pz, radius: 0.2, blocksSight: false });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.2, d + 1.0), thatchMat);
  roof.position.set(0, 2.95, 0);
  roof.rotation.z = 0.08;
  roof.castShadow = true;
  g.add(roof);

  // Burlap storage sacks inside shed for cover
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xb69764, roughness: 0.95 });
  addSolidBox(ctx, x - 2.1, z - 1.3, 1.5, 0.96, 1.4, sackMat, true, 0);
  ctx.group.add(g);
  ctx.buildings.push({ x, z, width: w, depth: d, rotY: 0, kind: 'shed' });
  ctx.hidingSpots.push({ x: x - 1.6, z: z + 0.6, label, kind: 'house' });
}

// ---------------------------------------------------------------------------
// Main Level 7 Builder: Additively Upgraded 1990s Indian River Village
// ---------------------------------------------------------------------------
export function buildRiverVillageMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  const rTex = createRiverVillageTextures();
  const rand = seededRand(199507);

  // -------------------------------------------------------------------------
  // 1. Lush Riverside Ground, Wide Safe Sandy Riverbanks & Shimmering River
  // -------------------------------------------------------------------------
  const groundMat = new THREE.MeshStandardMaterial({
    map: rTex.ground,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.038,
    roughness: 0.96,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(148, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ctx.group.add(ground);

  // Widened safe walking sandy riverbanks along West & East banks (x = ±5.2 .. ±11.2)
  const sandMat = new THREE.MeshStandardMaterial({
    map: rTex.sandBank,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.028,
    roughness: 0.94,
  });
  const westBank = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 128), sandMat);
  westBank.rotation.x = -Math.PI / 2;
  westBank.position.set(-8.2, 0.015, 0);
  westBank.receiveShadow = true;
  ctx.group.add(westBank);

  const eastBank = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 128), sandMat);
  eastBank.rotation.x = -Math.PI / 2;
  eastBank.position.set(8.2, 0.015, 0);
  eastBank.receiveShadow = true;
  ctx.group.add(eastBank);

  // Shimmering Realistic River Water slicing North-South (preserves animated river!)
  const riverMat = new THREE.MeshStandardMaterial({
    map: rTex.riverRipples,
    color: 0x3592b0,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.11,
    metalness: 0.22,
    transparent: true,
    opacity: 0.9,
  });
  const riverWater = new THREE.Mesh(new THREE.PlaneGeometry(10.8, 140), riverMat);
  riverWater.rotation.x = -Math.PI / 2;
  riverWater.position.set(0, 0.032, 0);
  riverWater.userData.isAnimatedWater = true;
  ctx.group.add(riverWater);
  ctx.pondWater = riverWater;
  ctx.waterRects.push({ x: 0, z: 0, width: 10.8, length: 118, rotY: 0 });

  // Solid water boundary colliders ONLY between the 5 walkable bridges (z = -36, -18, 0, 18, 36)
  const waterBlockSegments: Array<[number, number]> = [
    [-64, -38.4],
    [-33.6, -20.5],
    [-15.5, -2.5],
    [2.5, 15.5],
    [20.5, 33.6],
    [38.4, 64],
  ];
  for (const [zMin, zMax] of waterBlockSegments) {
    ctx.boxes.push({
      minX: -5.1,
      maxX: 5.1,
      minZ: zMin,
      maxZ: zMax,
      blocksSight: false,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Shared Materials
  // -------------------------------------------------------------------------
  const bridgeWoodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8b623c,
    roughness: 0.86,
  });
  const railPostMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x5c3c22,
    roughness: 0.9,
  });
  const ghatStoneMat = new THREE.MeshStandardMaterial({
    map: rTex.ghatStone,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    roughness: 0.91,
  });
  const houseWallMat = new THREE.MeshStandardMaterial({
    map: rTex.houseWall,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.03,
    roughness: 0.92,
  });
  const houseWallOchreMat = new THREE.MeshStandardMaterial({
    map: rTex.houseWallOchre,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.03,
    roughness: 0.92,
  });
  const terraceRoofMat = new THREE.MeshStandardMaterial({
    map: rTex.terraceRoof,
    roughness: 0.91,
  });
  const thatchMat = new THREE.MeshStandardMaterial({
    map: rTex.thatch,
    roughness: 0.95,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xd4b678,
    roughness: 0.94,
  });
  const stonePathMat = new THREE.MeshStandardMaterial({
    map: rTex.stonePath,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.025,
    roughness: 0.93,
  });

  // -------------------------------------------------------------------------
  // 3. Wooden Bridges (3 Existing Wide Bridges + 2 New Outer Footbridges)
  // -------------------------------------------------------------------------
  const bridgeSpecs: Array<{ z: number; width: number }> = [
    { z: -36, width: 3.8 }, // New North Footbridge
    { z: -18, width: 4.8 }, // Existing North Bridge
    { z: 0, width: 4.8 },   // Existing Center Bridge
    { z: 18, width: 4.8 },  // Existing South Bridge
    { z: 36, width: 3.8 },  // New South Footbridge
  ];
  for (const { z: bz, width: bw } of bridgeSpecs) {
    const bridge = new THREE.Group();
    bridge.position.set(0, 0, bz);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(13.4, 0.15, bw),
      bridgeWoodMat,
    );
    deck.position.y = 0.075;
    deck.receiveShadow = true;
    deck.castShadow = true;
    bridge.add(deck);

    // Side wooden railings & vertical timber posts
    const rzOff = bw * 0.5 - 0.16;
    for (const rz of [-rzOff, rzOff]) {
      addVisualBox(bridge, 0, 0.96, rz, 12.8, 0.11, 0.11, railPostMat);
      addVisualBox(bridge, 0, 0.52, rz, 12.8, 0.08, 0.08, bridgeWoodMat);
      for (let px = -5.8; px <= 5.8; px += 2.9) {
        addVisualBox(bridge, px, 0.5, rz, 0.16, 1.02, 0.16, railPostMat);
      }
    }
    ctx.group.add(bridge);
    ctx.buildings.push({ x: 0, z: bz, width: 13.4, depth: bw, rotY: 0, kind: 'bridge' });
    ctx.roads.push({ x: 0, z: bz, width: bw, length: 58, rotY: Math.PI / 2 });
  }

  // -------------------------------------------------------------------------
  // 4. Existing Village Paths + New Stone Paths & Narrow Connecting Lanes
  // -------------------------------------------------------------------------
  addRoadSegment(ctx, -12.5, 0, 3.8, 86, 0, textures, 0xcab082);
  addRoadSegment(ctx, 12.5, 0, 3.8, 86, 0, textures, 0xcab082);
  addRoadSegment(ctx, -26.5, 0, 3.2, 78, 0, textures, 0xc2a87b);
  addRoadSegment(ctx, 26.5, 0, 3.2, 78, 0, textures, 0xc2a87b);

  // Additive stone flagstone paths & outer village lanes
  const addStoneLane = (x: number, z: number, width: number, length: number, rotY = 0) => {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), stonePathMat);
    lane.rotation.x = -Math.PI / 2;
    lane.rotation.z = rotY;
    lane.position.set(x, 0.022, z);
    lane.receiveShadow = true;
    ctx.group.add(lane);
    ctx.roads.push({ x, z, width, length, rotY });
  };
  addStoneLane(0, -36, 3.2, 86, Math.PI / 2);
  addStoneLane(0, 36, 3.2, 86, Math.PI / 2);
  addStoneLane(-45.5, 0, 2.8, 66, 0);
  addStoneLane(45.5, 0, 2.8, 66, 0);
  addStoneLane(-34, 0, 2.8, 22, Math.PI / 2);
  addStoneLane(34, 0, 2.8, 22, Math.PI / 2);

  // -------------------------------------------------------------------------
  // 5. NEW Village Ghats with Sandstone Steps Leading Down to the River!
  // -------------------------------------------------------------------------
  const terracottaTrimMat = new THREE.MeshStandardMaterial({
    color: 0xa44b32,
    roughness: 0.85,
  });
  addRiverGhat(ctx, 'west', -7.0, ghatStoneMat, terracottaTrimMat, bridgeWoodMat);
  addRiverGhat(ctx, 'east', 7.0, ghatStoneMat, terracottaTrimMat, bridgeWoodMat);

  // -------------------------------------------------------------------------
  // 6. Preserved Moored Boats & Beached Climbable Wooden Rowboats
  // -------------------------------------------------------------------------
  const boatHullMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x6b4528,
    roughness: 0.85,
  });
  const boatTrimMat = new THREE.MeshStandardMaterial({
    color: 0xc94a2b,
    roughness: 0.78,
  });
  const boatSpecs: Array<[number, number, number]> = [
    [-4.3, -9.0, 0.12],
    [4.3, -8.2, -0.15],
    [-4.2, 8.8, -0.08],
    [4.2, 9.5, 0.14],
    [-4.1, 24.5, 0.2],
    [4.1, -26.5, -0.18],
  ];
  for (const [bx, bz, rot] of boatSpecs) {
    const boat = new THREE.Group();
    boat.position.set(bx, 0.08, bz);
    boat.rotation.y = rot;
    addVisualBox(boat, 0, 0.22, 0, 1.35, 0.44, 3.8, boatHullMat);
    addVisualBox(boat, 0, 0.46, 0, 1.42, 0.1, 3.9, boatTrimMat);
    addVisualBox(boat, 0, 0.4, -0.75, 1.2, 0.08, 0.35, bridgeWoodMat);
    addVisualBox(boat, 0, 0.4, 0.75, 1.2, 0.08, 0.35, bridgeWoodMat);
    ctx.group.add(boat);
    ctx.hidingSpots.push({
      x: bx + (bx < 0 ? -2.8 : 2.8),
      z: bz,
      label: 'Near Moored Wooden Rowboat',
      kind: 'vehicle',
    });
  }

  const beachedBoats: Array<[number, number, number]> = [
    [-7.1, -16.5, 0.25],
    [7.1, 16.5, -0.25],
  ];
  for (const [bx, bz, rot] of beachedBoats) {
    const boat = new THREE.Group();
    boat.position.set(bx, 0.14, bz);
    boat.rotation.y = rot;
    addVisualBox(boat, 0, 0.34, 0, 1.45, 0.68, 3.6, boatHullMat);
    addVisualBox(boat, 0, 0.72, 0, 1.52, 0.12, 3.7, boatTrimMat);
    addVisualBox(boat, 0, 0.58, -0.7, 1.25, 0.1, 0.36, bridgeWoodMat);
    addVisualBox(boat, 0, 0.58, 0.7, 1.25, 0.1, 0.36, bridgeWoodMat);
    ctx.group.add(boat);
    ctx.boxes.push({
      minX: bx - 0.85,
      maxX: bx + 0.85,
      minZ: bz - 1.9,
      maxZ: bz + 1.9,
      blocksSight: true,
      topY: 0.78,
      climbable: true,
    });
    ctx.hidingSpots.push({
      x: bx + (bx < 0 ? -1.35 : 1.35),
      z: bz,
      label: 'Behind a Beached Wooden Boat',
      kind: 'vehicle',
    });
  }

  // -------------------------------------------------------------------------
  // 7. Preserved 6 Riverside Thatch Huts + NEW 4 Courtyard Houses (Balconies & Rooftops!) + 2 Sheds
  // -------------------------------------------------------------------------
  const hutFloorMat = new THREE.MeshStandardMaterial({
    color: 0x9b825e,
    roughness: 0.94,
  });
  const huts: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    door: 'east' | 'west' | 'south' | 'north';
    ochre: boolean;
  }> = [
    { id: 'hut-w1', label: 'Fisherman West Hut', x: -19.5, z: -10.5, door: 'east', ochre: false },
    { id: 'hut-w2', label: 'Boatman Shed', x: -19.5, z: 9.5, door: 'east', ochre: true },
    { id: 'hut-w3', label: 'South Ghat Hut', x: -19.5, z: 24.5, door: 'north', ochre: false },
    { id: 'hut-e1', label: 'East Ferryman Hut', x: 19.5, z: -10.5, door: 'west', ochre: true },
    { id: 'hut-e2', label: 'Net Weaver Hut', x: 19.5, z: 9.5, door: 'west', ochre: false },
    { id: 'hut-e3', label: 'North Riverbank Hut', x: 19.5, z: -24.5, door: 'south', ochre: true },
  ];
  for (const h of huts) {
    buildEnterableRoom(ctx, {
      id: h.id,
      label: h.label,
      x: h.x,
      z: h.z,
      width: 6.2,
      depth: 5.2,
      height: 2.85,
      doorSide: h.door,
      doorWidth: 2.05,
      wallMaterial: h.ochre ? houseWallOchreMat : houseWallMat,
      floorMaterial: hutFloorMat,
      roofStyle: 'thatch',
      roofColor: 0xd9bb7c,
      trimColor: 0x2f6b64,
      textures,
      minimapKind: 'hut',
    });
  }

  // NEW 4 Traditional Courtyard Houses with Balconies, Accessible Interiors & Climbable Rooftops!
  buildRiversideCourtyardHouse(ctx, {
    id: 'river-house-nw',
    label: 'West Courtyard House',
    x: -37.5,
    z: -12.5,
    facingDir: 1,
    wallMat: houseWallMat,
    roofMat: terraceRoofMat,
    woodMat: bridgeWoodMat,
    ropeMat,
    stoneMat: ghatStoneMat,
    hasRooftopStairs: true,
  });
  buildRiversideCourtyardHouse(ctx, {
    id: 'river-house-sw',
    label: 'West Riverfront Home',
    x: -37.5,
    z: 12.5,
    facingDir: 1,
    wallMat: houseWallOchreMat,
    roofMat: terraceRoofMat,
    woodMat: bridgeWoodMat,
    ropeMat,
    stoneMat: ghatStoneMat,
    hasRooftopStairs: false,
  });
  buildRiversideCourtyardHouse(ctx, {
    id: 'river-house-ne',
    label: 'East Courtyard House',
    x: 37.5,
    z: -12.5,
    facingDir: -1,
    wallMat: houseWallOchreMat,
    roofMat: terraceRoofMat,
    woodMat: bridgeWoodMat,
    ropeMat,
    stoneMat: ghatStoneMat,
    hasRooftopStairs: true,
  });
  buildRiversideCourtyardHouse(ctx, {
    id: 'river-house-se',
    label: 'East Riverfront Home',
    x: 37.5,
    z: 12.5,
    facingDir: -1,
    wallMat: houseWallMat,
    roofMat: terraceRoofMat,
    woodMat: bridgeWoodMat,
    ropeMat,
    stoneMat: ghatStoneMat,
    hasRooftopStairs: false,
  });

  // NEW 2 Open Village Storage & Boat-Repair Sheds
  addOpenVillageShed(
    ctx,
    -36.5,
    -29.5,
    houseWallMat,
    thatchMat,
    railPostMat,
    'Inside West Boat-Repair Shed',
  );
  addOpenVillageShed(
    ctx,
    36.5,
    29.5,
    houseWallOchreMat,
    thatchMat,
    railPostMat,
    'Inside East Grain Shed',
  );

  // -------------------------------------------------------------------------
  // 8. NEW Small Riverside Farms, Extra Well, Hand Pumps, Chaupal & Haystacks
  // -------------------------------------------------------------------------
  const farmBedMat = new THREE.MeshStandardMaterial({
    map: rTex.farmSoil,
    roughness: 0.96,
  });
  const addSmallFarmPlot = (fx: number, fz: number, fw: number, fd: number) => {
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), farmBedMat);
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(fx, 0.02, fz);
    plot.receiveShadow = true;
    ctx.group.add(plot);
    ctx.landmarks.push({ x: fx, z: fz, radius: Math.max(fw, fd) * 0.45, kind: 'farm' });
  };
  addSmallFarmPlot(-34.5, 29.0, 12.0, 9.6);
  addSmallFarmPlot(34.5, -29.0, 12.0, 9.6);

  // Instanced green crop rows inside both small village farms (1 draw call!)
  const cropRows: Array<[number, number]> = [];
  for (const [fx, fz] of [
    [-34.5, 29.0],
    [34.5, -29.0],
  ]) {
    for (let dx = -4.6; dx <= 4.6; dx += 1.55) {
      for (let dz = -3.6; dz <= 3.6; dz += 1.45) {
        cropRows.push([fx + dx, fz + dz]);
      }
    }
  }
  const cropGeo = new THREE.ConeGeometry(0.32, 0.85, 5);
  const cropMat = new THREE.MeshStandardMaterial({ color: 0x5c9638, roughness: 0.9 });
  const cropInst = new THREE.InstancedMesh(cropGeo, cropMat, cropRows.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < cropRows.length; i++) {
    dummy.position.set(cropRows[i][0], 0.42, cropRows[i][1]);
    dummy.rotation.set(0, i * 0.5, 0);
    dummy.scale.set(1, 0.85 + (i % 3) * 0.14, 1);
    dummy.updateMatrix();
    cropInst.setMatrixAt(i, dummy.matrix);
  }
  cropInst.instanceMatrix.needsUpdate = true;
  cropInst.computeBoundingSphere();
  ctx.group.add(cropInst);

  // Preserved West Bank Well + NEW East Bank Well + 2 Cast-Iron Hand Pumps + 6 Golden Haystacks
  addStoneWell(ctx, -26.5, -25.5, textures, 'Behind West Bank Well');
  addStoneWell(ctx, 26.5, 25.5, textures, 'Behind East Bank Well');
  addRiversideHandPump(ctx, -23.5, 3.5, ghatStoneMat, 'Beside West Village Hand Pump');
  addRiversideHandPump(ctx, 23.5, -3.5, ghatStoneMat, 'Beside East Village Hand Pump');

  // Old Village Chaupal (brick shade platform + sittable charpai) at South-East riverbank
  const chaupal = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.0, 0.34, 12),
    ghatStoneMat,
  );
  chaupal.position.set(18.5, 0.17, 29.0);
  chaupal.receiveShadow = true;
  ctx.group.add(chaupal);
  addVillageCharpai(ctx, 18.5, 26.2, 0, bridgeWoodMat, ropeMat, 'Chaupal Shade Charpai');

  // 6 Conical Golden Indian Haystacks for rich crouch cover
  const haystacks: Array<[number, number, number, string]> = [
    [-26.5, 31.5, 1.0, 'West Farm Haystack'],
    [-41.5, 24.5, 0.95, 'Outer West Haystack'],
    [26.5, -31.5, 1.0, 'East Farm Haystack'],
    [41.5, -24.5, 0.95, 'Outer East Haystack'],
    [-21.5, -31.5, 0.9, 'North-West Bank Haystack'],
    [21.5, 31.5, 0.92, 'South-East Bank Haystack'],
  ];
  for (const [hx, hz, hs, hLabel] of haystacks) {
    addVillageHaystack(ctx, hx, hz, hs, thatchMat, railPostMat, hLabel);
  }

  // Preserved Fishing & Supply Crates
  addCrateStack(ctx, -14.5, -14.5, textures, 'Behind Fishing Basket Crates');
  addCrateStack(ctx, 14.5, 14.5, textures, 'Behind Boatman Supply Crates');

  // -------------------------------------------------------------------------
  // 9. Preserved Tall Swaying River Grass + NEW Bamboo Groves & Instanced Foliage
  // -------------------------------------------------------------------------
  const grassBladeMat1 = new THREE.MeshStandardMaterial({ color: 0x5c8c38, roughness: 0.88 });
  const grassBladeMat2 = new THREE.MeshStandardMaterial({ color: 0x769f42, roughness: 0.9 });
  const grassPatches: Array<[number, number, number]> = [
    [-9.8, -24.5, 3.2],
    [-11.0, -3.5, 2.8],
    [-9.8, 13.5, 3.0],
    [-28.5, -18.0, 3.6],
    [-29.0, 4.5, 3.4],
    [9.8, -14.0, 3.0],
    [10.2, 4.5, 3.0],
    [10.0, 23.5, 3.4],
    [28.5, -4.5, 3.6],
    [28.0, 17.5, 3.5],
  ];
  for (const [gx, gz, rad] of grassPatches) {
    const patch = new THREE.Group();
    patch.position.set(gx, 0, gz);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.25;
      const dist = (((i * 37) % 100) / 100) * (rad * 0.8);
      const bladeH = 1.25 + (i % 4) * 0.22;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, bladeH, 5),
        i % 2 === 0 ? grassBladeMat1 : grassBladeMat2,
      );
      tuft.position.set(Math.cos(a) * dist, bladeH * 0.5, Math.sin(a) * dist);
      tuft.rotation.z = ((i % 5) - 2) * 0.08;
      patch.add(tuft);
    }
    ctx.group.add(patch);
    ctx.swayFoliage.push(patch);
    ctx.landmarks.push({ x: gx, z: gz, radius: rad, kind: 'grass' });
    ctx.hidingSpots.push({ x: gx, z: gz, label: 'Hidden in Tall River Grass', kind: 'tree' });
  }

  // NEW Lush Indian Riverside Bamboo Groves (Baans Ki Jhadi — 2 InstancedMeshes!)
  const bambooGroveCenters: Array<[number, number, string]> = [
    [-16.5, -31.5, 'North-West Bamboo Grove'],
    [16.5, -31.5, 'North-East Bamboo Grove'],
    [-16.5, 31.5, 'South-West Bamboo Grove'],
    [15.5, 42.5, 'Far South Bamboo Grove'],
    [-42.5, 0.0, 'West Lane Bamboo Grove'],
    [42.5, 0.0, 'East Lane Bamboo Grove'],
    [-15.5, -42.5, 'Far North Bamboo Grove'],
  ];
  const stalksPerGrove = 22;
  const totalStalks = bambooGroveCenters.length * stalksPerGrove;
  const bambooCulmGeo = new THREE.CylinderGeometry(0.065, 0.085, 5.4, 6);
  const bambooCulmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
  const bambooLeafGeo = new THREE.DodecahedronGeometry(0.95, 1);
  const bambooLeafMat = new THREE.MeshStandardMaterial({ color: 0x4b8a36, roughness: 0.88 });
  const bambooCulmInst = new THREE.InstancedMesh(bambooCulmGeo, bambooCulmMat, totalStalks);
  const bambooLeafInst = new THREE.InstancedMesh(bambooLeafGeo, bambooLeafMat, totalStalks);
  bambooCulmInst.castShadow = true;
  bambooLeafInst.castShadow = false;

  const colTmp = new THREE.Color();
  const bambooTones = [0x6f9a3e, 0x7ea644, 0x5c8934, 0x8fb04c];
  let bIdx = 0;

  for (const [bx, bz, bLabel] of bambooGroveCenters) {
    for (let s = 0; s < stalksPerGrove; s++) {
      const ang = (s / stalksPerGrove) * Math.PI * 2 + rand() * 0.4;
      const rad = 0.4 + rand() * 2.1;
      const sx = bx + Math.cos(ang) * rad;
      const sz = bz + Math.sin(ang) * rad;
      const hScale = 0.75 + rand() * 0.48;
      const leanX = (rand() - 0.5) * 0.14;
      const leanZ = (rand() - 0.5) * 0.14;

      dummy.position.set(sx, 2.65 * hScale, sz);
      dummy.rotation.set(leanX, ang, leanZ);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();
      bambooCulmInst.setMatrixAt(bIdx, dummy.matrix);
      colTmp.setHex(bambooTones[bIdx % bambooTones.length]);
      bambooCulmInst.setColorAt(bIdx, colTmp);

      dummy.position.set(
        sx + Math.sin(leanZ) * 1.4,
        4.6 * hScale,
        sz + Math.sin(leanX) * 1.4,
      );
      dummy.scale.set(1.1, 0.65, 1.1);
      dummy.updateMatrix();
      bambooLeafInst.setMatrixAt(bIdx, dummy.matrix);
      bIdx++;
    }
    ctx.hidingSpots.push({ x: bx, z: bz, label: bLabel, kind: 'tree' });
    ctx.landmarks.push({ x: bx, z: bz, radius: 2.6, kind: 'grass' });
  }
  bambooCulmInst.instanceMatrix.needsUpdate = true;
  if (bambooCulmInst.instanceColor) bambooCulmInst.instanceColor.needsUpdate = true;
  bambooLeafInst.instanceMatrix.needsUpdate = true;
  bambooCulmInst.computeBoundingSphere();
  bambooLeafInst.computeBoundingSphere();
  ctx.group.add(bambooCulmInst, bambooLeafInst);

  // Preserved 8 Riverside Trees
  const riverTrees: Array<[number, number]> = [
    [-16.5, -24.5],
    [-28.0, -6.5],
    [-28.5, 16.5],
    [16.5, 24.5],
    [28.5, -16.5],
    [29.5, 6.5],
    [-13.5, 29.0],
    [13.5, -29.0],
  ];
  for (const [tx, tz] of riverTrees) {
    addTree(ctx, tx, tz, 1.16, textures, 0x417c38, false, true, 'Behind a Riverbank Tree');
  }

  // Instanced Outer Village & Riverbank Horizon Trees (Android-optimized!)
  const extraTrees: Array<{ x: number; z: number; s: number; playable: boolean }> = [
    { x: 18.5, z: 29.0, s: 1.32, playable: true }, // Chaupal banyan shade tree
    { x: -32.0, z: -20.5, s: 1.1, playable: true },
    { x: 32.0, z: 20.5, s: 1.12, playable: true },
    { x: -46.5, z: -22.0, s: 1.15, playable: true },
    { x: -46.5, z: 22.0, s: 1.1, playable: true },
    { x: 46.5, z: -22.0, s: 1.12, playable: true },
    { x: 46.5, z: 22.0, s: 1.14, playable: true },
    { x: -24.0, z: 42.5, s: 1.15, playable: true },
    { x: 24.0, z: -42.5, s: 1.15, playable: true },
  ];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const rad = 57.5 + rand() * 14.0;
    const tx = Math.cos(a) * rad;
    const tz = Math.sin(a) * rad;
    // Keep north/south river channel visually open
    if (Math.abs(tx) < 8.0) continue;
    extraTrees.push({ x: tx, z: tz, s: 0.96 + rand() * 0.45, playable: false });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.23, 0.36, 2.75, 7);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    color: 0x67503a,
    roughness: 0.94,
  });
  const lowerGeo = new THREE.DodecahedronGeometry(2.0, 1);
  const upperGeo = new THREE.DodecahedronGeometry(1.45, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, extraTrees.length);
  const lowerInst = new THREE.InstancedMesh(lowerGeo, leafMat, extraTrees.length);
  const upperInst = new THREE.InstancedMesh(upperGeo, leafMat, extraTrees.length);
  trunkInst.castShadow = true;
  lowerInst.castShadow = true;
  lowerInst.receiveShadow = true;
  upperInst.castShadow = false;
  const greens = [0x336f2b, 0x3f7e32, 0x2c6224, 0x4b8a38];

  for (let i = 0; i < extraTrees.length; i++) {
    const t = extraTrees[i];
    const rot = rand() * Math.PI * 2;
    dummy.position.set(t.x, 1.36 * t.s, t.z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, 3.8 * t.s, t.z);
    dummy.scale.set(t.s * 1.14, t.s * 0.85, t.s * 1.12);
    dummy.updateMatrix();
    lowerInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(greens[i % greens.length]);
    lowerInst.setColorAt(i, colTmp);

    dummy.position.set(t.x + Math.cos(rot) * 0.45 * t.s, 4.9 * t.s, t.z + Math.sin(rot) * 0.45 * t.s);
    dummy.scale.set(t.s * 0.98, t.s * 0.84, t.s * 0.98);
    dummy.updateMatrix();
    upperInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(greens[(i + 1) % greens.length]);
    upperInst.setColorAt(i, colTmp);

    if (t.playable) {
      ctx.circles.push({ x: t.x, z: t.z, radius: 0.42 * t.s, blocksSight: true });
    }
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  lowerInst.instanceMatrix.needsUpdate = true;
  upperInst.instanceMatrix.needsUpdate = true;
  if (lowerInst.instanceColor) lowerInst.instanceColor.needsUpdate = true;
  if (upperInst.instanceColor) upperInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  lowerInst.computeBoundingSphere();
  upperInst.computeBoundingSphere();
  ctx.group.add(trunkInst, lowerInst, upperInst);

  // Wild Riverside Bushes (InstancedMesh, crouch cover!)
  const bushCoords: Array<[number, number]> = [
    [-8.8, -31.0],
    [-8.8, 28.5],
    [8.8, -28.5],
    [8.8, 31.0],
    [-22.5, -18.5],
    [-22.5, 16.5],
    [22.5, -16.5],
    [22.5, 18.5],
    [-42.0, -28.0],
    [42.0, 28.0],
    [-31.5, 42.0],
    [31.5, 42.0],
    [-31.5, -42.0],
    [31.5, -42.0],
  ];
  const bushGeo = new THREE.DodecahedronGeometry(0.84, 1);
  const bushInst = new THREE.InstancedMesh(bushGeo, leafMat, bushCoords.length);
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;
  for (let i = 0; i < bushCoords.length; i++) {
    const [bx, bz] = bushCoords[i];
    dummy.position.set(bx, 0.54, bz);
    dummy.rotation.set(0, i * 0.8, 0);
    dummy.scale.set(1.25, 0.82, 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(greens[i % greens.length]);
    bushInst.setColorAt(i, colTmp);
    if (i % 3 === 0) {
      ctx.hidingSpots.push({ x: bx, z: bz, label: 'Thick Riverbank Bush', kind: 'tree' });
    }
  }
  bushInst.instanceMatrix.needsUpdate = true;
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  bushInst.computeBoundingSphere();
  ctx.group.add(bushInst);

  // -------------------------------------------------------------------------
  // 10. Patrol Points & 10-Player Verified Unobstructed Spawns
  // -------------------------------------------------------------------------
  ctx.patrolPoints.push(
    new THREE.Vector3(-12.5, 0, 7.0),
    new THREE.Vector3(-12.5, 0, -18.0),
    new THREE.Vector3(0, 0, -18.0),
    new THREE.Vector3(12.5, 0, -18.0),
    new THREE.Vector3(12.5, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-12.5, 0, 0),
    new THREE.Vector3(-12.5, 0, 18.0),
    new THREE.Vector3(0, 0, 18.0),
    new THREE.Vector3(12.5, 0, 18.0),
    new THREE.Vector3(0, 0, -36.0),
    new THREE.Vector3(0, 0, 36.0),
    new THREE.Vector3(-26.5, 0, 0),
    new THREE.Vector3(26.5, 0, 0),
    new THREE.Vector3(-26.5, 0, -18.0),
    new THREE.Vector3(26.5, 0, 18.0),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 56.5,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: ctx.pondWater,
    seats: ctx.seats,
    minimapLayout: {
      worldRadius: 56.5,
      groundTint: '#687948',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [-12.5, 0, 7.6],
      previewCamPos: [-11.1, 1.9, 11.6],
      previewLookAt: [-9.0, 1.05, 5.2],
      seeker: [12.5, 0.0, -Math.PI / 2],
      hiders: [
        [-12.5, 7.6, Math.PI],
        [-12.5, -14.0, 0.5],
        [12.5, 14.0, -0.6],
        [12.5, -14.0, 2.5],
        [-12.5, -36.0, 1.2],
        [12.5, -36.0, -1.2],
        [-12.5, 36.0, 2.0],
        [12.5, 36.0, -2.0],
        [-26.5, 0.0, 1.5],
        [26.5, 0.0, -1.5],
      ],
    },
  };
}

import * as THREE from 'three';
import {
  addSolidBox,
  addVisualBox,
  createMapContext,
  MapBuildContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helper for consistent colony foliage & details
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
// Procedural 1990s Indian Railway Colony Canvas Textures
// ---------------------------------------------------------------------------
interface RailwayTextures {
  ground: THREE.CanvasTexture;
  tarmac: THREE.CanvasTexture;
  platform: THREE.CanvasTexture;
  ballast: THREE.CanvasTexture;
  stationWall: THREE.CanvasTexture;
  quarterWall: THREE.CanvasTexture;
  roofConcrete: THREE.CanvasTexture;
  corrugatedSheet: THREE.CanvasTexture;
  stationSign: THREE.CanvasTexture;
  ticketSign: THREE.CanvasTexture;
  waitingSign: THREE.CanvasTexture;
  clockFace: THREE.CanvasTexture;
  gardenLawn: THREE.CanvasTexture;
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

function createRailwayTextures(): RailwayTextures {
  // 1. Dusty colony earth & dry grass verges
  const ground = makeTex(256, 256, 24, 24, (c, w, h) => {
    const rand = seededRand(501);
    c.fillStyle = '#978c6a';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(116, 130, 74, 0.25)' : 'rgba(138, 118, 86, 0.26)';
      c.beginPath();
      c.arc(rand() * w, rand() * h, 10 + rand() * 24, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 300; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(92, 86, 62, 0.28)' : 'rgba(196, 182, 146, 0.24)';
      c.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 2);
    }
  });

  // 2. Weathered 1990s colony tarmac street with whitewashed kerbs
  const tarmac = makeTex(256, 256, 1, 14, (c, w, h) => {
    const rand = seededRand(502);
    c.fillStyle = '#5c5d5f';
    c.fillRect(0, 0, w, h);
    // Whitewashed railway colony road edges
    c.fillStyle = '#d6cfb8';
    c.fillRect(0, 0, 12, h);
    c.fillRect(w - 12, 0, 12, h);
    // Asphalt grit & dusty wheel wear
    for (let i = 0; i < 380; i++) {
      const x = 14 + rand() * (w - 28);
      const y = rand() * h;
      c.fillStyle =
        rand() < 0.5 ? 'rgba(42, 43, 45, 0.35)' : 'rgba(154, 142, 118, 0.24)';
      c.fillRect(x, y, 2 + rand() * 4, 2 + rand() * 4);
    }
    // Subtle center weathered tar patches
    c.fillStyle = 'rgba(176, 162, 134, 0.16)';
    c.fillRect(w * 0.25, 0, 26, h);
    c.fillRect(w * 0.65, 0, 26, h);
  });

  // 3. Classic Indian Railway platform Kota stone paving slabs
  const platform = makeTex(256, 256, 18, 3, (c, w, h) => {
    const rand = seededRand(503);
    c.fillStyle = '#9a968c';
    c.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 4;
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        c.fillStyle =
          rand() < 0.5 ? '#a5a196' : rand() < 0.8 ? '#8f8b81' : '#9d988c';
        c.fillRect(col * cw + 2, r * rh + 2, cw - 4, rh - 4);
      }
    }
    // Iconic yellow safety warning band along track edge
    c.fillStyle = '#e5b82e';
    c.fillRect(0, 0, w, 24);
    c.fillStyle = '#2d2b28';
    c.fillRect(0, 24, w, 4);
  });

  // 4. Crushed grey-brown railway granite track ballast (Gitti)
  const ballast = makeTex(256, 256, 24, 4, (c, w, h) => {
    const rand = seededRand(504);
    c.fillStyle = '#6c665d';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 720; i++) {
      const shade = Math.floor(78 + rand() * 76);
      c.fillStyle = `rgb(${shade + 6}, ${shade}, ${shade - 6})`;
      c.fillRect(rand() * w, rand() * h, 3 + rand() * 5, 3 + rand() * 4);
    }
  });

  // 5. Classic Indian Railways Station cream-yellow plaster + maroon dado band
  const stationWall = makeTex(256, 256, 4, 1, (c, w, h) => {
    const rand = seededRand(505);
    c.fillStyle = '#ebd9a6';
    c.fillRect(0, 0, w, h);
    // Iconic Indian Railways maroon lower dado band
    c.fillStyle = '#7f322c';
    c.fillRect(0, h * 0.72, w, h * 0.28);
    c.fillStyle = '#f5ebd0';
    c.fillRect(0, h * 0.7, w, 6);
    // Upper maroon trim strip
    c.fillStyle = '#7f322c';
    c.fillRect(0, 0, w, 14);
    for (let i = 0; i < 80; i++) {
      c.fillStyle = 'rgba(136, 114, 78, 0.14)';
      c.fillRect(rand() * w, rand() * h * 0.7, 10 + rand() * 18, 12 + rand() * 24);
    }
  });

  // 6. 1990s Railway Staff Quarter wall (aged red-brick base + warm limewash plaster)
  const quarterWall = makeTex(256, 256, 3, 2, (c, w, h) => {
    const rand = seededRand(506);
    c.fillStyle = '#dec9a4';
    c.fillRect(0, 0, w, h);
    // Lower weathered brick plinth & dado
    c.fillStyle = '#9e533e';
    c.fillRect(0, h * 0.76, w, h * 0.24);
    // Subtle brick courses peeking through aged plaster
    c.fillStyle = 'rgba(154, 82, 58, 0.22)';
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 5; col++) {
        if (rand() < 0.35) {
          c.fillRect(col * 52 + (r % 2) * 24, h * 0.78 + r * 10, 44, 7);
        }
      }
    }
    // Monsoon rainwater patina streaks near top
    for (let i = 0; i < 48; i++) {
      c.fillStyle = 'rgba(116, 104, 82, 0.16)';
      c.fillRect(rand() * w, 0, 5 + rand() * 10, 26 + rand() * 48);
    }
  });

  // 7. Concrete terrace roof slab with weathered damp patches
  const roofConcrete = makeTex(256, 256, 3, 2, (c, w, h) => {
    const rand = seededRand(507);
    c.fillStyle = '#9c9689';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 65; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(92, 96, 80, 0.22)' : 'rgba(130, 124, 112, 0.25)';
      c.beginPath();
      c.arc(rand() * w, rand() * h, 8 + rand() * 24, 0, Math.PI * 2);
      c.fill();
    }
  });

  // 8. Corrugated galvanized metal platform canopy sheets
  const corrugatedSheet = makeTex(128, 128, 14, 2, (c, w, h) => {
    c.fillStyle = '#7e878c';
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      c.fillStyle = '#99a3a8';
      c.fillRect(x, 0, 3, h);
      c.fillStyle = '#60686d';
      c.fillRect(x + 4, 0, 3, h);
    }
    // Subtle rust patina
    c.fillStyle = 'rgba(148, 84, 48, 0.16)';
    c.fillRect(0, h * 0.65, w, h * 0.35);
  });

  // 9. Iconic Indian Railways Yellow Station Nameboard
  const stationSign = makeTex(512, 160, 1, 1, (c, w, h) => {
    c.fillStyle = '#f2bf26';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1b1a18';
    c.lineWidth = 10;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#181715';
    c.font = 'bold 44px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('RAMPUR JN.', w * 0.5, h * 0.38);
    c.font = 'bold 30px sans-serif';
    c.fillText('रामपुर जंक्शन  •  1995', w * 0.5, h * 0.74);
  });

  // 10. Ticket Counter blue & white board
  const ticketSign = makeTex(256, 80, 1, 1, (c, w, h) => {
    c.fillStyle = '#1f4c7a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4efe2';
    c.lineWidth = 5;
    c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#f7f4ea';
    c.font = 'bold 24px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TICKET COUNTER', w * 0.5, h * 0.38);
    c.font = 'bold 18px sans-serif';
    c.fillText('टिकट घर', w * 0.5, h * 0.72);
  });

  // 11. Waiting Hall board
  const waitingSign = makeTex(256, 80, 1, 1, (c, w, h) => {
    c.fillStyle = '#7f322c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4e6c2';
    c.lineWidth = 5;
    c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#fbf4e2';
    c.font = 'bold 23px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('WAITING HALL', w * 0.5, h * 0.38);
    c.font = 'bold 18px sans-serif';
    c.fillText('प्रतीक्षालय', w * 0.5, h * 0.72);
  });

  // 12. Vintage Indian Railways Round Clock Face (4:40 PM)
  const clockFace = makeTex(256, 256, 1, 1, (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.fillStyle = '#202224';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f7f2e4';
    c.beginPath();
    c.arc(cx, cy, 114, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#1f1e1c';
    c.lineWidth = 10;
    c.stroke();

    // Hour ticks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.strokeStyle = '#1a1918';
      c.lineWidth = i % 3 === 0 ? 7 : 4;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86);
      c.lineTo(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104);
      c.stroke();
    }
    // Hour hand (~4:40)
    c.strokeStyle = '#161616';
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + 46, cy + 36);
    c.stroke();
    // Minute hand (40 mins = 8 o'clock)
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx - 72, cy + 40);
    c.stroke();
    // Red second pin
    c.fillStyle = '#b42c24';
    c.beginPath();
    c.arc(cx, cy, 8, 0, Math.PI * 2);
    c.fill();
  });

  // 13. Lush colony garden lawn
  const gardenLawn = makeTex(256, 256, 6, 5, (c, w, h) => {
    const rand = seededRand(508);
    c.fillStyle = '#5c8440';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      c.fillStyle =
        rand() < 0.5 ? 'rgba(72, 108, 46, 0.35)' : 'rgba(118, 148, 72, 0.3)';
      c.fillRect(rand() * w, rand() * h, 4 + rand() * 8, 4 + rand() * 8);
    }
  });

  return {
    ground,
    tarmac,
    platform,
    ballast,
    stationWall,
    quarterWall,
    roofConcrete,
    corrugatedSheet,
    stationSign,
    ticketSign,
    waitingSign,
    clockFace,
    gardenLawn,
  };
}

// ---------------------------------------------------------------------------
// Reusable Colony Props: Platform Bench, Railway Clock, Station Signboard,
// Overhead Railway Water Tank & Accessible Multi-Room Staff Quarter
// ---------------------------------------------------------------------------
function addSittableBench(
  ctx: MapBuildContext,
  x: number,
  z: number,
  rotY: number,
  woodMat: THREE.Material,
  ironMat: THREE.Material,
  label: string,
  yBase = 0,
): void {
  const g = new THREE.Group();
  g.position.set(x, yBase, z);
  g.rotation.y = rotY;

  // Cast-iron legs & armrests
  for (const sx of [-0.88, 0.88]) {
    addVisualBox(g, sx, 0.25, 0, 0.08, 0.5, 0.56, ironMat);
    addVisualBox(g, sx, 0.62, -0.22, 0.08, 0.44, 0.08, ironMat);
  }
  // Slatted wooden seat & backrest
  addVisualBox(g, 0, 0.46, 0.04, 1.98, 0.07, 0.46, woodMat);
  addVisualBox(g, 0, 0.78, -0.22, 1.98, 0.3, 0.07, woodMat);

  ctx.group.add(g);

  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const hx = 1.02 * cos + 0.34 * sin;
  const hz = 1.02 * sin + 0.34 * cos;
  ctx.boxes.push({
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
    blocksSight: false,
    topY: yBase + 0.52,
  });

  ctx.seats.push({
    id: `rail-bench-${x.toFixed(1)}-${z.toFixed(1)}`,
    label,
    kind: 'bench',
    x,
    z,
    seatY: yBase + 0.5,
    rotY,
  });
}

function addYellowStationNameboard(
  ctx: MapBuildContext,
  x: number,
  z: number,
  signMat: THREE.Material,
  ironMat: THREE.Material,
  yBase = 0.16,
): void {
  const g = new THREE.Group();
  g.position.set(x, yBase, z);

  for (const sx of [-1.75, 1.75]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 2.75, 7),
      ironMat,
    );
    post.position.set(sx, 1.38, 0);
    post.castShadow = true;
    g.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.18, 0.14), signMat);
  board.position.set(0, 2.25, 0);
  board.castShadow = true;
  g.add(board);

  ctx.group.add(g);
  ctx.circles.push({ x: x - 1.75, z, radius: 0.18, blocksSight: false });
  ctx.circles.push({ x: x + 1.75, z, radius: 0.18, blocksSight: false });
}

function addHangingRailwayClock(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  clockMat: THREE.Material,
  ironMat: THREE.Material,
): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Suspension rod
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6),
    ironMat,
  );
  rod.position.y = 0.58;
  g.add(rod);

  // Double-sided round railway clock drum
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.2, 16),
    ironMat,
  );
  drum.rotation.z = Math.PI / 2;
  g.add(drum);

  for (const side of [-1, 1]) {
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), clockMat);
    dial.position.set(side * 0.105, 0, 0);
    dial.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(dial);
  }
  parent.add(g);
}

function addOverheadWaterTank(
  ctx: MapBuildContext,
  x: number,
  z: number,
  concreteMat: THREE.Material,
  tankMat: THREE.Material,
  ironMat: THREE.Material,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Small concrete pump room nestled at base of water tower (solid hiding cover!)
  addSolidBox(ctx, x, z, 3.2, 2.6, 3.0, concreteMat, true, 0);

  // 4 tall concrete/steel support columns rising to 9.2m
  const legOffsets = [
    [-1.7, -1.7],
    [1.7, -1.7],
    [-1.7, 1.7],
    [1.7, 1.7],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 9.2, 0.36),
      concreteMat,
    );
    leg.position.set(lx, 4.6, lz);
    leg.castShadow = true;
    g.add(leg);
  }

  // Horizontal cross-bracing rings
  for (const ry of [3.5, 6.4, 8.8]) {
    addVisualBox(g, 0, ry, -1.7, 3.5, 0.22, 0.22, concreteMat);
    addVisualBox(g, 0, ry, 1.7, 3.5, 0.22, 0.22, concreteMat);
    addVisualBox(g, -1.7, ry, 0, 0.22, 0.22, 3.5, concreteMat);
    addVisualBox(g, 1.7, ry, 0, 0.22, 0.22, 3.5, concreteMat);
  }

  // Iconic cylindrical Indian Railways elevated water tank drum
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 2.65, 3.2, 14),
    tankMat,
  );
  tank.position.y = 10.6;
  tank.castShadow = true;
  g.add(tank);

  // Domed tank cap
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.85, 0.9, 14),
    ironMat,
  );
  cap.position.y = 12.65;
  g.add(cap);

  // Vertical water supply pipe
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 9.2, 8),
    ironMat,
  );
  pipe.position.set(0.85, 4.6, 0.85);
  g.add(pipe);

  ctx.group.add(g);
  ctx.hidingSpots.push({
    x: x + 2.4,
    z: z + 0.5,
    label,
    kind: 'pump',
  });
  ctx.landmarks.push({ x, z, radius: 3.4, kind: 'well' });
}

/**
 * Builds an accessible 1990s Indian Railway Staff Quarter with:
 * - Fenced front yard (Aangan) & open iron gate
 * - Upper front balcony with decorative iron railing & overhang
 * - Pass-through front & back doors (zero dead-ends!)
 * - Interior Bedroom (bed + steel almirah), Kitchen (slab + matkas) & Storage Room (metal trunks)
 * - Roof meshes registered in ctx.houseInteriors so the roof fades out smoothly when inside!
 */
interface QuarterSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  wallMat: THREE.Material;
  roofMat: THREE.Material;
  woodMat: THREE.Material;
  ironMat: THREE.Material;
  floorMat: THREE.Material;
  accentColor: number;
}

function buildRailwayStaffQuarter(
  ctx: MapBuildContext,
  spec: QuarterSpec,
): void {
  const g = new THREE.Group();
  const { x, z } = spec;
  const w = 12.2;
  const d = 8.4;
  const wallH = 3.25;
  const wallT = 0.34;
  const halfW = w * 0.5;
  const halfD = d * 0.5;
  const doorW = 2.1;
  const doorH = 2.25;

  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor, // Classic 1990s railway shutter green / blue / maroon
    roughness: 0.72,
  });
  const almirahMat = new THREE.MeshStandardMaterial({
    color: 0x5c726c, // Vintage steel Godrej almirah grey-green
    roughness: 0.45,
    metalness: 0.35,
  });
  const bedMat = new THREE.MeshStandardMaterial({
    color: 0xc97b54,
    roughness: 0.9,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x3b3e42, // Black Kadappa stone kitchen slab
    roughness: 0.65,
  });
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x43576a, // Steel railway luggage trunk (Sandook)
    roughness: 0.52,
    metalness: 0.35,
  });

  // Interior cement floor plinth
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.24, 0.14, d + 0.24),
    spec.floorMat,
  );
  floor.position.set(x, 0.07, z);
  floor.receiveShadow = true;
  g.add(floor);

  // --- Exterior Walls (North front door & South back-alley door!) ---
  const segW = (w - doorW) * 0.5;
  for (const wz of [z - halfD + wallT * 0.5, z + halfD - wallT * 0.5]) {
    addSolidBox(ctx, x - halfW + segW * 0.5, wz, segW, wallH, wallT, spec.wallMat, true, 0);
    addSolidBox(ctx, x + halfW - segW * 0.5, wz, segW, wallH, wallT, spec.wallMat, true, 0);
    addVisualBox(g, x, doorH + (wallH - doorH) * 0.5, wz, doorW + 0.12, wallH - doorH, wallT + 0.02, spec.wallMat);
    addVisualBox(g, x, doorH + 0.06, wz, doorW + 0.22, 0.12, wallT + 0.08, trimMat);
    addVisualBox(g, x - doorW * 0.5, doorH * 0.5, wz, 0.1, doorH, wallT + 0.08, trimMat);
    addVisualBox(g, x + doorW * 0.5, doorH * 0.5, wz, 0.1, doorH, wallT + 0.08, trimMat);
  }
  // West & East solid outer walls
  addSolidBox(ctx, x - halfW + wallT * 0.5, z, wallT, wallH, d, spec.wallMat, true, 0);
  addSolidBox(ctx, x + halfW - wallT * 0.5, z, wallT, wallH, d, spec.wallMat, true, 0);

  // Shuttered colonial-style railway windows on front & sides
  for (const wx of [x - 3.6, x + 3.6]) {
    addVisualBox(g, wx, 1.72, z - halfD - 0.04, 1.45, 1.05, 0.14, trimMat);
    addVisualBox(g, wx, 2.32, z - halfD - 0.26, 1.65, 0.12, 0.45, spec.roofMat);
  }

  // --- Interior Room Partitions (Wide open archways for smooth player navigation!) ---
  // Left partition separates Bedroom (west wing) from Central Hallway
  addSolidBox(ctx, x - 2.25, z - 2.35, 0.24, wallH - 0.15, 3.2, spec.wallMat, true, 0);
  // Right partition separates Kitchen (NE) & Storage Room (SE) from Central Hallway
  addSolidBox(ctx, x + 2.25, z - 2.35, 0.24, wallH - 0.15, 3.2, spec.wallMat, true, 0);
  // Cross partition between Kitchen (NE) and Storage Room (SE) with generous doorway gap
  addSolidBox(ctx, x + 4.35, z + 0.25, 3.0, wallH - 0.15, 0.24, spec.wallMat, true, 0);

  // --- Bedroom Furnishings (West Wing: x - 5.6 .. x - 2.6) ---
  // Wooden bed with woven quilt
  addSolidBox(ctx, x - 4.55, z - 1.55, 2.05, 0.56, 1.35, spec.woodMat, false, 0, {
    topY: 0.58,
  });
  addVisualBox(g, x - 4.55, 0.62, z - 1.55, 1.92, 0.14, 1.24, bedMat);
  // Tall steel Godrej almirah (sight-blocking hiding spot!)
  addSolidBox(ctx, x - 5.15, z + 2.55, 1.15, 2.05, 0.72, almirahMat, true, 0);

  // --- Kitchen Furnishings (North-East Wing: x + 2.6 .. x + 5.6, z - 3.8 .. z) ---
  addSolidBox(ctx, x + 5.25, z - 1.85, 0.82, 0.86, 2.95, slabMat, false, 0, {
    topY: 0.88,
  });
  // Steel cooking pots & clay water matka on kitchen slab
  const potMat = new THREE.MeshStandardMaterial({
    color: 0xb6623d,
    roughness: 0.84,
  });
  const matka = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), potMat);
  matka.position.set(x + 5.25, 1.12, z - 2.6);
  g.add(matka);

  // --- Storage Room Furnishings (South-East Wing: x + 2.6 .. x + 5.6, z + 0.6 .. z + 3.8) ---
  // Stacked vintage steel trunks (Sandook) for hiding cover!
  addSolidBox(ctx, x + 4.75, z + 2.75, 1.35, 0.85, 0.92, trunkMat, true, 0, {
    topY: 0.86,
  });
  addVisualBox(g, x + 4.8, 1.15, z + 2.75, 1.02, 0.52, 0.74, spec.woodMat);

  // --- Iconic 1990s Railway Quarter Front Balcony & Veranda (North side, facing street) ---
  const verandaZ = z - halfD - 1.15;
  const verandaFloor = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.14, 2.15),
    spec.floorMat,
  );
  verandaFloor.position.set(x, 0.07, verandaZ);
  verandaFloor.receiveShadow = true;
  g.add(verandaFloor);

  // Veranda columns supporting upper balcony slab
  for (const px of [-halfW + 0.35, -1.65, 1.65, halfW - 0.35]) {
    addVisualBox(g, x + px, wallH * 0.5, z - halfD - 2.02, 0.24, wallH, 0.24, spec.wallMat);
    ctx.circles.push({ x: x + px, z: z - halfD - 2.02, radius: 0.2, blocksSight: false });
  }

  // --- Roof + Upper Front Balcony with Decorative Railing (fades cleanly when inside!) ---
  const roofMeshes: THREE.Mesh[] = [];
  const roofMatClone = spec.roofMat.clone();
  roofMatClone.transparent = true;
  roofMatClone.opacity = 1;

  // Main terrace slab extending over front veranda to form the balcony floor
  const roofSlab = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.6, 0.26, d + 2.45),
    roofMatClone,
  );
  roofSlab.position.set(x, wallH + 0.13, z - 1.05);
  roofSlab.castShadow = true;
  roofSlab.receiveShadow = true;
  g.add(roofSlab);
  roofMeshes.push(roofSlab);

  // Upper half-story balcony room facade (visual 2nd-floor railway duplex character!)
  const upperWallClone = spec.wallMat.clone();
  upperWallClone.transparent = true;
  upperWallClone.opacity = 1;
  const upperRoom = new THREE.Mesh(
    new THREE.BoxGeometry(w - 1.2, 2.45, d * 0.55),
    upperWallClone,
  );
  upperRoom.position.set(x, wallH + 1.48, z + 1.2);
  upperRoom.castShadow = true;
  g.add(upperRoom);
  roofMeshes.push(upperRoom);

  const upperRoof = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.4, 0.24, d * 0.68),
    roofMatClone,
  );
  upperRoof.position.set(x, wallH + 2.82, z + 1.0);
  upperRoof.castShadow = true;
  g.add(upperRoof);
  roofMeshes.push(upperRoof);

  // Upper front balcony balustrade & railing overlooking the colony street
  const balcZ = z - halfD - 2.12;
  const balcRail = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.92, 0.14),
    trimMat,
  );
  balcRail.position.set(x, wallH + 0.72, balcZ);
  g.add(balcRail);
  roofMeshes.push(balcRail);

  const balcWallL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.92, 2.3),
    spec.wallMat,
  );
  balcWallL.position.set(x - halfW, wallH + 0.72, verandaZ);
  g.add(balcWallL);
  roofMeshes.push(balcWallL);

  const balcWallR = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.92, 2.3),
    spec.wallMat,
  );
  balcWallR.position.set(x + halfW, wallH + 0.72, verandaZ);
  g.add(balcWallR);
  roofMeshes.push(balcWallR);

  // --- Low Front Yard Compound Wall (Aangan) with Wide Open Front Gate ---
  const yardFrontZ = z - halfD - 4.1;
  addSolidBox(ctx, x - 3.9, yardFrontZ, 4.4, 0.88, 0.26, spec.wallMat, false, 0);
  addSolidBox(ctx, x + 3.9, yardFrontZ, 4.4, 0.88, 0.26, spec.wallMat, false, 0);
  // Gate pillars
  addVisualBox(g, x - 1.65, 0.62, yardFrontZ, 0.34, 1.24, 0.34, trimMat);
  addVisualBox(g, x + 1.65, 0.62, yardFrontZ, 0.34, 1.24, 0.34, trimMat);
  // Short side yard walls
  addSolidBox(ctx, x - halfW + 0.12, z - halfD - 2.05, 0.24, 0.85, 4.1, spec.wallMat, false, 0);
  addSolidBox(ctx, x + halfW - 0.12, z - halfD - 2.05, 0.24, 0.85, 4.1, spec.wallMat, false, 0);

  // Front yard small garden flower patch & terracotta planter
  const patchMat = new THREE.MeshStandardMaterial({
    color: 0x4e7c36,
    roughness: 0.95,
  });
  const patch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.45), patchMat);
  patch.position.set(x - 3.6, 0.05, z - halfD - 3.15);
  g.add(patch);

  // Sittable front veranda bench
  addSittableBench(
    ctx,
    x + 3.65,
    z - halfD - 2.95,
    0,
    spec.woodMat,
    spec.ironMat,
    `${spec.label} Yard Bench`,
  );

  ctx.group.add(g);

  ctx.houseInteriors.push({
    id: spec.id,
    label: spec.label,
    minX: x - halfW - 0.3,
    maxX: x + halfW + 0.3,
    minZ: z - halfD - 0.3,
    maxZ: z + halfD + 0.3,
    doorX: x,
    doorZ: z - halfD - 0.85,
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

  // Register indoor & backyard hiding spots
  ctx.hidingSpots.push(
    {
      x: x - 3.8,
      z: z + 2.4,
      label: `${spec.label} Bedroom Almirah`,
      kind: 'house',
    },
    {
      x: x + 3.7,
      z: z + 2.3,
      label: `${spec.label} Storage Room`,
      kind: 'house',
    },
    {
      x: x - 4.4,
      z: z + halfD + 1.25,
      label: `Behind ${spec.label} Alley Wall`,
      kind: 'wall',
    },
  );
}

// ---------------------------------------------------------------------------
// Main Level 5 Builder: Upgraded 1990s Indian Railway Residential Colony
// ---------------------------------------------------------------------------
export function buildRailwayColonyMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  const railTex = createRailwayTextures();
  const rand = seededRand(199505);

  // -------------------------------------------------------------------------
  // 1. Colony Ground Plane & Tarmac Street / Narrow Alley Network
  // -------------------------------------------------------------------------
  const groundMat = new THREE.MeshStandardMaterial({
    map: railTex.ground,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.036,
    roughness: 0.96,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(148, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ctx.group.add(ground);

  const tarmacMat = new THREE.MeshStandardMaterial({
    map: railTex.tarmac,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.024,
    roughness: 0.9,
  });

  const addColonyStreet = (
    x: number,
    z: number,
    width: number,
    length: number,
    rotY = 0,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      tarmacMat,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    ctx.group.add(mesh);
    ctx.roads.push({ x, z, width, length, rotY });
  };

  // Main East-West Station Road (in front of station building)
  addColonyStreet(0, -5.5, 5.4, 92, Math.PI / 2);
  // Middle Colony Street (between Row 1 & Row 2 quarters)
  addColonyStreet(0, 16.5, 4.2, 86, Math.PI / 2);
  // South Garden Lane
  addColonyStreet(0, 36.5, 3.8, 82, Math.PI / 2);

  // North-South Central Avenue & Narrow Connected Colony Alleys
  addColonyStreet(0, 14.0, 4.8, 52, 0);
  addColonyStreet(-19.5, 16.0, 3.2, 46, 0);
  addColonyStreet(19.5, 16.0, 3.2, 46, 0);
  addColonyStreet(-38.5, 10.5, 3.2, 56, 0);
  addColonyStreet(38.5, 10.5, 3.2, 56, 0);

  // -------------------------------------------------------------------------
  // 2. Shared Architectural Materials
  // -------------------------------------------------------------------------
  const stationWallMat = new THREE.MeshStandardMaterial({
    map: railTex.stationWall,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.03,
    roughness: 0.9,
  });
  const quarterWallMat = new THREE.MeshStandardMaterial({
    map: railTex.quarterWall,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.034,
    roughness: 0.92,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    map: railTex.roofConcrete,
    roughness: 0.92,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    map: railTex.corrugatedSheet,
    roughness: 0.65,
    metalness: 0.25,
  });
  const maroonIronMat = new THREE.MeshStandardMaterial({
    color: 0x6f2622, // Classic Indian Railways maroon painted iron
    roughness: 0.55,
    metalness: 0.42,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x2c3236,
    roughness: 0.5,
    metalness: 0.52,
  });
  const steelRailMat = new THREE.MeshStandardMaterial({
    color: 0x7b8288,
    roughness: 0.35,
    metalness: 0.72,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8b5e36,
    roughness: 0.86,
  });
  const floorStoneMat = new THREE.MeshStandardMaterial({
    color: 0xbbb4a4,
    roughness: 0.9,
  });
  const stationSignMat = new THREE.MeshStandardMaterial({
    map: railTex.stationSign,
    roughness: 0.65,
  });
  const ticketSignMat = new THREE.MeshStandardMaterial({
    map: railTex.ticketSign,
    roughness: 0.68,
  });
  const waitingSignMat = new THREE.MeshStandardMaterial({
    map: railTex.waitingSign,
    roughness: 0.68,
  });
  const clockMat = new THREE.MeshStandardMaterial({
    map: railTex.clockFace,
    roughness: 0.45,
  });
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xa2a9ad,
    roughness: 0.58,
    metalness: 0.35,
  });
  const boundaryWallMat = new THREE.MeshStandardMaterial({
    color: 0xd8cdb4,
    roughness: 0.94,
  });

  // -------------------------------------------------------------------------
  // 3. Scenic Non-Playable Railway Tracks, Sleepers (InstancedMesh) & Signals
  // -------------------------------------------------------------------------
  const ballastMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(132, 14.5),
    new THREE.MeshStandardMaterial({
      map: railTex.ballast,
      roughness: 0.96,
    }),
  );
  ballastMesh.rotation.x = -Math.PI / 2;
  ballastMesh.position.set(0, 0.025, -32.2);
  ballastMesh.receiveShadow = true;
  ctx.group.add(ballastMesh);

  // Two parallel Indian Broad-Gauge (1.676m) steel tracks + 160 instanced sleepers
  const trackCentersZ = [-28.2, -34.4];
  const sleepersPerTrack = 82;
  const sleeperGeo = new THREE.BoxGeometry(0.28, 0.12, 2.45);
  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x4c3c2e,
    roughness: 0.95,
  });
  const sleeperInst = new THREE.InstancedMesh(
    sleeperGeo,
    sleeperMat,
    sleepersPerTrack * trackCentersZ.length,
  );
  const dummy = new THREE.Object3D();
  let sIdx = 0;

  for (const tz of trackCentersZ) {
    // Twin continuous steel rails
    for (const offset of [-0.84, 0.84]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(132, 0.14, 0.1),
        steelRailMat,
      );
      rail.position.set(0, 0.14, tz + offset);
      ctx.group.add(rail);
    }
    for (let i = 0; i < sleepersPerTrack; i++) {
      const sx = -64 + i * 1.58;
      dummy.position.set(sx, 0.06, tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sleeperInst.setMatrixAt(sIdx++, dummy.matrix);
    }
  }
  sleeperInst.instanceMatrix.needsUpdate = true;
  sleeperInst.computeBoundingSphere();
  ctx.group.add(sleeperInst);

  // Classic Indian Railways Semaphore Signal Mast at East track yard
  const signalG = new THREE.Group();
  signalG.position.set(31.5, 0, -31.2);
  addVisualBox(signalG, 0, 3.8, 0, 0.24, 7.6, 0.24, darkIronMat);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0xc63228,
    roughness: 0.55,
  });
  addVisualBox(signalG, -0.85, 6.7, 0.14, 1.75, 0.28, 0.06, armMat);
  addVisualBox(signalG, -1.25, 6.7, 0.16, 0.22, 0.28, 0.08, boundaryWallMat);
  ctx.group.add(signalG);

  // Stationary vintage goods/guard wagon parked on far north siding (strictly scenery!)
  const wagonG = new THREE.Group();
  wagonG.position.set(-29.0, 0.2, -34.4);
  const wagonBodyMat = new THREE.MeshStandardMaterial({
    color: 0x6b2f2a, // Classic 1990s Indian Railways oxide-maroon goods wagon
    roughness: 0.78,
  });
  addVisualBox(wagonG, 0, 1.85, 0, 11.4, 2.55, 2.75, wagonBodyMat);
  addVisualBox(wagonG, 0, 3.22, 0, 11.6, 0.26, 2.86, darkIronMat);
  addVisualBox(wagonG, 0, 0.52, 0, 11.8, 0.24, 2.55, darkIronMat);
  for (const wx of [-4.2, -2.5, 2.5, 4.2]) {
    for (const wz of [-0.95, 0.95]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.16, 10),
        darkIronMat,
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.45, wz);
      wagonG.add(wheel);
    }
  }
  ctx.group.add(wagonG);
  ctx.boxes.push({
    minX: -35.0,
    maxX: -23.0,
    minZ: -36.0,
    maxZ: -32.8,
    blocksSight: true,
  });

  // Safety rail fence along north track edge so players stay on Platform & Colony side
  addSolidBox(ctx, 0, -39.5, 112, 1.15, 0.3, darkIronMat, false, 0);

  // -------------------------------------------------------------------------
  // 4. Platform No. 1, Canopy, Yellow Signboards, Clocks & Sittable Benches
  // -------------------------------------------------------------------------
  const platW = 74;
  const platD = 8.0;
  const platZ = -21.2;
  const platMesh = new THREE.Mesh(
    new THREE.BoxGeometry(platW, 0.16, platD),
    new THREE.MeshStandardMaterial({
      map: railTex.platform,
      roughness: 0.88,
    }),
  );
  platMesh.position.set(0, 0.08, platZ);
  platMesh.receiveShadow = true;
  ctx.group.add(platMesh);
  ctx.buildings.push({
    x: 0,
    z: platZ,
    width: platW,
    depth: platD,
    rotY: 0,
    kind: 'platform',
  });

  // Platform Corrugated Metal Canopy Roof & Maroon Cast-Iron Pillars
  const canopyRoof = new THREE.Mesh(
    new THREE.BoxGeometry(50, 0.16, 5.8),
    canopyMat,
  );
  canopyRoof.position.set(0, 4.25, -20.4);
  canopyRoof.rotation.x = 0.08;
  canopyRoof.castShadow = true;
  canopyRoof.receiveShadow = true;
  ctx.group.add(canopyRoof);

  for (const px of [-22, -13, -4.5, 4.5, 13, 22]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 4.15, 8),
      maroonIronMat,
    );
    pillar.position.set(px, 2.22, -21.9);
    pillar.castShadow = true;
    ctx.group.add(pillar);
    ctx.circles.push({ x: px, z: -21.9, radius: 0.24, blocksSight: false });
  }

  // Two Iconic Yellow Indian Railway Station Nameboards at both platform ends
  addYellowStationNameboard(ctx, -31.5, -21.6, stationSignMat, darkIronMat);
  addYellowStationNameboard(ctx, 31.5, -21.6, stationSignMat, darkIronMat);

  // Hanging Double-Sided Railway Clocks under the platform canopy
  addHangingRailwayClock(ctx.group, -12.5, 3.35, -21.0, clockMat, darkIronMat);
  addHangingRailwayClock(ctx.group, 12.5, 3.35, -21.0, clockMat, darkIronMat);

  // 6 Sittable Wooden & Cast-Iron Platform Benches
  const benchXs = [-25.5, -10.0, -6.2, 6.2, 10.0, 25.5];
  for (let i = 0; i < benchXs.length; i++) {
    addSittableBench(
      ctx,
      benchXs[i],
      -19.1,
      0,
      woodMat,
      maroonIronMat,
      `Platform Bench #${i + 1}`,
      0.16,
    );
  }

  // Vintage Platform Book & Chai Stall (West Platform)
  addSolidBox(ctx, -18.5, -19.2, 3.4, 2.35, 2.1, maroonIronMat, true, 0.16);
  addVisualBox(ctx.group, -18.5, 2.68, -19.2, 3.8, 0.2, 2.5, canopyMat);
  ctx.hidingSpots.push({
    x: -20.8,
    z: -19.2,
    label: 'Behind Platform Chai & Book Stall',
    kind: 'wall',
  });

  // Classic Indian Railway Platform Drinking Water Booth (Piau, East Platform)
  const piauMat = new THREE.MeshStandardMaterial({
    color: 0xd9e8ec,
    roughness: 0.6,
  });
  addSolidBox(ctx, 18.5, -19.1, 3.2, 1.55, 1.5, piauMat, true, 0.16);
  addVisualBox(ctx.group, 18.5, 2.45, -19.1, 3.5, 0.18, 1.8, canopyMat);
  ctx.hidingSpots.push({
    x: 20.8,
    z: -19.1,
    label: 'Beside Platform Water Booth',
    kind: 'pump',
  });

  // -------------------------------------------------------------------------
  // 5. 1990s Railway Station Building (Ticket Windows, Central Concourse & Waiting Hall)
  // -------------------------------------------------------------------------
  const stZ = -13.6;
  const stD = 7.2;
  const stH = 4.1;
  const stWallT = 0.38;
  const stFloor = new THREE.Mesh(
    new THREE.BoxGeometry(34.8, 0.18, stD + 0.3),
    floorStoneMat,
  );
  stFloor.position.set(0, 0.09, stZ);
  stFloor.receiveShadow = true;
  ctx.group.add(stFloor);

  // --- West Wing: Ticket Booking Hall (x = -17 .. -5.2) ---
  const ticketRoofMeshes: THREE.Mesh[] = [];
  // North wall (Platform side) with pass-through door at x = -11.0
  addSolidBox(ctx, -14.8, -17.0, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, -7.4, -17.0, 4.4, stH, stWallT, stationWallMat, true, 0);
  // South wall (Colony Road side) with wide entrance at x = -11.0
  addSolidBox(ctx, -14.8, -10.2, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, -7.4, -10.2, 4.4, stH, stWallT, stationWallMat, true, 0);
  // West end wall
  addSolidBox(ctx, -16.8, stZ, stWallT, stH, stD, stationWallMat, true, 0);
  // Partition wall between Ticket Hall & Central Concourse with open archway
  addSolidBox(ctx, -5.2, -15.4, stWallT, stH, 3.1, stationWallMat, true, 0);

  // Ticket Booking Counter Booth & 3 Arched Iron-Grill Ticket Windows inside West Wing!
  addSolidBox(ctx, -13.8, -13.6, 4.2, 1.12, 1.15, woodMat, true, 0, {
    topY: 1.14,
  });
  // Counter upper glass-and-grill partition with 3 ticket windows
  for (const gx of [-15.4, -13.8, -12.2]) {
    addVisualBox(ctx.group, gx, 2.05, -13.1, 0.16, 1.85, 0.16, darkIronMat);
    // Horizontal steel window grill bars
    for (const gy of [1.45, 1.72, 1.98]) {
      addVisualBox(ctx.group, gx + 0.72, gy, -13.1, 1.25, 0.04, 0.05, darkIronMat);
    }
  }
  // Blue Ticket Counter Sign above south entrance
  const tSign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.92, 0.12), ticketSignMat);
  tSign.position.set(-11.0, 3.35, -9.95);
  ctx.group.add(tSign);

  const stRoofMatW = concreteMat.clone();
  stRoofMatW.transparent = true;
  stRoofMatW.opacity = 1;
  const ticketRoof = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.28, stD + 0.8),
    stRoofMatW,
  );
  ticketRoof.position.set(-11.0, stH + 0.14, stZ);
  ticketRoof.castShadow = true;
  ctx.group.add(ticketRoof);
  ticketRoofMeshes.push(ticketRoof);

  ctx.houseInteriors.push({
    id: 'railway-ticket-hall',
    label: 'Station Ticket Hall',
    minX: -17.0,
    maxX: -5.2,
    minZ: -17.2,
    maxZ: -10.0,
    doorX: -11.0,
    doorZ: -9.4,
    insideX: -11.0,
    insideZ: stZ,
    roofMeshes: ticketRoofMeshes,
  });
  ctx.hidingSpots.push({
    x: -14.8,
    z: -15.4,
    label: 'Behind Ticket Booking Counter',
    kind: 'house',
  });

  // --- Central Concourse Breezeway (x = -5.2 .. +5.2) with Station Clock Gable ---
  const concourseRoof = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 0.34, stD + 1.4),
    concreteMat,
  );
  concourseRoof.position.set(0, stH + 0.55, stZ);
  concourseRoof.castShadow = true;
  ctx.group.add(concourseRoof);

  // Decorative façade pediment + main Yellow Station Sign + Station Clock facing Colony Street!
  addVisualBox(ctx.group, 0, stH + 1.65, -9.85, 7.6, 2.0, 0.36, stationWallMat);
  const facadeSign = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.35, 0.14),
    stationSignMat,
  );
  facadeSign.position.set(0, stH + 0.25, -9.6);
  ctx.group.add(facadeSign);

  // Round Station Clock mounted in the central pediment gable
  const gableClock = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 18),
    clockMat,
  );
  gableClock.position.set(0, stH + 1.72, -9.62);
  ctx.group.add(gableClock);

  // --- East Wing: Passenger Waiting Hall (x = +5.2 .. +17.0) ---
  const waitingRoofMeshes: THREE.Mesh[] = [];
  addSolidBox(ctx, 7.4, -17.0, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, 14.8, -17.0, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, 7.4, -10.2, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, 14.8, -10.2, 4.4, stH, stWallT, stationWallMat, true, 0);
  addSolidBox(ctx, 16.8, stZ, stWallT, stH, stD, stationWallMat, true, 0);
  addSolidBox(ctx, 5.2, -15.4, stWallT, stH, 3.1, stationWallMat, true, 0);

  // Maroon Waiting Hall Sign above south entrance
  const wSign = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.92, 0.12),
    waitingSignMat,
  );
  wSign.position.set(11.0, 3.35, -9.95);
  ctx.group.add(wSign);

  // Sittable Waiting Hall Benches & Luggage Trunks inside East Wing
  addSittableBench(ctx, 8.2, -12.2, Math.PI, woodMat, maroonIronMat, 'Waiting Hall Bench West', 0.18);
  addSittableBench(ctx, 14.2, -12.2, Math.PI, woodMat, maroonIronMat, 'Waiting Hall Bench East', 0.18);
  addSolidBox(ctx, 15.2, -15.4, 1.35, 0.88, 1.0, darkIronMat, true, 0.18);

  const stRoofMatE = concreteMat.clone();
  stRoofMatE.transparent = true;
  stRoofMatE.opacity = 1;
  const waitingRoof = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.28, stD + 0.8),
    stRoofMatE,
  );
  waitingRoof.position.set(11.0, stH + 0.14, stZ);
  waitingRoof.castShadow = true;
  ctx.group.add(waitingRoof);
  waitingRoofMeshes.push(waitingRoof);

  ctx.houseInteriors.push({
    id: 'railway-waiting-hall',
    label: 'Station Waiting Hall',
    minX: 5.2,
    maxX: 17.0,
    minZ: -17.2,
    maxZ: -10.0,
    doorX: 11.0,
    doorZ: -9.4,
    insideX: 11.0,
    insideZ: stZ,
    roofMeshes: waitingRoofMeshes,
  });
  ctx.hidingSpots.push({
    x: 15.0,
    z: -14.2,
    label: 'Inside Station Waiting Hall',
    kind: 'house',
  });

  ctx.buildings.push({
    x: 0,
    z: stZ,
    width: 34.0,
    depth: stD,
    rotY: 0,
    kind: 'railway',
  });
  ctx.landmarks.push({ x: 0, z: stZ, radius: 7.5, kind: 'courtyard' });

  // -------------------------------------------------------------------------
  // 6. Six Accessible 1990s Railway Staff Quarters (Front Yards, Balconies & Interiors!)
  // -------------------------------------------------------------------------
  const quarters: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    accentColor: number;
  }> = [
    { id: 'quarter-a1', label: 'Quarter A-1', x: -10.2, z: 6.2, accentColor: 0x2f684e },
    { id: 'quarter-a2', label: 'Quarter A-2', x: 10.2, z: 6.2, accentColor: 0x2d5575 },
    { id: 'quarter-b1', label: 'Quarter B-1', x: -29.0, z: 6.2, accentColor: 0x76342c },
    { id: 'quarter-b2', label: 'Quarter B-2', x: 29.0, z: 6.2, accentColor: 0x2f684e },
    { id: 'quarter-c1', label: 'Quarter C-1', x: -29.0, z: 27.6, accentColor: 0x2d5575 },
    { id: 'quarter-c2', label: 'Quarter C-2', x: 29.0, z: 27.6, accentColor: 0x76342c },
  ];

  for (const q of quarters) {
    buildRailwayStaffQuarter(ctx, {
      ...q,
      wallMat: quarterWallMat,
      roofMat: concreteMat,
      woodMat,
      ironMat: darkIronMat,
      floorMat: floorStoneMat,
    });
  }

  // -------------------------------------------------------------------------
  // 7. Central Colony Garden Park (x = -15..+15, z = 20.5..33.0)
  // -------------------------------------------------------------------------
  const parkZ = 26.8;
  const parkW = 29.0;
  const parkD = 12.4;
  const parkLawn = new THREE.Mesh(
    new THREE.PlaneGeometry(parkW, parkD),
    new THREE.MeshStandardMaterial({
      map: railTex.gardenLawn,
      roughness: 0.95,
    }),
  );
  parkLawn.rotation.x = -Math.PI / 2;
  parkLawn.position.set(0, 0.028, parkZ);
  parkLawn.receiveShadow = true;
  ctx.group.add(parkLawn);

  // Criss-crossing garden walkways
  const walkMat = new THREE.MeshStandardMaterial({
    color: 0xc9b998,
    roughness: 0.92,
  });
  const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(parkW, 2.2), walkMat);
  walkEW.rotation.x = -Math.PI / 2;
  walkEW.position.set(0, 0.036, parkZ);
  ctx.group.add(walkEW);

  // Low whitewashed garden boundary walls with wide entry openings on all 4 sides
  addSolidBox(ctx, -9.2, parkZ - parkD * 0.5, 10.2, 0.85, 0.28, boundaryWallMat, false, 0);
  addSolidBox(ctx, 9.2, parkZ - parkD * 0.5, 10.2, 0.85, 0.28, boundaryWallMat, false, 0);
  addSolidBox(ctx, -9.2, parkZ + parkD * 0.5, 10.2, 0.85, 0.28, boundaryWallMat, false, 0);
  addSolidBox(ctx, 9.2, parkZ + parkD * 0.5, 10.2, 0.85, 0.28, boundaryWallMat, false, 0);
  addSolidBox(ctx, -parkW * 0.5, parkZ - 3.6, 0.28, 0.85, 4.8, boundaryWallMat, false, 0);
  addSolidBox(ctx, -parkW * 0.5, parkZ + 3.6, 0.28, 0.85, 4.8, boundaryWallMat, false, 0);
  addSolidBox(ctx, parkW * 0.5, parkZ - 3.6, 0.28, 0.85, 4.8, boundaryWallMat, false, 0);
  addSolidBox(ctx, parkW * 0.5, parkZ + 3.6, 0.28, 0.85, 4.8, boundaryWallMat, false, 0);

  // Central ornamental stone planter ring in Colony Park
  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.3, 0.56, 12),
    boundaryWallMat,
  );
  planter.position.set(0, 0.28, parkZ);
  planter.castShadow = true;
  ctx.group.add(planter);
  ctx.circles.push({ x: 0, z: parkZ, radius: 2.3, blocksSight: false });

  // 4 Sittable Garden Park Benches
  addSittableBench(ctx, -7.8, parkZ - 2.6, 0, woodMat, maroonIronMat, 'Colony Garden Bench NW');
  addSittableBench(ctx, 7.8, parkZ - 2.6, 0, woodMat, maroonIronMat, 'Colony Garden Bench NE');
  addSittableBench(ctx, -7.8, parkZ + 2.6, Math.PI, woodMat, maroonIronMat, 'Colony Garden Bench SW');
  addSittableBench(ctx, 7.8, parkZ + 2.6, Math.PI, woodMat, maroonIronMat, 'Colony Garden Bench SE');

  ctx.landmarks.push({ x: 0, z: parkZ, radius: 10.5, kind: 'garden' });
  ctx.hidingSpots.push(
    { x: -12.6, z: parkZ - 4.4, label: 'Colony Garden Hedge NW', kind: 'tree' },
    { x: 12.6, z: parkZ + 4.4, label: 'Colony Garden Hedge SE', kind: 'tree' },
  );

  // -------------------------------------------------------------------------
  // 8. Two Iconic Overhead Indian Railways Water Tanks & Colony Boundary Walls
  // -------------------------------------------------------------------------
  addOverheadWaterTank(
    ctx,
    34.5,
    -13.5,
    concreteMat,
    tankMat,
    maroonIronMat,
    'Behind East Railway Water Tank',
  );
  addOverheadWaterTank(
    ctx,
    -44.5,
    16.5,
    concreteMat,
    tankMat,
    darkIronMat,
    'Behind West Colony Water Tank',
  );

  // Whitewashed Railway Colony Perimeter Boundary Walls (West, East & South)
  addSolidBox(ctx, -49.5, 8.5, 0.42, 2.05, 68, boundaryWallMat, true, 0);
  addSolidBox(ctx, 49.5, 8.5, 0.42, 2.05, 68, boundaryWallMat, true, 0);
  addSolidBox(ctx, 0, 44.5, 99, 2.05, 0.42, boundaryWallMat, true, 0);

  // -------------------------------------------------------------------------
  // 9. Instanced Colony Shade Trees & Garden Bushes (Smooth Android FPS!)
  // -------------------------------------------------------------------------
  const treeCoords: Array<{ x: number; z: number; s: number; playable: boolean }> = [
    // Park & Garden shade trees
    { x: -11.5, z: 23.0, s: 1.05, playable: true },
    { x: 11.5, z: 23.0, s: 1.08, playable: true },
    { x: -11.5, z: 30.8, s: 1.0, playable: true },
    { x: 11.5, z: 30.8, s: 1.04, playable: true },
    { x: 0, z: parkZ, s: 1.25, playable: false }, // Inside central planter (already has circle collider!)
    // Station Road & Colony Avenue boulevard trees
    { x: -24.5, z: -11.2, s: 1.05, playable: true },
    { x: -34.0, z: -11.2, s: 1.12, playable: true },
    { x: 24.5, z: -11.2, s: 1.06, playable: true },
    { x: -43.5, z: -4.5, s: 1.15, playable: true },
    { x: 43.5, z: -4.5, s: 1.1, playable: true },
    { x: -43.5, z: 6.5, s: 1.08, playable: true },
    { x: 43.5, z: 6.5, s: 1.12, playable: true },
    { x: 43.5, z: 22.5, s: 1.05, playable: true },
    { x: -43.5, z: 28.5, s: 1.1, playable: true },
    { x: 43.5, z: 34.5, s: 1.06, playable: true },
    { x: -32.0, z: 41.2, s: 1.14, playable: true },
    { x: -14.5, z: 41.2, s: 1.08, playable: true },
    { x: 14.5, z: 41.2, s: 1.1, playable: true },
    { x: 32.0, z: 41.2, s: 1.12, playable: true },
  ];

  // Add outer scenic horizon trees beyond colony walls & tracks (zero collision overhead!)
  for (let i = 0; i < 42; i++) {
    const a = (i / 42) * Math.PI * 2;
    const rad = 58.0 + rand() * 14.0;
    const tx = Math.cos(a) * rad;
    const tz = Math.sin(a) * rad;
    // Leave rail corridor clear on far east/west
    if (tz > -38 && tz < -25) continue;
    treeCoords.push({ x: tx, z: tz, s: 1.0 + rand() * 0.42, playable: false });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.8, 7);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    color: 0x6c5640,
    roughness: 0.94,
  });
  const lowerGeo = new THREE.DodecahedronGeometry(1.95, 1);
  const upperGeo = new THREE.DodecahedronGeometry(1.42, 1);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
  });

  const tCount = treeCoords.length;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, tCount);
  const lowerInst = new THREE.InstancedMesh(lowerGeo, leafMat, tCount);
  const upperInst = new THREE.InstancedMesh(upperGeo, leafMat, tCount);
  trunkInst.castShadow = true;
  lowerInst.castShadow = true;
  lowerInst.receiveShadow = true;
  upperInst.castShadow = false;

  const colTmp = new THREE.Color();
  const canopyPalette = [0x336d2d, 0x3d7d34, 0x2b5f27, 0x488938, 0x367230];

  for (let i = 0; i < tCount; i++) {
    const tc = treeCoords[i];
    const rot = rand() * Math.PI * 2;
    dummy.position.set(tc.x, 1.4 * tc.s, tc.z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(tc.s, tc.s, tc.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tc.x, 3.85 * tc.s, tc.z);
    dummy.scale.set(tc.s * 1.12, tc.s * 0.86, tc.s * 1.1);
    dummy.updateMatrix();
    lowerInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(canopyPalette[i % canopyPalette.length]);
    lowerInst.setColorAt(i, colTmp);

    dummy.position.set(
      tc.x + Math.cos(rot) * 0.45 * tc.s,
      4.95 * tc.s,
      tc.z + Math.sin(rot) * 0.45 * tc.s,
    );
    dummy.scale.set(tc.s * 0.96, tc.s * 0.84, tc.s * 0.96);
    dummy.updateMatrix();
    upperInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(canopyPalette[(i + 2) % canopyPalette.length]);
    upperInst.setColorAt(i, colTmp);

    if (tc.playable) {
      ctx.circles.push({
        x: tc.x,
        z: tc.z,
        radius: 0.4 * tc.s,
        blocksSight: true,
      });
      if (i % 3 === 0) {
        ctx.hidingSpots.push({
          x: tc.x + 1.05,
          z: tc.z + 0.5,
          label: 'Behind Colony Shade Tree',
          kind: 'tree',
        });
      }
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

  // Ornamental Colony Garden Bushes & Bougainvillea Shrubs (InstancedMesh)
  const bushCoords: Array<[number, number, number]> = [
    [-13.2, 22.0, 0x3b762d],
    [-13.2, 31.6, 0xb83862], // Bougainvillea magenta accent
    [13.2, 22.0, 0xb83862],
    [13.2, 31.6, 0x3b762d],
    [-4.5, 22.2, 0x458435],
    [4.5, 22.2, 0x458435],
    [-4.5, 31.4, 0xd46a34],
    [4.5, 31.4, 0x458435],
    [-21.5, -11.5, 0x3f7b30],
    [21.5, -11.5, 0xb83862],
    [-46.5, 1.5, 0x3b762d],
    [-46.5, 11.5, 0x468334],
    [46.5, 1.5, 0x3b762d],
    [46.5, 15.5, 0xb83862],
    [-46.5, 34.5, 0x3b762d],
    [46.5, 34.5, 0x468334],
  ];
  const bushGeo = new THREE.DodecahedronGeometry(0.76, 1);
  const bushInst = new THREE.InstancedMesh(bushGeo, leafMat, bushCoords.length);
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;
  for (let i = 0; i < bushCoords.length; i++) {
    const [bx, bz, bCol] = bushCoords[i];
    dummy.position.set(bx, 0.52, bz);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(1.25, 0.85, 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    colTmp.setHex(bCol);
    bushInst.setColorAt(i, colTmp);
  }
  bushInst.instanceMatrix.needsUpdate = true;
  if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
  bushInst.computeBoundingSphere();
  ctx.group.add(bushInst);

  // -------------------------------------------------------------------------
  // 10. Patrol Points & 10-Player Verified Unobstructed Spawns
  // -------------------------------------------------------------------------
  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, -5.5),
    new THREE.Vector3(0, 0, -21.0),
    new THREE.Vector3(-24, 0, -21.0),
    new THREE.Vector3(24, 0, -21.0),
    new THREE.Vector3(-22, 0, -5.5),
    new THREE.Vector3(22, 0, -5.5),
    new THREE.Vector3(-19.5, 0, 16.5),
    new THREE.Vector3(0, 0, 16.5),
    new THREE.Vector3(19.5, 0, 16.5),
    new THREE.Vector3(-19.5, 0, 36.5),
    new THREE.Vector3(0, 0, 36.5),
    new THREE.Vector3(19.5, 0, 36.5),
    new THREE.Vector3(-10.2, 0, 6.2),
    new THREE.Vector3(10.2, 0, 6.2),
    new THREE.Vector3(-29.0, 0, 27.6),
    new THREE.Vector3(29.0, 0, 27.6),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 58.0,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: ctx.pondWater,
    seats: ctx.seats,
    minimapLayout: {
      worldRadius: 58.0,
      groundTint: '#9a9072',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.0, -5.5, 0.0],
      previewCamPos: [5.2, 3.0, 1.8],
      previewLookAt: [0.0, 1.8, -13.0],
      seeker: [0.0, -5.5, 0.0],
      hiders: [
        [0.0, -21.0, Math.PI],
        [-24.0, -21.0, 1.57],
        [24.0, -21.0, -1.57],
        [-22.0, -5.5, 1.57],
        [22.0, -5.5, -1.57],
        [-19.5, 16.5, 0.5],
        [19.5, 16.5, -0.5],
        [0.0, 16.5, Math.PI],
        [-19.5, 36.5, 0.8],
        [19.5, 36.5, -0.8],
      ],
    },
  };
}

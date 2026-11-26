import * as THREE from 'three';
import {
  addCrateStack,
  addGroundPlane,
  addNaturalPerimeter,
  addRoadSegment,
  addTree,
  addVisualBox,
  createMapContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { MinimapBuilding } from './types';
import { VillageBuildResult } from './village';

// ---------------------------------------------------------------------------
// Custom Procedural 1990s Indian Village Market Textures
// ---------------------------------------------------------------------------
interface MarketTextures {
  brickPlaster: THREE.CanvasTexture;
  cobbleStreet: THREE.CanvasTexture;
  shopWood: THREE.CanvasTexture;
  stripedAwnings: THREE.CanvasTexture[];
  sweetDisplay: THREE.CanvasTexture;
  groceryShelf: THREE.CanvasTexture;
  clothShelf: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTex(
  canvas: HTMLCanvasElement,
  repX = 1,
  repY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = repX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repX, repY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createSignboardTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  borderHex: string,
  textHex: string,
): THREE.CanvasTexture {
  const [c, g] = makeCanvas(512, 128);
  // Hand-painted wooden shop board base
  g.fillStyle = bgHex;
  g.fillRect(0, 0, 512, 128);

  // Subtle 1990s sun-faded weathering wash
  const fade = g.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, 'rgba(255,250,235,0.14)');
  fade.addColorStop(1, 'rgba(35,20,10,0.18)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 512, 128);

  // Ornate double hand-painted border
  g.strokeStyle = borderHex;
  g.lineWidth = 8;
  g.strokeRect(8, 8, 496, 112);
  g.lineWidth = 2.5;
  g.strokeRect(18, 18, 476, 92);

  // Corner motifs
  g.fillStyle = borderHex;
  for (const cx of [28, 484]) {
    for (const cy of [28, 100]) {
      g.beginPath();
      g.arc(cx, cy, 5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Shop name typography
  g.fillStyle = textHex;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 34px Georgia, serif';
  g.fillText(title, 256, 54, 444);

  // Subtitle / tagline
  g.font = 'bold 17px sans-serif';
  g.globalAlpha = 0.88;
  g.fillText(subtitle, 256, 90, 440);
  g.globalAlpha = 1;

  return toTex(c, 1, 1);
}

function createMarketTextures(): MarketTextures {
  // 1. Aged 1990s lime-washed brick & plaster shop wall
  const [wC, wg] = makeCanvas(256, 256);
  wg.fillStyle = '#e8d7be';
  wg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 360; i++) {
    const x = (i * 59) % 256;
    const y = (i * 113) % 256;
    wg.fillStyle = i % 2 === 0 ? 'rgba(135,98,66,0.08)' : 'rgba(255,248,236,0.12)';
    wg.fillRect(x, y, 10 + (i % 14), 6 + (i % 10));
  }
  // Exposed weathered red brick patch near lower dado
  wg.fillStyle = 'rgba(148, 78, 56, 0.28)';
  wg.fillRect(0, 206, 256, 50);
  wg.fillStyle = 'rgba(162, 82, 54, 0.55)';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      wg.fillRect(18 + c * 22 + (r % 2) * 8, 212 + r * 10, 18, 7);
    }
  }
  const brickPlaster = toTex(wC, 2, 1);

  // 2. Worn bazaar brick-paved alley / stone cobble texture
  const [stC, sg] = makeCanvas(256, 256);
  sg.fillStyle = '#9c8365';
  sg.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    const off = (r % 2) * 16;
    for (let c = -1; c < 9; c++) {
      const shade = 152 + ((r * 23 + c * 37) % 28) - 14;
      sg.fillStyle = `rgb(${shade + 12}, ${shade - 4}, ${shade - 24})`;
      sg.fillRect(c * 32 + off + 2, r * 32 + 2, 28, 28);
    }
  }
  // Subtle wheel/footpath dust streak down center
  const dust = sg.createLinearGradient(0, 0, 256, 0);
  dust.addColorStop(0, 'rgba(92, 70, 48, 0.16)');
  dust.addColorStop(0.5, 'rgba(214, 188, 150, 0.2)');
  dust.addColorStop(1, 'rgba(92, 70, 48, 0.16)');
  sg.fillStyle = dust;
  sg.fillRect(0, 0, 256, 256);
  const cobbleStreet = toTex(stC, 4, 4);

  // 3. Aged painted teak wood for shop doors, shutters & counters
  const [wdC, wd] = makeCanvas(256, 256);
  wd.fillStyle = '#6c472c';
  wd.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 8; p++) {
    const py = p * 32;
    const tone = 96 + ((p * 17) % 20) - 10;
    wd.fillStyle = `rgb(${tone + 18}, ${tone - 12}, ${tone - 36})`;
    wd.fillRect(0, py + 1.5, 256, 29);
    wd.fillStyle = 'rgba(36, 20, 10, 0.45)';
    wd.fillRect(0, py, 256, 2);
  }
  const shopWood = toTex(wdC, 1, 1);

  // 4. Colorful striped 1990s bazaar cloth awnings (5 lively palettes)
  const stripePalettes: Array<[string, string]> = [
    ['#c93c28', '#f5e4c2'], // Crimson & Cream
    ['#d9861f', '#fdf1d2'], // Marigold & Off-white
    ['#1f6c5c', '#f2dfba'], // Peacock Teal & Sand
    ['#2a568a', '#f0e2c6'], // Bazaar Blue & Cream
    ['#9c2f4e', '#f5d27a'], // Magenta & Mustard
  ];
  const stripedAwnings = stripePalettes.map(([c1, c2]) => {
    const [ac, ag] = makeCanvas(256, 128);
    const stripes = 8;
    const sw = 256 / stripes;
    for (let i = 0; i < stripes; i++) {
      ag.fillStyle = i % 2 === 0 ? c1 : c2;
      ag.fillRect(i * sw, 0, sw, 128);
    }
    // Sun-worn crease lines
    ag.fillStyle = 'rgba(28,16,8,0.12)';
    ag.fillRect(0, 114, 256, 14);
    return toTex(ac, 1, 1);
  });

  // 5. Mithai (Indian sweet shop) glass display tray texture
  const [swC, swg] = makeCanvas(256, 128);
  swg.fillStyle = '#b9c6cc';
  swg.fillRect(0, 0, 256, 128);
  const sweetColors = ['#f2a71b', '#e86824', '#f4e8c8', '#7a3b1e', '#e8b648', '#f0829c'];
  for (let col = 0; col < 6; col++) {
    swg.fillStyle = '#d8dfe4';
    swg.fillRect(col * 42 + 4, 8, 36, 112);
    swg.fillStyle = sweetColors[col];
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 2; k++) {
        swg.beginPath();
        swg.arc(col * 42 + 15 + k * 14, 22 + r * 20, 6.2, 0, Math.PI * 2);
        swg.fill();
      }
    }
  }
  const sweetDisplay = toTex(swC, 1, 1);

  // 6. Kirana grocery wall shelf texture (packed tins, spice jars, tea boxes)
  const [grC, grg] = makeCanvas(256, 256);
  grg.fillStyle = '#5c3c24';
  grg.fillRect(0, 0, 256, 256);
  const itemColors = ['#d9472b', '#e3a629', '#2b7a58', '#336699', '#e8d49c', '#b83c63'];
  for (let row = 0; row < 4; row++) {
    const sy = row * 64;
    grg.fillStyle = '#3d2515';
    grg.fillRect(0, sy + 54, 256, 10);
    for (let i = 0; i < 8; i++) {
      const w = 22 + ((row * 7 + i * 5) % 8);
      const h = 32 + ((row * 11 + i * 3) % 16);
      grg.fillStyle = itemColors[(row * 5 + i) % itemColors.length];
      grg.fillRect(6 + i * 31, sy + 54 - h, w, h);
      grg.fillStyle = 'rgba(255,250,235,0.65)';
      grg.fillRect(9 + i * 31, sy + 54 - h + 8, w - 6, 8);
    }
  }
  const groceryShelf = toTex(grC, 1, 1);

  // 7. Cloth Emporium stacked folded sari & textile shelf texture
  const [clC, clg] = makeCanvas(256, 256);
  clg.fillStyle = '#523420';
  clg.fillRect(0, 0, 256, 256);
  const fabricColors = ['#c92e3b', '#e89d1c', '#1e7868', '#3658a6', '#b53f8a', '#d95826', '#6b8c32'];
  for (let row = 0; row < 4; row++) {
    const sy = row * 64;
    clg.fillStyle = '#382112';
    clg.fillRect(0, sy + 56, 256, 8);
    for (let stack = 0; stack < 4; stack++) {
      for (let f = 0; f < 4; f++) {
        clg.fillStyle = fabricColors[(row * 3 + stack * 2 + f) % fabricColors.length];
        clg.fillRect(8 + stack * 62, sy + 12 + f * 11, 52, 9);
        clg.fillStyle = 'rgba(240, 206, 118, 0.55)';
        clg.fillRect(8 + stack * 62, sy + 18 + f * 11, 52, 2);
      }
    }
  }
  const clothShelf = toTex(clC, 1, 1);

  return {
    brickPlaster,
    cobbleStreet,
    shopWood,
    stripedAwnings,
    sweetDisplay,
    groceryShelf,
    clothShelf,
  };
}

// ---------------------------------------------------------------------------
// Main Level 4 Builder: Upgraded 1990s Indian Village Bazaar ("Old Market")
// ---------------------------------------------------------------------------
export function buildOldMarketMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  const mTex = createMarketTextures();
  const WORLD_RADIUS = 56.5;

  // Ground plane extending beyond playable bazaar
  addGroundPlane(ctx, textures, 0xb8966b, 165);

  // Shared PBR Materials
  const wallCreamMat = new THREE.MeshStandardMaterial({
    map: mTex.brickPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xf4e3c6,
    roughness: 0.9,
  });
  const wallOchreMat = new THREE.MeshStandardMaterial({
    map: mTex.brickPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xe8be84,
    roughness: 0.9,
  });
  const wallPinkMat = new THREE.MeshStandardMaterial({
    map: mTex.brickPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xe2a898,
    roughness: 0.9,
  });
  const wallBlueMat = new THREE.MeshStandardMaterial({
    map: mTex.brickPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xaac4d9,
    roughness: 0.9,
  });
  const wallMintMat = new THREE.MeshStandardMaterial({
    map: mTex.brickPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xc2d4b8,
    roughness: 0.9,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: mTex.cobbleStreet,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.04,
    color: 0xb87654,
    roughness: 0.92,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: mTex.cobbleStreet,
    color: 0xc4b096,
    roughness: 0.92,
  });
  const shopFloorMat = new THREE.MeshStandardMaterial({
    color: 0x998874,
    roughness: 0.92,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: mTex.shopWood,
    roughness: 0.82,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: mTex.shopWood,
    color: 0x6f4b32,
    roughness: 0.85,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xe6cda2,
    roughness: 0.85,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xcfa44e,
    roughness: 0.36,
    metalness: 0.72,
  });
  const clayMat = new THREE.MeshStandardMaterial({
    color: 0xb65e3a,
    roughness: 0.86,
  });
  const burlapMat = new THREE.MeshStandardMaterial({
    color: 0xb89664,
    roughness: 0.96,
  });
  const glassCounterMat = new THREE.MeshStandardMaterial({
    color: 0xdff2f8,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });
  const sweetTrayMat = new THREE.MeshStandardMaterial({
    map: mTex.sweetDisplay,
    roughness: 0.55,
  });
  const groceryShelfMat = new THREE.MeshStandardMaterial({
    map: mTex.groceryShelf,
    roughness: 0.85,
  });
  const clothShelfMat = new THREE.MeshStandardMaterial({
    map: mTex.clothShelf,
    roughness: 0.88,
  });
  const awningMats = mTex.stripedAwnings.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.86,
        side: THREE.DoubleSide,
      }),
  );
  const marigoldMat = new THREE.MeshStandardMaterial({
    color: 0xf48c1c,
    roughness: 0.82,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a0,
    emissive: 0xffa838,
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });
  const cobbleCourtyardMat = new THREE.MeshStandardMaterial({
    map: mTex.cobbleStreet,
    color: 0xd8be96,
    roughness: 0.92,
  });

  // Cached BoxGeometry pool
  const boxCache = new Map<string, THREE.BoxGeometry>();
  const getBox = (w: number, h: number, d: number): THREE.BoxGeometry => {
    const k = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`;
    let g = boxCache.get(k);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      boxCache.set(k, g);
    }
    return g;
  };

  /** Multi-floor aware wall / obstacle box */
  const addMarketBox = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    yBase: number,
    mat: THREE.Material,
    opts?: {
      blocksSight?: boolean;
      climbable?: boolean;
      castShadow?: boolean;
      collider?: boolean;
      colliderMinY?: number;
      colliderTopY?: number;
    },
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(getBox(w, h, d), mat);
    mesh.position.set(x, yBase + h * 0.5, z);
    mesh.castShadow = opts?.castShadow ?? true;
    mesh.receiveShadow = true;
    ctx.group.add(mesh);

    if (opts?.collider !== false) {
      ctx.boxes.push({
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
        blocksSight: opts?.blocksSight ?? true,
        minY: opts?.colliderMinY ?? yBase,
        topY: opts?.colliderTopY ?? yBase + h,
        ...(opts?.climbable ? { climbable: true } : {}),
      });
    }
    return mesh;
  };

  /** Walkable rooftop / balcony slab (climbable top, fades cleanly when inside ground shop!) */
  const addRooftopSlab = (
    x: number,
    z: number,
    w: number,
    d: number,
    topY: number,
    thickness: number,
    mat: THREE.Material,
    fadeGroup?: THREE.Mesh[],
  ): THREE.Mesh => {
    const useMat = fadeGroup ? (mat.clone() as THREE.MeshStandardMaterial) : mat;
    const mesh = new THREE.Mesh(getBox(w, thickness, d), useMat);
    mesh.position.set(x, topY - thickness * 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.group.add(mesh);
    if (fadeGroup) fadeGroup.push(mesh);

    ctx.boxes.push({
      minX: x - w * 0.5,
      maxX: x + w * 0.5,
      minZ: z - d * 0.5,
      maxZ: z + d * 0.5,
      blocksSight: false,
      minY: topY - thickness,
      topY,
      climbable: true,
    });
    return mesh;
  };

  /** Smooth walkable staircase (riser <= 0.22m so players walk effortlessly up to rooftops!) */
  const buildMarketStaircase = (opts: {
    startX: number;
    startZ: number;
    startY: number;
    endY: number;
    dir: 'north' | 'south' | 'east' | 'west';
    width: number;
    steps: number;
    tread: number;
    mat: THREE.Material;
  }) => {
    const { startX, startZ, startY, endY, dir, width, steps, tread, mat } = opts;
    const rise = (endY - startY) / steps;
    const dx = dir === 'east' ? 1 : dir === 'west' ? -1 : 0;
    const dz = dir === 'south' ? 1 : dir === 'north' ? -1 : 0;

    for (let i = 1; i <= steps; i++) {
      const stepTop = startY + rise * i;
      const dist = (i - 0.5) * tread;
      const sx = startX + dx * dist;
      const sz = startZ + dz * dist;
      const sw = dx !== 0 ? tread + 0.04 : width;
      const sd = dz !== 0 ? tread + 0.04 : width;
      const thick = Math.max(0.24, Math.abs(rise) + 0.08);

      const m = new THREE.Mesh(getBox(sw, thick, sd), mat);
      m.position.set(sx, stepTop - thick * 0.5, sz);
      m.castShadow = true;
      m.receiveShadow = true;
      ctx.group.add(m);

      ctx.boxes.push({
        minX: sx - sw * 0.5,
        maxX: sx + sw * 0.5,
        minZ: sz - sd * 0.5,
        maxZ: sz + sd * 0.5,
        blocksSight: false,
        minY: stepTop - 0.28,
        topY: stepTop,
        climbable: true,
      });

      // Outer wooden handrail posts every 4 steps
      if (i === 1 || i === steps || i % 4 === 0) {
        const post = new THREE.Mesh(getBox(0.1, 0.88, 0.1), darkWoodMat);
        post.position.set(
          sx + (dz !== 0 ? width * 0.45 : 0),
          stepTop + 0.44,
          sz + (dx !== 0 ? width * 0.45 : 0),
        );
        ctx.group.add(post);
      }
    }
  };

  /** Sittable wooden bench or bazaar charpai */
  let seatIdx = 0;
  const addMarketSeat = (
    x: number,
    z: number,
    rotY: number,
    kind: 'bench' | 'charpai',
    label: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    if (kind === 'bench') {
      addVisualBox(g, 0, 0.46, 0, 1.95, 0.1, 0.62, woodMat, true);
      addVisualBox(g, -0.78, 0.23, 0, 0.14, 0.46, 0.54, darkWoodMat, false);
      addVisualBox(g, 0.78, 0.23, 0, 0.14, 0.46, 0.54, darkWoodMat, false);
    } else {
      addVisualBox(g, 0, 0.44, 0, 1.95, 0.09, 1.0, woodMat, true);
      addVisualBox(g, 0, 0.49, 0, 1.75, 0.04, 0.82, burlapMat, false);
      for (const lx of [-0.88, 0.88]) {
        for (const lz of [-0.44, 0.44]) {
          addVisualBox(g, lx, 0.22, lz, 0.09, 0.44, 0.09, darkWoodMat, false);
        }
      }
    }
    ctx.group.add(g);

    const rotQ = Math.abs(Math.sin(rotY)) > 0.7;
    ctx.boxes.push({
      minX: x - (rotQ ? 0.52 : 1.0),
      maxX: x + (rotQ ? 0.52 : 1.0),
      minZ: z - (rotQ ? 1.0 : 0.52),
      maxZ: z + (rotQ ? 1.0 : 0.52),
      blocksSight: false,
      minY: 0,
      topY: 0.55,
    });
    seatIdx++;
    ctx.seats.push({
      id: `market_seat_${seatIdx}`,
      x,
      z,
      seatY: 0.5,
      rotY,
      label,
      kind,
    });
  };

  /** Places a burlap grain sack cluster (solid crouch cover + hiding spot) */
  const sackGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const addSackCluster = (x: number, yBase: number, z: number, hideLabel?: string) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    const offsets: Array<[number, number, number, number]> = [
      [-0.36, 0.34, 0, 1.0],
      [0.34, 0.34, 0.1, 0.96],
      [0.0, 0.84, -0.05, 0.92],
    ];
    for (const [ox, oy, oz, sc] of offsets) {
      const s = new THREE.Mesh(sackGeo, burlapMat);
      s.scale.set(sc * 1.05, sc * 0.88, sc * 0.95);
      s.position.set(ox, oy, oz);
      s.castShadow = true;
      g.add(s);
    }
    ctx.group.add(g);
    ctx.boxes.push({
      minX: x - 0.82,
      maxX: x + 0.82,
      minZ: z - 0.56,
      maxZ: z + 0.56,
      blocksSight: true,
      minY: yBase,
      topY: yBase + 1.25,
    });
    if (hideLabel) {
      ctx.hidingSpots.push({ x: x + 1.05, z, label: hideLabel, kind: 'gully' });
    }
  };

  /** Adds a festive overhead bunting string + warm market bulbs across a street or courtyard */
  const buntingTriangles: Array<{ x: number; y: number; z: number; rotY: number; color: number }> = [];
  const addOverheadGarland = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    height = 3.85,
  ) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const ang = Math.atan2(x2 - x1, z2 - z1);

    // Wire line
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, len, 5),
      darkWoodMat,
    );
    wire.position.set(mx, height, mz);
    wire.rotation.x = Math.PI / 2;
    wire.rotation.z = -ang;
    ctx.group.add(wire);

    const flags = Math.max(5, Math.floor(len * 1.4));
    const palette = [0xe84228, 0xf5b31a, 0x249678, 0x3272c8, 0xe85a94];
    for (let i = 1; i < flags; i++) {
      const t = i / flags;
      const sag = Math.sin(t * Math.PI) * 0.32;
      buntingTriangles.push({
        x: x1 + (x2 - x1) * t,
        y: height - 0.16 - sag,
        z: z1 + (z2 - z1) * t,
        rotY: ang + Math.PI / 2,
        color: palette[i % palette.length],
      });
    }
  };

  /**
   * Builds a rich enterable 1990s Indian bazaar shop with:
   * - Front wide doorway + open wooden shutter doors + marigold toran
   * - Back alley doorway (so every shop is a true pass-through route!)
   * - Hand-painted vintage signboard + colorful striped cloth awning on poles
   * - Detailed interior (shop counter, stocked shelves, sweet glass case / sacks, optional back storage divider)
   * - Walkable rooftop slab (fades cleanly when inside ground shop, solid when walking on rooftop!)
   * - Optional overhanging wooden balcony + low rooftop parapet walls
   */
  const buildBazaarBuilding = (spec: {
    id: string;
    label: string;
    signTitle: string;
    signSub: string;
    signBg: string;
    signBorder: string;
    signText: string;
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    frontDir: 'east' | 'west' | 'north' | 'south';
    wallMat: THREE.Material;
    awningIdx: number;
    shopKind: 'kirana' | 'mithai' | 'cloth' | 'chai' | 'general';
    hasBackStorage?: boolean;
    hasBalcony?: boolean;
    walkableRoof?: boolean;
  }) => {
    const {
      id,
      label,
      signTitle,
      signSub,
      signBg,
      signBorder,
      signText,
      x,
      z,
      width,
      depth,
      height,
      frontDir,
      wallMat,
      awningIdx,
      shopKind,
      hasBackStorage = false,
      hasBalcony = false,
      walkableRoof = true,
    } = spec;

    const hw = width * 0.5;
    const hd = depth * 0.5;
    const t = 0.34;
    const doorW = 2.4;
    const roofY = height;
    const roofMeshes: THREE.Mesh[] = [];

    // Shop interior floor slab
    const floor = new THREE.Mesh(getBox(width - 0.12, 0.08, depth - 0.12), shopFloorMat);
    floor.position.set(x, 0.04, z);
    floor.receiveShadow = true;
    ctx.group.add(floor);

    // Helper for perimeter wall with optional open doorway
    const buildWallWithDoor = (
      side: 'north' | 'south' | 'east' | 'west',
      hasDoor: boolean,
    ) => {
      const isNS = side === 'north' || side === 'south';
      const span = isNS ? width : depth;
      const posX = side === 'east' ? x + hw - t * 0.5 : side === 'west' ? x - hw + t * 0.5 : x;
      const posZ = side === 'south' ? z + hd - t * 0.5 : side === 'north' ? z - hd + t * 0.5 : z;

      if (!hasDoor) {
        addMarketBox(
          posX,
          posZ,
          isNS ? span : t,
          height,
          isNS ? t : span,
          0,
          wallMat,
          { colliderTopY: height - 0.15 },
        );
        return;
      }

      const seg = Math.max(0.5, (span - doorW) * 0.5);
      const off = doorW * 0.5 + seg * 0.5;
      if (isNS) {
        addMarketBox(posX - off, posZ, seg, height, t, 0, wallMat, { colliderTopY: height - 0.15 });
        addMarketBox(posX + off, posZ, seg, height, t, 0, wallMat, { colliderTopY: height - 0.15 });
        // Door lintel above
        addMarketBox(posX, posZ, doorW, height - 2.35, t, 2.35, wallMat, { collider: false });
      } else {
        addMarketBox(posX, posZ - off, t, height, seg, 0, wallMat, { colliderTopY: height - 0.15 });
        addMarketBox(posX, posZ + off, t, height, seg, 0, wallMat, { colliderTopY: height - 0.15 });
        addMarketBox(posX, posZ, t, height - 2.35, doorW, 2.35, wallMat, { collider: false });
      }

      // Traditional wooden doorframe (chaukhat) + hinged open double wooden doors!
      const doorOut = side === 'east' ? 0.2 : side === 'west' ? -0.2 : 0;
      const doorOutZ = side === 'south' ? 0.2 : side === 'north' ? -0.2 : 0;
      const doorGrp = new THREE.Group();
      doorGrp.position.set(posX + doorOut, 0, posZ + doorOutZ);
      doorGrp.rotation.y =
        side === 'south' ? 0 : side === 'north' ? Math.PI : side === 'east' ? Math.PI / 2 : -Math.PI / 2;

      addVisualBox(doorGrp, -doorW * 0.5, 1.18, 0, 0.12, 2.36, 0.16, darkWoodMat, false);
      addVisualBox(doorGrp, doorW * 0.5, 1.18, 0, 0.12, 2.36, 0.16, darkWoodMat, false);
      addVisualBox(doorGrp, 0, 2.38, 0, doorW + 0.24, 0.14, 0.18, darkWoodMat, false);
      // Hinged open wooden door leaves swung wide against exterior facade
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(getBox(0.92, 2.22, 0.08), woodMat);
        leaf.position.set(s * (doorW * 0.5 + 0.36), 1.12, 0.22);
        leaf.rotation.y = -s * 0.45;
        doorGrp.add(leaf);
      }
      // Festive marigold toran garland on front shop entrance
      if (side === frontDir) {
        for (let m = -4; m <= 4; m++) {
          const fl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 6), marigoldMat);
          fl.position.set(m * 0.26, 2.22 - Math.cos((m / 4) * Math.PI * 0.5) * 0.18, 0.14);
          doorGrp.add(fl);
        }
      }
      ctx.group.add(doorGrp);
    };

    const backDir: 'east' | 'west' | 'north' | 'south' =
      frontDir === 'east'
        ? 'west'
        : frontDir === 'west'
          ? 'east'
          : frontDir === 'north'
            ? 'south'
            : 'north';

    buildWallWithDoor('north', frontDir === 'north' || backDir === 'north');
    buildWallWithDoor('south', frontDir === 'south' || backDir === 'south');
    buildWallWithDoor('east', frontDir === 'east' || backDir === 'east');
    buildWallWithDoor('west', frontDir === 'west' || backDir === 'west');

    // Hand-painted 1990s Shop Signboard + Sloped Striped Cloth Awning + Support Poles
    const signTex = createSignboardTexture(
      signTitle,
      signSub,
      signBg,
      signBorder,
      signText,
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.72,
    });
    const frontSpan = frontDir === 'east' || frontDir === 'west' ? depth : width;
    const facadeGrp = new THREE.Group();
    if (frontDir === 'east') {
      facadeGrp.position.set(x + hw, 0, z);
      facadeGrp.rotation.y = Math.PI / 2;
    } else if (frontDir === 'west') {
      facadeGrp.position.set(x - hw, 0, z);
      facadeGrp.rotation.y = -Math.PI / 2;
    } else if (frontDir === 'south') {
      facadeGrp.position.set(x, 0, z + hd);
      facadeGrp.rotation.y = 0;
    } else {
      facadeGrp.position.set(x, 0, z - hd);
      facadeGrp.rotation.y = Math.PI;
    }

    // Signboard mounted above doorway
    const signW = Math.min(frontSpan - 1.2, 4.8);
    addVisualBox(facadeGrp, 0, 3.05, 0.12, signW + 0.14, 1.02, 0.12, darkWoodMat, false);
    const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(signW, 0.9), signMat);
    signPlane.position.set(0, 3.05, 0.2);
    facadeGrp.add(signPlane);

    // Colorful striped bazaar cloth awning projecting over shopfront
    const awningW = frontSpan - 0.6;
    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(awningW, 2.05),
      awningMats[awningIdx % awningMats.length],
    );
    awning.position.set(0, 2.48, 0.92);
    awning.rotation.x = -Math.PI * 0.36;
    awning.castShadow = true;
    facadeGrp.add(awning);

    // Bamboo/iron awning corner poles
    for (const px of [-(awningW * 0.48), awningW * 0.48]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 2.18, 6),
        darkWoodMat,
      );
      pole.position.set(px, 1.09, 1.82);
      facadeGrp.add(pole);
    }

    // Optional overhanging wooden jharokha balcony on upper floor (walkable!)
    if (hasBalcony) {
      const balW = Math.min(frontSpan - 1.4, 7.6);
      const balD = 1.45;
      addVisualBox(facadeGrp, 0, roofY - 0.1, balD * 0.5, balW, 0.2, balD, darkWoodMat, true);
      // Carved wooden balustrade railing
      addVisualBox(facadeGrp, 0, roofY + 0.46, balD - 0.08, balW, 0.92, 0.12, woodMat, false);
      addVisualBox(facadeGrp, -balW * 0.5 + 0.06, roofY + 0.46, balD * 0.5, 0.12, 0.92, balD, woodMat, false);
      addVisualBox(facadeGrp, balW * 0.5 - 0.06, roofY + 0.46, balD * 0.5, 0.12, 0.92, balD, woodMat, false);
      // Decorative corbel brackets underneath balcony
      for (const bx of [-balW * 0.36, 0, balW * 0.36]) {
        addVisualBox(facadeGrp, bx, roofY - 0.36, balD * 0.32, 0.2, 0.36, 0.65, darkWoodMat, false);
      }
      // Register walkable balcony deck + outer safety railing collider in world space
      const bOutX = frontDir === 'east' ? x + hw + balD * 0.5 : frontDir === 'west' ? x - hw - balD * 0.5 : x;
      const bOutZ = frontDir === 'south' ? z + hd + balD * 0.5 : frontDir === 'north' ? z - hd - balD * 0.5 : z;
      const bW = frontDir === 'east' || frontDir === 'west' ? balD : balW;
      const bD = frontDir === 'east' || frontDir === 'west' ? balW : balD;
      ctx.boxes.push({
        minX: bOutX - bW * 0.5,
        maxX: bOutX + bW * 0.5,
        minZ: bOutZ - bD * 0.5,
        maxZ: bOutZ + bD * 0.5,
        blocksSight: false,
        minY: roofY - 0.24,
        topY: roofY,
        climbable: true,
      });
    }
    ctx.group.add(facadeGrp);

    // --- Detailed Shop Interior (Front Shop + Optional Back Storage Godown!) ---
    const isEW = frontDir === 'east' || frontDir === 'west';
    const frontSign = frontDir === 'east' || frontDir === 'south' ? 1 : -1;

    // Optional internal partition wall separating Front Shop from Back Storage Room (Godown)
    if (hasBackStorage) {
      if (isEW) {
        const partX = x - frontSign * 0.4;
        addMarketBox(partX, z - hd * 0.56, 0.28, height - 0.1, depth * 0.36, 0, wallMat, { colliderTopY: height - 0.15 });
        addMarketBox(partX, z + hd * 0.56, 0.28, height - 0.1, depth * 0.36, 0, wallMat, { colliderTopY: height - 0.15 });
      } else {
        const partZ = z - frontSign * 0.4;
        addMarketBox(x - hw * 0.56, partZ, width * 0.36, height - 0.1, 0.28, 0, wallMat, { colliderTopY: height - 0.15 });
        addMarketBox(x + hw * 0.56, partZ, width * 0.36, height - 0.1, 0.28, 0, wallMat, { colliderTopY: height - 0.15 });
      }
    }

    // Shop serving counter (placed along one side of the front area so doorway & center lane stay wide open!)
    const counterOffsetFront = hasBackStorage ? frontSign * (isEW ? hw * 0.42 : hd * 0.42) : frontSign * 0.8;
    const sideOffset = isEW ? hd * 0.48 : hw * 0.48;
    const cntX = isEW ? x + counterOffsetFront : x - sideOffset * 0.6;
    const cntZ = isEW ? z - sideOffset * 0.62 : z + counterOffsetFront;
    const cntW = isEW ? 2.2 : 1.05;
    const cntD = isEW ? 1.05 : 2.2;

    addMarketBox(cntX, cntZ, cntW, 0.96, cntD, 0, woodMat, {
      blocksSight: true,
      colliderTopY: 1.05,
    });
    if (shopKind === 'mithai') {
      // Sweet shop glass showcase + colorful laddoo/jalebi trays on top!
      addVisualBox(ctx.group, cntX, 1.04, cntZ, cntW - 0.12, 0.12, cntD - 0.12, sweetTrayMat, false);
      addVisualBox(ctx.group, cntX, 1.24, cntZ, cntW - 0.08, 0.38, cntD - 0.08, glassCounterMat, false);
    } else if (shopKind === 'chai') {
      // Brass tea urn & serving tray on counter
      const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.48, 10), brassMat);
      urn.position.set(cntX, 1.2, cntZ);
      ctx.group.add(urn);
    } else {
      // Brass weighing balance on shop counter
      const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.44, 6), brassMat);
      scalePost.position.set(cntX, 1.18, cntZ);
      ctx.group.add(scalePost);
    }
    // Natural hiding spot tucked behind the shop counter!
    ctx.hidingSpots.push({
      x: isEW ? cntX : cntX - 0.9,
      z: isEW ? cntZ - 0.95 : cntZ,
      label: `Behind ${label} Counter`,
      kind: 'house',
    });

    // Tall stocked wall shelf along opposite interior wall (natural cover + authentic detail!)
    const shelfMat =
      shopKind === 'cloth' ? clothShelfMat : groceryShelfMat;
    const shX = isEW ? x + counterOffsetFront : x + hw - 0.68;
    const shZ = isEW ? z + hd - 0.68 : z + counterOffsetFront;
    const shW = isEW ? 3.2 : 0.64;
    const shD = isEW ? 0.64 : 3.2;
    addMarketBox(shX, shZ, shW, 2.25, shD, 0, shelfMat, {
      blocksSight: true,
      colliderTopY: 2.35,
    });
    ctx.hidingSpots.push({
      x: isEW ? shX : shX - 0.95,
      z: isEW ? shZ - 0.95 : shZ,
      label: `Beside ${label} Shelves`,
      kind: 'house',
    });

    // Back storage room props (burlap grain sacks + stacked wooden crates!)
    if (hasBackStorage) {
      const backX = isEW ? x - frontSign * (hw * 0.56) : x;
      const backZ = isEW ? z : z - frontSign * (hd * 0.56);
      addSackCluster(
        backX + (isEW ? 0 : -hw * 0.42),
        0,
        backZ + (isEW ? -hd * 0.44 : 0),
        `Behind ${label} Storage Sacks`,
      );
      addMarketBox(
        backX + (isEW ? 0 : hw * 0.44),
        backZ + (isEW ? hd * 0.44 : 0),
        1.35,
        1.15,
        1.15,
        0,
        darkWoodMat,
        { blocksSight: true, colliderTopY: 1.2 },
      );
      ctx.hidingSpots.push({
        x: backX,
        z: backZ,
        label: `Inside ${label} Back Storage`,
        kind: 'house',
      });
    }

    // Walkable Rooftop Slab (fades cleanly when inside ground-floor shop!)
    if (walkableRoof) {
      addRooftopSlab(x, z, width + 0.3, depth + 0.3, roofY, 0.24, roofMat, roofMeshes);
      // Low brick rooftop parapet walls (0.78m height — crouch cover on rooftops!)
      // Leave clean gaps along edges where rooftop bridges/stairs connect!
      const pH = 0.78;
      if (frontDir !== 'north') {
        addMarketBox(x, z - hd + 0.16, width - 3.6, pH, 0.28, roofY, brickMat, {
          blocksSight: true,
          colliderMinY: roofY - 0.05,
          colliderTopY: roofY + pH + 0.1,
        });
      }
      if (frontDir !== 'south') {
        addMarketBox(x, z + hd - 0.16, width - 3.6, pH, 0.28, roofY, brickMat, {
          blocksSight: true,
          colliderMinY: roofY - 0.05,
          colliderTopY: roofY + pH + 0.1,
        });
      }
      // Rooftop earthen water cistern / storage crate for hiding cover up top!
      addMarketBox(
        x - frontSign * 1.4,
        z + (isEW ? 2.6 : 0),
        1.45,
        1.05,
        1.35,
        roofY,
        stoneMat,
        {
          blocksSight: true,
          colliderMinY: roofY - 0.05,
          colliderTopY: roofY + 1.15,
        },
      );
      ctx.hidingSpots.push({
        x: x - frontSign * 1.4,
        z: z + (isEW ? 1.0 : 1.5),
        label: `On ${label} Rooftop`,
        kind: 'wall',
      });
    }

    // Register floor-aware HouseInterior so roof fades ONLY when player is inside ground shop (y < 2.8)!
    const doorX = frontDir === 'east' ? x + hw : frontDir === 'west' ? x - hw : x;
    const doorZ = frontDir === 'south' ? z + hd : frontDir === 'north' ? z - hd : z;
    ctx.houseInteriors.push({
      id,
      label,
      minX: x - hw,
      maxX: x + hw,
      minZ: z - hd,
      maxZ: z + hd,
      minY: -0.5,
      maxY: roofY - 0.65,
      doorX,
      doorZ,
      insideX: x,
      insideZ: z,
      roofMeshes,
    });

    const mapBld: MinimapBuilding = {
      x,
      z,
      width,
      depth,
      rotY: 0,
      kind: 'market',
    };
    ctx.buildings.push(mapBld);
  };

  /** Builds a colorful stationary 1990s Indian Vegetable / Produce Stall (NO vehicles/wheels!) */
  const addVegetableStall = (
    x: number,
    z: number,
    rotY: number,
    awningIdx: number,
    produceColors: [number, number, number],
    label: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    // Heavy wooden market table & lower crate shelf
    addVisualBox(g, 0, 0.86, 0, 2.85, 0.14, 1.35, woodMat, true);
    addVisualBox(g, 0, 0.34, 0, 2.55, 0.08, 1.12, darkWoodMat, false);
    for (const lx of [-1.28, 1.28]) {
      for (const lz of [-0.56, 0.56]) {
        addVisualBox(g, lx, 1.22, lz, 0.1, 2.44, 0.1, darkWoodMat, true);
      }
    }
    // Colorful sloped cloth canopy overhead
    const canopy = new THREE.Mesh(
      new THREE.PlaneGeometry(3.25, 1.95),
      awningMats[awningIdx % awningMats.length],
    );
    canopy.position.set(0, 2.46, 0.05);
    canopy.rotation.x = -Math.PI * 0.44;
    canopy.castShadow = true;
    g.add(canopy);

    // 3 vibrant overflowing bamboo baskets of fresh vegetables/fruits
    for (let i = 0; i < 3; i++) {
      const bx = -0.88 + i * 0.88;
      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.28, 0.24, 10),
        burlapMat,
      );
      basket.position.set(bx, 1.04, 0);
      g.add(basket);
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: produceColors[i],
          roughness: 0.78,
        }),
      );
      mound.position.set(bx, 1.1, 0);
      g.add(mound);
    }

    // Stored wooden crate tucked underneath table
    addVisualBox(g, -0.55, 0.55, 0.05, 0.9, 0.42, 0.72, darkWoodMat, false);
    ctx.group.add(g);

    const rotQ = Math.abs(Math.sin(rotY)) > 0.7;
    ctx.boxes.push({
      minX: x - (rotQ ? 0.75 : 1.48),
      maxX: x + (rotQ ? 0.75 : 1.48),
      minZ: z - (rotQ ? 1.48 : 0.75),
      maxZ: z + (rotQ ? 1.48 : 0.75),
      blocksSight: true,
      minY: 0,
      topY: 1.28,
    });
    ctx.hidingSpots.push({
      x: x + Math.sin(rotY) * 1.25,
      z: z + Math.cos(rotY) * 1.25,
      label,
      kind: 'gully',
    });
    ctx.buildings.push({
      x,
      z,
      width: rotQ ? 1.5 : 3.0,
      depth: rotQ ? 3.0 : 1.5,
      rotY: 0,
      kind: 'stall',
    });
  };

  // =========================================================================
  // 1. BAZAAR STREET NETWORK, NARROW ALLEYS & SMALL COURTYARDS
  // =========================================================================
  // Main Bazaar Spine (N-S) & Cross Sabzi Street (E-W)
  addRoadSegment(ctx, 0, 0, 5.6, 94, 0, textures, 0xcba97d, 0.022);
  addRoadSegment(ctx, 0, 0, 5.4, 94, Math.PI / 2, textures, 0xcba97d, 0.024);
  // Narrow Inner Connected Alleys behind the 4 core shop blocks
  addRoadSegment(ctx, -17.5, 0, 3.4, 72, 0, textures, 0xb8966b, 0.02);
  addRoadSegment(ctx, 17.5, 0, 3.4, 72, 0, textures, 0xb8966b, 0.02);
  addRoadSegment(ctx, 0, -18.0, 3.4, 72, Math.PI / 2, textures, 0xb8966b, 0.02);
  addRoadSegment(ctx, 0, 18.0, 3.4, 72, Math.PI / 2, textures, 0xb8966b, 0.02);
  // Outer Perimeter Market Ring Lanes (connecting all back alleys seamlessly!)
  addRoadSegment(ctx, -35.0, 0, 3.8, 72, 0, textures, 0xad8c62, 0.018);
  addRoadSegment(ctx, 35.0, 0, 3.8, 72, 0, textures, 0xad8c62, 0.018);
  addRoadSegment(ctx, 0, -34.5, 3.8, 72, Math.PI / 2, textures, 0xad8c62, 0.018);
  addRoadSegment(ctx, 0, 34.5, 3.8, 72, Math.PI / 2, textures, 0xad8c62, 0.018);

  // Central Bazaar Chowk Paved Plaza
  const chowk = new THREE.Mesh(
    new THREE.CircleGeometry(7.8, 28),
    cobbleCourtyardMat,
  );
  chowk.rotation.x = -Math.PI / 2;
  chowk.position.set(0, 0.032, 0);
  chowk.receiveShadow = true;
  ctx.group.add(chowk);
  ctx.landmarks.push({ x: 0, z: 0, radius: 7.8, kind: 'courtyard' });

  // West Sabzi Mandi Courtyard Paving (-26, 0) & East Chai/Pottery Courtyard Paving (26, 0)
  for (const cx of [-26.0, 26.0]) {
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 13.8), cobbleCourtyardMat);
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(cx, 0.03, 0);
    yard.receiveShadow = true;
    ctx.group.add(yard);
    ctx.landmarks.push({ x: cx, z: 0, radius: 6.2, kind: 'courtyard' });
  }

  // =========================================================================
  // 2. CENTRAL BAZAAR CHOWK: HERITAGE GHANTA GHAR (CLOCK TOWER) & LANTERNS
  // =========================================================================
  const clockGroup = new THREE.Group();
  clockGroup.position.set(0, 0, -2.4);
  addVisualBox(clockGroup, 0, 0.35, 0, 2.75, 0.7, 2.75, stoneMat, true);
  addVisualBox(clockGroup, 0, 3.3, 0, 1.62, 5.3, 1.62, stoneMat, true);
  addVisualBox(clockGroup, 0, 6.2, 0, 2.05, 0.44, 2.05, brickMat, true);
  // Crown onion dome & brass finial on top of Clock Tower
  const ctDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.86, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    stoneMat,
  );
  ctDome.position.y = 6.42;
  ctDome.castShadow = true;
  clockGroup.add(ctDome);
  const ctFinial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 8), brassMat);
  ctFinial.position.y = 7.45;
  clockGroup.add(ctFinial);

  // Detailed vintage clock faces on all 4 sides
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xfef6e0 });
  const handMat = new THREE.MeshBasicMaterial({ color: 0x221b15 });
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const fGrp = new THREE.Group();
    fGrp.position.set(Math.sin(a) * 0.84, 4.72, Math.cos(a) * 0.84);
    fGrp.rotation.y = a;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), faceMat);
    fGrp.add(face);
    // Hour & minute hands pointing to nostalgic 4:20 afternoon bazaar time
    const hHand = new THREE.Mesh(getBox(0.04, 0.24, 0.02), handMat);
    hHand.position.set(0.06, -0.05, 0.02);
    hHand.rotation.z = -2.1;
    fGrp.add(hHand);
    const mHand = new THREE.Mesh(getBox(0.03, 0.34, 0.02), handMat);
    mHand.position.set(-0.04, 0.09, 0.02);
    mHand.rotation.z = 0.55;
    fGrp.add(mHand);
    clockGroup.add(fGrp);
  }
  // Warm bazaar lamp mounted on Clock Tower (1 of 2 point lights for golden glow)
  const chowkLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lanternGlowMat);
  chowkLamp.position.set(0, 3.1, 0.92);
  clockGroup.add(chowkLamp);
  const chowkPt = new THREE.PointLight(0xffb85c, 2.0, 18, 1.5);
  chowkPt.position.set(0, 3.3, 1.1);
  clockGroup.add(chowkPt);
  ctx.group.add(clockGroup);

  ctx.boxes.push({
    minX: -1.42,
    maxX: 1.42,
    minZ: -3.82,
    maxZ: -1.02,
    blocksSight: true,
    minY: 0,
    topY: 7.5,
  });
  ctx.hidingSpots.push({
    x: 0,
    z: -4.65,
    label: 'Behind Bazaar Ghanta Ghar',
    kind: 'gully',
  });

  // =========================================================================
  // 3. FOUR CORE CONNECTED TWO-ROOM SHOP + GODOWN BLOCKS WITH BALCONIES & ROOFTOPS
  // =========================================================================
  // NW Block: Gupta Kirana Store + Back Spice Godown (x: -15.4..-3.4, z: -15.6..-4.4)
  buildBazaarBuilding({
    id: 'shop-kirana-nw',
    label: 'Gupta Kirana Store',
    signTitle: 'GUPTA KIRANA STORE',
    signSub: 'GROCERY • SPICES • GRAIN • EST. 1978',
    signBg: '#1f4d7a',
    signBorder: '#f2c14e',
    signText: '#fff8e2',
    x: -9.4,
    z: -10.0,
    width: 12.0,
    depth: 11.2,
    height: 3.6,
    frontDir: 'east',
    wallMat: wallCreamMat,
    awningIdx: 0,
    shopKind: 'kirana',
    hasBackStorage: true,
    hasBalcony: true,
  });

  // NE Block: Sharma Mithai & Halwai + Back Sweet Kitchen (x: 3.4..15.4, z: -15.6..-4.4)
  buildBazaarBuilding({
    id: 'shop-mithai-ne',
    label: 'Sharma Mithai Shop',
    signTitle: 'SHARMA MITHAI SHOP',
    signSub: 'FRESH JALEBI • LADDOO • BARFI • HALWAI',
    signBg: '#942824',
    signBorder: '#ffd15c',
    signText: '#fff5d6',
    x: 9.4,
    z: -10.0,
    width: 12.0,
    depth: 11.2,
    height: 3.6,
    frontDir: 'west',
    wallMat: wallPinkMat,
    awningIdx: 1,
    shopKind: 'mithai',
    hasBackStorage: true,
    hasBalcony: true,
  });

  // SW Block: Verma Cloth Emporium + Back Textile Godown (x: -15.4..-3.4, z: 4.4..15.6)
  buildBazaarBuilding({
    id: 'shop-cloth-sw',
    label: 'Verma Cloth House',
    signTitle: 'VERMA CLOTH HOUSE',
    signSub: 'SAREES • COTTON • KURTA • DRESS MATERIAL',
    signBg: '#1c6354',
    signBorder: '#f5d27a',
    signText: '#fff7e0',
    x: -9.4,
    z: 10.0,
    width: 12.0,
    depth: 11.2,
    height: 3.6,
    frontDir: 'east',
    wallMat: wallBlueMat,
    awningIdx: 2,
    shopKind: 'cloth',
    hasBackStorage: true,
    hasBalcony: true,
  });

  // SE Block: Raju Chai & Samosa + Back Pantry (x: 3.4..15.4, z: 4.4..15.6)
  buildBazaarBuilding({
    id: 'shop-chai-se',
    label: 'Raju Chai & Samosa',
    signTitle: 'RAJU CHAI & SAMOSA',
    signSub: 'GARAM MASALA CHAI • SAMOSA • KACHORI',
    signBg: '#a6431e',
    signBorder: '#fae2a0',
    signText: '#fff9e6',
    x: 9.4,
    z: 10.0,
    width: 12.0,
    depth: 11.2,
    height: 3.6,
    frontDir: 'west',
    wallMat: wallOchreMat,
    awningIdx: 4,
    shopKind: 'chai',
    hasBackStorage: true,
    hasBalcony: true,
  });

  // =========================================================================
  // 4. EIGHT OUTER CONNECTED BAZAAR SHOPS (ALL WITH FRONT + BACK ENTRANCES!)
  // =========================================================================
  // Outer NW: Patel Grain & Spice Store (connects to NW Kirana rooftop via overhead alley bridge!)
  buildBazaarBuilding({
    id: 'shop-grain-nw',
    label: 'Patel Grain & Spice',
    signTitle: 'PATEL GRAIN & SPICE',
    signSub: 'WHEAT • RICE • DAL • HALDI • MIRCHI',
    signBg: '#7a441e',
    signBorder: '#f5cb6c',
    signText: '#fff6de',
    x: -26.0,
    z: -12.6,
    width: 12.2,
    depth: 7.4,
    height: 3.6,
    frontDir: 'south',
    wallMat: wallOchreMat,
    awningIdx: 1,
    shopKind: 'kirana',
    hasBackStorage: true,
    hasBalcony: false,
  });

  // Outer NE: Lakshmi Bangle & Brassware (connects to NE Mithai rooftop via alley bridge!)
  buildBazaarBuilding({
    id: 'shop-bangle-ne',
    label: 'Lakshmi Bangle & Brass',
    signTitle: 'LAKSHMI BANGLE STORE',
    signSub: 'GLASS BANGLES • BRASSWARE • POOJA ITEMS',
    signBg: '#8c2246',
    signBorder: '#ffd468',
    signText: '#fff5e0',
    x: 26.0,
    z: -12.6,
    width: 12.2,
    depth: 7.4,
    height: 3.6,
    frontDir: 'south',
    wallMat: wallPinkMat,
    awningIdx: 4,
    shopKind: 'cloth',
    hasBackStorage: true,
    hasBalcony: false,
  });

  // Outer SW: New Bharat Tailors (connects to SW Cloth rooftop via alley bridge!)
  buildBazaarBuilding({
    id: 'shop-tailor-sw',
    label: 'New Bharat Tailors',
    signTitle: 'NEW BHARAT TAILORS',
    signSub: 'GENTS & LADIES STITCHING • EST. 1984',
    signBg: '#254a78',
    signBorder: '#f0d284',
    signText: '#fffaf0',
    x: -26.0,
    z: 12.6,
    width: 12.2,
    depth: 7.4,
    height: 3.6,
    frontDir: 'north',
    wallMat: wallMintMat,
    awningIdx: 3,
    shopKind: 'cloth',
    hasBackStorage: true,
    hasBalcony: false,
  });

  // Outer SE: Kisan Utensils & Hardware (connects to SE Chai rooftop via alley bridge!)
  buildBazaarBuilding({
    id: 'shop-utensil-se',
    label: 'Kisan Brass & Utensils',
    signTitle: 'KISAN BARTAN BHANDAR',
    signSub: 'STEEL • BRASS POTS • LANTERNS • TOOLS',
    signBg: '#2d5c48',
    signBorder: '#f0cc72',
    signText: '#fff8e6',
    x: 26.0,
    z: 12.6,
    width: 12.2,
    depth: 7.4,
    height: 3.6,
    frontDir: 'north',
    wallMat: wallCreamMat,
    awningIdx: 2,
    shopKind: 'general',
    hasBackStorage: true,
    hasBalcony: false,
  });

  // North Bazaar Street Shops (z = -25.8, front onto North Alley + back door onto North Ring Lane!)
  buildBazaarBuilding({
    id: 'shop-north-w',
    label: 'Ramlal Provision Store',
    signTitle: 'RAMLAL GENERAL STORE',
    signSub: 'SOAP • OIL • TEA • BISCUITS • TOYS',
    signBg: '#a63826',
    signBorder: '#f6d884',
    signText: '#fff9e8',
    x: -9.5,
    z: -25.8,
    width: 10.6,
    depth: 7.2,
    height: 3.5,
    frontDir: 'south',
    wallMat: wallCreamMat,
    awningIdx: 0,
    shopKind: 'kirana',
  });
  buildBazaarBuilding({
    id: 'shop-north-e',
    label: 'Classic Radio & Watch',
    signTitle: 'CLASSIC RADIO & WATCH',
    signSub: 'TRANSISTORS • CASSETTES • CLOCK REPAIR',
    signBg: '#24486b',
    signBorder: '#e8c468',
    signText: '#fff7e4',
    x: 9.5,
    z: -25.8,
    width: 10.6,
    depth: 7.2,
    height: 3.5,
    frontDir: 'south',
    wallMat: wallBlueMat,
    awningIdx: 3,
    shopKind: 'general',
  });

  // South Bazaar Street Shops (z = 25.8, front onto South Alley + back door onto South Ring Lane!)
  buildBazaarBuilding({
    id: 'shop-south-w',
    label: 'Mangal Paan & Sweets',
    signTitle: 'MANGAL PAAN & MITHAI',
    signSub: 'BANARASI PAAN • GULAB JAMUN • LASSI',
    signBg: '#8c2a3a',
    signBorder: '#f5d27a',
    signText: '#fff6e0',
    x: -9.5,
    z: 25.8,
    width: 10.6,
    depth: 7.2,
    height: 3.5,
    frontDir: 'north',
    wallMat: wallPinkMat,
    awningIdx: 4,
    shopKind: 'mithai',
  });
  buildBazaarBuilding({
    id: 'shop-south-e',
    label: 'Gupta Book & Stationery',
    signTitle: 'GUPTA BOOK DEPOT',
    signSub: 'SCHOOL BOOKS • SLATES • FOUNTAIN PENS',
    signBg: '#2a614f',
    signBorder: '#f0cf7a',
    signText: '#fff9e6',
    x: 9.5,
    z: 25.8,
    width: 10.6,
    depth: 7.2,
    height: 3.5,
    frontDir: 'north',
    wallMat: wallMintMat,
    awningIdx: 2,
    shopKind: 'general',
  });

  // =========================================================================
  // 5. WALKABLE EXTERIOR ROOFTOP STAIRCASES & CONNECTED ROOFTOP BRIDGES!
  // =========================================================================
  // 4 Gentle Walkable Exterior Brick Staircases (17 steps, rise = 0.212m <= 0.22m!)
  // Rising along the North & South inner alley edges right onto all 4 core shop rooftops (y = 3.6m)!
  buildMarketStaircase({
    startX: -4.2,
    startZ: -16.45,
    startY: 0,
    endY: 3.6,
    dir: 'west',
    width: 1.55,
    steps: 17,
    tread: 0.4,
    mat: brickMat,
  });
  buildMarketStaircase({
    startX: 4.2,
    startZ: -16.45,
    startY: 0,
    endY: 3.6,
    dir: 'east',
    width: 1.55,
    steps: 17,
    tread: 0.4,
    mat: brickMat,
  });
  buildMarketStaircase({
    startX: -4.2,
    startZ: 16.45,
    startY: 0,
    endY: 3.6,
    dir: 'west',
    width: 1.55,
    steps: 17,
    tread: 0.4,
    mat: brickMat,
  });
  buildMarketStaircase({
    startX: 4.2,
    startZ: 16.45,
    startY: 0,
    endY: 3.6,
    dir: 'east',
    width: 1.55,
    steps: 17,
    tread: 0.4,
    mat: brickMat,
  });

  // Staircase top landing pads connecting seamlessly onto the 4 core rooftops (y = 3.6m)
  addRooftopSlab(-11.8, -16.0, 2.2, 1.8, 3.6, 0.22, brickMat);
  addRooftopSlab(11.8, -16.0, 2.2, 1.8, 3.6, 0.22, brickMat);
  addRooftopSlab(-11.8, 16.0, 2.2, 1.8, 3.6, 0.22, brickMat);
  addRooftopSlab(11.8, 16.0, 2.2, 1.8, 3.6, 0.22, brickMat);

  // Connected Wooden Rooftop Bridges spanning over Main Bazaar Street & Inner Back Alleys!
  const addRooftopBridge = (
    x: number,
    z: number,
    w: number,
    d: number,
    yTop = 3.6,
    isEW = true,
  ) => {
    addRooftopSlab(x, z, w, d, yTop, 0.2, woodMat);
    // Low wooden bridge handrails on both sides
    if (isEW) {
      addMarketBox(x, z - d * 0.5 + 0.08, w, 0.85, 0.14, yTop, darkWoodMat, {
        blocksSight: false,
        colliderMinY: yTop - 0.05,
        colliderTopY: yTop + 0.9,
      });
      addMarketBox(x, z + d * 0.5 - 0.08, w, 0.85, 0.14, yTop, darkWoodMat, {
        blocksSight: false,
        colliderMinY: yTop - 0.05,
        colliderTopY: yTop + 0.9,
      });
    } else {
      addMarketBox(x - w * 0.5 + 0.08, z, 0.14, 0.85, d, yTop, darkWoodMat, {
        blocksSight: false,
        colliderMinY: yTop - 0.05,
        colliderTopY: yTop + 0.9,
      });
      addMarketBox(x + w * 0.5 - 0.08, z, 0.14, 0.85, d, yTop, darkWoodMat, {
        blocksSight: false,
        colliderMinY: yTop - 0.05,
        colliderTopY: yTop + 0.9,
      });
    }
  };
  // Bridges over Main N-S Bazaar Street connecting NW <-> NE and SW <-> SE rooftops!
  addRooftopBridge(0, -11.4, 7.2, 2.5, 3.6, true);
  addRooftopBridge(0, 11.4, 7.2, 2.5, 3.6, true);
  // Bridges over West & East Inner Alleys connecting Inner Blocks <-> Outer Bazaar Shops!
  addRooftopBridge(-17.6, -11.4, 4.8, 2.4, 3.6, true);
  addRooftopBridge(17.6, -11.4, 4.8, 2.4, 3.6, true);
  addRooftopBridge(-17.6, 11.4, 4.8, 2.4, 3.6, true);
  addRooftopBridge(17.6, 11.4, 4.8, 2.4, 3.6, true);

  // =========================================================================
  // 6. WEST SABZI MANDI COURTYARD (VEGETABLE STALLS) & EAST CHAI/POTTERY COURTYARD
  // =========================================================================
  // 4 Vibrant Stationary Wooden Vegetable Stalls in West Sabzi Mandi Courtyard (-26, 0)
  addVegetableStall(
    -29.2,
    -4.6,
    0,
    0,
    [0xd93526, 0xc22b44, 0xe87b22],
    'Behind Tomato & Onion Stall',
  );
  addVegetableStall(
    -29.2,
    4.6,
    Math.PI,
    2,
    [0x2f7d32, 0x4ca638, 0x7cb342],
    'Behind Fresh Greens Stall',
  );
  addVegetableStall(
    -22.8,
    -4.6,
    0,
    1,
    [0xf2ebd4, 0xb88c52, 0xe86e24],
    'Behind Cauliflower & Potato Stall',
  );
  addVegetableStall(
    -22.8,
    4.6,
    Math.PI,
    3,
    [0xf5b822, 0xe6d635, 0x8bc34a],
    'Behind Fruit & Lemon Stall',
  );
  // Two additional roadside vegetable & spice stalls near North & South Bazaar Approaches
  addVegetableStall(
    -17.5,
    -25.5,
    Math.PI / 2,
    1,
    [0xd94228, 0xf2b824, 0x428a38],
    'Behind North Spice & Chilli Stall',
  );
  addVegetableStall(
    17.5,
    25.5,
    -Math.PI / 2,
    0,
    [0xe6522e, 0xf0c230, 0x3b8c48],
    'Behind South Vegetable Stall',
  );

  // East Chai & Pottery Courtyard (26, 0): Neem Shade Tree, Charpais, Clay Pottery Stall & Water Pyau!
  addTree(ctx, 26.2, 0.0, 1.24, textures, 0x437836, false, true, 'Behind East Courtyard Neem Tree');
  addMarketSeat(22.2, -4.4, 0.2, 'charpai', 'Chai Courtyard Charpai');
  addMarketSeat(22.2, 4.4, Math.PI - 0.2, 'bench', 'Bazaar Shade Bench');
  addMarketSeat(-26.0, -7.2, 0, 'bench', 'Sabzi Mandi Wooden Bench');
  addMarketSeat(0, 6.4, Math.PI, 'bench', 'Chowk Clock Tower Bench');

  // Traditional Earthen Clay Pottery & Matka Display Stall in East Courtyard (30.2, -3.5)
  const potStall = new THREE.Group();
  potStall.position.set(30.2, 0, -3.5);
  addVisualBox(potStall, 0, 0.72, 0, 1.4, 0.14, 3.2, woodMat, true);
  addVisualBox(potStall, 0, 0.36, -1.35, 1.2, 0.72, 0.12, darkWoodMat, false);
  addVisualBox(potStall, 0, 0.36, 1.35, 1.2, 0.72, 0.12, darkWoodMat, false);
  for (let i = 0; i < 4; i++) {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), clayMat);
    pot.scale.set(1, 1.12, 1);
    pot.position.set(0, 1.08, -1.1 + i * 0.74);
    pot.castShadow = true;
    potStall.add(pot);
  }
  ctx.group.add(potStall);
  ctx.boxes.push({
    minX: 29.4,
    maxX: 31.0,
    minZ: -5.2,
    maxZ: -1.8,
    blocksSight: true,
    minY: 0,
    topY: 1.45,
  });
  ctx.hidingSpots.push({ x: 28.4, z: -3.5, label: 'Behind Clay Pottery Stall', kind: 'gully' });

  // Second Warm Evening Bazaar Lantern in East Courtyard (2 of 2 point lights!)
  const eastLanternPost = new THREE.Group();
  eastLanternPost.position.set(29.8, 0, 4.2);
  addVisualBox(eastLanternPost, 0, 1.65, 0, 0.14, 3.3, 0.14, darkWoodMat, true);
  const eastBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lanternGlowMat);
  eastBulb.position.set(-0.35, 3.15, 0);
  eastLanternPost.add(eastBulb);
  const eastPt = new THREE.PointLight(0xffb454, 1.7, 16, 1.5);
  eastPt.position.set(-0.35, 3.15, 0);
  eastLanternPost.add(eastPt);
  ctx.group.add(eastLanternPost);

  // =========================================================================
  // 7. FESTIVE OVERHEAD HANGING BUNTING DECORATIONS (1 SINGLE INSTANCED MESH!)
  // =========================================================================
  // Crisscross festive bazaar bunting across Main Streets, Narrow Alleys & Courtyards
  addOverheadGarland(-3.4, -7.2, 3.4, -7.2, 4.1);
  addOverheadGarland(-3.4, 7.2, 3.4, 7.2, 4.1);
  addOverheadGarland(-7.2, -4.4, -7.2, 4.4, 4.0);
  addOverheadGarland(7.2, -4.4, 7.2, 4.4, 4.0);
  addOverheadGarland(-15.4, -4.4, -19.8, -8.8, 3.9);
  addOverheadGarland(15.4, -4.4, 19.8, -8.8, 3.9);
  addOverheadGarland(-15.4, 4.4, -19.8, 8.8, 3.9);
  addOverheadGarland(15.4, 4.4, 19.8, 8.8, 3.9);
  addOverheadGarland(-29.2, -4.6, -22.8, 4.6, 3.85);
  addOverheadGarland(-29.2, 4.6, -22.8, -4.6, 3.85);
  addOverheadGarland(21.0, -4.6, 30.2, 4.2, 3.9);
  addOverheadGarland(-4.2, -22.2, 4.2, -22.2, 3.95);
  addOverheadGarland(-4.2, 22.2, 4.2, 22.2, 3.95);

  if (buntingTriangles.length > 0) {
    const flagGeo = new THREE.ConeGeometry(0.16, 0.34, 3);
    flagGeo.rotateX(Math.PI); // Point triangle tip downward
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
    });
    const inst = new THREE.InstancedMesh(flagGeo, flagMat, buntingTriangles.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < buntingTriangles.length; i++) {
      const f = buntingTriangles[i];
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, f.rotY, 0);
      dummy.scale.set(1, 1, 0.25);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.setHex(f.color);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    ctx.group.add(inst);
  }

  // =========================================================================
  // 8. NARROW ALLEY CRATES, GRAIN SACKS & SHADE TREES (NATURAL COVER!)
  // =========================================================================
  addCrateStack(ctx, -16.6, -1.8, textures, 'Behind West Alley Spice Crates');
  addCrateStack(ctx, 16.6, 1.8, textures, 'Behind East Alley Cloth Crates');
  addCrateStack(ctx, -33.2, -16.5, textures, 'Behind NW Outer Market Crates');
  addCrateStack(ctx, 33.2, 16.5, textures, 'Behind SE Outer Market Crates');
  addCrateStack(ctx, -17.5, 25.2, textures, 'Behind SW Lane Provision Crates');
  addCrateStack(ctx, 17.5, -25.2, textures, 'Behind NE Lane Brass Crates');

  addSackCluster(-5.5, 0, -19.2, 'Behind North Alley Grain Sacks');
  addSackCluster(5.5, 0, 19.2, 'Behind South Alley Rice Sacks');
  addSackCluster(-33.5, 0, 15.8, 'Behind West Lane Burlap Sacks');
  addSackCluster(33.5, 0, -15.8, 'Behind East Lane Flour Sacks');

  // Bazaar perimeter & approach shade trees (Neem & Banyan framing the market naturally)
  const marketTrees: Array<[number, number, number]> = [
    [-39.5, -26.0, 1.25],
    [39.5, -26.0, 1.22],
    [-39.5, 26.0, 1.26],
    [39.5, 26.0, 1.24],
    [-22.0, -39.5, 1.2],
    [22.0, -39.5, 1.22],
    [-22.0, 39.5, 1.22],
    [22.0, 39.5, 1.2],
    [-41.5, 0.0, 1.3],
    [41.5, 0.0, 1.3],
  ];
  for (const [tx, tz, sc] of marketTrees) {
    addTree(ctx, tx, tz, sc, textures, 0x457936, false, true, 'Behind Bazaar Shade Tree');
  }

  addNaturalPerimeter(
    ctx,
    textures,
    58.0,
    38,
    [0x457435, 0x51803c, 0x3b672d],
    'stone_wall',
  );

  // =========================================================================
  // 9. AI PATROL LOOP & 10-PLAYER MULTIPLAYER SPAWNS
  // =========================================================================
  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.2),
    new THREE.Vector3(0, 0, -18.0),
    new THREE.Vector3(-17.5, 0, -18.0),
    new THREE.Vector3(-17.5, 0, 0),
    new THREE.Vector3(-25.8, 0, 0),
    new THREE.Vector3(-17.5, 0, 18.0),
    new THREE.Vector3(0, 0, 18.0),
    new THREE.Vector3(17.5, 0, 18.0),
    new THREE.Vector3(17.5, 0, 0),
    new THREE.Vector3(22.2, 0, 0),
    new THREE.Vector3(17.5, 0, -18.0),
    new THREE.Vector3(35.0, 0, 0),
    new THREE.Vector3(-35.0, 0, 0),
    new THREE.Vector3(0, 0, -34.5),
    new THREE.Vector3(0, 0, 34.5),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: WORLD_RADIUS,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    seats: ctx.seats,
    templeBells: [],
    minimapLayout: {
      worldRadius: WORLD_RADIUS,
      groundTint: '#c9aa7c',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.0, 0, 7.8],
      previewCamPos: [0.0, 6.2, 22.0],
      previewLookAt: [0.0, 2.8, -6.0],
      seeker: [0.0, 3.8, Math.PI],
      hiders: [
        [0.0, 18.0, Math.PI],
        [0.0, -18.0, 0.0],
        [-17.5, -4.0, 1.4],
        [17.5, 4.0, -1.4],
        [-25.8, 0.0, 1.5],
        [22.2, 0.0, -1.5],
        [-17.5, 18.0, 0.8],
        [17.5, -18.0, -0.8],
        [-35.0, 6.0, 1.5],
        [35.0, -6.0, -1.5],
      ],
    },
  };
}

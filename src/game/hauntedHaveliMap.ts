import * as THREE from 'three';
import {
  addGroundPlane,
  addRoadSegment,
  addTree,
  addVisualBox,
  createMapContext,
  MapBuildContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { MinimapBuilding } from './types';
import { VillageBuildResult } from './village';

// ---------------------------------------------------------------------------
// Custom Procedural Textures for the 1990s Abandoned Indian Haveli
// ---------------------------------------------------------------------------
interface HaveliTextures {
  sandstone: THREE.CanvasTexture;
  crackedPlaster: THREE.CanvasTexture;
  flagstone: THREE.CanvasTexture;
  oldWood: THREE.CanvasTexture;
  cobweb: THREE.CanvasTexture;
  curtain: THREE.CanvasTexture;
  paintings: THREE.CanvasTexture[];
  moonBeam: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isColor = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createHaveliTextures(): HaveliTextures {
  // 1. Weathered Rajasthani sandstone with mortar joints, damp stains & hairline cracks
  const [ssCanvas, ss] = makeCanvas(256, 256);
  ss.fillStyle = '#9c8670';
  ss.fillRect(0, 0, 256, 256);
  const rows = 8;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 32;
    for (let c = -1; c < 5; c++) {
      const bx = c * 64 + offset;
      const by = r * rowH;
      const tone = 140 + ((r * 29 + c * 47) & 31) - 16;
      ss.fillStyle = `rgb(${tone}, ${Math.round(tone * 0.85)}, ${Math.round(tone * 0.72)})`;
      ss.fillRect(bx + 2, by + 2, 60, rowH - 4);
      // Subtle weathering speckle
      ss.fillStyle = 'rgba(42, 34, 28, 0.12)';
      ss.fillRect(bx + 4, by + rowH - 8, 56, 4);
    }
    // Mortar line
    ss.fillStyle = 'rgba(48, 38, 30, 0.45)';
    ss.fillRect(0, r * rowH, 256, 2);
  }
  // Dampness patches & moss streaks near base
  const dampGrad = ss.createLinearGradient(0, 175, 0, 256);
  dampGrad.addColorStop(0, 'rgba(38, 48, 34, 0)');
  dampGrad.addColorStop(1, 'rgba(34, 46, 30, 0.36)');
  ss.fillStyle = dampGrad;
  ss.fillRect(0, 175, 256, 81);
  // Cracks
  ss.strokeStyle = 'rgba(32, 24, 20, 0.58)';
  ss.lineWidth = 1.6;
  const crackPaths = [
    [
      [42, 18],
      [50, 48],
      [44, 78],
      [56, 114],
    ],
    [
      [182, 90],
      [174, 126],
      [188, 162],
      [180, 208],
    ],
    [
      [110, 160],
      [124, 188],
      [118, 224],
    ],
  ];
  for (const pts of crackPaths) {
    ss.beginPath();
    ss.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ss.lineTo(pts[i][0], pts[i][1]);
    ss.stroke();
  }
  const sandstone = finalizeTexture(ssCanvas, 2, 2);

  // 2. Peeling lime-plaster interior wall texture with exposed brick patches & cracks
  const [plCanvas, pl] = makeCanvas(256, 256);
  pl.fillStyle = '#aba08f';
  pl.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    pl.fillStyle = i % 2 === 0 ? 'rgba(72,62,52,0.08)' : 'rgba(210,198,178,0.09)';
    pl.fillRect(x, y, 8 + (i % 14), 5 + (i % 11));
  }
  // Exposed aged brick patch where plaster peeled away
  pl.fillStyle = '#6f4a3c';
  pl.beginPath();
  pl.ellipse(76, 154, 34, 22, 0.2, 0, Math.PI * 2);
  pl.fill();
  pl.fillStyle = '#845947';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      pl.fillRect(50 + c * 15 + (r % 2) * 6, 138 + r * 9, 12, 6);
    }
  }
  // Fine plaster fracture lines
  pl.strokeStyle = 'rgba(42, 36, 30, 0.45)';
  pl.lineWidth = 1.4;
  pl.beginPath();
  pl.moveTo(190, 22);
  pl.lineTo(176, 66);
  pl.lineTo(188, 108);
  pl.lineTo(170, 152);
  pl.moveTo(176, 66);
  pl.lineTo(205, 82);
  pl.stroke();
  const crackedPlaster = finalizeTexture(plCanvas, 2, 1);

  // 3. Aged mossy flagstone courtyard & hall floor texture
  const [flCanvas, fl] = makeCanvas(256, 256);
  fl.fillStyle = '#47433e';
  fl.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const shade = 104 + ((r * 37 + c * 23) % 26) - 13;
      fl.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 9})`;
      fl.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);
      // Mossy corner edges
      if ((r + c) % 3 === 0) {
        fl.fillStyle = 'rgba(56, 76, 46, 0.34)';
        fl.fillRect(c * 64 + 2, r * 64 + 2, 18, 12);
      }
      // Hairline flagstone crack
      if ((r * 4 + c) % 5 === 2) {
        fl.strokeStyle = 'rgba(34, 30, 26, 0.42)';
        fl.lineWidth = 1.2;
        fl.beginPath();
        fl.moveTo(c * 64 + 10, r * 64 + 14);
        fl.lineTo(c * 64 + 38, r * 64 + 46);
        fl.stroke();
      }
    }
  }
  const flagstone = finalizeTexture(flCanvas, 6, 6);

  // 4. Dusty aged dark teak wood planks (balconies, stairs, doors, furniture)
  const [wdCanvas, wd] = makeCanvas(256, 256);
  wd.fillStyle = '#4b3324';
  wd.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 6; p++) {
    const py = p * 42.6;
    const tone = 68 + ((p * 19) % 18) - 9;
    wd.fillStyle = `rgb(${tone + 14}, ${tone - 6}, ${tone - 22})`;
    wd.fillRect(0, py + 2, 256, 39);
    // Grain streaks
    wd.fillStyle = 'rgba(26, 16, 10, 0.2)';
    for (let g = 0; g < 6; g++) {
      wd.fillRect(0, py + 5 + g * 6, 256, 1.5);
    }
    // Dusty patina
    wd.fillStyle = 'rgba(175, 168, 152, 0.08)';
    wd.fillRect(0, py + 12, 256, 12);
    // Plank seam
    wd.fillStyle = 'rgba(18, 11, 6, 0.65)';
    wd.fillRect(0, py, 256, 2.2);
  }
  const oldWood = finalizeTexture(wdCanvas, 2, 2);

  // 5. Translucent radial corner cobweb texture (alpha)
  const [cwCanvas, cw] = makeCanvas(256, 256);
  cw.clearRect(0, 0, 256, 256);
  cw.strokeStyle = 'rgba(225, 232, 240, 0.65)';
  cw.lineWidth = 1.6;
  const ox = 16;
  const oy = 16;
  const spokes = 8;
  for (let i = 0; i <= spokes; i++) {
    const ang = (i / spokes) * (Math.PI * 0.5);
    cw.beginPath();
    cw.moveTo(ox, oy);
    cw.lineTo(ox + Math.cos(ang) * 235, oy + Math.sin(ang) * 235);
    cw.stroke();
  }
  cw.lineWidth = 1.25;
  for (let ring = 1; ring <= 7; ring++) {
    const r = ring * 30;
    cw.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const ang = (i / spokes) * (Math.PI * 0.5);
      const px = ox + Math.cos(ang) * r;
      const py = oy + Math.sin(ang) * r;
      if (i === 0) {
        cw.moveTo(px, py);
      } else {
        const midAng = ((i - 0.5) / spokes) * (Math.PI * 0.5);
        const sag = r * 0.87;
        cw.quadraticCurveTo(
          ox + Math.cos(midAng) * sag,
          oy + Math.sin(midAng) * sag,
          px,
          py,
        );
      }
    }
    cw.stroke();
  }
  const cobweb = finalizeTexture(cwCanvas, 1, 1, true);

  // 6. Dusty maroon-gold patterned Indian curtain fabric
  const [ctCanvas, ct] = makeCanvas(128, 256);
  ct.fillStyle = '#5e2932';
  ct.fillRect(0, 0, 128, 256);
  // Vertical fabric folds
  for (let x = 0; x < 128; x += 16) {
    const g = ct.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, 'rgba(18, 8, 12, 0.42)');
    g.addColorStop(0.5, 'rgba(165, 96, 102, 0.14)');
    g.addColorStop(1, 'rgba(18, 8, 12, 0.38)');
    ct.fillStyle = g;
    ct.fillRect(x, 0, 16, 256);
  }
  // Faded zari gold border near hem
  ct.fillStyle = 'rgba(184, 148, 84, 0.52)';
  ct.fillRect(0, 224, 128, 10);
  ct.fillRect(0, 240, 128, 5);
  // Dusty fade near bottom hem
  const dustHem = ct.createLinearGradient(0, 180, 0, 256);
  dustHem.addColorStop(0, 'rgba(155, 146, 132, 0)');
  dustHem.addColorStop(1, 'rgba(155, 146, 132, 0.34)');
  ct.fillStyle = dustHem;
  ct.fillRect(0, 180, 128, 76);
  const curtain = finalizeTexture(ctCanvas, 1, 1);

  // 7. Three faded vintage 1990s/ancestral framed Indian paintings
  const paintings: THREE.CanvasTexture[] = [];
  const paintSpecs: Array<{
    bgTop: string;
    bgBot: string;
    subject: 'royal' | 'palace' | 'banyan';
  }> = [
    { bgTop: '#322b26', bgBot: '#1d1814', subject: 'royal' },
    { bgTop: '#313a4d', bgBot: '#4d4136', subject: 'palace' },
    { bgTop: '#3d392d', bgBot: '#292e24', subject: 'banyan' },
  ];
  for (const spec of paintSpecs) {
    const [pc, pctx] = makeCanvas(128, 160);
    const bg = pctx.createLinearGradient(0, 0, 0, 160);
    bg.addColorStop(0, spec.bgTop);
    bg.addColorStop(1, spec.bgBot);
    pctx.fillStyle = bg;
    pctx.fillRect(0, 0, 128, 160);

    if (spec.subject === 'royal') {
      // Vintage sepia silhouette portrait of an ancestral zamindar in turban & sherwani
      pctx.fillStyle = '#5c4637';
      pctx.beginPath();
      pctx.ellipse(64, 140, 38, 42, 0, Math.PI, Math.PI * 2);
      pctx.fill();
      // Face
      pctx.fillStyle = '#8b6f58';
      pctx.beginPath();
      pctx.ellipse(64, 72, 16, 20, 0, 0, Math.PI * 2);
      pctx.fill();
      // Rajasthani pagri (turban)
      pctx.fillStyle = '#7e3a32';
      pctx.beginPath();
      pctx.ellipse(64, 53, 21, 12, -0.1, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#b49257';
      pctx.fillRect(59, 44, 6, 12);
      // Mustache
      pctx.strokeStyle = '#2d211b';
      pctx.lineWidth = 2.4;
      pctx.beginPath();
      pctx.moveTo(54, 78);
      pctx.quadraticCurveTo(64, 74, 74, 78);
      pctx.stroke();
    } else if (spec.subject === 'palace') {
      // Moonlit heritage haveli skyline painting
      pctx.fillStyle = '#d4d9e6';
      pctx.beginPath();
      pctx.arc(92, 36, 12, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#5f4d3d';
      pctx.fillRect(22, 86, 84, 52);
      pctx.beginPath();
      pctx.arc(64, 86, 16, Math.PI, Math.PI * 2);
      pctx.fill();
      pctx.beginPath();
      pctx.arc(34, 86, 10, Math.PI, Math.PI * 2);
      pctx.fill();
      pctx.beginPath();
      pctx.arc(94, 86, 10, Math.PI, Math.PI * 2);
      pctx.fill();
    } else {
      // Old banyan tree & village well watercolor
      pctx.fillStyle = '#4c573f';
      pctx.beginPath();
      pctx.arc(64, 68, 34, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = '#4a3728';
      pctx.fillRect(58, 86, 12, 52);
      pctx.fillStyle = '#766a58';
      pctx.fillRect(24, 122, 26, 18);
    }

    // Aged dust vignette & canvas cracks
    pctx.strokeStyle = 'rgba(20, 15, 12, 0.35)';
    pctx.lineWidth = 4;
    pctx.strokeRect(4, 4, 120, 152);
    pctx.fillStyle = 'rgba(182, 168, 144, 0.14)';
    pctx.fillRect(0, 0, 128, 160);
    paintings.push(finalizeTexture(pc, 1, 1));
  }

  // 8. Soft translucent volumetric-style moonlight shaft gradient
  const [mbCanvas, mb] = makeCanvas(128, 256);
  const mg = mb.createLinearGradient(0, 0, 0, 256);
  mg.addColorStop(0, 'rgba(182, 208, 255, 0.24)');
  mg.addColorStop(0.65, 'rgba(162, 194, 248, 0.11)');
  mg.addColorStop(1, 'rgba(150, 184, 240, 0.0)');
  mb.fillStyle = mg;
  mb.fillRect(0, 0, 128, 256);
  // Soft horizontal edge feathering
  mb.globalCompositeOperation = 'destination-in';
  const hg = mb.createLinearGradient(0, 0, 128, 0);
  hg.addColorStop(0, 'rgba(255,255,255,0)');
  hg.addColorStop(0.25, 'rgba(255,255,255,1)');
  hg.addColorStop(0.75, 'rgba(255,255,255,1)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  mb.fillStyle = hg;
  mb.fillRect(0, 0, 128, 256);
  const moonBeam = finalizeTexture(mbCanvas, 1, 1);

  return {
    sandstone,
    crackedPlaster,
    flagstone,
    oldWood,
    cobweb,
    curtain,
    paintings,
    moonBeam,
  };
}

// ---------------------------------------------------------------------------
// Main Level 6 Builder: Abandoned 1990s Indian Mansion ("Haunted Haveli")
// ---------------------------------------------------------------------------
export function buildHauntedHaveliMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  const hTex = createHaveliTextures();
  const WORLD_RADIUS = 56.5;

  // Ground terrain — moonlit overgrown earth around the haveli estate
  addGroundPlane(ctx, textures, 0x626058, 165);

  // Shared PBR Materials (reused heavily for minimal draw calls & smooth mobile FPS)
  const sandstoneMat = new THREE.MeshStandardMaterial({
    map: hTex.sandstone,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.045,
    color: 0xc8b59f,
    roughness: 0.9,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    map: hTex.sandstone,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.04,
    color: 0x867a6c,
    roughness: 0.92,
  });
  const plasterWallMat = new THREE.MeshStandardMaterial({
    map: hTex.crackedPlaster,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    color: 0xc2b7a6,
    roughness: 0.91,
  });
  const cellarStoneMat = new THREE.MeshStandardMaterial({
    map: hTex.sandstone,
    color: 0x6b6158,
    roughness: 0.95,
  });
  const flagstoneMat = new THREE.MeshStandardMaterial({
    map: hTex.flagstone,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.03,
    color: 0xbcb6ac,
    roughness: 0.9,
  });
  const oldWoodMat = new THREE.MeshStandardMaterial({
    map: hTex.oldWood,
    color: 0xa4856c,
    roughness: 0.84,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: hTex.oldWood,
    color: 0x6b503e,
    roughness: 0.86,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0x9b7e48,
    roughness: 0.45,
    metalness: 0.6,
  });
  const rustIronMat = new THREE.MeshStandardMaterial({
    color: 0x4b3c35,
    roughness: 0.78,
    metalness: 0.55,
  });
  const clayPotMat = new THREE.MeshStandardMaterial({
    color: 0x8e5740,
    roughness: 0.88,
  });
  const curtainMat = new THREE.MeshStandardMaterial({
    map: hTex.curtain,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const rugMat = new THREE.MeshStandardMaterial({
    color: 0x6a2f34,
    roughness: 0.95,
  });
  const dustSheetMat = new THREE.MeshStandardMaterial({
    color: 0xc5bca9,
    roughness: 0.95,
  });
  const cobwebMat = new THREE.MeshBasicMaterial({
    map: hTex.cobweb,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const moonBeamMat = new THREE.MeshBasicMaterial({
    map: hTex.moonBeam,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const moonPoolMat = new THREE.MeshBasicMaterial({
    color: 0x9fc0ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffd28e,
    emissive: 0xff9f40,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x263246,
    roughness: 0.35,
    metalness: 0.25,
  });
  const paintingMats = hTex.paintings.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
      }),
  );

  // -------------------------------------------------------------------------
  // Geometry & Collider Helpers (Multi-Floor Aware!)
  // -------------------------------------------------------------------------
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

  /** Adds a wall or structural box with explicit multi-floor vertical bounds */
  const addFloorBox = (
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
      colliderTopY?: number;
      colliderMinY?: number;
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

  /** Adds a walkable elevated floor slab (climbable top, walkable underneath!) */
  const addWalkableSlab = (
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

  /**
   * Builds a smooth walkable staircase where every riser is <= 0.22m so players
   * glide naturally up and down without jumping.
   */
  const buildStaircase = (opts: {
    startX: number;
    startZ: number;
    startY: number;
    endY: number;
    dir: 'north' | 'south' | 'east' | 'west';
    width: number;
    steps: number;
    tread: number;
    mat: THREE.Material;
    railings?: boolean;
  }) => {
    const { startX, startZ, startY, endY, dir, width, steps, tread, mat, railings = true } = opts;
    const totalRise = endY - startY;
    const rise = totalRise / steps;
    const dx = dir === 'east' ? 1 : dir === 'west' ? -1 : 0;
    const dz = dir === 'south' ? 1 : dir === 'north' ? -1 : 0;

    for (let i = 1; i <= steps; i++) {
      const stepTop = startY + rise * i;
      const dist = (i - 0.5) * tread;
      const sx = startX + dx * dist;
      const sz = startZ + dz * dist;
      const sw = dx !== 0 ? tread + 0.04 : width;
      const sd = dz !== 0 ? tread + 0.04 : width;
      const stepThick = Math.max(0.24, Math.abs(rise) + 0.08);

      const stepMesh = new THREE.Mesh(getBox(sw, stepThick, sd), mat);
      stepMesh.position.set(sx, stepTop - stepThick * 0.5, sz);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      ctx.group.add(stepMesh);

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

      // Decorative wooden/stone banister posts every 4 steps
      if (railings && (i === 1 || i === steps || i % 4 === 0)) {
        const perpX = dz !== 0 ? width * 0.5 - 0.08 : 0;
        const perpZ = dx !== 0 ? width * 0.5 - 0.08 : 0;
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(getBox(0.12, 0.92, 0.12), darkWoodMat);
          post.position.set(sx + perpX * side, stepTop + 0.46, sz + perpZ * side);
          post.castShadow = false;
          ctx.group.add(post);
        }
      }
    }

    // Sloped stringer & handrail bars along each side
    if (railings) {
      const runLen = steps * tread;
      const slopeLen = Math.hypot(runLen, totalRise);
      const slopeAngle = Math.atan2(totalRise, runLen);
      const midDist = runLen * 0.5;
      const midY = (startY + endY) * 0.5;

      for (const side of [-1, 1]) {
        const perpX = dz !== 0 ? (width * 0.5 - 0.08) * side : 0;
        const perpZ = dx !== 0 ? (width * 0.5 - 0.08) * side : 0;
        const rail = new THREE.Mesh(
          getBox(dx !== 0 ? slopeLen : 0.09, 0.09, dz !== 0 ? slopeLen : 0.09),
          darkWoodMat,
        );
        rail.position.set(
          startX + dx * midDist + perpX,
          midY + 0.92,
          startZ + dz * midDist + perpZ,
        );
        if (dz === -1) rail.rotation.x = slopeAngle;
        else if (dz === 1) rail.rotation.x = -slopeAngle;
        else if (dx === 1) rail.rotation.z = slopeAngle;
        else if (dx === -1) rail.rotation.z = -slopeAngle;
        ctx.group.add(rail);
      }
    }
  };

  /** Builds a traditional carved Rajasthani sandstone arch pillar */
  const pillarBaseGeo = new THREE.BoxGeometry(0.68, 0.28, 0.68);
  const pillarShaftGeo = new THREE.CylinderGeometry(0.24, 0.28, 2.55, 8);
  const pillarCapGeo = new THREE.BoxGeometry(0.76, 0.24, 0.76);
  const addCarvedPillar = (
    x: number,
    z: number,
    yBase = 0,
    height = 3.1,
    withCollider = true,
    mat: THREE.Material = sandstoneMat,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    const scaleY = height / 3.07;

    const base = new THREE.Mesh(pillarBaseGeo, darkStoneMat);
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const shaft = new THREE.Mesh(pillarShaftGeo, mat);
    shaft.scale.y = scaleY;
    shaft.position.y = 0.28 + 1.275 * scaleY;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    g.add(shaft);

    const cap = new THREE.Mesh(pillarCapGeo, darkStoneMat);
    cap.position.y = height - 0.12;
    cap.castShadow = true;
    g.add(cap);

    ctx.group.add(g);

    if (withCollider) {
      ctx.boxes.push({
        minX: x - 0.34,
        maxX: x + 0.34,
        minZ: z - 0.34,
        maxZ: z + 0.34,
        blocksSight: true,
        minY: yBase,
        topY: yBase + height,
      });
    }
  };

  /** Builds an ornate wall-mounted broken shuttered window + optional moonlight shaft */
  const addBrokenWindow = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    withMoonShaft = false,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    // Carved jharokha sill & arch crown
    addVisualBox(g, 0, -0.62, 0.12, 1.45, 0.16, 0.34, darkStoneMat, false);
    addVisualBox(g, 0, 0.68, 0.14, 1.52, 0.2, 0.36, darkStoneMat, false);
    addVisualBox(g, 0, 0.02, 0.03, 1.15, 1.15, 0.1, windowGlassMat, false);
    // Left shutter hanging ajar, right shutter crooked/broken
    const leftShutter = new THREE.Mesh(getBox(0.52, 1.1, 0.07), darkWoodMat);
    leftShutter.position.set(-0.62, 0.02, 0.2);
    leftShutter.rotation.y = -0.65;
    g.add(leftShutter);

    const rightShutter = new THREE.Mesh(getBox(0.52, 1.1, 0.07), darkWoodMat);
    rightShutter.position.set(0.58, -0.06, 0.18);
    rightShutter.rotation.y = 0.52;
    rightShutter.rotation.z = -0.14;
    g.add(rightShutter);

    // Optional slanting moonlight shaft & floor moon-pool inside the room
    if (withMoonShaft) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 4.4), moonBeamMat);
      beam.position.set(0, -0.95, 1.65);
      beam.rotation.x = -0.78;
      g.add(beam);

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), moonPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, -y + 0.06, 2.35);
      g.add(pool);
    }

    ctx.group.add(g);
  };

  /** Places a lightweight cobweb plane tucked into an arch or wall corner */
  const cobwebGeo = new THREE.PlaneGeometry(1.35, 1.35);
  const addCobweb = (x: number, y: number, z: number, rotY = 0, scale = 1.0) => {
    const web = new THREE.Mesh(cobwebGeo, cobwebMat);
    web.position.set(x, y, z);
    web.rotation.y = rotY;
    web.scale.setScalar(scale);
    ctx.group.add(web);
  };

  /** Places a framed faded ancestral painting on an interior wall */
  const addOldPainting = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    idx: number,
    tilted = false,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    if (tilted) g.rotation.z = 0.09;
    addVisualBox(g, 0, 0, 0, 1.08, 1.32, 0.07, darkWoodMat, false);
    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 1.12),
      paintingMats[idx % paintingMats.length],
    );
    canvasMesh.position.z = 0.042;
    g.add(canvasMesh);
    ctx.group.add(g);
  };

  /**
   * Places a hanging dusty velvet curtain (walk-through or crouch-behind hiding drape!).
   * Players can walk right behind it to conceal themselves.
   */
  const addHangingCurtain = (
    x: number,
    yBase: number,
    z: number,
    width: number,
    height: number,
    rotY: number,
    hideLabel?: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    g.rotation.y = rotY;
    // Curtain rod
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, width + 0.25, 6),
      brassMat,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.y = height;
    g.add(rod);

    // Two slightly parted dusty drapes so players see there is space behind
    const panelW = width * 0.46;
    for (const side of [-1, 1]) {
      const drape = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, height - 0.06),
        curtainMat,
      );
      drape.position.set(side * (width * 0.26), height * 0.5, 0);
      drape.rotation.y = side * 0.08;
      g.add(drape);
    }
    ctx.group.add(g);

    if (hideLabel) {
      ctx.hidingSpots.push({ x, z, label: hideLabel, kind: 'house' });
    }
  };

  /** Adds a tall antique teak cupboard / almirah (solid cover + hiding spot behind/beside) */
  const addCupboard = (
    x: number,
    yBase: number,
    z: number,
    rotY: number,
    label?: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    g.rotation.y = rotY;
    addVisualBox(g, 0, 1.05, 0, 1.45, 2.1, 0.72, darkWoodMat, true);
    addVisualBox(g, 0, 2.14, 0.03, 1.56, 0.12, 0.8, oldWoodMat, false);
    // Slightly ajar left cupboard door
    const door = new THREE.Mesh(getBox(0.66, 1.85, 0.06), oldWoodMat);
    door.position.set(-0.46, 1.02, 0.48);
    door.rotation.y = -0.45;
    g.add(door);
    // Brass handles
    addVisualBox(g, 0.08, 1.02, 0.39, 0.05, 0.18, 0.05, brassMat, false);
    ctx.group.add(g);

    const rotQuarter = Math.abs(Math.sin(rotY)) > 0.7;
    const hw = rotQuarter ? 0.4 : 0.76;
    const hd = rotQuarter ? 0.76 : 0.4;
    ctx.boxes.push({
      minX: x - hw,
      maxX: x + hw,
      minZ: z - hd,
      maxZ: z + hd,
      blocksSight: true,
      minY: yBase,
      topY: yBase + 2.2,
    });
    if (label) {
      ctx.hidingSpots.push({
        x: x + Math.sin(rotY) * 1.1,
        z: z + Math.cos(rotY) * 1.1,
        label,
        kind: 'house',
      });
    }
  };

  /** Adds a dusty four-poster wooden bed with tattered canopy drapes */
  const addFourPosterBed = (
    x: number,
    yBase: number,
    z: number,
    rotY: number,
    label?: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    g.rotation.y = rotY;
    // Frame & dusty mattress
    addVisualBox(g, 0, 0.45, 0, 2.1, 0.24, 2.6, darkWoodMat, true);
    addVisualBox(g, 0, 0.64, 0, 1.94, 0.18, 2.42, dustSheetMat, false);
    // Headboard & footboard
    addVisualBox(g, 0, 1.02, -1.24, 2.15, 0.95, 0.12, darkWoodMat, true);
    // 4 carved corner posts
    for (const px of [-0.98, 0.98]) {
      for (const pz of [-1.22, 1.22]) {
        addVisualBox(g, px, 1.18, pz, 0.12, 2.35, 0.12, darkWoodMat, false);
      }
    }
    // Canopy frame + tattered curtain sides
    addVisualBox(g, 0, 2.34, 0, 2.1, 0.08, 2.58, oldWoodMat, false);
    const sideDrape = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.75), curtainMat);
    sideDrape.position.set(-1.02, 1.42, 0);
    sideDrape.rotation.y = Math.PI / 2;
    g.add(sideDrape);

    ctx.group.add(g);

    const rotQuarter = Math.abs(Math.sin(rotY)) > 0.7;
    const hw = rotQuarter ? 1.32 : 1.06;
    const hd = rotQuarter ? 1.06 : 1.32;
    ctx.boxes.push({
      minX: x - hw,
      maxX: x + hw,
      minZ: z - hd,
      maxZ: z + hd,
      blocksSight: true,
      minY: yBase,
      topY: yBase + 1.05,
    });
    if (label) {
      ctx.hidingSpots.push({ x: x + (rotQuarter ? 0 : 1.5), z: z + (rotQuarter ? 1.5 : 0), label, kind: 'house' });
    }
  };

  /** Adds a large antique brass-bound storage trunk or crate cluster */
  const addStorageCluster = (
    x: number,
    yBase: number,
    z: number,
    label?: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    // Main heavy wooden trunk
    addVisualBox(g, 0, 0.42, 0, 1.45, 0.84, 0.92, darkWoodMat, true);
    addVisualBox(g, 0, 0.45, 0.47, 1.46, 0.08, 0.04, brassMat, false);
    addVisualBox(g, 0, 0.86, 0, 1.48, 0.08, 0.95, oldWoodMat, false);
    // Stacked crate slightly askew on top
    const topCrate = new THREE.Mesh(getBox(0.86, 0.74, 0.82), oldWoodMat);
    topCrate.position.set(-0.22, 1.26, -0.04);
    topCrate.rotation.y = 0.22;
    topCrate.castShadow = true;
    g.add(topCrate);
    // Nearby clay pot
    const pot = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      clayPotMat,
    );
    pot.scale.set(1, 1.15, 1);
    pot.position.set(0.92, 0.3, 0.25);
    g.add(pot);

    ctx.group.add(g);
    ctx.boxes.push({
      minX: x - 0.82,
      maxX: x + 0.82,
      minZ: z - 0.56,
      maxZ: z + 0.56,
      blocksSight: true,
      minY: yBase,
      topY: yBase + 1.65,
    });
    if (label) {
      ctx.hidingSpots.push({ x: x + 1.15, z, label, kind: 'house' });
    }
  };

  /** Adds a dusty wooden charpai or stone bench (also registers as sittable!) */
  let seatCounter = 0;
  const addHaveliSeat = (
    x: number,
    yBase: number,
    z: number,
    rotY: number,
    kind: 'charpai' | 'bench',
    label: string,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    g.rotation.y = rotY;
    if (kind === 'charpai') {
      addVisualBox(g, 0, 0.44, 0, 1.95, 0.1, 1.02, oldWoodMat, true);
      addVisualBox(g, 0, 0.49, 0, 1.75, 0.05, 0.84, dustSheetMat, false);
      for (const lx of [-0.88, 0.88]) {
        for (const lz of [-0.44, 0.44]) {
          addVisualBox(g, lx, 0.22, lz, 0.1, 0.44, 0.1, darkWoodMat, false);
        }
      }
    } else {
      addVisualBox(g, 0, 0.46, 0, 2.05, 0.12, 0.72, darkStoneMat, true);
      addVisualBox(g, -0.78, 0.22, 0, 0.24, 0.44, 0.62, sandstoneMat, true);
      addVisualBox(g, 0.78, 0.22, 0, 0.24, 0.44, 0.62, sandstoneMat, true);
    }
    ctx.group.add(g);

    const rotQuarter = Math.abs(Math.sin(rotY)) > 0.7;
    ctx.boxes.push({
      minX: x - (rotQuarter ? 0.54 : 1.02),
      maxX: x + (rotQuarter ? 0.54 : 1.02),
      minZ: z - (rotQuarter ? 1.02 : 0.54),
      maxZ: z + (rotQuarter ? 1.02 : 0.54),
      blocksSight: false,
      minY: yBase,
      topY: yBase + 0.55,
    });
    if (yBase < 0.2) {
      seatCounter++;
      ctx.seats.push({
        id: `haveli_seat_${seatCounter}`,
        x,
        z,
        seatY: yBase + 0.5,
        rotY,
        label,
        kind,
      });
    }
  };

  /** Adds a wall-mounted antique brass oil-lamp sconce (emissive glow, optional pointLight) */
  const addOilLampSconce = (
    x: number,
    y: number,
    z: number,
    withPointLight = false,
    lightDist = 14,
  ) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.08, 0.14, 8),
      brassMat,
    );
    g.add(bowl);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      lampGlowMat,
    );
    flame.position.y = 0.12;
    g.add(flame);
    if (withPointLight) {
      const pt = new THREE.PointLight(0xffb45c, 2.2, lightDist, 1.6);
      pt.position.y = 0.25;
      g.add(pt);
    }
    ctx.group.add(g);
  };

  /** Adds a traditional Rajasthani Chhatri rooftop pavilion dome */
  const addChhatri = (x: number, yBase: number, z: number, radius = 2.3) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    // Octagonal plinth base
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.25, radius + 0.35, 0.26, 8),
      darkStoneMat,
    );
    plinth.position.y = 0.13;
    plinth.receiveShadow = true;
    g.add(plinth);

    // 4 carved sandstone corner pillars
    const pOff = radius * 0.65;
    for (const px of [-pOff, pOff]) {
      for (const pz of [-pOff, pOff]) {
        const p = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, 2.5, 8),
          sandstoneMat,
        );
        p.position.set(px, 1.5, pz);
        p.castShadow = true;
        g.add(p);
        ctx.boxes.push({
          minX: x + px - 0.22,
          maxX: x + px + 0.22,
          minZ: z + pz - 0.22,
          maxZ: z + pz + 0.22,
          blocksSight: true,
          minY: yBase,
          topY: yBase + 2.8,
        });
      }
    }

    // Eaves cornice (chhajja)
    const eave = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.45, radius + 0.65, 0.22, 8),
      darkStoneMat,
    );
    eave.position.y = 2.8;
    eave.castShadow = true;
    g.add(eave);

    // Fluted onion dome & brass kalash finial
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      sandstoneMat,
    );
    dome.position.y = 2.82;
    dome.castShadow = true;
    g.add(dome);

    const finial = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.68, 8),
      brassMat,
    );
    finial.position.y = 2.82 + radius * 0.85 + 0.3;
    g.add(finial);

    ctx.group.add(g);
  };

  // =========================================================================
  // 1. COURTYARD PAVING & STONE PATHWAYS
  // =========================================================================
  // Main Central Courtyard (Aangan) flagstone floor
  const courtyardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(31, 37),
    flagstoneMat,
  );
  courtyardMesh.rotation.x = -Math.PI / 2;
  courtyardMesh.position.set(0, 0.025, 4.5);
  courtyardMesh.receiveShadow = true;
  ctx.group.add(courtyardMesh);

  // Radiating stone pathways through gatehouse, front garden, and outer perimeter
  addRoadSegment(ctx, 0, 39.5, 5.2, 26, 0, textures, 0x9b9286, 0.022);
  addRoadSegment(ctx, 0, 4.5, 3.6, 30, 0, textures, 0xaba295, 0.032);
  addRoadSegment(ctx, 0, 4.5, 3.6, 26, Math.PI / 2, textures, 0xaba295, 0.034);
  // Outer garden loop pathways (West, East, North)
  addRoadSegment(ctx, -36, 4, 3.6, 74, 0, textures, 0x898278, 0.018);
  addRoadSegment(ctx, 36, 4, 3.6, 74, 0, textures, 0x898278, 0.018);
  addRoadSegment(ctx, 0, -37, 3.8, 72, Math.PI / 2, textures, 0x898278, 0.018);
  addRoadSegment(ctx, 0, 43, 3.8, 72, Math.PI / 2, textures, 0x898278, 0.018);

  ctx.landmarks.push({ x: 0, z: 4.5, radius: 14.0, kind: 'courtyard' });

  // =========================================================================
  // 2. CENTRAL COURTYARD LANDMARKS: DRY FOUNTAIN, OLD WELL & GNARLED TREE
  // =========================================================================
  // 2A. Ornate Multi-Tier Carved Dry Fountain at (0, 4.5)
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, 0, 4.5);
  const fBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.5, 0.72, 8),
    darkStoneMat,
  );
  fBase.position.y = 0.36;
  fBase.castShadow = true;
  fBase.receiveShadow = true;
  fountainGroup.add(fBase);
  // Dry cracked basin floor inside
  const fDryFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 0.08, 8),
    cellarStoneMat,
  );
  fDryFloor.position.y = 0.62;
  fountainGroup.add(fDryFloor);
  // Central carved pedestal + 2 dry lotus bowls
  const fPed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.78, 1.75, 8),
    sandstoneMat,
  );
  fPed.position.y = 1.3;
  fPed.castShadow = true;
  fountainGroup.add(fPed);
  const fBowl1 = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 0.65, 0.34, 8),
    sandstoneMat,
  );
  fBowl1.position.y = 1.85;
  fBowl1.castShadow = true;
  fountainGroup.add(fBowl1);
  const fBowl2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.36, 0.28, 8),
    darkStoneMat,
  );
  fBowl2.position.y = 2.55;
  fountainGroup.add(fBowl2);
  const fSpout = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.6, 8),
    brassMat,
  );
  fSpout.position.y = 2.95;
  fountainGroup.add(fSpout);
  ctx.group.add(fountainGroup);
  ctx.circles.push({ x: 0, z: 4.5, radius: 3.35, blocksSight: true, topY: 1.0 });
  ctx.hidingSpots.push(
    { x: -4.1, z: 4.5, label: 'Behind dry courtyard fountain', kind: 'well' },
    { x: 4.1, z: 4.5, label: 'Beside dry courtyard fountain', kind: 'well' },
  );

  // 2B. Old Courtyard Stone Well (Kuan) at (9.2, 13.8)
  const wellGroup = new THREE.Group();
  wellGroup.position.set(9.2, 0, 13.8);
  const wellRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.72, 1.05, 14),
    darkStoneMat,
  );
  wellRing.position.y = 0.525;
  wellRing.castShadow = true;
  wellRing.receiveShadow = true;
  wellGroup.add(wellRing);
  const wellHole = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.12, 0.14, 12),
    new THREE.MeshBasicMaterial({ color: 0x0c0e14 }),
  );
  wellHole.position.y = 1.02;
  wellGroup.add(wellHole);
  // Twin aged timber pulley posts & crossbar
  addVisualBox(wellGroup, -1.2, 1.85, 0, 0.16, 1.9, 0.16, darkWoodMat, true);
  addVisualBox(wellGroup, 1.2, 1.85, 0, 0.16, 1.9, 0.16, darkWoodMat, true);
  addVisualBox(wellGroup, 0, 2.74, 0, 2.65, 0.14, 0.16, darkWoodMat, true);
  const pulley = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10),
    rustIronMat,
  );
  pulley.rotation.z = Math.PI / 2;
  pulley.position.set(0, 2.56, 0);
  wellGroup.add(pulley);
  // Hanging rope & old rusted bucket resting on rim
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6),
    dustSheetMat,
  );
  rope.position.set(0, 1.82, 0);
  wellGroup.add(rope);
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.34, 10),
    rustIronMat,
  );
  bucket.position.set(1.05, 1.22, 0.52);
  wellGroup.add(bucket);
  ctx.group.add(wellGroup);
  ctx.circles.push({ x: 9.2, z: 13.8, radius: 1.75, blocksSight: true, topY: 1.15 });
  ctx.landmarks.push({ x: 9.2, z: 13.8, radius: 2.2, kind: 'well' });
  ctx.hidingSpots.push({ x: 11.4, z: 14.4, label: 'Behind old courtyard well', kind: 'well' });

  // 2C. Gnarled Courtyard Tree & Sittable Bench/Charpai at (-9.2, 13.8)
  addTree(ctx, -9.2, 13.8, 1.22, textures, 0x3f573d, false, true, 'Behind gnarled courtyard tree');
  addHaveliSeat(-6.4, 0, 15.8, -0.35, 'bench', 'Mossy Courtyard Bench');
  addHaveliSeat(6.2, 0, 16.5, 0.35, 'charpai', 'Dusty Courtyard Charpai');
  ctx.hidingSpots.push({ x: -10.6, z: 15.6, label: 'Behind gnarled courtyard tree', kind: 'tree' });

  // Courtyard Veranda Colonnade Pillars (West x=-13.2, East x=13.2)
  for (const pz of [-9.5, -3.5, 2.5, 14.5, 19.5]) {
    addCarvedPillar(-13.2, pz, 0, 3.15, true);
    addCarvedPillar(13.2, pz, 0, 3.15, true);
  }
  ctx.hidingSpots.push(
    { x: -13.2, z: -6.5, label: 'Behind west veranda pillars', kind: 'wall' },
    { x: 13.2, z: -6.5, label: 'Behind east veranda pillars', kind: 'wall' },
  );

  // =========================================================================
  // 3. WEST GROUND-FLOOR WING (Portrait Gallery, Kitchen, Storage Room)
  //    x: -29..-16, z: -14..22, height: 3.15m (Upper Floor sits at y=3.2m)
  // =========================================================================
  // Ground floor slab for entire West Wing
  const westFloor = new THREE.Mesh(getBox(13.2, 0.08, 36.2), flagstoneMat);
  westFloor.position.set(-22.5, 0.04, 4.0);
  westFloor.receiveShadow = true;
  ctx.group.add(westFloor);

  // West Wing outer west wall (x = -29, z = -14..22) with broken windows
  addFloorBox(-29, 4.0, 0.42, 3.15, 36.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addBrokenWindow(-28.75, 1.75, 14.5, Math.PI / 2, true);
  addBrokenWindow(-28.75, 1.75, 3.0, Math.PI / 2, true);
  addBrokenWindow(-28.75, 1.75, -8.5, Math.PI / 2, false);

  // West Wing south wall (z = 22) with side garden door (gap at x = -23.5..-21.1)
  addFloorBox(-26.3, 22, 5.4, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-18.5, 22, 5.0, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-22.3, 22, 2.6, 0.85, 0.4, 2.3, sandstoneMat, { collider: false });

  // West Wing north wall (z = -14) with Secret Passage gap (x = -19.2..-16.6) to Underground Tehkhana!
  addFloorBox(-24.2, -14, 9.8, 3.15, 0.4, 0, plasterWallMat, { colliderTopY: 3.1 });
  addFloorBox(-17.9, -14, 2.8, 0.85, 0.4, 2.3, plasterWallMat, { collider: false });
  addHangingCurtain(-17.9, 0, -14.0, 2.5, 2.35, 0, 'Behind secret cellar curtain');

  // West Wing courtyard-facing east wall (x = -16) with 3 wide arched doorways (z = 14.5, 3.0, -8.5)
  addFloorBox(-16, 19.0, 0.38, 3.15, 6.2, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-16, 8.75, 0.38, 3.15, 8.7, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-16, -2.75, 0.38, 3.15, 8.7, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-16, -12.0, 0.38, 3.15, 4.2, 0, sandstoneMat, { colliderTopY: 3.1 });
  // Door lintels above West Wing courtyard doorways
  for (const dz of [14.5, 3.0, -8.5]) {
    addFloorBox(-16, dz, 0.38, 0.85, 2.8, 2.3, darkStoneMat, { collider: false });
  }

  // Internal interconnecting partition walls between the 3 West rooms (doorways at x = -22.5, width 2.6m!)
  for (const partZ of [8.8, -2.8]) {
    addFloorBox(-26.4, partZ, 5.2, 3.1, 0.32, 0, plasterWallMat, { colliderTopY: 3.1 });
    addFloorBox(-18.6, partZ, 5.2, 3.1, 0.32, 0, plasterWallMat, { colliderTopY: 3.1 });
    addFloorBox(-22.5, partZ, 2.6, 0.8, 0.32, 2.3, plasterWallMat, { collider: false });
  }

  // --- West Room 1: Portrait Gallery (x: -29..-16, z: 8.8..22) ---
  addOldPainting(-28.72, 1.8, 18.2, Math.PI / 2, 0, false);
  addOldPainting(-28.72, 1.8, 11.2, Math.PI / 2, 1, true);
  addOldPainting(-19.5, 1.85, 21.72, Math.PI, 2, false);
  addCupboard(-27.6, 0, 19.6, Math.PI / 2, 'Behind portrait gallery cupboard');
  addHangingCurtain(-26.8, 0, 10.2, 2.6, 2.7, 0.4, 'Behind dusty gallery curtain');
  addHaveliSeat(-20.2, 0, 19.8, Math.PI, 'bench', 'Gallery Teak Bench');
  addCobweb(-28.1, 2.6, 21.2, Math.PI / 4, 1.15);
  addCobweb(-16.8, 2.6, 9.6, -Math.PI * 0.75, 1.0);
  // Tattered gallery carpet
  const gRug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.6), rugMat);
  gRug.rotation.x = -Math.PI / 2;
  gRug.position.set(-22.5, 0.09, 15.2);
  ctx.group.add(gRug);

  // --- West Room 2: Old Haveli Kitchen / Rasoi (x: -29..-16, z: -2.8..8.8) ---
  // Traditional mud chulha hearth & counter against west wall
  addFloorBox(-27.9, 5.5, 1.6, 0.92, 3.6, 0, darkStoneMat, { colliderTopY: 1.05 });
  // Clay pots & brass vessels on chulha counter
  for (let i = 0; i < 4; i++) {
    const pot = new THREE.Mesh(
      new THREE.SphereGeometry(0.24 + (i % 2) * 0.06, 10, 8),
      i % 2 === 0 ? clayPotMat : brassMat,
    );
    pot.position.set(-27.8, 1.16, 4.2 + i * 0.85);
    ctx.group.add(pot);
  }
  // Wooden kitchen prep table (crouch-hide behind!)
  addFloorBox(-21.8, 2.6, 2.8, 0.86, 1.25, 0, oldWoodMat, { colliderTopY: 0.95 });
  addCupboard(-27.8, 0, -0.8, Math.PI / 2, 'Behind kitchen spice cupboard');
  addStorageCluster(-18.2, 0, 6.8, 'Behind kitchen grain sacks');
  addCobweb(-28.1, 2.65, -1.9, Math.PI / 4, 1.0);
  ctx.hidingSpots.push({ x: -21.8, z: 1.3, label: 'Behind old kitchen table', kind: 'house' });

  // --- West Room 3: Dusty Storage Room / Bhandar (x: -29..-16, z: -14..-2.8) ---
  addStorageCluster(-26.8, 0, -5.2, 'Behind stacked storage trunks');
  addStorageCluster(-26.8, 0, -11.4, 'Behind dusty storage crates');
  addCupboard(-18.2, 0, -5.2, -Math.PI / 2, 'Behind storage almirah');
  addCobweb(-28.1, 2.65, -13.1, Math.PI / 4, 1.25);
  addCobweb(-16.9, 2.65, -13.1, -Math.PI / 4, 1.1);

  // =========================================================================
  // 4. EAST GROUND-FLOOR WING (Caretaker Quarters, Banquet Hall, Guest Bedroom)
  //    x: 16..29, z: -14..22, height: 3.15m (Upper Floor sits at y=3.2m)
  // =========================================================================
  const eastFloor = new THREE.Mesh(getBox(13.2, 0.08, 36.2), flagstoneMat);
  eastFloor.position.set(22.5, 0.04, 4.0);
  eastFloor.receiveShadow = true;
  ctx.group.add(eastFloor);

  // East outer wall (x = 29) with broken windows & moonlight shafts
  addFloorBox(29, 4.0, 0.42, 3.15, 36.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addBrokenWindow(28.75, 1.75, 14.5, -Math.PI / 2, false);
  addBrokenWindow(28.75, 1.75, 3.0, -Math.PI / 2, true);
  addBrokenWindow(28.75, 1.75, -8.5, -Math.PI / 2, true);

  // East Wing south wall (z = 22) with garden doorway (gap x = 21.1..23.5)
  addFloorBox(26.3, 22, 5.4, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(18.5, 22, 5.0, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(22.3, 22, 2.6, 0.85, 0.4, 2.3, sandstoneMat, { collider: false });

  // East Wing north wall (z = -14) with Secret Passage gap (x = 16.6..19.2) to Underground Tehkhana!
  addFloorBox(24.2, -14, 9.8, 3.15, 0.4, 0, plasterWallMat, { colliderTopY: 3.1 });
  addFloorBox(17.9, -14, 2.8, 0.85, 0.4, 2.3, plasterWallMat, { collider: false });
  addHangingCurtain(17.9, 0, -14.0, 2.5, 2.35, 0, 'Behind hidden bedroom curtain');

  // East Wing courtyard-facing west wall (x = 16) with 3 arched doorways (z = 14.5, 3.0, -8.5)
  addFloorBox(16, 19.0, 0.38, 3.15, 6.2, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(16, 8.75, 0.38, 3.15, 8.7, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(16, -2.75, 0.38, 3.15, 8.7, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(16, -12.0, 0.38, 3.15, 4.2, 0, sandstoneMat, { colliderTopY: 3.1 });
  for (const dz of [14.5, 3.0, -8.5]) {
    addFloorBox(16, dz, 0.38, 0.85, 2.8, 2.3, darkStoneMat, { collider: false });
  }

  // Internal interconnecting partitions between East rooms (doorways at x = 22.5)
  for (const partZ of [8.8, -2.8]) {
    addFloorBox(26.4, partZ, 5.2, 3.1, 0.32, 0, plasterWallMat, { colliderTopY: 3.1 });
    addFloorBox(18.6, partZ, 5.2, 3.1, 0.32, 0, plasterWallMat, { colliderTopY: 3.1 });
    addFloorBox(22.5, partZ, 2.6, 0.8, 0.32, 2.3, plasterWallMat, { collider: false });
  }

  // --- East Room 1: Caretaker Quarters (x: 16..29, z: 8.8..22) ---
  addHaveliSeat(26.6, 0, 18.8, -Math.PI / 2, 'charpai', 'Caretaker Charpai');
  addCupboard(18.2, 0, 19.6, Math.PI, 'Behind caretaker cupboard');
  addFloorBox(26.8, 12.2, 1.4, 0.82, 2.2, 0, darkWoodMat, { colliderTopY: 0.95 });
  addOilLampSconce(26.8, 0.9, 12.2, true, 13);
  addOldPainting(28.72, 1.8, 18.0, -Math.PI / 2, 2, false);
  addCobweb(28.1, 2.65, 21.1, -Math.PI / 4, 1.05);

  // --- East Room 2: East Banquet Hall (x: 16..29, z: -2.8..8.8) ---
  // Long dusty banquet table in hall center (wide walkable space around all 4 sides!)
  addFloorBox(22.5, 3.0, 2.1, 0.88, 6.2, 0, darkWoodMat, { colliderTopY: 0.98 });
  // Carved dusty dining chairs (some slightly angled/abandoned)
  for (const cz of [0.8, 3.0, 5.2]) {
    for (const side of [-1, 1]) {
      const ch = new THREE.Group();
      ch.position.set(22.5 + side * 1.45, 0, cz);
      ch.rotation.y = side > 0 ? -Math.PI / 2 + 0.14 : Math.PI / 2 - 0.1;
      addVisualBox(ch, 0, 0.46, 0, 0.54, 0.08, 0.54, oldWoodMat, false);
      addVisualBox(ch, 0, 0.86, -0.24, 0.54, 0.78, 0.08, darkWoodMat, false);
      ctx.group.add(ch);
    }
  }
  addHangingCurtain(27.5, 0, 6.2, 2.8, 2.7, -Math.PI / 2, 'Behind banquet hall curtains');
  addOldPainting(28.72, 1.85, -0.2, -Math.PI / 2, 0, true);
  addCobweb(28.1, 2.6, 8.0, -Math.PI * 0.75, 1.15);
  ctx.hidingSpots.push({ x: 25.0, z: 3.0, label: 'Beside long banquet table', kind: 'house' });

  // --- East Room 3: Guest Bedroom (x: 16..29, z: -14..-2.8) ---
  addFourPosterBed(26.4, 0, -9.2, -Math.PI / 2, 'Beside guest bedroom four-poster bed');
  addCupboard(26.8, 0, -4.4, -Math.PI / 2, 'Behind guest room wardrobe');
  addStorageCluster(18.6, 0, -5.0, 'Behind bedroom luggage trunk');
  addOldPainting(18.8, 1.8, -3.05, 0, 1, false);
  addCobweb(28.1, 2.65, -13.1, -Math.PI / 4, 1.15);

  // =========================================================================
  // 5. SOUTH GATEHOUSE (POL), GUARD ROOM & RECORD ROOM (z: 22..34, y: 0)
  // =========================================================================
  // Monumental Grand Entrance Archway at (0, 31.5) — wide 5.6m open passage
  addFloorBox(-5.2, 31.5, 4.8, 6.4, 4.2, 0, sandstoneMat);
  addFloorBox(5.2, 31.5, 4.8, 6.4, 4.2, 0, sandstoneMat);
  // Overhead gatehouse arch bridge connecting the two gate towers (walkable overhead!)
  addFloorBox(0, 31.5, 6.2, 2.6, 4.0, 3.8, sandstoneMat, { collider: false });
  // Carved scalloped parapet crest above gatehouse
  addFloorBox(0, 31.5, 15.8, 0.75, 4.5, 6.4, darkStoneMat, { collider: false });
  addChhatri(-5.2, 7.15, 31.5, 1.55);
  addChhatri(5.2, 7.15, 31.5, 1.55);

  // Heavy old weathered wooden & rusted-iron double doors propped half-open!
  for (const side of [-1, 1]) {
    const doorPivot = new THREE.Group();
    doorPivot.position.set(side * 2.7, 0, 33.2);
    doorPivot.rotation.y = side * 0.95; // swung half-open inward/outward
    addVisualBox(doorPivot, -side * 1.25, 1.85, 0, 2.5, 3.65, 0.22, darkWoodMat, true);
    // Rusted iron bands & studs
    for (const by of [0.7, 1.85, 3.0]) {
      addVisualBox(doorPivot, -side * 1.25, by, 0.13, 2.45, 0.12, 0.04, rustIronMat, false);
    }
    ctx.group.add(doorPivot);
  }
  addOilLampSconce(-2.85, 2.75, 33.65, true, 14);
  addOilLampSconce(2.85, 2.75, 33.65, false);

  // Flanking South-West Guard Room (x: -16..-7.6, z: 22..32)
  const swFloor = new THREE.Mesh(getBox(8.6, 0.08, 10.2), flagstoneMat);
  swFloor.position.set(-11.8, 0.04, 27.0);
  swFloor.receiveShadow = true;
  ctx.group.add(swFloor);
  addFloorBox(-11.8, 32.0, 8.8, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-16.0, 29.6, 0.4, 3.15, 5.0, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-16.0, 23.4, 0.4, 3.15, 2.8, 0, sandstoneMat, { colliderTopY: 3.1 }); // West garden doorway at z=26
  addFloorBox(-7.6, 27.0, 0.36, 3.15, 10.0, 0, plasterWallMat, { colliderTopY: 3.1 });
  // Courtyard doorway on north wall (z = 22)
  addFloorBox(-14.3, 22.0, 3.4, 3.15, 0.38, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(-9.1, 22.0, 3.0, 3.15, 0.38, 0, sandstoneMat, { colliderTopY: 3.1 });
  addHaveliSeat(-11.8, 0, 29.8, Math.PI, 'charpai', 'Old Guard Room Charpai');
  addStorageCluster(-9.2, 0, 26.8, 'Behind guard room chest');
  addBrokenWindow(-11.8, 1.75, 32.15, 0, false);

  // Flanking South-East Record Room (x: 7.6..16, z: 22..32)
  const seFloor = new THREE.Mesh(getBox(8.6, 0.08, 10.2), flagstoneMat);
  seFloor.position.set(11.8, 0.04, 27.0);
  seFloor.receiveShadow = true;
  ctx.group.add(seFloor);
  addFloorBox(11.8, 32.0, 8.8, 3.15, 0.4, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(16.0, 29.6, 0.4, 3.15, 5.0, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(16.0, 23.4, 0.4, 3.15, 2.8, 0, sandstoneMat, { colliderTopY: 3.1 }); // East garden doorway at z=26
  addFloorBox(7.6, 27.0, 0.36, 3.15, 10.0, 0, plasterWallMat, { colliderTopY: 3.1 });
  addFloorBox(14.3, 22.0, 3.4, 3.15, 0.38, 0, sandstoneMat, { colliderTopY: 3.1 });
  addFloorBox(9.1, 22.0, 3.0, 3.15, 0.38, 0, sandstoneMat, { colliderTopY: 3.1 });
  addCupboard(10.0, 0, 30.2, Math.PI, 'Behind dusty record almirah');
  addFloorBox(13.2, 26.6, 2.2, 0.82, 1.2, 0, oldWoodMat, { colliderTopY: 0.92 });
  addHangingCurtain(9.2, 0, 24.4, 2.2, 2.5, Math.PI / 2, 'Behind record room curtain');
  addBrokenWindow(11.8, 1.75, 32.15, 0, false);

  // =========================================================================
  // 6. SECRET UNDERGROUND CELLAR / TEHKHANA (y = 0.0, directly beneath North Wing!)
  //    x: -24..24, z: -31..-15.2, ceiling = underside of North Durbar Hall at y = 2.6m
  // =========================================================================
  const cellarFloor = new THREE.Mesh(getBox(48, 0.08, 16.2), cellarStoneMat);
  cellarFloor.position.set(0, 0.03, -23.0);
  cellarFloor.receiveShadow = true;
  ctx.group.add(cellarFloor);

  // Perimeter stone cellar walls (topY: 2.52 so upper North Royal Wing at y=2.6 walks right over!)
  // South retaining wall separating courtyard (z = -15.2) with open wing entries on West/East edges
  addFloorBox(0, -15.2, 31.6, 2.55, 0.5, 0, cellarStoneMat, { colliderTopY: 2.5 });
  // West cellar outer wall (x = -24)
  addFloorBox(-24, -23.0, 0.5, 2.55, 16.0, 0, cellarStoneMat, { colliderTopY: 2.5 });
  // East cellar outer wall (x = 24)
  addFloorBox(24, -23.0, 0.5, 2.55, 16.0, 0, cellarStoneMat, { colliderTopY: 2.5 });
  // North cellar back wall (z = -31) with SECRET GARDEN RUIN TUNNEL exit at x = 10.2..12.8!
  addFloorBox(-7.0, -31.0, 34.0, 2.55, 0.5, 0, cellarStoneMat, { colliderTopY: 2.5 });
  addFloorBox(18.5, -31.0, 11.2, 2.55, 0.5, 0, cellarStoneMat, { colliderTopY: 2.5 });
  addHangingCurtain(11.5, 0, -31.0, 2.6, 2.35, 0, 'In secret cellar tunnel exit');

  // Vaulted cellar stone arches & dividing concealed corners (every archway is 3m+ wide!)
  for (const cx of [-13.5, -4.5, 4.5, 13.5]) {
    addCarvedPillar(cx, -20.0, 0, 2.52, true, cellarStoneMat);
    addCarvedPillar(cx, -25.8, 0, 2.52, true, cellarStoneMat);
  }
  // Low cellar partition alcove walls creating awesome concealed corners
  addFloorBox(-18.5, -22.5, 5.2, 2.5, 0.36, 0, cellarStoneMat, { colliderTopY: 2.5 });
  addFloorBox(18.5, -22.5, 5.2, 2.5, 0.36, 0, cellarStoneMat, { colliderTopY: 2.5 });
  addFloorBox(0, -23.0, 0.36, 2.5, 5.8, 0, cellarStoneMat, { colliderTopY: 2.5 });

  // Underground Tehkhana Props: antique treasure chests, earthen amphorae, cobwebs, oil lamp
  addStorageCluster(-21.2, 0, -28.0, 'Behind underground vault chests');
  addStorageCluster(21.2, 0, -28.0, 'Behind cellar brass trunks');
  addStorageCluster(-2.2, 0, -23.0, 'Behind cellar earthen jars');
  addStorageCluster(2.2, 0, -23.0, 'In hidden cellar alcove');
  addHangingCurtain(-16.0, 0, -18.0, 2.4, 2.35, Math.PI / 2, 'Behind cellar archway curtain');
  addOilLampSconce(0, 1.85, -19.8, true, 16);
  addCobweb(-22.8, 2.15, -29.8, Math.PI / 4, 1.25);
  addCobweb(22.8, 2.15, -29.8, -Math.PI / 4, 1.25);
  addCobweb(-4.0, 2.15, -20.2, Math.PI / 3, 1.1);
  addCobweb(4.0, 2.15, -25.5, -Math.PI / 3, 1.1);

  // =========================================================================
  // 7. RAISED NORTH ROYAL WING (y = 2.6m) ABOVE THE UNDERGROUND TEHKHANA!
  //    Grand Durbar Hall + NW Royal Bedroom + NE Ancestral Library + Secret Rear Passage
  // =========================================================================
  const tehkhanaCeilingMeshes: THREE.Mesh[] = [];
  const northRoofMeshes: THREE.Mesh[] = [];

  // Walkable sandstone floor slabs for the North Royal Wing at y = 2.6m
  // Left & Right solid sections + center section leaving a clean secret stairwell cutout at x=-12.8..-6.8, z=-29.6..-27.2!
  addWalkableSlab(-19.0, -23.0, 12.6, 16.4, 2.6, 0.24, sandstoneMat, tehkhanaCeilingMeshes);
  addWalkableSlab(13.5, -23.0, 23.6, 16.4, 2.6, 0.24, sandstoneMat, tehkhanaCeilingMeshes);
  // Center slab in front of secret stairwell (z = -27.2..-14.8)
  addWalkableSlab(-5.5, -21.0, 14.6, 12.4, 2.6, 0.24, sandstoneMat, tehkhanaCeilingMeshes);
  // Thin rear walkway slab behind secret stairwell (z = -31.2..-29.6)
  addWalkableSlab(-5.5, -30.4, 14.6, 1.6, 2.6, 0.24, sandstoneMat, tehkhanaCeilingMeshes);
  // Secret rear hidden passage floor strip behind North Wing (z = -31.0..-33.8, y = 2.6m)
  addWalkableSlab(0, -32.4, 34.0, 2.8, 2.6, 0.24, darkWoodMat);

  // Register Underground Tehkhana as a floor-aware HouseInterior so its ceiling fades ONLY when player is underground (y < 1.9)!
  ctx.houseInteriors.push({
    id: 'haveli_tehkhana',
    label: 'Underground Tehkhana',
    minX: -24.2,
    maxX: 24.2,
    minZ: -31.2,
    maxZ: -15.0,
    minY: -0.5,
    maxY: 1.9,
    doorX: -17.9,
    doorZ: -14.0,
    insideX: 0,
    insideZ: -21.5,
    roofMeshes: tehkhanaCeilingMeshes,
  });

  // Grand Ceremonial Central Sandstone Staircase from Courtyard (y=0) up to Durbar Hall (y=2.6)
  buildStaircase({
    startX: 0,
    startZ: -10.8,
    startY: 0,
    endY: 2.6,
    dir: 'north',
    width: 4.8,
    steps: 12,
    tread: 0.36,
    mat: sandstoneMat,
    railings: true,
  });

  // Secret Interior Wooden Staircase descending from NW Durbar Corner (y=2.6) down into Underground Tehkhana (y=0)!
  buildStaircase({
    startX: -12.6,
    startZ: -28.4,
    startY: 2.6,
    endY: 0.0,
    dir: 'east',
    width: 2.1,
    steps: 12,
    tread: 0.44,
    mat: oldWoodMat,
    railings: false,
  });

  // --- North Royal Wing Walls (y = 2.6m .. 5.75m, colliderMinY: 2.55, colliderTopY: 5.7) ---
  // Courtyard-facing South Colonnade Wall (z = -15.2) with grand open 5.4m center Durbar Arch + West/East doors
  addFloorBox(-19.5, -15.2, 6.2, 3.15, 0.4, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(-7.4, -15.2, 9.2, 3.15, 0.4, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(7.4, -15.2, 9.2, 3.15, 0.4, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(19.5, -15.2, 6.2, 3.15, 0.4, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  // West & East exterior walls of North Wing (x = -25.2 and x = 25.2) with openings onto Upper Corridors!
  addFloorBox(-25.2, -25.6, 0.42, 3.15, 11.2, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(-25.2, -16.4, 0.42, 3.15, 2.6, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(25.2, -25.6, 0.42, 3.15, 11.2, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(25.2, -16.4, 0.42, 3.15, 2.6, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });

  // North back wall (z = -31.0) with TWO SECRET DOORWAYS into the Hidden Rear Passage (at x = -15.2 and x = 15.2)!
  addFloorBox(-21.2, -31.0, 8.2, 3.15, 0.42, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(0, -31.0, 26.8, 3.15, 0.42, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(21.2, -31.0, 8.2, 3.15, 0.42, 2.6, sandstoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  // Outer enclosing wall of the Hidden Rear Passage (z = -33.8)
  addFloorBox(0, -33.8, 34.4, 3.15, 0.4, 2.6, darkStoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(-17.0, -32.4, 0.4, 3.15, 2.8, 2.6, darkStoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  addFloorBox(17.0, -32.4, 0.4, 3.15, 2.8, 2.6, darkStoneMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  // Disguised curtains concealing both ends of the Secret Rear Passage!
  addHangingCurtain(-15.2, 2.6, -31.0, 2.4, 2.45, 0, 'In secret passage behind Royal Bedroom');
  addHangingCurtain(15.2, 2.6, -31.0, 2.4, 2.45, 0, 'In secret bookcase passage behind Library');

  // Interconnecting interior walls dividing Durbar Hall from NW Royal Bedroom & NE Library (wide 2.8m doorways!)
  for (const divX of [-10.0, 10.0]) {
    addFloorBox(divX, -27.2, 0.34, 3.1, 7.6, 2.6, plasterWallMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
    addFloorBox(divX, -17.6, 0.34, 3.1, 4.8, 2.6, plasterWallMat, { colliderMinY: 2.55, colliderTopY: 5.7 });
  }

  // --- Grand Durbar Hall (x: -10..10, z: -31..-15.2, y = 2.6m) ---
  for (const dx of [-5.2, 5.2]) {
    for (const dz of [-18.5, -24.5]) {
      addCarvedPillar(dx, dz, 2.6, 3.1, true, sandstoneMat);
    }
  }
  // Royal tattered crimson carpet & carved wooden diwan dais
  const durbarRug = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 11.4), rugMat);
  durbarRug.rotation.x = -Math.PI / 2;
  durbarRug.position.set(0, 2.64, -22.2);
  ctx.group.add(durbarRug);
  addFloorBox(0, -28.6, 4.6, 0.45, 2.2, 2.6, darkWoodMat, { colliderMinY: 2.55, colliderTopY: 3.15 });
  addVisualBox(ctx.group, 0, 3.35, -29.2, 2.4, 0.65, 0.55, rugMat, false);
  // Dusty antique chandelier frame suspended from Durbar ceiling
  const chand = new THREE.Group();
  chand.position.set(0, 5.25, -22.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 16), brassMat);
  ring.rotation.x = Math.PI / 2;
  chand.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), rustIronMat);
  chain.position.y = 0.3;
  chand.add(chain);
  ctx.group.add(chand);
  // Ancestral framed portraits & velvet curtains in Durbar Hall
  addOldPainting(-4.5, 4.45, -30.72, 0, 0, false);
  addOldPainting(4.5, 4.45, -30.72, 0, 1, true);
  addOldPainting(0, 4.55, -30.72, 0, 2, false);
  addHangingCurtain(-9.4, 2.6, -24.5, 2.2, 2.6, Math.PI / 2, 'Behind Durbar Hall curtains');
  addHangingCurtain(9.4, 2.6, -24.5, 2.2, 2.6, -Math.PI / 2, 'Behind Durbar east curtains');
  ctx.hidingSpots.push(
    { x: -5.2, z: -26.0, label: 'Behind Durbar Hall pillar', kind: 'house' },
    { x: 5.2, z: -26.0, label: 'Behind Durbar Hall pillar', kind: 'house' },
  );

  // --- NW Royal Bedroom (x: -25..-10, z: -31..-15.2, y = 2.6m) ---
  addFourPosterBed(-21.8, 2.6, -24.8, Math.PI / 2, 'Beside royal four-poster bed');
  addCupboard(-23.6, 2.6, -18.2, Math.PI / 2, 'Behind royal bedroom almirah');
  addStorageCluster(-18.2, 2.6, -29.4, 'Behind royal dowry trunk');
  addOldPainting(-24.92, 4.4, -21.0, Math.PI / 2, 1, false);
  addCobweb(-24.2, 5.25, -30.2, Math.PI / 4, 1.15);

  // --- NE Ancestral Library (x: 10..25, z: -31..-15.2, y = 2.6m) ---
  // Tall dusty bookcases (one angled near x=15.2 hinting at the secret rear passage!)
  for (const bx of [12.4, 19.8, 23.2]) {
    addFloorBox(bx, -29.8, 2.4, 2.6, 0.72, 2.6, darkWoodMat, { colliderMinY: 2.55, colliderTopY: 5.25 });
  }
  addFloorBox(24.2, -23.5, 0.72, 2.6, 4.2, 2.6, darkWoodMat, { colliderMinY: 2.55, colliderTopY: 5.25 });
  // Dusty study desk & scattered books
  addFloorBox(17.5, -22.2, 2.6, 0.85, 1.35, 2.6, oldWoodMat, { colliderMinY: 2.55, colliderTopY: 3.55 });
  for (let b = 0; b < 5; b++) {
    const book = new THREE.Mesh(
      getBox(0.32, 0.08, 0.24),
      b % 2 === 0 ? rugMat : darkWoodMat,
    );
    book.position.set(16.6 + b * 0.42, 3.49, -22.2 + (b % 2) * 0.28);
    book.rotation.y = b * 0.4;
    ctx.group.add(book);
  }
  addCobweb(24.2, 5.25, -30.2, -Math.PI / 4, 1.2);
  ctx.hidingSpots.push(
    { x: 21.8, z: -28.0, label: 'Behind ancestral library bookshelves', kind: 'house' },
    { x: 0, z: -32.4, label: 'Inside secret rear corridor', kind: 'house' },
  );

  // =========================================================================
  // 8. ACCESSIBLE UPPER FLOORS (y = 3.2m): WOODEN BALCONIES, CORRIDORS & STAIRS
  // =========================================================================
  const westUpperFloorMeshes: THREE.Mesh[] = [];
  const eastUpperFloorMeshes: THREE.Mesh[] = [];

  // Two Grand Walkable Wooden Staircases from Courtyard Veranda (y=0) -> Upper Balconies (y=3.2m)
  buildStaircase({
    startX: -14.5,
    startZ: 11.6,
    startY: 0,
    endY: 3.2,
    dir: 'north',
    width: 2.4,
    steps: 15,
    tread: 0.38,
    mat: oldWoodMat,
    railings: true,
  });
  buildStaircase({
    startX: 14.5,
    startZ: 11.6,
    startY: 0,
    endY: 3.2,
    dir: 'north',
    width: 2.4,
    steps: 15,
    tread: 0.38,
    mat: oldWoodMat,
    railings: true,
  });

  // West Upper Wooden Balcony & Narrow Upper Corridor Floor Slab (y = 3.2m)
  // Cut cleanly around West Courtyard Staircase opening (x=-15.8..-13.2, z=5.8..11.8)!
  addWalkableSlab(-22.5, 4.0, 13.4, 36.4, 3.2, 0.22, oldWoodMat, westUpperFloorMeshes);
  // West Courtyard Balcony overhang north of stair (z = -14..5.9)
  addWalkableSlab(-14.5, -4.05, 3.2, 19.9, 3.2, 0.22, oldWoodMat);
  // West Courtyard Balcony overhang south of stair (z = 11.9..22.2)
  addWalkableSlab(-14.5, 17.05, 3.2, 10.3, 3.2, 0.22, oldWoodMat);

  // East Upper Wooden Balcony & Narrow Upper Corridor Floor Slab (y = 3.2m)
  addWalkableSlab(22.5, 4.0, 13.4, 36.4, 3.2, 0.22, oldWoodMat, eastUpperFloorMeshes);
  addWalkableSlab(14.5, -4.05, 3.2, 19.9, 3.2, 0.22, oldWoodMat);
  addWalkableSlab(14.5, 17.05, 3.2, 10.3, 3.2, 0.22, oldWoodMat);

  // South Upper Wooden Bridge Gallery overlooking courtyard & connecting West <-> East Upper Floors (y = 3.2m)
  addWalkableSlab(0, 23.6, 32.0, 3.8, 3.2, 0.22, oldWoodMat);
  // Guard & Record room upper terrace deck slabs
  addWalkableSlab(-11.8, 28.6, 8.8, 6.8, 3.2, 0.22, sandstoneMat);
  addWalkableSlab(11.8, 28.6, 8.8, 6.8, 3.2, 0.22, sandstoneMat);

  // Gentle 3-step Connectors from West & East Upper Balconies (y = 3.2m) -> Raised North Royal Wing (y = 2.6m)
  buildStaircase({
    startX: -14.5,
    startZ: -13.9,
    startY: 3.2,
    endY: 2.6,
    dir: 'north',
    width: 2.8,
    steps: 3,
    tread: 0.45,
    mat: oldWoodMat,
    railings: false,
  });
  buildStaircase({
    startX: 14.5,
    startZ: -13.9,
    startY: 3.2,
    endY: 2.6,
    dir: 'north',
    width: 2.8,
    steps: 3,
    tread: 0.45,
    mat: oldWoodMat,
    railings: false,
  });

  // Register West & East Ground Wings as floor-aware HouseInteriors (ceiling fades ONLY when player is on Ground Floor y < 2.2!)
  ctx.houseInteriors.push(
    {
      id: 'haveli_west_ground',
      label: 'West Haveli Wing',
      minX: -29.2,
      maxX: -15.8,
      minZ: -14.2,
      maxZ: 22.2,
      minY: -0.5,
      maxY: 2.2,
      doorX: -16.0,
      doorZ: 3.0,
      insideX: -22.5,
      insideZ: 3.0,
      roofMeshes: westUpperFloorMeshes,
    },
    {
      id: 'haveli_east_ground',
      label: 'East Haveli Wing',
      minX: 15.8,
      maxX: 29.2,
      minZ: -14.2,
      maxZ: 22.2,
      minY: -0.5,
      maxY: 2.2,
      doorX: 16.0,
      doorZ: 3.0,
      insideX: 22.5,
      insideZ: 3.0,
      roofMeshes: eastUpperFloorMeshes,
    },
  );

  // Carved Wooden Balcony Railings overlooking Courtyard (y = 3.2m .. 4.25m, safe low railing!)
  const addBalconyRailing = (
    x: number,
    z: number,
    w: number,
    d: number,
    yBase = 3.2,
  ) => {
    // Low balustrade wall + top rail
    addFloorBox(x, z, w, 0.98, d, yBase, darkWoodMat, {
      blocksSight: false,
      colliderMinY: yBase - 0.05,
      colliderTopY: yBase + 1.05,
    });
    // Jharokha carved overhang eaves
    addVisualBox(
      ctx.group,
      x,
      yBase + 1.02,
      z,
      w + 0.08,
      0.1,
      d + 0.08,
      oldWoodMat,
      false,
    );
  };
  // West balcony courtyard edge (gap left open at stair top z=5.7..11.8)
  addBalconyRailing(-13.0, -4.0, 0.24, 19.6, 3.2);
  addBalconyRailing(-13.0, 17.0, 0.24, 9.6, 3.2);
  // East balcony courtyard edge
  addBalconyRailing(13.0, -4.0, 0.24, 19.6, 3.2);
  addBalconyRailing(13.0, 17.0, 0.24, 9.6, 3.2);
  // South Bridge Gallery courtyard-facing & south-facing railings
  addBalconyRailing(0, 21.8, 25.8, 0.24, 3.2);
  addBalconyRailing(0, 25.4, 15.2, 0.24, 3.2);

  // Upper-Floor Narrow Shadowed Corridors & Chambers (West & East wings at y = 3.2m!)
  // Outer protective sandstone walls along West (x = -29) & East (x = 29) upper levels
  addFloorBox(-29, 4.0, 0.42, 2.75, 36.4, 3.2, sandstoneMat, { colliderMinY: 3.15, colliderTopY: 6.0 });
  addFloorBox(29, 4.0, 0.42, 2.75, 36.4, 3.2, sandstoneMat, { colliderMinY: 3.15, colliderTopY: 6.0 });
  addFloorBox(-22.5, 22.0, 13.0, 2.75, 0.4, 3.2, sandstoneMat, { colliderMinY: 3.15, colliderTopY: 6.0 });
  addFloorBox(22.5, 22.0, 13.0, 2.75, 0.4, 3.2, sandstoneMat, { colliderMinY: 3.15, colliderTopY: 6.0 });
  // Broken arched upper windows casting dramatic moonlight across upper corridors!
  addBrokenWindow(-28.75, 4.8, 12.0, Math.PI / 2, true);
  addBrokenWindow(-28.75, 4.8, -2.0, Math.PI / 2, true);
  addBrokenWindow(28.75, 4.8, 12.0, -Math.PI / 2, true);
  addBrokenWindow(28.75, 4.8, -2.0, -Math.PI / 2, true);

  // Narrow Corridor interior partition walls (creating shadowy corridor walkways + 2 side chambers per wing!)
  for (const side of [-1, 1]) {
    const cx = side * 20.5;
    // Corridor dividing wall running north-south with 3 arched openings
    addFloorBox(cx, 17.5, 0.34, 2.7, 7.6, 3.2, plasterWallMat, { colliderMinY: 3.15, colliderTopY: 5.95 });
    addFloorBox(cx, 5.5, 0.34, 2.7, 10.5, 3.2, plasterWallMat, { colliderMinY: 3.15, colliderTopY: 5.95 });
    addFloorBox(cx, -7.0, 0.34, 2.7, 8.2, 3.2, plasterWallMat, { colliderMinY: 3.15, colliderTopY: 5.95 });
    // Upper corridor furniture, cupboards, curtains & cobwebs
    addCupboard(side * 27.6, 3.2, 16.5, side > 0 ? -Math.PI / 2 : Math.PI / 2, 'Behind upper corridor cupboard');
    addStorageCluster(side * 26.8, 3.2, 4.8, 'Behind upper gallery trunks');
    addHangingCurtain(side * 23.2, 3.2, 11.0, 2.6, 2.4, 0, 'Behind upper corridor curtain');
    addOldPainting(side * 20.25, 4.85, 5.5, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? 0 : 2, true);
    addCobweb(side * 28.1, 5.5, 21.1, side > 0 ? -Math.PI / 4 : Math.PI / 4, 1.15);
    addCobweb(side * 21.2, 5.5, 14.0, side > 0 ? Math.PI / 4 : -Math.PI / 4, 1.0);
  }

  // =========================================================================
  // 9. ACCESSIBLE ROOFTOP TERRACE (CHHAT, y = 5.8m) WITH CHHATRI DOMES!
  // =========================================================================
  // Walkable Rooftop Terrace Slab over the entire North Royal Wing (y = 5.8m)
  addWalkableSlab(0, -23.0, 51.0, 16.4, 5.8, 0.26, sandstoneMat, northRoofMeshes);

  // Register North Royal Wing as floor-aware HouseInterior (roof fades ONLY when player is on North Royal Floor y = 2.0..5.2!)
  ctx.houseInteriors.push({
    id: 'haveli_north_royal',
    label: 'Grand Durbar & Royal Wing',
    minX: -25.4,
    maxX: 25.4,
    minZ: -31.2,
    maxZ: -15.0,
    minY: 2.0,
    maxY: 5.2,
    doorX: 0,
    doorZ: -15.2,
    insideX: 0,
    insideZ: -22.5,
    roofMeshes: northRoofMeshes,
  });

  // Two Smooth Walkable Wooden Rooftop Staircases rising from West & East Upper Corridors (y = 3.2m -> y = 5.8m)!
  buildStaircase({
    startX: -26.4,
    startZ: -9.8,
    startY: 3.2,
    endY: 5.8,
    dir: 'north',
    width: 2.5,
    steps: 12,
    tread: 0.42,
    mat: oldWoodMat,
    railings: true,
  });
  buildStaircase({
    startX: 26.4,
    startZ: -9.8,
    startY: 3.2,
    endY: 5.8,
    dir: 'north',
    width: 2.5,
    steps: 12,
    tread: 0.42,
    mat: oldWoodMat,
    railings: true,
  });
  // Rooftop landing bridge platforms connecting stairs seamlessly onto the Rooftop Terrace (y = 5.8m)
  addWalkableSlab(-26.4, -15.6, 3.2, 2.2, 5.8, 0.22, sandstoneMat);
  addWalkableSlab(26.4, -15.6, 3.2, 2.2, 5.8, 0.22, sandstoneMat);

  // Iconic Traditional Rajasthani Chhatri Domes on the Rooftop Terrace!
  addChhatri(0, 5.8, -23.0, 2.95);
  addChhatri(-18.5, 5.8, -23.0, 2.15);
  addChhatri(18.5, 5.8, -23.0, 2.15);

  // Crumbling Rooftop Parapet Walls (y = 5.8m .. 6.85m, gaps left where rooftop stairs arrive!)
  addFloorBox(0, -31.0, 50.8, 1.05, 0.42, 5.8, darkStoneMat, { colliderMinY: 5.75, colliderTopY: 6.9 });
  addFloorBox(0, -15.0, 46.8, 1.0, 0.42, 5.8, darkStoneMat, { colliderMinY: 5.75, colliderTopY: 6.9 });
  addFloorBox(-25.3, -24.2, 0.42, 1.05, 13.8, 5.8, darkStoneMat, { colliderMinY: 5.75, colliderTopY: 6.9 });
  addFloorBox(25.3, -24.2, 0.42, 1.05, 13.8, 5.8, darkStoneMat, { colliderMinY: 5.75, colliderTopY: 6.9 });

  // Old Rooftop Stone Water Cistern & scattered broken sandstone rubble blocks
  addFloorBox(-9.5, -28.0, 2.6, 1.25, 2.2, 5.8, darkStoneMat, { colliderMinY: 5.75, colliderTopY: 7.1 });
  addFloorBox(9.5, -28.0, 2.2, 0.95, 1.8, 5.8, sandstoneMat, { colliderMinY: 5.75, colliderTopY: 6.8 });
  ctx.hidingSpots.push(
    { x: -18.5, z: -25.8, label: 'Behind west rooftop chhatri', kind: 'wall' },
    { x: 18.5, z: -25.8, label: 'Behind east rooftop chhatri', kind: 'wall' },
    { x: -9.5, z: -26.2, label: 'Behind rooftop stone cistern', kind: 'wall' },
  );

  // Decorative Chhatri Domes capping the outer South-West & South-East Haveli Corners
  addChhatri(-22.5, 5.95, 20.0, 1.75);
  addChhatri(22.5, 5.95, 20.0, 1.75);

  // =========================================================================
  // 10. BROKEN OUTER COMPOUND WALLS & OVERGROWN 1990s GARDEN
  // =========================================================================
  // Crumbling Perimeter Boundary Walls with dramatic broken gaps & fallen rubble blocks
  const compoundSegments: Array<[number, number, number, number, number]> = [
    // South front boundary walls flanking the approach road (z = 48)
    [-34.0, 48.0, 28.0, 2.5, 0.65],
    [-11.0, 48.0, 12.0, 1.9, 0.65],
    [11.0, 48.0, 12.0, 2.3, 0.65],
    [34.0, 48.0, 28.0, 2.6, 0.65],
    // West compound wall (x = -48) with two breached openings
    [-48.0, 32.0, 0.65, 2.5, 32.0],
    [-48.0, 2.0, 0.65, 1.85, 20.0],
    [-48.0, -28.0, 0.65, 2.4, 28.0],
    // East compound wall (x = 48) with two breached openings
    [48.0, 32.0, 0.65, 2.5, 32.0],
    [48.0, 2.0, 0.65, 2.0, 20.0],
    [48.0, -28.0, 0.65, 2.4, 28.0],
    // North compound wall (z = -46) with mossy ruins
    [-26.0, -46.0, 42.0, 2.3, 0.65],
    [26.0, -46.0, 42.0, 2.4, 0.65],
    // Broken inner garden low walls framing the front overgrown lawn
    [-24.0, 38.0, 12.0, 1.15, 0.48],
    [24.0, 38.0, 12.0, 1.15, 0.48],
    [-38.0, -22.0, 0.48, 1.35, 12.0],
    [38.0, -22.0, 0.48, 1.35, 12.0],
  ];
  for (const [wx, wz, ww, wh, wd] of compoundSegments) {
    addFloorBox(wx, wz, ww, wh, wd, 0, darkStoneMat);
  }

  // Fallen weathered masonry rubble blocks beside broken wall gaps
  const rubbleCoords: Array<[number, number, number]> = [
    [-17.8, 47.6, 0.4],
    [17.8, 47.6, -0.5],
    [-47.5, -11.5, 0.3],
    [47.5, -11.5, -0.4],
    [-2.5, -45.6, 0.6],
    [3.2, -45.5, -0.3],
    [14.2, -33.2, 0.2],
  ];
  for (const [rx, rz, rot] of rubbleCoords) {
    const rb = new THREE.Mesh(getBox(1.25, 0.62, 0.9), darkStoneMat);
    rb.position.set(rx, 0.31, rz);
    rb.rotation.y = rot;
    rb.castShadow = true;
    rb.receiveShadow = true;
    ctx.group.add(rb);
  }

  // Ruined Overgrown Garden Pavilion & Stone Benches in Front/Side Gardens
  addChhatri(-24.0, 0, 42.5, 2.0);
  addHaveliSeat(-14.0, 0, 41.5, 0.15, 'bench', 'Overgrown Garden Stone Bench');
  addHaveliSeat(14.0, 0, 41.5, -0.15, 'bench', 'East Garden Stone Bench');
  addHaveliSeat(-39.5, 0, 18.0, Math.PI / 2, 'charpai', 'Old Garden Charpai');
  addStorageCluster(39.5, 0, -4.0, 'Behind garden shed crates');
  addStorageCluster(-39.5, 0, -6.0, 'Behind west garden ruins');

  // Overgrown Ancient Trees (Banyan, Neem & Dark Moonlit Cypresses) around Garden & Perimeter
  const haveliTrees: Array<[number, number, number, 'banyan' | 'neem' | 'peepal']> = [
    [-19.0, 39.5, 1.35, 'banyan'],
    [19.5, 39.5, 1.32, 'neem'],
    [-33.5, 35.5, 1.28, 'peepal'],
    [33.5, 35.5, 1.26, 'banyan'],
    [-41.5, 24.0, 1.24, 'neem'],
    [41.5, 24.0, 1.24, 'peepal'],
    [-42.0, 4.0, 1.35, 'banyan'],
    [42.0, 4.0, 1.32, 'neem'],
    [-41.5, -18.0, 1.25, 'peepal'],
    [41.5, -18.0, 1.25, 'banyan'],
    [-32.5, -39.5, 1.38, 'banyan'],
    [-12.0, -41.5, 1.22, 'neem'],
    [12.0, -41.5, 1.24, 'peepal'],
    [32.5, -39.5, 1.35, 'banyan'],
    [-7.5, 45.0, 1.12, 'neem'],
    [7.5, 45.0, 1.12, 'neem'],
  ];
  for (const [tx, tz, sc, kind] of haveliTrees) {
    const shade = kind === 'banyan' ? 0x324a36 : kind === 'peepal' ? 0x3b543c : 0x2e4533;
    addTree(ctx, tx, tz, sc, textures, shade, false, true, 'Behind overgrown haveli tree');
    ctx.landmarks.push({ x: tx, z: tz, radius: 3.1, kind: 'tree' });
  }

  // Instanced Overgrown Wild Garden Bushes & Tall Weeds (1 single InstancedMesh draw call!)
  const bushCoords: Array<[number, number, number]> = [
    [-13.5, 36.2, 1.15], [-16.2, 37.5, 0.95], [13.5, 36.2, 1.18], [16.4, 37.5, 0.92],
    [-27.5, 42.5, 1.25], [-31.0, 41.0, 1.05], [27.5, 42.5, 1.22], [31.2, 41.2, 1.08],
    [-32.5, 26.5, 1.15], [-33.0, 14.5, 1.2], [-33.0, -4.5, 1.15], [-33.5, -24.5, 1.25],
    [32.5, 26.5, 1.15], [33.0, 14.5, 1.2], [33.0, -4.5, 1.18], [33.5, -24.5, 1.22],
    [-22.0, -39.0, 1.3], [-4.5, -39.8, 1.18], [5.0, -39.8, 1.15], [22.0, -39.0, 1.3],
    [-44.0, 12.0, 1.25], [-44.5, -8.0, 1.2], [44.0, 12.0, 1.25], [44.5, -8.0, 1.2],
    [-11.8, 1.2, 0.72], [11.8, 1.2, 0.72], [-11.5, -11.5, 0.78], [11.5, -11.5, 0.78],
  ];
  const bushGeo = new THREE.DodecahedronGeometry(0.95, 1);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0x354d35,
    roughness: 0.93,
  });
  const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCoords.length);
  bushInst.castShadow = false;
  bushInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bushCoords.length; i++) {
    const [bx, bz, bs] = bushCoords[i];
    dummy.position.set(bx, 0.55 * bs, bz);
    dummy.scale.set(bs * 1.15, bs * 0.82, bs * 1.1);
    dummy.rotation.y = i * 1.1;
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    if (bs >= 1.1) {
      ctx.hidingSpots.push({ x: bx, z: bz, label: 'In overgrown garden bushes', kind: 'tree' });
    }
  }
  bushInst.instanceMatrix.needsUpdate = true;
  ctx.group.add(bushInst);

  // =========================================================================
  // 11. MINIMAP BUILDINGS, AI PATROL POINTS & 10-PLAYER SPAWNS
  // =========================================================================
  const mapBuildings: MinimapBuilding[] = [
    { x: 0, z: -23.0, width: 51, depth: 16.4, rotY: 0, kind: 'haveli' },
    { x: -22.5, z: 4.0, width: 13.4, depth: 36.4, rotY: 0, kind: 'haveli' },
    { x: 22.5, z: 4.0, width: 13.4, depth: 36.4, rotY: 0, kind: 'haveli' },
    { x: -11.8, z: 27.0, width: 8.8, depth: 10.2, rotY: 0, kind: 'haveli' },
    { x: 11.8, z: 27.0, width: 8.8, depth: 10.2, rotY: 0, kind: 'haveli' },
    { x: -5.2, z: 31.5, width: 4.8, depth: 4.2, rotY: 0, kind: 'haveli' },
    { x: 5.2, z: 31.5, width: 4.8, depth: 4.2, rotY: 0, kind: 'haveli' },
  ];
  ctx.buildings.push(...mapBuildings);

  // Comprehensive AI Patrol Loop spanning Courtyard, Wings, Gatehouse & Overgrown Garden
  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 12.0),
    new THREE.Vector3(-10.5, 0, 4.5),
    new THREE.Vector3(-10.5, 0, -7.5),
    new THREE.Vector3(0, 0, -7.5),
    new THREE.Vector3(10.5, 0, -7.5),
    new THREE.Vector3(10.5, 0, 4.5),
    new THREE.Vector3(0, 0, 26.0),
    new THREE.Vector3(0, 0, 40.0),
    new THREE.Vector3(-36.0, 0, 34.0),
    new THREE.Vector3(-36.0, 0, 4.0),
    new THREE.Vector3(-36.0, 0, -34.0),
    new THREE.Vector3(0, 0, -37.0),
    new THREE.Vector3(36.0, 0, -34.0),
    new THREE.Vector3(36.0, 0, 4.0),
    new THREE.Vector3(36.0, 0, 34.0),
  );

  // Additional strategic hiding spots in outer garden ruins
  ctx.hidingSpots.push(
    { x: -24.0, z: 42.5, label: 'Inside ruined garden pavilion', kind: 'wall' },
    { x: -37.5, z: -22.0, label: 'Behind broken west garden wall', kind: 'wall' },
    { x: 37.5, z: -22.0, label: 'Behind broken east garden wall', kind: 'wall' },
    { x: 11.5, z: -33.8, label: 'Outside secret north cellar arch', kind: 'wall' },
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
      groundTint: '#363b48',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.0, 0, 20.5],
      previewCamPos: [0.0, 6.2, 39.5],
      previewLookAt: [0.0, 3.8, -10.0],
      seeker: [0.0, 12.0, Math.PI],
      hiders: [
        [0.0, 26.0, Math.PI],
        [-10.5, 4.5, 1.4],
        [10.5, 4.5, -1.4],
        [-22.5, 14.5, 0.2],
        [22.5, 14.5, -0.2],
        [-22.5, -8.5, 0.8],
        [22.5, -8.5, -0.8],
        [-35.0, 6.0, 1.5],
        [35.0, 6.0, -1.5],
        [0.0, 42.0, Math.PI],
      ],
    },
  };
}

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
  MinimapWaterRect,
} from './types';

export interface MapBuildContext {
  group: THREE.Group;
  boxes: BoxCollider[];
  circles: CircleCollider[];
  swayFoliage: THREE.Object3D[];
  patrolPoints: THREE.Vector3[];
  hidingSpots: HidingSpot[];
  houseInteriors: HouseInterior[];
  roads: MinimapRoad[];
  waterRects: MinimapWaterRect[];
  buildings: MinimapBuilding[];
  landmarks: MinimapLandmark[];
  pondWater: THREE.Mesh | null;
  _boxGeoCache?: Map<string, THREE.BoxGeometry>;
}

function getBoxGeo(
  ctx: MapBuildContext,
  w: number,
  h: number,
  d: number,
): THREE.BoxGeometry {
  if (!ctx._boxGeoCache) {
    ctx._boxGeoCache = new Map();
  }
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let geo = ctx._boxGeoCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d);
    ctx._boxGeoCache.set(key, geo);
  }
  return geo;
}

export function createMapContext(): MapBuildContext {
  return {
    group: new THREE.Group(),
    boxes: [],
    circles: [],
    swayFoliage: [],
    patrolPoints: [],
    hidingSpots: [],
    houseInteriors: [],
    roads: [],
    waterRects: [],
    buildings: [],
    landmarks: [],
    pondWater: null,
  };
}

export function addGroundPlane(
  ctx: MapBuildContext,
  textures: VillageTextureSet,
  tintColor: number,
  radius = 135,
): void {
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.ground,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.045,
    color: tintColor,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ctx.group.add(ground);
}

export function addRoadSegment(
  ctx: MapBuildContext,
  x: number,
  z: number,
  width: number,
  length: number,
  rotY: number,
  textures: VillageTextureSet,
  tintColor = 0xffffff,
  yOffset = 0.02,
): void {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({
      map: textures.street,
      bumpMap: textures.surfaceBump,
      bumpScale: 0.032,
      color: tintColor,
      roughness: 0.94,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotY;
  mesh.position.set(x, yOffset, z);
  mesh.receiveShadow = true;
  ctx.group.add(mesh);

  ctx.roads.push({ x, z, width, length, rotY });
}

export function addSolidBox(
  ctx: MapBuildContext,
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  blocksSight = true,
  yBase = 0,
  colliderOpts?: { topY?: number; climbable?: boolean },
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    getBoxGeo(ctx, width, height, depth),
    material,
  );
  mesh.position.set(x, yBase + height * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.group.add(mesh);

  ctx.boxes.push({
    minX: x - width * 0.5,
    maxX: x + width * 0.5,
    minZ: z - depth * 0.5,
    maxZ: z + depth * 0.5,
    blocksSight,
    ...(colliderOpts?.climbable ? { climbable: true } : {}),
    ...(colliderOpts?.topY !== undefined ? { topY: colliderOpts.topY } : {}),
  });
  return mesh;
}

export function addVisualBox(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  castShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export interface EnterableRoomOptions {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Which side has the wide open doorway */
  doorSide: 'south' | 'north' | 'east' | 'west';
  doorWidth?: number;
  wallMaterial: THREE.Material;
  floorMaterial: THREE.Material;
  roofStyle: 'flat' | 'pitched' | 'thatch' | 'tin' | 'dome';
  roofColor: number;
  trimColor: number;
  textures: VillageTextureSet;
  minimapKind: MinimapBuilding['kind'];
  /** Optional callback to populate interior props (local coordinates centered on room) */
  addInteriorProps?: (roomGroup: THREE.Group) => void;
}

/**
 * Builds an enterable 4-walled room with an open doorway, floor slab, trim,
 * accurate wall BoxColliders, fade-out roofMeshes, HouseInterior registration,
 * and an automatic interior HidingSpot.
 */
export function buildEnterableRoom(
  ctx: MapBuildContext,
  opts: EnterableRoomOptions,
): THREE.Group {
  const {
    id,
    label,
    x,
    z,
    width,
    depth,
    height,
    doorSide,
    doorWidth = 2.0,
    wallMaterial,
    floorMaterial,
    roofStyle,
    roofColor,
    trimColor,
    textures,
    minimapKind,
    addInteriorProps,
  } = opts;

  const room = new THREE.Group();
  room.position.set(x, 0, z);
  const t = 0.28; // Wall thickness
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  // Floor slab
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.1, 0.08, depth - 0.1),
    floorMaterial,
  );
  floor.position.set(0, 0.04, 0);
  floor.receiveShadow = true;
  room.add(floor);

  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.72,
  });

  // Helper to add a wall segment in local space + world collider
  const addWallSeg = (
    lx: number,
    lz: number,
    sw: number,
    sd: number,
    sh = height,
    yBase = 0,
  ) => {
    if (sw <= 0.05 || sd <= 0.05) return;
    const mesh = new THREE.Mesh(
      getBoxGeo(ctx, sw, sh, sd),
      wallMaterial,
    );
    mesh.position.set(lx, yBase + sh * 0.5, lz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    room.add(mesh);

    if (yBase < 1.2) {
      ctx.boxes.push({
        minX: x + lx - sw * 0.5,
        maxX: x + lx + sw * 0.5,
        minZ: z + lz - sd * 0.5,
        maxZ: z + lz + sd * 0.5,
        blocksSight: true,
      });
    }
  };

  // South wall (+Z)
  if (doorSide === 'south') {
    const segW = Math.max(0.35, (width - doorWidth) * 0.5);
    addWallSeg(-(doorWidth * 0.5 + segW * 0.5), halfD - t * 0.5, segW, t);
    addWallSeg(doorWidth * 0.5 + segW * 0.5, halfD - t * 0.5, segW, t);
    // Door lintel above
    addWallSeg(0, halfD - t * 0.5, doorWidth, t, Math.max(0.45, height - 2.2), 2.2);
    addVisualBox(room, 0, 2.22, halfD + 0.02, doorWidth + 0.25, 0.14, 0.14, trimMat);
  } else {
    addWallSeg(0, halfD - t * 0.5, width, t);
  }

  // North wall (-Z)
  if (doorSide === 'north') {
    const segW = Math.max(0.35, (width - doorWidth) * 0.5);
    addWallSeg(-(doorWidth * 0.5 + segW * 0.5), -halfD + t * 0.5, segW, t);
    addWallSeg(doorWidth * 0.5 + segW * 0.5, -halfD + t * 0.5, segW, t);
    addWallSeg(0, -halfD + t * 0.5, doorWidth, t, Math.max(0.45, height - 2.2), 2.2);
    addVisualBox(room, 0, 2.22, -halfD - 0.02, doorWidth + 0.25, 0.14, 0.14, trimMat);
  } else {
    addWallSeg(0, -halfD + t * 0.5, width, t);
  }

  // East wall (+X)
  if (doorSide === 'east') {
    const segD = Math.max(0.35, (depth - doorWidth) * 0.5);
    addWallSeg(halfW - t * 0.5, -(doorWidth * 0.5 + segD * 0.5), t, segD);
    addWallSeg(halfW - t * 0.5, doorWidth * 0.5 + segD * 0.5, t, segD);
    addWallSeg(halfW - t * 0.5, 0, t, doorWidth, Math.max(0.45, height - 2.2), 2.2);
    addVisualBox(room, halfW + 0.02, 2.22, 0, 0.14, 0.14, doorWidth + 0.25, trimMat);
  } else {
    addWallSeg(halfW - t * 0.5, 0, t, depth);
  }

  // West wall (-X)
  if (doorSide === 'west') {
    const segD = Math.max(0.35, (depth - doorWidth) * 0.5);
    addWallSeg(-halfW + t * 0.5, -(doorWidth * 0.5 + segD * 0.5), t, segD);
    addWallSeg(-halfW + t * 0.5, doorWidth * 0.5 + segD * 0.5, t, segD);
    addWallSeg(-halfW + t * 0.5, 0, t, doorWidth, Math.max(0.45, height - 2.2), 2.2);
    addVisualBox(room, -halfW - 0.02, 2.22, 0, 0.14, 0.14, doorWidth + 0.25, trimMat);
  } else {
    addWallSeg(-halfW + t * 0.5, 0, t, depth);
  }

  // Painted windows on non-door walls for rich 1990s architectural charm
  const winGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2a333b,
    roughness: 0.45,
  });
  const addWindow = (wx: number, wz: number, rotY: number) => {
    const wf = new THREE.Group();
    wf.position.set(wx, 1.55, wz);
    wf.rotation.y = rotY;
    addVisualBox(wf, 0, 0, 0, 1.05, 0.9, 0.1, trimMat, false);
    addVisualBox(wf, 0, 0, 0.03, 0.82, 0.68, 0.08, winGlassMat, false);
    // Wooden shutter slats
    addVisualBox(wf, 0, 0, 0.07, 0.06, 0.7, 0.04, trimMat, false);
    addVisualBox(wf, 0, 0, 0.07, 0.82, 0.06, 0.04, trimMat, false);
    room.add(wf);
  };

  if (doorSide !== 'south' && width >= 4.2) addWindow(0, halfD + 0.02, 0);
  if (doorSide !== 'north' && width >= 4.2) addWindow(0, -halfD - 0.02, Math.PI);
  if (doorSide !== 'east' && depth >= 4.2) addWindow(halfW + 0.02, 0, Math.PI / 2);
  if (doorSide !== 'west' && depth >= 4.2) addWindow(-halfW - 0.02, 0, -Math.PI / 2);

  // Fade-out Roof (transparent: true so engine's updateHouseRoofVisibility reveals interior)
  const roofMeshes: THREE.Mesh[] = [];
  if (roofStyle === 'flat') {
    const slabMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.88,
      transparent: true,
      opacity: 1,
    });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.45, 0.24, depth + 0.45),
      slabMat,
    );
    slab.position.set(0, height + 0.12, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    room.add(slab);
    roofMeshes.push(slab);

    // Low rooftop parapet rim
    const parapetH = 0.55;
    const pMat = new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.85,
      transparent: true,
      opacity: 1,
    });
    const pN = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, parapetH, 0.18), pMat);
    pN.position.set(0, height + 0.24 + parapetH * 0.5, -halfD - 0.1);
    const pS = pN.clone();
    pS.position.z = halfD + 0.1;
    const pE = new THREE.Mesh(new THREE.BoxGeometry(0.18, parapetH, depth + 0.35), pMat);
    pE.position.set(halfW + 0.1, height + 0.24 + parapetH * 0.5, 0);
    const pW = pE.clone();
    pW.position.x = -halfW - 0.1;
    room.add(pN, pS, pE, pW);
    roofMeshes.push(pN, pS, pE, pW);
  } else if (roofStyle === 'tin') {
    const tinMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.58,
      metalness: 0.35,
      transparent: true,
      opacity: 1,
    });
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.9, 0.14, depth + 0.9),
      tinMat,
    );
    roof.position.set(0, height + 0.28, 0);
    roof.rotation.z = 0.08;
    roof.castShadow = true;
    room.add(roof);
    roofMeshes.push(roof);
  } else if (roofStyle === 'thatch') {
    const thatchMat = new THREE.MeshStandardMaterial({
      map: textures.thatchRoof,
      color: roofColor,
      roughness: 0.96,
      transparent: true,
      opacity: 1,
    });
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(width, depth) * 0.76, 1.85, 4),
      thatchMat,
    );
    cone.position.set(0, height + 0.88, 0);
    cone.rotation.y = Math.PI / 4;
    cone.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    cone.castShadow = true;
    room.add(cone);
    roofMeshes.push(cone);
  } else if (roofStyle === 'dome') {
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.84,
      transparent: true,
      opacity: 1,
    });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, 0.25, depth + 0.4),
      roofMat,
    );
    slab.position.set(0, height + 0.12, 0);
    slab.castShadow = true;
    room.add(slab);
    roofMeshes.push(slab);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(Math.min(width, depth) * 0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      roofMat,
    );
    dome.position.set(0, height + 0.22, 0);
    dome.castShadow = true;
    room.add(dome);
    roofMeshes.push(dome);
  } else {
    // Pitched clay-tile roof
    const tileMat = new THREE.MeshStandardMaterial({
      map: textures.roofTile,
      color: roofColor,
      roughness: 0.88,
      transparent: true,
      opacity: 1,
    });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(width, depth) * 0.74, 1.55, 4),
      tileMat,
    );
    roof.position.set(0, height + 0.75, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    roof.castShadow = true;
    room.add(roof);
    roofMeshes.push(roof);
  }

  if (addInteriorProps) {
    addInteriorProps(room);
  }

  ctx.group.add(room);

  // Doorway & interior navigation coordinates
  let doorX = x;
  let doorZ = z;
  let insideX = x;
  let insideZ = z;
  if (doorSide === 'south') {
    doorZ = z + halfD + 1.05;
    insideZ = z - halfD * 0.25;
  } else if (doorSide === 'north') {
    doorZ = z - halfD - 1.05;
    insideZ = z + halfD * 0.25;
  } else if (doorSide === 'east') {
    doorX = x + halfW + 1.05;
    insideX = x - halfW * 0.25;
  } else {
    doorX = x - halfW - 1.05;
    insideX = x + halfW * 0.25;
  }

  ctx.houseInteriors.push({
    id,
    label,
    minX: x - halfW + 0.15,
    maxX: x + halfW - 0.15,
    minZ: z - halfD + 0.15,
    maxZ: z + halfD - 0.15,
    doorX,
    doorZ,
    insideX,
    insideZ,
    roofMeshes,
  });

  ctx.hidingSpots.push({
    x: insideX,
    z: insideZ,
    label: `Inside ${label}`,
    kind: 'house',
  });

  ctx.buildings.push({
    x,
    z,
    width,
    depth,
    rotY: 0,
    kind: minimapKind,
  });

  return room;
}

export function addTree(
  ctx: MapBuildContext,
  x: number,
  z: number,
  scale: number,
  textures: VillageTextureSet,
  foliageColor = 0x457b36,
  withMangoes = false,
  registerHidingSpot = true,
  spotLabel = 'Behind a Shade Tree',
): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    roughness: 0.94,
  });

  const trunkH = 2.6 * scale;
  const trunkR = 0.34 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.72, trunkR * 1.18, trunkH, 9),
    barkMat,
  );
  trunk.position.y = trunkH * 0.5;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const foliage = new THREE.Group();
  foliage.position.y = trunkH + 0.45 * scale;
  const leafMat = new THREE.MeshStandardMaterial({
    color: foliageColor,
    roughness: 0.86,
  });
  const leafMatDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(foliageColor).multiplyScalar(0.82),
    roughness: 0.9,
  });

  const puffs: Array<[number, number, number, number, boolean]> = [
    [0, 0.55, 0, 1.75, false],
    [-1.1, 0.15, 0.55, 1.25, true],
    [1.15, 0.2, -0.45, 1.3, false],
    [0.25, 0.1, 1.1, 1.2, true],
    [-0.35, 0.15, -1.05, 1.22, false],
  ];
  for (const [px, py, pz, r, dark] of puffs) {
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r * scale, 1),
      dark ? leafMatDark : leafMat,
    );
    puff.position.set(px * scale, py * scale, pz * scale);
    puff.castShadow = true;
    puff.receiveShadow = true;
    foliage.add(puff);
  }

  if (withMangoes) {
    const mangoMat = new THREE.MeshStandardMaterial({
      color: 0xf0b22a,
      roughness: 0.45,
    });
    const mangoCoords: Array<[number, number, number]> = [
      [-0.9, -0.5, 0.7],
      [0.95, -0.42, 0.45],
      [0.15, -0.58, -0.85],
      [-0.55, -0.35, -0.75],
      [0.7, -0.48, -0.4],
    ];
    for (const [mx, my, mz] of mangoCoords) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * scale, 7, 6),
        mangoMat,
      );
      m.scale.set(0.85, 1.25, 0.85);
      m.position.set(mx * scale, my * scale, mz * scale);
      foliage.add(m);
    }
  }

  tree.add(foliage);
  ctx.group.add(tree);
  ctx.swayFoliage.push(foliage);

  ctx.circles.push({
    x,
    z,
    radius: Math.max(0.45, trunkR * 1.3),
    blocksSight: true,
  });

  ctx.landmarks.push({
    x,
    z,
    radius: 1.55 * scale,
    kind: 'tree',
  });

  if (registerHidingSpot) {
    ctx.hidingSpots.push({
      x: x + (x >= 0 ? -1.4 : 1.4),
      z: z + (z >= 0 ? -1.4 : 1.4),
      label: spotLabel,
      kind: 'tree',
    });
  }

  return tree;
}

export function addStoneWell(
  ctx: MapBuildContext,
  x: number,
  z: number,
  textures: VillageTextureSet,
  label = 'Behind the Stone Well',
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.85,
  });

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.38, 1.52, 1.08, 16, 1, true),
    brickMat,
  );
  rim.position.y = 0.54;
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  const cap = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.16, 8, 18),
    brickMat,
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 1.06;
  cap.castShadow = true;
  g.add(cap);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.22, 16),
    new THREE.MeshStandardMaterial({
      color: 0x265c72,
      normalMap: textures.waterNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.16,
      metalness: 0.18,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;
  g.add(water);

  // Wooden pulley frame
  addVisualBox(g, -1.2, 1.75, 0, 0.16, 1.5, 0.16, woodMat);
  addVisualBox(g, 1.2, 1.75, 0, 0.16, 1.5, 0.16, woodMat);
  addVisualBox(g, 0, 2.45, 0, 2.7, 0.16, 0.16, woodMat);

  ctx.group.add(g);
  ctx.circles.push({ x, z, radius: 1.65, blocksSight: true });
  ctx.landmarks.push({ x, z, radius: 1.65, kind: 'well' });
  ctx.hidingSpots.push({ x: x + 2.1, z: z + 0.4, label, kind: 'well' });
}

export function addCrateStack(
  ctx: MapBuildContext,
  x: number,
  z: number,
  textures: VillageTextureSet,
  label = 'Behind Stacked Crates',
): void {
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.025,
    color: 0xc99c68,
    roughness: 0.88,
  });
  const sackMat = new THREE.MeshStandardMaterial({
    color: 0xb79663,
    roughness: 0.95,
  });

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  addVisualBox(g, -0.42, 0.45, 0, 0.9, 0.9, 0.9, woodMat);
  addVisualBox(g, 0.48, 0.45, 0.1, 0.88, 0.9, 0.88, woodMat);
  addVisualBox(g, 0.05, 1.32, 0.02, 0.82, 0.82, 0.82, woodMat);

  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), sackMat);
  sack.scale.set(1.1, 0.72, 0.85);
  sack.position.set(-0.62, 0.3, 0.65);
  sack.castShadow = true;
  g.add(sack);

  ctx.group.add(g);
  ctx.boxes.push({
    minX: x - 1.05,
    maxX: x + 1.0,
    minZ: z - 0.6,
    maxZ: z + 0.95,
    blocksSight: true,
    topY: 0.92,
    climbable: true,
  });
  ctx.hidingSpots.push({ x, z: z - 1.35, label, kind: 'gully' });
}

export function addNaturalPerimeter(
  ctx: MapBuildContext,
  textures: VillageTextureSet,
  radius: number,
  treeCount: number,
  leafColors: number[],
  wallStyle: 'trees' | 'stone_wall' | 'hedges' = 'trees',
): void {
  const g = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    roughness: 0.95,
  });

  const leafMats = leafColors.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const sharedTrunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 3.4, 7);
  const sharedCanopyGeo = new THREE.DodecahedronGeometry(2.45, 1);

  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2;
    const r = radius + (i % 3) * 2.2;
    const tx = Math.cos(angle) * r;
    const tz = Math.sin(angle) * r;
    const s = 1.15 + (i % 4) * 0.2;

    const trunk = new THREE.Mesh(sharedTrunkGeo, barkMat);
    trunk.position.set(tx, 1.7 * s, tz);
    trunk.scale.setScalar(s);
    g.add(trunk);

    const canopy = new THREE.Mesh(
      sharedCanopyGeo,
      leafMats[i % leafMats.length],
    );
    canopy.position.set(tx, 4.1 * s, tz);
    canopy.scale.setScalar(s);
    g.add(canopy);
  }

  if (wallStyle === 'stone_wall' || wallStyle === 'hedges') {
    const segs = 28;
    const wallMat =
      wallStyle === 'stone_wall'
        ? new THREE.MeshStandardMaterial({
            map: textures.templeStone,
            bumpMap: textures.surfaceBump,
            bumpScale: 0.04,
            color: 0x9b8e7b,
            roughness: 0.92,
          })
        : new THREE.MeshStandardMaterial({
            color: 0x3b6b33,
            roughness: 0.94,
          });
    const wallH = wallStyle === 'stone_wall' ? 2.4 : 1.75;
    const segLen = (2 * Math.PI * (radius - 1.2)) / segs + 0.4;
    const sharedWallGeo = new THREE.BoxGeometry(segLen, wallH, 0.8);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const seg = new THREE.Mesh(sharedWallGeo, wallMat);
      seg.position.set(
        Math.cos(a) * (radius - 1.2),
        wallH * 0.5,
        Math.sin(a) * (radius - 1.2),
      );
      seg.rotation.y = -a + Math.PI / 2;
      seg.receiveShadow = true;
      g.add(seg);
    }
  }

  ctx.group.add(g);
}

export function addGlowingStringLights(
  ctx: MapBuildContext,
  start: [number, number, number],
  end: [number, number, number],
  bulbCount: number,
  colors: number[],
): void {
  const g = new THREE.Group();
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x251a12 });
  const bulbGeo = new THREE.SphereGeometry(0.13, 7, 6);
  const bulbMats = colors.map((col) => new THREE.MeshBasicMaterial({ color: col }));

  const sx = start[0],
    sy = start[1],
    sz = start[2];
  const ex = end[0],
    ey = end[1],
    ez = end[2];

  const dist = Math.hypot(ex - sx, ez - sz);
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, dist, 5),
    wireMat,
  );
  wire.position.set((sx + ex) * 0.5, (sy + ey) * 0.5 - 0.15, (sz + ez) * 0.5);
  wire.rotation.z = Math.PI / 2;
  wire.rotation.y = -Math.atan2(ez - sz, ex - sx);
  g.add(wire);

  for (let i = 1; i < bulbCount; i++) {
    const t = i / bulbCount;
    const sag = Math.sin(t * Math.PI) * 0.45;
    const bx = sx + (ex - sx) * t;
    const by = sy + (ey - sy) * t - sag;
    const bz = sz + (ez - sz) * t;
    const bulb = new THREE.Mesh(
      bulbGeo,
      bulbMats[i % bulbMats.length],
    );
    bulb.position.set(bx, by, bz);
    g.add(bulb);
  }

  ctx.group.add(g);
}

/**
 * Parked 1995 vintage scooter or village tractor providing authentic vehicle cover
 */
export function addVintageVehicle(
  ctx: MapBuildContext,
  kind: 'scooter' | 'tractor',
  x: number,
  z: number,
  rotY: number,
  bodyColor: number,
  label: string,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const paintMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.48,
    metalness: 0.18,
  });
  const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x201e1c,
    roughness: 0.9,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd9d4c7,
    roughness: 0.45,
    metalness: 0.45,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x3b281c,
    roughness: 0.85,
  });

  if (kind === 'scooter') {
    // Classic 1990s Indian scooter body with rear stepney wheel
    addVisualBox(g, 0, 0.56, -0.25, 0.68, 0.54, 1.25, paintMat);
    addVisualBox(g, 0, 0.82, -0.18, 0.42, 0.16, 0.72, seatMat);
    addVisualBox(g, 0, 0.72, 0.58, 0.52, 0.78, 0.24, paintMat);
    // Handlebar & headlamp cowl
    addVisualBox(g, 0, 1.16, 0.56, 0.68, 0.12, 0.18, rimMat);
    addVisualBox(g, 0, 0.52, -0.92, 0.18, 0.44, 0.44, tyreMat);
    for (const wz of [-0.62, 0.62]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.16, 10),
        tyreMat,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.24, wz);
      g.add(wheel);
    }

    ctx.group.add(g);
    ctx.boxes.push({
      minX: x - 0.85,
      maxX: x + 0.85,
      minZ: z - 1.1,
      maxZ: z + 1.1,
      blocksSight: true,
      topY: 0.88,
      climbable: true,
    });
    const hideDist = 1.6;
    ctx.hidingSpots.push({
      x: x - Math.sin(rotY) * hideDist,
      z: z - Math.cos(rotY) * hideDist,
      label,
      kind: 'vehicle',
    });
    return;
  }

  // 1995 Indian farm tractor with high rear tyres & tall engine hood
  addVisualBox(g, 0, 0.96, 0.35, 1.15, 0.88, 1.85, paintMat);
  addVisualBox(g, 0, 1.48, 0.95, 0.12, 0.62, 0.12, tyreMat);
  addVisualBox(g, 0, 1.25, -0.78, 1.28, 0.38, 0.88, paintMat);
  addVisualBox(g, 0, 1.46, -0.78, 0.6, 0.2, 0.55, seatMat);

  for (const side of [-0.78, 0.78]) {
    const rearWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.38, 12),
      tyreMat,
    );
    rearWheel.rotation.z = Math.PI / 2;
    rearWheel.position.set(side, 0.68, -0.75);
    g.add(rearWheel);

    const rearRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.4, 10),
      rimMat,
    );
    rearRim.rotation.z = Math.PI / 2;
    rearRim.position.set(side, 0.68, -0.75);
    g.add(rearRim);

    const frontWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10),
      tyreMat,
    );
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(side * 0.8, 0.36, 1.05);
    g.add(frontWheel);
  }

  ctx.group.add(g);
  ctx.boxes.push({
    minX: x - 1.45,
    maxX: x + 1.45,
    minZ: z - 1.65,
    maxZ: z + 1.65,
    blocksSight: true,
    topY: 1.38,
    climbable: true,
  });
  const hideDist = 2.25;
  ctx.hidingSpots.push({
    x: x - Math.sin(rotY) * hideDist,
    z: z - Math.cos(rotY) * hideDist,
    label,
    kind: 'vehicle',
  });
}

import * as THREE from 'three';
import {
  addCrateStack,
  addGroundPlane,
  addNaturalPerimeter,
  addRoadSegment,
  addSolidBox,
  addStoneWell,
  addTree,
  addVintageVehicle,
  addVisualBox,
  buildEnterableRoom,
  createMapContext,
} from './mapHelpers';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

// ============================================================================
// LEVEL 2 — SCHOOL CAMPUS (Old Village Prathmik Vidyalaya)
// ============================================================================
export function buildSchoolCampusMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0xceb88d, 130);

  // Central dusty playground & chalk court
  const playground = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 24),
    new THREE.MeshStandardMaterial({
      map: textures.courtyard,
      color: 0xe3cb9c,
      roughness: 0.94,
    }),
  );
  playground.rotation.x = -Math.PI / 2;
  playground.position.set(0, 0.02, 2);
  playground.receiveShadow = true;
  ctx.group.add(playground);
  ctx.landmarks.push({ x: 0, z: 2, radius: 11.5, kind: 'courtyard' });

  // Chalk-white Kho-Kho / Kabaddi court lines in the playground
  const chalkMat = new THREE.MeshBasicMaterial({ color: 0xf6f1e0 });
  const addChalkLine = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), chalkMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.035, z);
    ctx.group.add(m);
  };
  addChalkLine(0, 2, 16, 0.14);
  addChalkLine(0, -4, 16, 0.14);
  addChalkLine(0, 8, 16, 0.14);
  addChalkLine(-8, 2, 0.14, 12);
  addChalkLine(8, 2, 0.14, 12);
  addChalkLine(0, 2, 0.14, 12);

  // Campus walkways & corridors
  addRoadSegment(ctx, 0, 22, 4.4, 26, 0, textures, 0xd9c298);
  addRoadSegment(ctx, 0, -11.2, 4.0, 42, Math.PI / 2, textures, 0xe4d4b0); // North veranda corridor
  addRoadSegment(ctx, -18.5, 4, 3.8, 32, 0, textures, 0xe4d4b0); // West wing corridor
  addRoadSegment(ctx, 18.5, 4, 3.8, 32, 0, textures, 0xe4d4b0); // East wing corridor
  addRoadSegment(ctx, 0, 17, 3.6, 40, Math.PI / 2, textures, 0xd8be92); // South gate path

  const schoolWallMat = new THREE.MeshStandardMaterial({
    map: textures.schoolWall,
    roughness: 0.88,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x9b9488,
    roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.84,
  });
  const blackboardMat = new THREE.MeshStandardMaterial({
    map: textures.blackboard,
    roughness: 0.9,
  });

  const addClassroomFurniture = (room: THREE.Group, doorSide: 'south' | 'east' | 'west') => {
    // Blackboard opposite the doorway
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), blackboardMat);
    if (doorSide === 'south') {
      bb.position.set(0, 1.65, -2.55);
    } else if (doorSide === 'east') {
      bb.position.set(-2.55, 1.65, 0);
      bb.rotation.y = Math.PI / 2;
    } else {
      bb.position.set(2.55, 1.65, 0);
      bb.rotation.y = -Math.PI / 2;
    }
    room.add(bb);

    // Classic wooden school benches
    for (const bx of [-1.45, 1.45]) {
      addVisualBox(room, bx, 0.36, 0.25, 1.5, 0.08, 0.55, woodMat);
      addVisualBox(room, bx - 0.62, 0.18, 0.25, 0.1, 0.36, 0.45, woodMat);
      addVisualBox(room, bx + 0.62, 0.18, 0.25, 0.1, 0.36, 0.45, woodMat);
    }
  };

  // U-shaped Village School: 6 Enterable Classrooms & Staff/Library Rooms!
  const classrooms: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    w: number;
    d: number;
    door: 'south' | 'east' | 'west';
  }> = [
    { id: 'cls-1', label: 'Class 1-2 Room', x: -13.5, z: -17.5, w: 8.0, d: 6.2, door: 'south' },
    { id: 'cls-2', label: 'Class 3-4 Room', x: -3.5, z: -17.5, w: 8.0, d: 6.2, door: 'south' },
    { id: 'cls-3', label: 'Class 5 Room', x: 6.5, z: -17.5, w: 8.0, d: 6.2, door: 'south' },
    { id: 'cls-4', label: 'Headmaster Office', x: 16.5, z: -17.5, w: 7.4, d: 6.2, door: 'south' },
    { id: 'cls-5', label: 'West Science Room', x: -24.5, z: -2.5, w: 6.4, d: 7.8, door: 'east' },
    { id: 'cls-6', label: 'West Art & Games Room', x: -24.5, z: 8.5, w: 6.4, d: 7.8, door: 'east' },
    { id: 'cls-7', label: 'East Library Room', x: 24.5, z: -2.5, w: 6.4, d: 7.8, door: 'west' },
  ];

  for (const c of classrooms) {
    buildEnterableRoom(ctx, {
      id: c.id,
      label: c.label,
      x: c.x,
      z: c.z,
      width: c.w,
      depth: c.d,
      height: 3.45,
      doorSide: c.door,
      doorWidth: 2.15,
      wallMaterial: schoolWallMat,
      floorMaterial: floorMat,
      roofStyle: 'flat',
      roofColor: 0xc2b296,
      trimColor: 0x26486c,
      textures,
      minimapKind: 'school',
      addInteriorProps: (r) => addClassroomFurniture(r, c.door),
    });
  }

  // Iconic "PRATHMIK VIDYALAYA" School Signboard above the main veranda
  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 1.5, 0.25),
    new THREE.MeshStandardMaterial({ map: textures.schoolSign, roughness: 0.6 }),
  );
  signMesh.position.set(1.5, 4.35, -14.2);
  signMesh.castShadow = true;
  ctx.group.add(signMesh);

  // Pillared Veranda Corridor Canopy along North & West Wings
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xf0e4c8,
    roughness: 0.85,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    color: 0xb65235,
    roughness: 0.88,
  });
  // North veranda overhang
  const nCanopy = new THREE.Mesh(new THREE.BoxGeometry(39, 0.2, 3.2), canopyMat);
  nCanopy.position.set(1.5, 3.3, -12.8);
  nCanopy.castShadow = true;
  ctx.group.add(nCanopy);

  for (let px = -16.5; px <= 19.5; px += 4.5) {
    addSolidBox(ctx, px, -11.4, 0.42, 3.3, 0.42, pillarMat, false);
    ctx.hidingSpots.push({
      x: px,
      z: -12.6,
      label: 'Behind School Veranda Pillar',
      kind: 'gully',
    });
  }

  // West wing veranda overhang
  const wCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 19.5), canopyMat);
  wCanopy.position.set(-19.9, 3.3, 3.0);
  wCanopy.castShadow = true;
  ctx.group.add(wCanopy);
  for (const pz of [-5.5, -0.5, 4.5, 9.5]) {
    addSolidBox(ctx, -18.7, pz, 0.42, 3.3, 0.42, pillarMat, false);
  }

  // Assembly Stage & Tricolour Flagpole on North Edge of Playground
  const stageMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xdec8a0,
    roughness: 0.88,
  });
  addSolidBox(ctx, 1.5, -7.2, 6.2, 0.72, 3.0, stageMat, false, 0, {
    topY: 0.72,
    climbable: true,
  });
  ctx.landmarks.push({ x: 1.5, z: -7.2, radius: 3.1, kind: 'stage' });
  ctx.hidingSpots.push({
    x: 1.5,
    z: -9.5,
    label: 'Behind Assembly Stage',
    kind: 'gully',
  });

  // Tall school flagpole
  const poleGroup = new THREE.Group();
  poleGroup.position.set(-9.5, 0, -6.8);
  const poleBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.6, 8),
    pillarMat,
  );
  poleBase.position.y = 0.3;
  poleGroup.add(poleBase);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 6.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 0.45, roughness: 0.4 }),
  );
  pole.position.y = 3.5;
  poleGroup.add(pole);
  // Decorative festive school pennant
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.85, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.7 }),
  );
  flag.position.set(0.72, 6.1, 0);
  poleGroup.add(flag);
  ctx.group.add(poleGroup);
  ctx.circles.push({ x: -9.5, z: -6.8, radius: 1.15, blocksSight: false });

  // Playground Iron Swing Frame (SE of playground)
  const swingGroup = new THREE.Group();
  swingGroup.position.set(11.5, 0, 11.5);
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2f547a,
    metalness: 0.4,
    roughness: 0.5,
  });
  addVisualBox(swingGroup, -2.1, 1.6, 0, 0.14, 3.2, 0.14, ironMat);
  addVisualBox(swingGroup, 2.1, 1.6, 0, 0.14, 3.2, 0.14, ironMat);
  addVisualBox(swingGroup, 0, 3.15, 0, 4.4, 0.14, 0.14, ironMat);
  for (const sx of [-0.9, 0.9]) {
    addVisualBox(swingGroup, sx, 0.8, 0, 0.75, 0.08, 0.32, woodMat);
  }
  ctx.group.add(swingGroup);
  ctx.circles.push({ x: 9.4, z: 11.5, radius: 0.35, blocksSight: false });
  ctx.circles.push({ x: 13.6, z: 11.5, radius: 0.35, blocksSight: false });

  // Lush School Botanical Garden (East & South-East Quadrant with Hedges & Flowerbeds)
  const gardenLawn = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ color: 0x5c8b42, roughness: 0.94 }),
  );
  gardenLawn.rotation.x = -Math.PI / 2;
  gardenLawn.position.set(25.5, 0.025, 13.5);
  gardenLawn.receiveShadow = true;
  ctx.group.add(gardenLawn);
  ctx.landmarks.push({ x: 25.5, z: 13.5, radius: 8.0, kind: 'garden' });

  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x35682e, roughness: 0.92 });
  addSolidBox(ctx, 25.5, 6.2, 12.5, 1.35, 0.85, hedgeMat, true, 0, {
    topY: 1.35,
    climbable: true,
  });
  addSolidBox(ctx, 25.5, 20.8, 12.5, 1.35, 0.85, hedgeMat, true, 0, {
    topY: 1.35,
    climbable: true,
  });
  addSolidBox(ctx, 32.5, 13.5, 0.85, 1.35, 13.5, hedgeMat, true, 0, {
    topY: 1.35,
    climbable: true,
  });
  // Central garden bench + flowerbed hiding spot
  addSolidBox(ctx, 25.5, 13.5, 3.0, 0.95, 3.0, hedgeMat, false, 0, {
    topY: 0.95,
    climbable: true,
  });
  ctx.hidingSpots.push({ x: 28.8, z: 13.5, label: 'Inside School Garden Hedge', kind: 'tree' });
  ctx.hidingSpots.push({ x: 23.0, z: 17.8, label: 'Behind Garden Flowerbed', kind: 'tree' });

  // Drinking Water Shed & School Bell Post (South-West)
  buildEnterableRoom(ctx, {
    id: 'cls-store',
    label: 'Sports Equipment Shed',
    x: -16.5,
    z: 22.5,
    width: 6.2,
    depth: 5.2,
    height: 2.9,
    doorSide: 'north',
    doorWidth: 2.0,
    wallMaterial: schoolWallMat,
    floorMaterial: floorMat,
    roofStyle: 'tin',
    roofColor: 0x6f7b84,
    trimColor: 0x9c4e35,
    textures,
    minimapKind: 'shed',
  });

  // School gate pillars at south entrance
  addSolidBox(ctx, -4.2, 29.5, 1.2, 2.8, 1.2, schoolWallMat, true);
  addSolidBox(ctx, 4.2, 29.5, 1.2, 2.8, 1.2, schoolWallMat, true);
  addSolidBox(ctx, -16.0, 29.5, 22.0, 1.85, 0.65, schoolWallMat, true);
  addSolidBox(ctx, 16.0, 29.5, 22.0, 1.85, 0.65, schoolWallMat, true);
  ctx.hidingSpots.push({ x: -8.5, z: 27.6, label: 'Behind School Gate Wall', kind: 'wall' });
  ctx.hidingSpots.push({ x: 10.2, z: 27.6, label: 'Near School Boundary Wall', kind: 'wall' });
  addVintageVehicle(
    ctx,
    'scooter',
    -11.8,
    24.5,
    0.45,
    0x3f6e5c,
    'Behind Headmaster’s Vintage Scooter',
  );

  // Shade Neem & Gulmohar Trees around Campus
  const treeCoords: Array<[number, number, number, number]> = [
    [-14.5, 15.0, 1.15, 0x457d36],
    [-25.5, 19.5, 1.2, 0x3b7130],
    [15.5, 22.5, 1.15, 0x4d843a],
    [29.5, 4.2, 1.1, 0xd45a2a], // Gulmohar bloom tree!
    [29.5, 23.0, 1.15, 0x427934],
    [-31.5, -13.5, 1.2, 0x3f7332],
    [28.0, -14.5, 1.18, 0x467c37],
    [-1.5, -26.5, 1.22, 0x3d7031],
    [13.5, -26.5, 1.15, 0x4c833a],
  ];
  for (const [tx, tz, sc, col] of treeCoords) {
    addTree(ctx, tx, tz, sc, textures, col, false, true, 'Behind a Campus Tree');
  }

  // Crates & School Desks stacked behind North Wing
  addCrateStack(ctx, -20.5, -22.5, textures, 'Behind Stacked School Desks');
  addCrateStack(ctx, 22.5, -23.0, textures, 'Behind Headmaster Shed Crates');

  // Natural outer campus grove
  addNaturalPerimeter(ctx, textures, 44.5, 34, [0x3d6e31, 0x4c7f3a, 0x35622a], 'trees');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.5),
    new THREE.Vector3(-12.0, 0, -10.5),
    new THREE.Vector3(6.5, 0, -10.5),
    new THREE.Vector3(16.5, 0, -10.5),
    new THREE.Vector3(-17.2, 0, -1.5),
    new THREE.Vector3(-17.2, 0, 9.5),
    new THREE.Vector3(17.5, 0, -1.5),
    new THREE.Vector3(19.5, 0, 13.5),
    new THREE.Vector3(26.0, 0, 24.5),
    new THREE.Vector3(0, 0, 19.0),
    new THREE.Vector3(-12.5, 0, 17.5),
    new THREE.Vector3(-5.0, 0, -24.0),
    new THREE.Vector3(12.0, 0, 4.5),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 42.5,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#433726',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.2, 0, 7.6],
      previewCamPos: [1.55, 1.85, 11.45],
      previewLookAt: [1.25, 1.05, 7.2],
      hiders: [
        [-2.0, 7.5, Math.PI],
        [-11.5, 4.5, 0.6],
        [10.5, -2.5, -0.8],
        [4.5, 15.5, 2.4],
      ],
      seeker: [1.5, 0.5, 0],
    },
  };
}

// ============================================================================
// LEVEL 3 — MANGO FARM (Aam Ka Bageecha)
// ============================================================================
export function buildMangoFarmMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0x9fa364, 135);

  // Main farm dirt tracks intersecting through the orchard
  addRoadSegment(ctx, 0, 0, 4.2, 76, 0, textures, 0xc9a36f);
  addRoadSegment(ctx, 0, 0, 4.0, 76, Math.PI / 2, textures, 0xc9a36f);
  addRoadSegment(ctx, -18, 0, 3.0, 56, 0, textures, 0xc09b68);
  addRoadSegment(ctx, 18, 0, 3.0, 56, 0, textures, 0xc09b68);
  addRoadSegment(ctx, 0, -18, 3.0, 56, Math.PI / 2, textures, 0xc09b68);
  addRoadSegment(ctx, 0, 18, 3.0, 56, Math.PI / 2, textures, 0xc09b68);

  // Plowed irrigation crop fields (South-West & South-East)
  const soilMat = new THREE.MeshStandardMaterial({
    map: textures.farmSoil,
    roughness: 0.96,
  });
  const cropMat = new THREE.MeshStandardMaterial({
    color: 0x6f993c,
    roughness: 0.9,
  });
  const fieldAreas: Array<[number, number, number, number]> = [
    [-26, 26, 13, 12],
    [26, 26, 13, 12],
    [-27, -25, 12, 11],
  ];
  for (const [fx, fz, fw, fd] of fieldAreas) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), soilMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(fx, 0.025, fz);
    patch.receiveShadow = true;
    ctx.group.add(patch);
    ctx.landmarks.push({ x: fx, z: fz, radius: fw * 0.55, kind: 'farm' });

    // Low leafy crop rows (visual cover without blocking walking)
    const rowGroup = new THREE.Group();
    for (let rz = -fd * 0.38; rz <= fd * 0.38; rz += 2.2) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(fw - 1.4, 0.72, 0.75),
        cropMat,
      );
      strip.position.set(fx, 0.36, fz + rz);
      strip.castShadow = true;
      rowGroup.add(strip);
    }
    ctx.group.add(rowGroup);
    ctx.swayFoliage.push(rowGroup);
    ctx.hidingSpots.push({
      x: fx,
      z: fz,
      label: 'Crouched in Crop Field Rows',
      kind: 'gully',
    });
  }

  // 3 Enterable Farm Tool Sheds & Watchman Hut
  const brickWallMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    color: 0xd4b698,
    roughness: 0.92,
  });
  const mudWallMat = new THREE.MeshStandardMaterial({
    map: textures.mudWallOchre,
    roughness: 0.92,
  });
  const dirtFloorMat = new THREE.MeshStandardMaterial({
    color: 0x8f7350,
    roughness: 0.95,
  });

  buildEnterableRoom(ctx, {
    id: 'farm-shed-nw',
    label: 'Mango Packing Shed',
    x: -10.5,
    z: -10.5,
    width: 7.0,
    depth: 5.4,
    height: 3.1,
    doorSide: 'south',
    doorWidth: 2.2,
    wallMaterial: brickWallMat,
    floorMaterial: dirtFloorMat,
    roofStyle: 'tin',
    roofColor: 0x7d6552,
    trimColor: 0x5c3a22,
    textures,
    minimapKind: 'shed',
  });

  buildEnterableRoom(ctx, {
    id: 'farm-shed-ne',
    label: 'Tractor & Tool Barn',
    x: 11.5,
    z: -11.5,
    width: 7.4,
    depth: 5.6,
    height: 3.3,
    doorSide: 'south',
    doorWidth: 2.4,
    wallMaterial: brickWallMat,
    floorMaterial: dirtFloorMat,
    roofStyle: 'tin',
    roofColor: 0x62707a,
    trimColor: 0x7a3a22,
    textures,
    minimapKind: 'shed',
  });

  buildEnterableRoom(ctx, {
    id: 'farm-hut-s',
    label: 'Orchard Watchman Hut',
    x: 10.5,
    z: 11.5,
    width: 5.8,
    depth: 5.0,
    height: 2.9,
    doorSide: 'west',
    doorWidth: 2.0,
    wallMaterial: mudWallMat,
    floorMaterial: dirtFloorMat,
    roofStyle: 'thatch',
    roofColor: 0xd8b878,
    trimColor: 0x4b6e3c,
    textures,
    minimapKind: 'hut',
  });

  buildEnterableRoom(ctx, {
    id: 'farm-pump-house',
    label: 'Tubewell Pump House',
    x: -11.0,
    z: 11.5,
    width: 5.4,
    depth: 4.8,
    height: 2.85,
    doorSide: 'east',
    doorWidth: 2.0,
    wallMaterial: brickWallMat,
    floorMaterial: dirtFloorMat,
    roofStyle: 'flat',
    roofColor: 0x9e9588,
    trimColor: 0x2f607d,
    textures,
    minimapKind: 'shed',
  });

  // 2 Classic Stone Irrigation Wells
  addStoneWell(ctx, -6.5, -2.5, textures, 'Behind West Orchard Well');
  addStoneWell(ctx, 24.5, -5.5, textures, 'Behind East Irrigation Well');

  // Tall Golden Haystacks (great round cover in the fields!)
  const hayMat = new THREE.MeshStandardMaterial({
    map: textures.thatchRoof,
    color: 0xe3bf68,
    roughness: 0.96,
  });
  const hayCoords: Array<[number, number]> = [
    [-23.5, 9.5],
    [-26.5, 13.0],
    [23.5, 11.5],
    [6.5, -25.0],
    [-7.5, 25.5],
  ];
  for (const [hx, hz] of hayCoords) {
    const hay = new THREE.Group();
    hay.position.set(hx, 0, hz);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.85, 1.85, 12),
      hayMat,
    );
    body.position.y = 0.92;
    body.castShadow = true;
    body.receiveShadow = true;
    hay.add(body);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 1.25, 12),
      hayMat,
    );
    top.position.y = 2.45;
    top.castShadow = true;
    hay.add(top);
    ctx.group.add(hay);
    ctx.circles.push({ x: hx, z: hz, radius: 1.9, blocksSight: true });
    ctx.hidingSpots.push({
      x: hx + 2.35,
      z: hz,
      label: 'Behind a Golden Haystack',
      kind: 'gully',
    });
  }

  // Mango Basket Crates near packing sheds + 1995 Farm Tractor
  addCrateStack(ctx, -5.2, -13.5, textures, 'Behind Mango Basket Crates');
  addCrateStack(ctx, 16.5, -8.0, textures, 'Behind Orchard Crates');
  addCrateStack(ctx, 7.5, 16.0, textures, 'Behind Watchman Hut Crates');
  addVintageVehicle(
    ctx,
    'tractor',
    18.8,
    -11.5,
    0.25,
    0xc93b28,
    'Behind Vintage Farm Tractor',
  );

  // Expansive Mango Orchard Grid (26 Lush Fruiting Mango Trees!)
  const orchardTrees: Array<[number, number, number]> = [
    [-25, -13, 1.15],
    [-25, -4, 1.2],
    [-25, 4, 1.12],
    [-12, -24, 1.22],
    [-4, -24, 1.15],
    [12, -24, 1.2],
    [22, -24, 1.18],
    [26, -15, 1.22],
    [27, 4, 1.15],
    [13, 25, 1.18],
    [4, 25, 1.14],
    [-13, 25, 1.2],
    [-12, -3, 1.08],
    [10, -3.5, 1.12],
    [-12, 4.5, 1.1],
    [11, 3.8, 1.14],
    [-32, -8, 1.25],
    [-32, 6, 1.2],
    [33, -10, 1.22],
    [33, 8, 1.24],
    [0, -32, 1.25],
    [0, 32, 1.22],
    [-18, -32, 1.18],
    [18, -32, 1.18],
    [-18, 32, 1.18],
    [18, 32, 1.18],
  ];
  const mangoTints = [0x3d7a32, 0x488537, 0x356f2e, 0x518c3c];
  for (let i = 0; i < orchardTrees.length; i++) {
    const [tx, tz, sc] = orchardTrees[i];
    addTree(
      ctx,
      tx,
      tz,
      sc,
      textures,
      mangoTints[i % mangoTints.length],
      true,
      i % 2 === 0,
      'Behind a Fruiting Mango Tree',
    );
  }

  // Wooden Farm Boundary Fence & Dense Perimeter Grove
  addNaturalPerimeter(ctx, textures, 45.5, 38, [0x376d2c, 0x457d34, 0x2f6026], 'hedges');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 6.5),
    new THREE.Vector3(-18, 0, -18),
    new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(18, 0, -18),
    new THREE.Vector3(18, 0, 0),
    new THREE.Vector3(18, 0, 18),
    new THREE.Vector3(0, 0, 18),
    new THREE.Vector3(-18, 0, 18),
    new THREE.Vector3(-18, 0, 0),
    new THREE.Vector3(-9, 0, -5),
    new THREE.Vector3(9, 0, -6),
    new THREE.Vector3(26, 0, -10),
    new THREE.Vector3(-23.5, 0, 17.5),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 43.5,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    minimapLayout: {
      worldRadius: 43.5,
      groundTint: '#323a22',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.2, 0, 7.6],
      previewCamPos: [1.55, 1.85, 11.45],
      previewLookAt: [1.25, 1.05, 7.2],
      hiders: [
        [-1.8, 7.2, Math.PI],
        [-17.5, -5.0, 0.5],
        [17.5, 6.0, -0.7],
        [0.0, -17.5, 2.8],
      ],
      seeker: [1.8, 1.2, 0],
    },
  };
}

// ============================================================================
// LEVEL 4 — OLD MARKET (Purana Village Bazaar)
// ============================================================================
export function buildOldMarketMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0xb8966b, 130);

  // Tightly woven Indian Bazaar Streets & Back Alleys
  addRoadSegment(ctx, 0, 0, 4.8, 76, 0, textures, 0xc7a77b); // Main Bazaar Spine
  addRoadSegment(ctx, 0, 0, 4.6, 76, Math.PI / 2, textures, 0xc7a77b); // Cross Bazaar Lane
  addRoadSegment(ctx, -14.5, 0, 3.0, 62, 0, textures, 0xb8976c); // West Back Lane
  addRoadSegment(ctx, 14.5, 0, 3.0, 62, 0, textures, 0xb8976c); // East Back Lane
  addRoadSegment(ctx, 0, -15.5, 3.0, 62, Math.PI / 2, textures, 0xb8976c); // North Godown Lane
  addRoadSegment(ctx, 0, 15.5, 3.0, 62, Math.PI / 2, textures, 0xb8976c); // South Chai Lane
  addRoadSegment(ctx, -28.0, 0, 2.8, 48, 0, textures, 0xae8e66); // Outer West Alley
  addRoadSegment(ctx, 28.0, 0, 2.8, 48, 0, textures, 0xae8e66); // Outer East Alley

  // Central Bazaar Chowk Plinth & Old Clock Pillar
  const chowk = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 24),
    new THREE.MeshStandardMaterial({
      map: textures.courtyard,
      color: 0xd9ba8c,
      roughness: 0.92,
    }),
  );
  chowk.rotation.x = -Math.PI / 2;
  chowk.position.set(0, 0.03, 0);
  chowk.receiveShadow = true;
  ctx.group.add(chowk);
  ctx.landmarks.push({ x: 0, z: 0, radius: 7.2, kind: 'courtyard' });

  // Mini Bazaar Ghanta Ghar (Clock Tower Pillar in center)
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xe6cda2,
    roughness: 0.85,
  });
  const clockGroup = new THREE.Group();
  clockGroup.position.set(0, 0, -2.5);
  addVisualBox(clockGroup, 0, 0.35, 0, 2.8, 0.7, 2.8, stoneMat);
  addVisualBox(clockGroup, 0, 3.2, 0, 1.5, 5.2, 1.5, stoneMat);
  addVisualBox(
    clockGroup,
    0,
    6.1,
    0,
    1.85,
    0.45,
    1.85,
    new THREE.MeshStandardMaterial({ color: 0xa64128, roughness: 0.8 }),
  );
  // Clock faces
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xfef5df });
  for (let side = 0; side < 4; side++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), faceMat);
    const a = (side * Math.PI) / 2;
    face.position.set(Math.sin(a) * 0.78, 4.65, Math.cos(a) * 0.78);
    face.rotation.y = a;
    clockGroup.add(face);
  }
  ctx.group.add(clockGroup);
  ctx.boxes.push({
    minX: -1.45,
    maxX: 1.45,
    minZ: -3.95,
    maxZ: -1.05,
    blocksSight: true,
  });
  ctx.hidingSpots.push({
    x: 0,
    z: -4.75,
    label: 'Behind Bazaar Clock Pillar',
    kind: 'gully',
  });

  // Colorful Awninged Shops + Enterable Back Storage Rooms (Godowns) + Tiered Rooftop Silhouettes
  const shopWallCream = new THREE.MeshStandardMaterial({
    map: textures.mudWall,
    color: 0xf2dfc0,
    roughness: 0.9,
  });
  const shopWallOchre = new THREE.MeshStandardMaterial({
    map: textures.mudWallOchre,
    color: 0xe5be88,
    roughness: 0.9,
  });
  const shopWallBlue = new THREE.MeshStandardMaterial({
    color: 0xa5bfd4,
    roughness: 0.9,
  });
  const shopWallPink = new THREE.MeshStandardMaterial({
    color: 0xdca494,
    roughness: 0.9,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8b7b6b,
    roughness: 0.92,
  });

  const shopSpecs: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    door: 'south' | 'north' | 'east' | 'west';
    wall: THREE.Material;
    trim: number;
    awningColor: number;
  }> = [
    { id: 'shop-1', label: 'Gupta Kirana Store', x: -8.2, z: -8.5, w: 6.2, d: 5.2, h: 3.4, door: 'east', wall: shopWallCream, trim: 0x2a5c8a, awningColor: 0xc94228 },
    { id: 'shop-2', label: 'Sharma Mithai Shop', x: 8.2, z: -8.5, w: 6.2, d: 5.2, h: 3.8, door: 'west', wall: shopWallPink, trim: 0x8f2e24, awningColor: 0xd68924 },
    { id: 'shop-3', label: 'Bazaar Cloth Emporium', x: -8.2, z: 8.5, w: 6.2, d: 5.2, h: 3.6, door: 'east', wall: shopWallBlue, trim: 0x244c6b, awningColor: 0x2d705c },
    { id: 'shop-4', label: 'Raju Chai & Samosa', x: 8.2, z: 8.5, w: 6.2, d: 5.2, h: 3.3, door: 'west', wall: shopWallOchre, trim: 0x7c3e20, awningColor: 0xb93c28 },
    { id: 'godown-nw', label: 'Spice Storage Godown', x: -21.2, z: -8.5, w: 6.6, d: 5.8, h: 4.1, door: 'south', wall: shopWallOchre, trim: 0x6b3a1f, awningColor: 0x9e532b },
    { id: 'godown-ne', label: 'Grain Storage Godown', x: 21.2, z: -8.5, w: 6.6, d: 5.8, h: 4.2, door: 'south', wall: shopWallCream, trim: 0x2f5f7a, awningColor: 0x3b6c8c },
    { id: 'godown-sw', label: 'Brassware Storage Room', x: -21.2, z: 8.5, w: 6.6, d: 5.8, h: 3.9, door: 'north', wall: shopWallPink, trim: 0x8a3726, awningColor: 0xc26c2b },
    { id: 'godown-se', label: 'Textile Storage Room', x: 21.2, z: 8.5, w: 6.6, d: 5.8, h: 4.0, door: 'north', wall: shopWallBlue, trim: 0x2d5a4b, awningColor: 0x8d3544 },
    { id: 'shop-n', label: 'North Tailor Shop', x: -8.5, z: -22.5, w: 6.4, d: 5.2, h: 3.5, door: 'south', wall: shopWallCream, trim: 0x346282, awningColor: 0xd17e26 },
    { id: 'shop-n2', label: 'Radio Repair Shop', x: 8.5, z: -22.5, w: 6.4, d: 5.2, h: 3.7, door: 'south', wall: shopWallOchre, trim: 0x823624, awningColor: 0x326a5a },
    { id: 'shop-s', label: 'South Bangle Stall', x: -8.5, z: 22.5, w: 6.4, d: 5.2, h: 3.4, door: 'north', wall: shopWallPink, trim: 0x943548, awningColor: 0xc94228 },
    { id: 'shop-s2', label: 'Bicycle Repair Shop', x: 8.5, z: 22.5, w: 6.4, d: 5.2, h: 3.6, door: 'north', wall: shopWallBlue, trim: 0x264d6d, awningColor: 0xb87624 },
  ];

  for (const s of shopSpecs) {
    const room = buildEnterableRoom(ctx, {
      id: s.id,
      label: s.label,
      x: s.x,
      z: s.z,
      width: s.w,
      depth: s.d,
      height: s.h,
      doorSide: s.door,
      doorWidth: 2.15,
      wallMaterial: s.wall,
      floorMaterial: floorMat,
      roofStyle: 'flat',
      roofColor: 0xbaaa92,
      trimColor: s.trim,
      textures,
      minimapKind: 'market',
    });

    // Colorful sloped bazaar cloth awning projecting over shopfront
    const awningMat = new THREE.MeshStandardMaterial({
      map: textures.awning,
      color: s.awningColor,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const aw = new THREE.Mesh(
      new THREE.PlaneGeometry(s.door === 'east' || s.door === 'west' ? s.d - 0.6 : s.w - 0.6, 1.85),
      awningMat,
    );
    if (s.door === 'south') {
      aw.position.set(0, 2.65, s.d * 0.5 + 0.8);
      aw.rotation.x = -Math.PI * 0.38;
    } else if (s.door === 'north') {
      aw.position.set(0, 2.65, -(s.d * 0.5 + 0.8));
      aw.rotation.x = Math.PI * 0.38;
      aw.rotation.y = Math.PI;
    } else if (s.door === 'east') {
      aw.position.set(s.w * 0.5 + 0.8, 2.65, 0);
      aw.rotation.y = Math.PI / 2;
      aw.rotation.x = -Math.PI * 0.38;
    } else {
      aw.position.set(-(s.w * 0.5 + 0.8), 2.65, 0);
      aw.rotation.y = -Math.PI / 2;
      aw.rotation.x = -Math.PI * 0.38;
    }
    room.add(aw);
  }

  // Wooden Market Handcarts (Thelas) & Spice Crate Stacks in Lanes
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.86,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x2c241d,
    roughness: 0.8,
  });
  const thelaCoords: Array<[number, number, number, number]> = [
    [-14.5, -18.5, 0, 0xe89c2e],
    [14.5, 18.5, Math.PI, 0x62993a],
    [-22.5, 0.2, Math.PI / 2, 0xd44f2c],
    [22.5, -0.2, -Math.PI / 2, 0xe3b838],
  ];
  for (const [tx, tz, rot, produceColor] of thelaCoords) {
    const cart = new THREE.Group();
    cart.position.set(tx, 0, tz);
    cart.rotation.y = rot;
    addVisualBox(cart, 0, 0.88, 0, 2.1, 0.14, 1.25, woodMat);
    addVisualBox(cart, 0, 1.12, 0, 1.8, 0.34, 1.0, new THREE.MeshStandardMaterial({ color: produceColor, roughness: 0.85 }));
    for (const wx of [-0.7, 0.7]) {
      for (const wz of [-0.62, 0.62]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 12), wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.38, wz);
        cart.add(w);
      }
    }
    ctx.group.add(cart);
    ctx.boxes.push({
      minX: tx - 1.15,
      maxX: tx + 1.15,
      minZ: tz - 0.9,
      maxZ: tz + 0.9,
      blocksSight: true,
      topY: 1.15,
      climbable: true,
    });
    ctx.hidingSpots.push({
      x: tx,
      z: tz + 1.45,
      label: 'Behind a Vegetable Thela',
      kind: 'vehicle',
    });
  }

  addVintageVehicle(
    ctx,
    'scooter',
    -24.2,
    11.5,
    -0.5,
    0xdfd4b2,
    'Behind Bazaar Delivery Scooter',
  );

  // Crates tucked into narrow market alleys
  addCrateStack(ctx, -14.5, 2.2, textures, 'Behind West Alley Spice Crates');
  addCrateStack(ctx, 14.5, -2.4, textures, 'Behind East Alley Cloth Bales');
  addCrateStack(ctx, -28.0, -14.5, textures, 'Behind Outer Market Crates');
  addCrateStack(ctx, 28.0, 14.5, textures, 'Behind Godown Back Crates');

  // Bazaar perimeter shade trees & boundary walls
  const marketTrees: Array<[number, number]> = [
    [-29, -25],
    [29, -25],
    [-29, 25],
    [29, 25],
    [0, -30],
    [0, 30],
  ];
  for (const [tx, tz] of marketTrees) {
    addTree(ctx, tx, tz, 1.15, textures, 0x457936, false, true, 'Behind Bazaar Courtyard Tree');
  }

  addNaturalPerimeter(ctx, textures, 44.5, 32, [0x457435, 0x51803c, 0x3b672d], 'stone_wall');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.5),
    new THREE.Vector3(-14.5, 0, -14.5),
    new THREE.Vector3(14.5, 0, -14.5),
    new THREE.Vector3(14.5, 0, 14.5),
    new THREE.Vector3(-14.5, 0, 14.5),
    new THREE.Vector3(-28.0, 0, 0),
    new THREE.Vector3(28.0, 0, 0),
    new THREE.Vector3(0, 0, -15.5),
    new THREE.Vector3(0, 0, 15.5),
    new THREE.Vector3(-14.5, 0, -4.5),
    new THREE.Vector3(14.5, 0, 4.5),
    new THREE.Vector3(0, 0, -27.0),
    new THREE.Vector3(0, 0, 27.0),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 42.5,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#3e3022',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.2, 0, 7.6],
      previewCamPos: [1.55, 1.85, 11.45],
      previewLookAt: [1.25, 1.05, 7.2],
      hiders: [
        [-2.0, 7.5, Math.PI],
        [-14.5, -8.5, 0.4],
        [14.5, 8.5, -0.5],
        [0.0, -15.5, 3.0],
      ],
      seeker: [2.2, 2.2, 0],
    },
  };
}

// ============================================================================
// LEVEL 5 — RAILWAY COLONY (1990s Rampur Junction & Staff Quarters)
// ============================================================================
export function buildRailwayColonyMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0xb9a282, 135);

  // Railway Track Gravel Bed running East-West at z = -12
  const ballast = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 6.2),
    new THREE.MeshStandardMaterial({ color: 0x6e665c, roughness: 0.96 }),
  );
  ballast.rotation.x = -Math.PI / 2;
  ballast.position.set(0, 0.02, -12);
  ballast.receiveShadow = true;
  ctx.group.add(ballast);
  ctx.roads.push({ x: 0, z: -12, width: 6.2, length: 84, rotY: Math.PI / 2 });

  // Steel Rails & Wooden Sleepers
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x7b8288,
    metalness: 0.65,
    roughness: 0.35,
  });
  const sleeperMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x5c422c,
    roughness: 0.92,
  });
  for (const rz of [-13.1, -10.9]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(84, 0.14, 0.14), railMat);
    rail.position.set(0, 0.08, rz);
    ctx.group.add(rail);
  }
  for (let sx = -40; sx <= 40; sx += 1.65) {
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 3.0), sleeperMat);
    sl.position.set(sx, 0.04, -12);
    ctx.group.add(sl);
  }

  // Vintage 1990s Indian Railways Blue-Cream Passenger Coach parked on East track!
  const coachGroup = new THREE.Group();
  coachGroup.position.set(16.5, 0, -12);
  const coachBlue = new THREE.MeshStandardMaterial({ color: 0x264f85, roughness: 0.62 });
  const coachCream = new THREE.MeshStandardMaterial({ color: 0xece1c5, roughness: 0.65 });
  const coachRoof = new THREE.MeshStandardMaterial({ color: 0x5e656c, roughness: 0.75 });
  const wheelSteel = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.5, roughness: 0.5 });

  addVisualBox(coachGroup, 0, 1.55, 0, 15.2, 2.2, 2.9, coachBlue);
  addVisualBox(coachGroup, 0, 2.02, 0, 15.26, 0.45, 2.96, coachCream);
  addVisualBox(coachGroup, 0, 2.8, 0, 15.4, 0.36, 3.05, coachRoof);
  // Coach windows
  const coachWinMat = new THREE.MeshStandardMaterial({ color: 0x1e2b38, roughness: 0.35 });
  for (let wx = -5.6; wx <= 5.6; wx += 1.85) {
    addVisualBox(coachGroup, wx, 1.98, 1.48, 1.0, 0.72, 0.08, coachWinMat, false);
    addVisualBox(coachGroup, wx, 1.98, -1.48, 1.0, 0.72, 0.08, coachWinMat, false);
  }
  // Bogie wheels
  for (const bx of [-5.2, -3.6, 3.6, 5.2]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.7, 10), wheelSteel);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(bx, 0.42, 0);
    coachGroup.add(wheel);
  }
  ctx.group.add(coachGroup);
  ctx.boxes.push({
    minX: 16.5 - 7.7,
    maxX: 16.5 + 7.7,
    minZ: -12 - 1.55,
    maxZ: -12 + 1.55,
    blocksSight: true,
  });
  ctx.buildings.push({ x: 16.5, z: -12, width: 15.2, depth: 2.9, rotY: 0, kind: 'railway' });
  ctx.hidingSpots.push({
    x: 16.5,
    z: -15.0,
    label: 'Behind Parked Rail Coach',
    kind: 'vehicle',
  });
  ctx.hidingSpots.push({
    x: 25.5,
    z: -12.0,
    label: 'At the End of the Rail Coach',
    kind: 'vehicle',
  });

  // Main Station Platform Walkway (South of Tracks, z = -6.5) with Corrugated Tin Canopy
  const platformMat = new THREE.MeshStandardMaterial({
    map: textures.courtyard,
    color: 0xbcb6aa,
    roughness: 0.9,
  });
  const platSlab = new THREE.Mesh(new THREE.BoxGeometry(52, 0.16, 4.6), platformMat);
  platSlab.position.set(-2, 0.08, -6.4);
  platSlab.receiveShadow = true;
  ctx.group.add(platSlab);
  ctx.buildings.push({ x: -2, z: -6.4, width: 52, depth: 4.6, rotY: 0, kind: 'platform' });

  // Yellow-black Indian station edge safety line
  const yellowStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xe6b835 }),
  );
  yellowStrip.rotation.x = -Math.PI / 2;
  yellowStrip.position.set(-2, 0.17, -8.4);
  ctx.group.add(yellowStrip);

  // Station Canopy supported by iron posts
  const ironPostMat = new THREE.MeshStandardMaterial({ color: 0x3b4854, metalness: 0.45, roughness: 0.55 });
  const canopyTinMat = new THREE.MeshStandardMaterial({ color: 0x7a858e, metalness: 0.35, roughness: 0.6 });
  const platCanopy = new THREE.Mesh(new THREE.BoxGeometry(34, 0.18, 4.4), canopyTinMat);
  platCanopy.position.set(-4, 3.6, -6.4);
  platCanopy.castShadow = true;
  ctx.group.add(platCanopy);

  for (let px = -19; px <= 11; px += 6) {
    addSolidBox(ctx, px, -6.4, 0.36, 3.6, 0.36, ironPostMat, false);
  }

  // Iconic Yellow Indian Railway Station Name Board
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-23.5, 0, -6.4);
  addVisualBox(boardGroup, -1.6, 1.4, 0, 0.14, 2.8, 0.14, ironPostMat);
  addVisualBox(boardGroup, 1.6, 1.4, 0, 0.14, 2.8, 0.14, ironPostMat);
  addVisualBox(
    boardGroup,
    0,
    2.15,
    0,
    3.6,
    1.15,
    0.16,
    new THREE.MeshStandardMaterial({ color: 0xf0be2e, roughness: 0.65 }),
  );
  ctx.group.add(boardGroup);
  ctx.boxes.push({
    minX: -25.3,
    maxX: -21.7,
    minZ: -6.7,
    maxZ: -6.1,
    blocksSight: false,
  });

  // Colony Roads & Walkways
  addRoadSegment(ctx, 0, 12, 4.4, 36, 0, textures, 0xcab38e);
  addRoadSegment(ctx, 0, 4.5, 3.8, 66, Math.PI / 2, textures, 0xcab38e);
  addRoadSegment(ctx, 0, 21.0, 3.6, 62, Math.PI / 2, textures, 0xc4ad87);
  addRoadSegment(ctx, -18, 12, 3.2, 36, 0, textures, 0xc4ad87);
  addRoadSegment(ctx, 18, 12, 3.2, 36, 0, textures, 0xc4ad87);

  // Enterable Railway Buildings & Red-Brick Staff Quarters
  const redBrickMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    color: 0xc26e52,
    roughness: 0.9,
  });
  const stationWallMat = new THREE.MeshStandardMaterial({
    map: textures.schoolWall,
    color: 0xe8d5b0,
    roughness: 0.88,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8f8c84,
    roughness: 0.92,
  });

  // Station Master & Ticket Office (North of tracks)
  buildEnterableRoom(ctx, {
    id: 'rail-station',
    label: 'Station Master Office',
    x: -10.5,
    z: -21.5,
    width: 10.2,
    depth: 6.2,
    height: 3.6,
    doorSide: 'south',
    doorWidth: 2.3,
    wallMaterial: stationWallMat,
    floorMaterial: floorMat,
    roofStyle: 'flat',
    roofColor: 0x9c8f7d,
    trimColor: 0x8a3222,
    textures,
    minimapKind: 'railway',
  });

  // Signal Cabin (North-East of tracks)
  buildEnterableRoom(ctx, {
    id: 'rail-signal',
    label: 'Railway Signal Cabin',
    x: 10.5,
    z: -21.5,
    width: 6.4,
    depth: 5.6,
    height: 4.2,
    doorSide: 'south',
    doorWidth: 2.0,
    wallMaterial: redBrickMat,
    floorMaterial: floorMat,
    roofStyle: 'tin',
    roofColor: 0x5c6872,
    trimColor: 0xe8d8b2,
    textures,
    minimapKind: 'railway',
  });

  // 4 Enterable Red-Brick Railway Colony Staff Quarters (South of platform)
  const quarters: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    door: 'north' | 'south' | 'east' | 'west';
  }> = [
    { id: 'rq-1', label: 'Quarter A-1 (Driver)', x: -10.5, z: 12.5, door: 'north' },
    { id: 'rq-2', label: 'Quarter A-2 (Guard)', x: 10.5, z: 12.5, door: 'north' },
    { id: 'rq-3', label: 'Quarter B-1 (Pointsman)', x: -26.5, z: 12.5, door: 'east' },
    { id: 'rq-4', label: 'Quarter B-2 (Clerk)', x: 26.5, z: 12.5, door: 'west' },
    { id: 'rq-5', label: 'Colony Club House', x: -10.5, z: 28.0, door: 'north' },
  ];

  for (const q of quarters) {
    buildEnterableRoom(ctx, {
      id: q.id,
      label: q.label,
      x: q.x,
      z: q.z,
      width: 6.8,
      depth: 5.4,
      height: 3.15,
      doorSide: q.door,
      doorWidth: 2.05,
      wallMaterial: redBrickMat,
      floorMaterial: floorMat,
      roofStyle: 'flat',
      roofColor: 0xa69b8e,
      trimColor: 0xe8ddc2,
      textures,
      minimapKind: 'house',
    });
  }

  // Overhead Colony Water Tank (SE Corner — iconic railway landmark!)
  const tankGroup = new THREE.Group();
  tankGroup.position.set(13.5, 0, 28.5);
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb6b0a6, roughness: 0.9 });
  for (const lx of [-1.8, 1.8]) {
    for (const lz of [-1.8, 1.8]) {
      addVisualBox(tankGroup, lx, 3.0, lz, 0.55, 6.0, 0.55, concreteMat);
    }
  }
  const tankDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 2.8, 2.8, 14),
    concreteMat,
  );
  tankDrum.position.y = 7.2;
  tankDrum.castShadow = true;
  tankGroup.add(tankDrum);
  ctx.group.add(tankGroup);
  ctx.circles.push({ x: 13.5, z: 28.5, radius: 2.35, blocksSight: true });
  ctx.hidingSpots.push({
    x: 13.5,
    z: 31.8,
    label: 'Under Colony Water Tank',
    kind: 'well',
  });

  // Small Hedged Colony Gardens between Quarters
  const gardenMat = new THREE.MeshStandardMaterial({ color: 0x578640, roughness: 0.94 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x35642e, roughness: 0.92 });
  const colonyGardens: Array<[number, number]> = [
    [-25.5, 25.5],
    [26.0, 25.5],
  ];
  for (const [gx, gz] of colonyGardens) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), gardenMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(gx, 0.025, gz);
    ctx.group.add(lawn);
    ctx.landmarks.push({ x: gx, z: gz, radius: 5.0, kind: 'garden' });
    addSolidBox(ctx, gx, gz - 3.6, 8.2, 1.25, 0.7, hedgeMat, true, 0, {
      topY: 1.25,
      climbable: true,
    });
    addSolidBox(ctx, gx, gz + 3.6, 8.2, 1.25, 0.7, hedgeMat, true, 0, {
      topY: 1.25,
      climbable: true,
    });
    ctx.hidingSpots.push({ x: gx, z: gz, label: 'Inside Colony Garden Hedge', kind: 'tree' });
  }

  // Parcel crates on platform & yard
  addCrateStack(ctx, -16.0, -2.5, textures, 'Behind Parcel Office Crates');
  addCrateStack(ctx, 24.0, -2.5, textures, 'Behind Railway Freight Crates');

  // Colony Trees
  const railTrees: Array<[number, number]> = [
    [-25.5, -21.5],
    [26.5, -22.0],
    [0, 14.0],
    [-19.5, 2.0],
    [19.5, 2.0],
    [0, 29.5],
    [-33.5, -4.5],
    [33.5, 4.5],
  ];
  for (const [tx, tz] of railTrees) {
    addTree(ctx, tx, tz, 1.15, textures, 0x437836, false, true, 'Behind a Railway Colony Tree');
  }

  addNaturalPerimeter(ctx, textures, 45.0, 34, [0x3d6e31, 0x4b7d39, 0x35602a], 'trees');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.0),
    new THREE.Vector3(-12, 0, -6.4),
    new THREE.Vector3(8, 0, -6.4),
    new THREE.Vector3(-10, 0, -16.5),
    new THREE.Vector3(10, 0, -16.5),
    new THREE.Vector3(-18, 0, 12.5),
    new THREE.Vector3(18, 0, 12.5),
    new THREE.Vector3(0, 0, 21.0),
    new THREE.Vector3(-18, 0, 21.0),
    new THREE.Vector3(18, 0, 21.0),
    new THREE.Vector3(26, 0, -6.4),
    new THREE.Vector3(-26, 0, 4.5),
  );

  return {
    group: ctx.group,
    colliders: {
      boxes: ctx.boxes,
      circles: ctx.circles,
      worldRadius: 43.0,
    },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    minimapLayout: {
      worldRadius: 43.0,
      groundTint: '#36322b',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0.2, 0, 7.6],
      previewCamPos: [1.55, 1.85, 11.45],
      previewLookAt: [1.25, 1.05, 7.2],
      hiders: [
        [-2.0, 7.5, Math.PI],
        [-17.5, 4.5, 0.5],
        [17.5, 4.5, -0.5],
        [-2.0, -16.5, 2.8],
      ],
      seeker: [2.2, 2.5, 0],
    },
  };
}

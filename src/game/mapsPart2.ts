import * as THREE from 'three';
import {
  addCrateStack,
  addGlowingStringLights,
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
// LEVEL 6 — HAUNTED HAVELI (Purani Sandstone Mansion)
// ============================================================================
export function buildHauntedHaveliMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0x625a55, 130);

  // Flagstone Haveli Courtyard & Stone Gallery Floors
  const courtyardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshStandardMaterial({
      map: textures.templeStone,
      color: 0x8e8378,
      roughness: 0.92,
    }),
  );
  courtyardMesh.rotation.x = -Math.PI / 2;
  courtyardMesh.position.set(0, 0.02, 0);
  courtyardMesh.receiveShadow = true;
  ctx.group.add(courtyardMesh);
  ctx.landmarks.push({ x: 0, z: 0, radius: 13.5, kind: 'courtyard' });

  // Stone walkways connecting courtyard, outer corridors & gatehouse
  addRoadSegment(ctx, 0, 0, 4.6, 74, 0, textures, 0x9c8e7d);
  addRoadSegment(ctx, 0, 0, 4.4, 74, Math.PI / 2, textures, 0x9c8e7d);
  addRoadSegment(ctx, -20.5, 0, 3.4, 54, 0, textures, 0x877b6f);
  addRoadSegment(ctx, 20.5, 0, 3.4, 54, 0, textures, 0x877b6f);
  addRoadSegment(ctx, 0, -20.5, 3.4, 54, Math.PI / 2, textures, 0x877b6f);
  addRoadSegment(ctx, 0, 20.5, 3.4, 54, Math.PI / 2, textures, 0x877b6f);

  const haveliWallMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xb6997a,
    roughness: 0.9,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0x87725e,
    roughness: 0.92,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x696058,
    roughness: 0.94,
  });

  // Central Carved Octagonal Dry Fountain in the Haveli Courtyard
  const fountain = new THREE.Group();
  fountain.position.set(0, 0, -2.0);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.8, 0.72, 8),
    darkStoneMat,
  );
  basin.position.y = 0.36;
  basin.castShadow = true;
  basin.receiveShadow = true;
  fountain.add(basin);
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.72, 2.3, 8),
    haveliWallMat,
  );
  spire.position.y = 1.45;
  spire.castShadow = true;
  fountain.add(spire);
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 0.45, 0.38, 8),
    haveliWallMat,
  );
  bowl.position.y = 2.45;
  fountain.add(bowl);
  ctx.group.add(fountain);
  ctx.circles.push({
    x: 0,
    z: -2.0,
    radius: 2.85,
    blocksSight: false,
    topY: 0.74,
    climbable: true,
  });
  ctx.landmarks.push({ x: 0, z: -2.0, radius: 2.85, kind: 'well' });
  ctx.hidingSpots.push({
    x: 0,
    z: -5.6,
    label: 'Behind the Old Courtyard Fountain',
    kind: 'well',
  });

  // 7 Enterable Atmospheric Haveli Wings & Secret Chambers
  const haveliRooms: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    door: 'south' | 'north' | 'east' | 'west';
    roof: 'dome' | 'flat';
  }> = [
    { id: 'hav-durbar', label: 'Grand Durbar Hall', x: 0, z: -28.0, w: 13.0, d: 7.4, h: 4.4, door: 'south', roof: 'dome' },
    { id: 'hav-nw', label: 'Mirror Chamber', x: -13.5, z: -13.5, w: 7.4, d: 6.4, h: 3.9, door: 'south', roof: 'dome' },
    { id: 'hav-ne', label: 'Dusty Ancestral Library', x: 13.5, z: -13.5, w: 7.4, d: 6.4, h: 3.9, door: 'south', roof: 'dome' },
    { id: 'hav-w', label: 'West Portrait Wing', x: -27.5, z: -2.0, w: 6.8, d: 9.2, h: 3.8, door: 'east', roof: 'flat' },
    { id: 'hav-e', label: 'East Banquet Hall', x: 27.5, z: -2.0, w: 6.8, d: 9.2, h: 3.8, door: 'west', roof: 'flat' },
    { id: 'hav-sw', label: 'Old Spice Kitchen', x: -13.5, z: 13.5, w: 7.4, d: 6.2, h: 3.5, door: 'north', roof: 'flat' },
    { id: 'hav-se', label: 'Caretaker Quarters', x: 13.5, z: 13.5, w: 7.4, d: 6.2, h: 3.5, door: 'north', roof: 'flat' },
  ];

  for (const r of haveliRooms) {
    buildEnterableRoom(ctx, {
      id: r.id,
      label: r.label,
      x: r.x,
      z: r.z,
      width: r.w,
      depth: r.d,
      height: r.h,
      doorSide: r.door,
      doorWidth: 2.3,
      wallMaterial: haveliWallMat,
      floorMaterial: floorMat,
      roofStyle: r.roof,
      roofColor: 0x99836b,
      trimColor: 0x5d4432,
      textures,
      minimapKind: 'haveli',
    });
  }

  // Twin Grand Carved Stone Staircases flanking the North Durbar Courtyard (with secret under-stair hiding pockets!)
  const addGrandStairs = (sx: number, sz: number, sideDir: 1 | -1) => {
    const stairGroup = new THREE.Group();
    stairGroup.position.set(sx, 0, sz);
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * 0.42;
      addVisualBox(
        stairGroup,
        sideDir * (i * 0.52 - 1.56),
        h * 0.5,
        0,
        0.54,
        h,
        2.6,
        darkStoneMat,
      );
    }
    // Decorative landing pillar
    addVisualBox(stairGroup, sideDir * 2.05, 1.8, -1.1, 0.55, 3.6, 0.55, haveliWallMat);
    addVisualBox(stairGroup, sideDir * 2.05, 1.8, 1.1, 0.55, 3.6, 0.55, haveliWallMat);
    ctx.group.add(stairGroup);

    ctx.boxes.push({
      minX: sx - 2.2,
      maxX: sx + 2.2,
      minZ: sz - 1.35,
      maxZ: sz + 1.35,
      blocksSight: true,
    });
    ctx.hidingSpots.push({
      x: sx,
      z: sz + 2.25,
      label: 'Tucked Behind Grand Haveli Stairs',
      kind: 'gully',
    });
  };
  addGrandStairs(-9.2, -23.0, 1);
  addGrandStairs(9.2, -23.0, -1);

  // Secret Hiding Alcoves: Free-standing carved sandstone courtyard screens & pillared colonnade
  const alcoveWalls: Array<[number, number, number, number, string]> = [
    [-11.0, -1.5, 0.65, 5.2, 'Secret West Colonnade Alcove'],
    [11.0, -1.5, 0.65, 5.2, 'Secret East Colonnade Alcove'],
    [-20.5, 14.5, 4.4, 0.65, 'Hidden South-West Curtain Wall'],
    [20.5, 14.5, 4.4, 0.65, 'Hidden South-East Curtain Wall'],
    [-20.5, -24.5, 4.8, 0.65, 'Secret North-West Courtyard Niche'],
    [20.5, -24.5, 4.8, 0.65, 'Secret North-East Courtyard Niche'],
  ];
  for (const [ax, az, aw, ad, label] of alcoveWalls) {
    addSolidBox(ctx, ax, az, aw, 2.75, ad, darkStoneMat, true);
    ctx.hidingSpots.push({
      x: ax + (aw < ad ? (ax < 0 ? -1.4 : 1.4) : 0),
      z: az + (aw > ad ? (az < 0 ? -1.4 : 1.4) : 0),
      label,
      kind: 'wall',
    });
  }

  // Grand Arched Haveli Entrance Gate (South) with warm oil-lamp sconces
  addSolidBox(ctx, -4.6, 26.5, 2.4, 4.6, 2.0, haveliWallMat, true);
  addSolidBox(ctx, 4.6, 26.5, 2.4, 4.6, 2.0, haveliWallMat, true);
  const gateLintel = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.35, 2.2), darkStoneMat);
  gateLintel.position.set(0, 4.9, 26.5);
  gateLintel.castShadow = true;
  ctx.group.add(gateLintel);
  // South compound wing walls
  addSolidBox(ctx, -18.5, 26.5, 24.0, 2.6, 0.9, darkStoneMat, true);
  addSolidBox(ctx, 18.5, 26.5, 24.0, 2.6, 0.9, darkStoneMat, true);

  // Subtle Warm Glowing Oil-Lamp Sconces (emissive orbs + 2 soft warm point lights)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb85c });
  const sconceCoords: Array<[number, number, number]> = [
    [-3.4, 2.6, 25.4],
    [3.4, 2.6, 25.4],
    [-4.2, 2.8, -24.0],
    [4.2, 2.8, -24.0],
    [-10.2, 2.5, -1.5],
    [10.2, 2.5, -1.5],
  ];
  for (const [lx, ly, lz] of sconceCoords) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), flameMat);
    orb.position.set(lx, ly, lz);
    ctx.group.add(orb);
  }
  const warmLight1 = new THREE.PointLight(0xffa447, 14, 22, 1.5);
  warmLight1.position.set(0, 3.6, -22.0);
  warmLight1.userData.optionalPointLight = true;
  ctx.group.add(warmLight1);
  const warmLight2 = new THREE.PointLight(0xffa447, 12, 20, 1.5);
  warmLight2.position.set(0, 3.2, 22.0);
  warmLight2.userData.optionalPointLight = true;
  ctx.group.add(warmLight2);

  // Ancient trunks & dark cypress/banyan trees around outer haveli grounds
  const spookyTrees: Array<[number, number]> = [
    [-27.5, -17.5],
    [27.5, -17.5],
    [-28.5, 16.5],
    [28.5, 16.5],
    [-15.5, -29.5],
    [15.5, -29.5],
    [-10.5, 21.5],
    [10.5, 21.5],
  ];
  for (const [tx, tz] of spookyTrees) {
    addTree(ctx, tx, tz, 1.22, textures, 0x2a4534, false, true, 'Behind a Gnarled Haveli Tree');
  }

  addCrateStack(ctx, -22.5, 4.5, textures, 'Behind Dusty Antique Trunks');
  addCrateStack(ctx, 22.5, 4.5, textures, 'Behind Old Courtyard Chests');

  addNaturalPerimeter(ctx, textures, 44.5, 36, [0x22382c, 0x2d4736, 0x1e3026], 'stone_wall');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.5),
    new THREE.Vector3(-8.0, 0, -7.5),
    new THREE.Vector3(8.0, 0, -7.5),
    new THREE.Vector3(0, 0, -19.5),
    new THREE.Vector3(-20.5, 0, -14.0),
    new THREE.Vector3(20.5, 0, -14.0),
    new THREE.Vector3(-20.5, 0, 8.0),
    new THREE.Vector3(20.5, 0, 8.0),
    new THREE.Vector3(0, 0, 20.5),
    new THREE.Vector3(-14.0, 0, 20.5),
    new THREE.Vector3(14.0, 0, 20.5),
    new THREE.Vector3(0, 0, 12.0),
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
      groundTint: '#292938',
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
        [-18.5, -6.5, 0.7],
        [18.5, -6.5, -0.7],
        [0.0, -18.5, 3.0],
      ],
      seeker: [3.2, 2.2, 0],
    },
  };
}

// ============================================================================
// LEVEL 7 — RIVER VILLAGE (Nadi Kinare Gaon)
// ============================================================================
export function buildRiverVillageMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0xa8a66e, 135);

  // Sandy riverbanks running along the North-South river channel (x = -5.2 .. +5.2)
  const sandMat = new THREE.MeshStandardMaterial({
    map: textures.courtyard,
    color: 0xd8bf8d,
    roughness: 0.94,
  });
  const westBank = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 96), sandMat);
  westBank.rotation.x = -Math.PI / 2;
  westBank.position.set(-7.6, 0.015, 0);
  westBank.receiveShadow = true;
  ctx.group.add(westBank);

  const eastBank = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 96), sandMat);
  eastBank.rotation.x = -Math.PI / 2;
  eastBank.position.set(7.6, 0.015, 0);
  eastBank.receiveShadow = true;
  ctx.group.add(eastBank);

  // Shimmering River Surface slicing cleanly North-South
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x2c7d9c,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const riverWater = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 110), riverMat);
  riverWater.rotation.x = -Math.PI / 2;
  riverWater.position.set(0, 0.03, 0);
  riverWater.userData.isAnimatedWater = true;
  ctx.group.add(riverWater);
  ctx.pondWater = riverWater;
  ctx.waterRects.push({ x: 0, z: 0, width: 10.6, length: 92, rotY: 0 });

  // Solid Water Boundary Colliders ONLY between the 3 Wide Walkable Bridges
  // Bridges are at z = -18, z = 0, and z = 18 (each bridge has a clean 4.8m walkable gap!)
  const waterBlockSegments: Array<[number, number]> = [
    [-46, -20.5],
    [-15.5, -2.5],
    [2.5, 15.5],
    [20.5, 46],
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

  // 3 Wide Walkable Wooden-Plank Bridges connecting West Bank & East Bank
  const bridgeWoodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8b623c,
    roughness: 0.88,
  });
  const railPostMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x5c3c22,
    roughness: 0.9,
  });

  for (const bz of [-18, 0, 18]) {
    const bridge = new THREE.Group();
    bridge.position.set(0, 0, bz);
    // Flat walkable deck slightly above water
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(13.2, 0.14, 4.8),
      bridgeWoodMat,
    );
    deck.position.y = 0.07;
    deck.receiveShadow = true;
    deck.castShadow = true;
    bridge.add(deck);

    // Side railings along North and South edges of bridge
    for (const rz of [-2.25, 2.25]) {
      addVisualBox(bridge, 0, 0.95, rz, 12.8, 0.12, 0.12, railPostMat);
      for (let px = -5.8; px <= 5.8; px += 2.9) {
        addVisualBox(bridge, px, 0.5, rz, 0.16, 1.0, 0.16, railPostMat);
      }
    }
    ctx.group.add(bridge);
    ctx.buildings.push({ x: 0, z: bz, width: 13.2, depth: 4.8, rotY: 0, kind: 'bridge' });
    ctx.roads.push({ x: 0, z: bz, width: 4.6, length: 44, rotY: Math.PI / 2 });
  }

  // West & East Bank Village Paths
  addRoadSegment(ctx, -12.5, 0, 3.8, 66, 0, textures, 0xcab082);
  addRoadSegment(ctx, 12.5, 0, 3.8, 66, 0, textures, 0xcab082);
  addRoadSegment(ctx, -26.5, 0, 3.0, 52, 0, textures, 0xc2a87b);
  addRoadSegment(ctx, 26.5, 0, 3.0, 52, 0, textures, 0xc2a87b);

  // Moored Wooden Rowboats along the Riverbanks (visual props inside the water/edge)
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
  ];
  for (const [bx, bz, rot] of boatSpecs) {
    const boat = new THREE.Group();
    boat.position.set(bx, 0.08, bz);
    boat.rotation.y = rot;
    addVisualBox(boat, 0, 0.22, 0, 1.35, 0.44, 3.8, boatHullMat);
    addVisualBox(boat, 0, 0.46, 0, 1.42, 0.1, 3.9, boatTrimMat);
    // Wooden bench seats inside boat
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

  // Pulled-up Beached Rowboats resting on the sandy riverbanks (real sight-blocking boat cover!)
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

  // 6 Enterable Riverside Thatch Huts (3 West Bank, 3 East Bank)
  const hutWallMat = new THREE.MeshStandardMaterial({
    map: textures.mudWall,
    color: 0xe6d3b2,
    roughness: 0.92,
  });
  const hutWallOchre = new THREE.MeshStandardMaterial({
    map: textures.mudWallOchre,
    roughness: 0.92,
  });
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
      wallMaterial: h.ochre ? hutWallOchre : hutWallMat,
      floorMaterial: hutFloorMat,
      roofStyle: 'thatch',
      roofColor: 0xd9bb7c,
      trimColor: 0x2f6b64,
      textures,
      minimapKind: 'hut',
    });
  }

  // Tall Swaying River Grass Patches (Walkable dense cover hiding zones!)
  const grassBladeMat1 = new THREE.MeshStandardMaterial({
    color: 0x5c8c38,
    roughness: 0.88,
  });
  const grassBladeMat2 = new THREE.MeshStandardMaterial({
    color: 0x769f42,
    roughness: 0.9,
  });
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
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.25;
      const dist = ((i * 37) % 100) / 100 * (rad * 0.8);
      const bladeH = 1.25 + (i % 4) * 0.22;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, bladeH, 5),
        i % 2 === 0 ? grassBladeMat1 : grassBladeMat2,
      );
      tuft.position.set(Math.cos(a) * dist, bladeH * 0.5, Math.sin(a) * dist);
      tuft.rotation.z = ((i % 5) - 2) * 0.08;
      tuft.castShadow = true;
      patch.add(tuft);
    }
    ctx.group.add(patch);
    ctx.swayFoliage.push(patch);
    ctx.landmarks.push({ x: gx, z: gz, radius: rad, kind: 'grass' });
    ctx.hidingSpots.push({
      x: gx,
      z: gz,
      label: 'Hidden in Tall River Grass',
      kind: 'tree',
    });
  }

  // Riverside Palm / Banyan / Neem Trees & Fishing Crates
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

  addCrateStack(ctx, -14.5, -14.5, textures, 'Behind Fishing Basket Crates');
  addCrateStack(ctx, 14.5, 14.5, textures, 'Behind Boatman Supply Crates');
  addStoneWell(ctx, -26.5, -25.5, textures, 'Behind West Bank Well');

  addNaturalPerimeter(ctx, textures, 45.0, 36, [0x3d7536, 0x4f873f, 0x33632e], 'trees');

  ctx.patrolPoints.push(
    new THREE.Vector3(-12.5, 0, 7.0),
    new THREE.Vector3(-12.5, 0, -18.0),
    new THREE.Vector3(0, 0, -18.0), // North Bridge
    new THREE.Vector3(12.5, 0, -18.0),
    new THREE.Vector3(12.5, 0, 0),
    new THREE.Vector3(0, 0, 0), // Center Bridge
    new THREE.Vector3(-12.5, 0, 0),
    new THREE.Vector3(-12.5, 0, 18.0),
    new THREE.Vector3(0, 0, 18.0), // South Bridge
    new THREE.Vector3(12.5, 0, 18.0),
    new THREE.Vector3(26.5, 0, 8.0),
    new THREE.Vector3(-26.5, 0, -8.0),
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
    pondWater: ctx.pondWater,
    minimapLayout: {
      worldRadius: 43.0,
      groundTint: '#2f3a2a',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      // West Riverbank Ghat overlooking the river, bridges & moored boats
      previewPos: [-12.5, 0, 7.6],
      previewCamPos: [-11.1, 1.9, 11.6],
      previewLookAt: [-11.4, 1.05, 7.2],
      hiders: [
        [-12.5, 7.6, Math.PI],
        [-12.5, -14.0, 0.5],
        [12.5, 14.0, -0.6],
        [12.5, -14.0, 2.5],
      ],
      seeker: [12.5, 0.0, -Math.PI / 2],
    },
  };
}

// ============================================================================
// LEVEL 8 — FESTIVAL VILLAGE (Diwali & Village Mela Night)
// ============================================================================
export function buildFestivalVillageMap(
  textures: VillageTextureSet,
): VillageBuildResult {
  const ctx = createMapContext();
  addGroundPlane(ctx, textures, 0x9b7a54, 135);

  // Festive Mela Crossroads & Crowded Illuminated Village Streets
  addRoadSegment(ctx, 0, 0, 4.8, 76, 0, textures, 0xc9a373);
  addRoadSegment(ctx, 0, 0, 4.8, 76, Math.PI / 2, textures, 0xc9a373);
  addRoadSegment(ctx, -16.5, 0, 3.4, 58, 0, textures, 0xbd986a);
  addRoadSegment(ctx, 16.5, 0, 3.4, 58, 0, textures, 0xbd986a);
  addRoadSegment(ctx, 0, -16.5, 3.4, 58, Math.PI / 2, textures, 0xbd986a);
  addRoadSegment(ctx, 0, 16.5, 3.4, 58, Math.PI / 2, textures, 0xbd986a);

  // Central Mela Chowk with Vibrant Circular Rangoli Floor Art!
  const chowk = new THREE.Mesh(
    new THREE.CircleGeometry(8.6, 28),
    new THREE.MeshStandardMaterial({
      map: textures.courtyard,
      color: 0xcfa776,
      roughness: 0.9,
    }),
  );
  chowk.rotation.x = -Math.PI / 2;
  chowk.position.set(0, 0.025, 0);
  chowk.receiveShadow = true;
  ctx.group.add(chowk);
  ctx.landmarks.push({ x: 0, z: 0, radius: 8.6, kind: 'courtyard' });

  // Multi-ring festive Rangoli in the heart of the Mela
  const rangoliRings: Array<[number, number]> = [
    [3.6, 0xe84a36],
    [2.8, 0xf5b82e],
    [2.0, 0x9c2c6b],
    [1.2, 0x2ca67a],
    [0.55, 0xfff0a6],
  ];
  for (let i = 0; i < rangoliRings.length; i++) {
    const [r, col] = rangoliRings[i];
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(r, 16),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.032 + i * 0.004, 0);
    ctx.group.add(disc);
  }

  // Grand Festive Pandal Stage (North Center) with Colorful Drapes & Lights
  const pandalGroup = new THREE.Group();
  pandalGroup.position.set(0, 0, -10.5);
  const stageBaseMat = new THREE.MeshStandardMaterial({
    color: 0xa62e2e,
    roughness: 0.85,
  });
  const drapeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf0ad2e,
    roughness: 0.75,
  });
  const drapeMagentaMat = new THREE.MeshStandardMaterial({
    color: 0xc2276a,
    roughness: 0.78,
  });
  addVisualBox(pandalGroup, 0, 0.45, 0, 7.6, 0.9, 4.4, stageBaseMat);
  for (const px of [-3.4, 3.4]) {
    for (const pz of [-1.9, 1.9]) {
      addVisualBox(pandalGroup, px, 2.3, pz, 0.34, 3.6, 0.34, drapeGoldMat);
    }
  }
  addVisualBox(pandalGroup, 0, 4.15, 0, 8.2, 0.5, 5.0, drapeMagentaMat);
  // Backdrop curtain behind stage
  addVisualBox(pandalGroup, 0, 2.4, -2.0, 7.0, 3.2, 0.25, drapeMagentaMat);
  ctx.group.add(pandalGroup);
  ctx.boxes.push({
    minX: -3.9,
    maxX: 3.9,
    minZ: -12.8,
    maxZ: -8.2,
    blocksSight: true,
    topY: 0.9,
    climbable: true,
  });
  ctx.landmarks.push({ x: 0, z: -10.5, radius: 4.2, kind: 'stage' });
  ctx.hidingSpots.push({
    x: 0,
    z: -13.9,
    label: 'Backstage Behind Festival Pandal',
    kind: 'gully',
  });

  // 8 Bustling Colorful Mela Food, Sweet & Toy Stalls lining the streets
  const stallPalette = [0xd93d2b, 0xeb9c24, 0x298772, 0xb82c6c, 0x2e64a3, 0xd46a22];
  const stallCounterMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x9c6d42,
    roughness: 0.86,
  });
  const lanternGlowMat = new THREE.MeshBasicMaterial({ color: 0xffdf7a });

  const stalls: Array<{ x: number; z: number; rotY: number; label: string; colorIdx: number }> = [
    { x: -8.8, z: -7.5, rotY: Math.PI / 2, label: 'Behind Chaat & Golgappa Stall', colorIdx: 0 },
    { x: 8.8, z: -7.5, rotY: -Math.PI / 2, label: 'Behind Hot Jalebi Stall', colorIdx: 1 },
    { x: -8.8, z: 7.5, rotY: Math.PI / 2, label: 'Behind Kulfi & Sharbat Stall', colorIdx: 2 },
    { x: 8.8, z: 7.5, rotY: -Math.PI / 2, label: 'Behind Bangle & Mehndi Stall', colorIdx: 3 },
    { x: -10.2, z: -20.5, rotY: 0, label: 'Behind Clay Toy Stall', colorIdx: 4 },
    { x: 10.2, z: -20.5, rotY: 0, label: 'Behind Diya & Lantern Stall', colorIdx: 5 },
    { x: -10.2, z: 20.5, rotY: Math.PI, label: 'Behind Laddu & Barfi Stall', colorIdx: 1 },
    { x: 10.2, z: 20.5, rotY: Math.PI, label: 'Behind Puppet Show Booth', colorIdx: 3 },
  ];

  for (const st of stalls) {
    const g = new THREE.Group();
    g.position.set(st.x, 0, st.z);
    g.rotation.y = st.rotY;

    const canopyMat = new THREE.MeshStandardMaterial({
      color: stallPalette[st.colorIdx % stallPalette.length],
      roughness: 0.78,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf7c948,
      roughness: 0.72,
    });

    // Stall counter + back backdrop + colorful roof canopy + hanging lantern
    addVisualBox(g, 0, 0.55, 0.55, 3.6, 1.1, 1.1, stallCounterMat);
    addVisualBox(g, 0, 1.3, -0.95, 3.6, 2.6, 0.25, canopyMat);
    for (const px of [-1.65, 1.65]) {
      addVisualBox(g, px, 1.45, 0.95, 0.14, 2.9, 0.14, trimMat);
      addVisualBox(g, px, 1.45, -0.95, 0.14, 2.9, 0.14, trimMat);
    }
    addVisualBox(g, 0, 2.95, 0, 4.1, 0.28, 2.5, canopyMat);
    addVisualBox(g, 0, 2.75, 1.15, 4.0, 0.18, 0.12, trimMat);
    // Warm hanging festival bulb inside stall
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), lanternGlowMat);
    bulb.position.set(0, 2.45, 0.4);
    g.add(bulb);

    ctx.group.add(g);

    const rot90 = Math.abs(Math.sin(st.rotY)) > 0.7;
    const hw = rot90 ? 1.25 : 1.95;
    const hd = rot90 ? 1.95 : 1.25;
    ctx.boxes.push({
      minX: st.x - hw,
      maxX: st.x + hw,
      minZ: st.z - hd,
      maxZ: st.z + hd,
      blocksSight: true,
    });
    ctx.buildings.push({
      x: st.x,
      z: st.z,
      width: rot90 ? 2.4 : 3.8,
      depth: rot90 ? 3.8 : 2.4,
      rotY: 0,
      kind: 'stall',
    });
    ctx.hidingSpots.push({
      x: st.x + (st.x < 0 ? -2.4 : 2.4),
      z: st.z,
      label: st.label,
      kind: 'gully',
    });
  }

  // 6 Enterable Festive Courtyard Houses decorated for Diwali
  const houseCream = new THREE.MeshStandardMaterial({
    map: textures.mudWall,
    color: 0xf4dec0,
    roughness: 0.9,
  });
  const houseOchre = new THREE.MeshStandardMaterial({
    map: textures.mudWallOchre,
    color: 0xe8be82,
    roughness: 0.9,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8c7155,
    roughness: 0.92,
  });

  const festiveHouses: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    door: 'south' | 'north' | 'east' | 'west';
    ochre: boolean;
  }> = [
    { id: 'fest-1', label: 'Marigold House NW', x: -24.5, z: -10.5, door: 'east', ochre: false },
    { id: 'fest-2', label: 'Lantern House NE', x: 24.5, z: -10.5, door: 'west', ochre: true },
    { id: 'fest-3', label: 'Sweetmaker House SW', x: -24.5, z: 10.5, door: 'east', ochre: true },
    { id: 'fest-4', label: 'Rangoli House SE', x: 24.5, z: 10.5, door: 'west', ochre: false },
    { id: 'fest-5', label: 'North Festival Haveli', x: 0, z: -26.5, door: 'south', ochre: true },
    { id: 'fest-6', label: 'South Courtyard House', x: 0, z: 26.5, door: 'north', ochre: false },
  ];

  for (const fh of festiveHouses) {
    buildEnterableRoom(ctx, {
      id: fh.id,
      label: fh.label,
      x: fh.x,
      z: fh.z,
      width: 6.6,
      depth: 5.4,
      height: 3.3,
      doorSide: fh.door,
      doorWidth: 2.15,
      wallMaterial: fh.ochre ? houseOchre : houseCream,
      floorMaterial: floorMat,
      roofStyle: 'flat',
      roofColor: 0xba9c7c,
      trimColor: 0xd94b2b,
      textures,
      minimapKind: 'house',
    });
  }

  addVintageVehicle(
    ctx,
    'scooter',
    -11.5,
    22.0,
    0.35,
    0xc93b28,
    'Behind Parked Festival Scooter',
  );

  // Decorative Glowing Bamboo Welcome Arches & Crisscrossing Overhead Fairy String Lights!
  const festColors = [0xffd84d, 0xff5a36, 0x36e09b, 0xff5ca8, 0x5cc8ff];
  const archPostMat = new THREE.MeshStandardMaterial({
    color: 0xd94a2b,
    roughness: 0.78,
  });
  const addWelcomeArch = (ax: number, az: number, rotY: number) => {
    const ag = new THREE.Group();
    ag.position.set(ax, 0, az);
    ag.rotation.y = rotY;
    addVisualBox(ag, -2.7, 2.3, 0, 0.36, 4.6, 0.36, archPostMat);
    addVisualBox(ag, 2.7, 2.3, 0, 0.36, 4.6, 0.36, archPostMat);
    addVisualBox(
      ag,
      0,
      4.55,
      0,
      6.0,
      0.55,
      0.42,
      new THREE.MeshStandardMaterial({ color: 0xf2a726, roughness: 0.72 }),
    );
    // Glowing bulbs across top of arch
    for (let bx = -2.4; bx <= 2.4; bx += 0.8) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 5),
        new THREE.MeshBasicMaterial({ color: festColors[Math.abs(Math.round(bx * 3)) % festColors.length] }),
      );
      b.position.set(bx, 4.22, 0.22);
      ag.add(b);
    }
    ctx.group.add(ag);
  };
  addWelcomeArch(0, 14.2, 0);
  addWelcomeArch(0, -18.2, 0);
  addWelcomeArch(-14.2, 0, Math.PI / 2);
  addWelcomeArch(14.2, 0, Math.PI / 2);

  // Overhead Glowing Festival String Lights crisscrossing the Mela Chowk & Lanes
  addGlowingStringLights(ctx, [-8.8, 3.8, -7.5], [8.8, 3.8, 7.5], 13, festColors);
  addGlowingStringLights(ctx, [8.8, 3.8, -7.5], [-8.8, 3.8, 7.5], 13, festColors);
  addGlowingStringLights(ctx, [-8.8, 3.7, -7.5], [8.8, 3.7, -7.5], 10, festColors);
  addGlowingStringLights(ctx, [-8.8, 3.7, 7.5], [8.8, 3.7, 7.5], 10, festColors);
  addGlowingStringLights(ctx, [-16.5, 3.6, -16.5], [-16.5, 3.6, 16.5], 14, festColors);
  addGlowingStringLights(ctx, [16.5, 3.6, -16.5], [16.5, 3.6, 16.5], 14, festColors);
  addGlowingStringLights(ctx, [-21, 3.8, -10.5], [-10, 3.8, -20.5], 9, festColors);
  addGlowingStringLights(ctx, [21, 3.8, -10.5], [10, 3.8, -20.5], 9, festColors);
  addGlowingStringLights(ctx, [-21, 3.8, 10.5], [-10, 3.8, 20.5], 9, festColors);
  addGlowingStringLights(ctx, [21, 3.8, 10.5], [10, 3.8, 20.5], 9, festColors);

  // Warm Festive Point Lights bathing the central Mela & Pandal
  const melaLight1 = new THREE.PointLight(0xffaa44, 18, 26, 1.4);
  melaLight1.position.set(0, 4.5, 0);
  melaLight1.userData.optionalPointLight = true;
  ctx.group.add(melaLight1);
  const melaLight2 = new THREE.PointLight(0xff8442, 14, 22, 1.4);
  melaLight2.position.set(0, 4.2, -11.0);
  melaLight2.userData.optionalPointLight = true;
  ctx.group.add(melaLight2);

  // Glowing Diya Lamp Clusters lining the Chowk edge
  const diyaGeo = new THREE.SphereGeometry(0.12, 6, 5);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const diya = new THREE.Mesh(diyaGeo, lanternGlowMat);
    diya.position.set(Math.cos(a) * 6.8, 0.14, Math.sin(a) * 6.8);
    ctx.group.add(diya);
  }

  // Festive Crates & Illuminated Village Trees
  addCrateStack(ctx, -16.5, -2.5, textures, 'Behind Sweetbox Crates');
  addCrateStack(ctx, 16.5, 2.5, textures, 'Behind Firework Stall Crates');

  const festTrees: Array<[number, number]> = [
    [-25.5, -22.5],
    [25.5, -22.5],
    [-25.5, 22.5],
    [25.5, 22.5],
    [-14.5, -27.5],
    [14.5, -27.5],
    [-14.5, 27.5],
    [14.5, 27.5],
  ];
  for (const [tx, tz] of festTrees) {
    addTree(ctx, tx, tz, 1.16, textures, 0x3a6432, false, true, 'Behind a Lit Festival Tree');
  }

  addNaturalPerimeter(ctx, textures, 45.0, 36, [0x2a4d28, 0x385e32, 0x244022], 'trees');

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 5.5),
    new THREE.Vector3(-16.5, 0, -16.5),
    new THREE.Vector3(16.5, 0, -16.5),
    new THREE.Vector3(16.5, 0, 16.5),
    new THREE.Vector3(-16.5, 0, 16.5),
    new THREE.Vector3(0, 0, -16.5),
    new THREE.Vector3(0, 0, 16.5),
    new THREE.Vector3(-16.5, 0, 0),
    new THREE.Vector3(16.5, 0, 0),
    new THREE.Vector3(-5.5, 0, -4.0),
    new THREE.Vector3(5.5, 0, 4.0),
    new THREE.Vector3(-20.0, 0, -18.5),
    new THREE.Vector3(20.0, 0, 18.5),
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
      groundTint: '#36232c',
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
        [-16.5, -10.5, 0.5],
        [16.5, 10.5, -0.5],
        [0.0, -16.5, 2.8],
      ],
      seeker: [2.4, 2.4, 0],
    },
  };
}

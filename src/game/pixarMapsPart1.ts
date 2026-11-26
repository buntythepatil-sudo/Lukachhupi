import * as THREE from 'three';
import {
  addCrateStack,
  addGlowingStringLights,
  addGroundPlane,
  addNaturalPerimeter,
  addRoadSegment,
  addSolidBox,
  addStoneWell,
  addVisualBox,
  buildEnterableRoom,
  createMapContext,
} from './mapHelpers';
import { buildPixarTree, PixarAnimator } from './pixarAnimator';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

/**
 * Helper to place a Pixar tree with accurate trunk collider, swaying canopy,
 * optional hiding spot, and minimap marker.
 */
function placePixarTree(
  ctx: ReturnType<typeof createMapContext>,
  x: number,
  z: number,
  kind: 'pine' | 'palm' | 'blossom' | 'deodar_snow' | 'royal_cypress' | 'banyan_lush',
  scale: number,
  seed: number,
  hidingLabel?: string,
): void {
  const { group, canopy, trunkRadius } = buildPixarTree(x, z, { kind, scale, seed });
  ctx.group.add(group);
  ctx.swayFoliage.push(canopy);
  ctx.circles.push({ x, z, radius: Math.max(0.45, trunkRadius), blocksSight: true });
  ctx.landmarks.push({ x, z, radius: 1.5 * scale, kind: 'tree' });
  if (hidingLabel) {
    ctx.hidingSpots.push({
      x: x + (x >= 0 ? -1.45 : 1.45),
      z: z + (z >= 0 ? -1.45 : 1.45),
      label: hidingLabel,
      kind: 'tree',
    });
  }
}

/* ============================================================================
 * LEVEL 9: HILL STATION TOY TOWN (1990s Shimla / Darjeeling Pine Ridge)
 * Signature Pixar Animations:
 *  - Chugging 1990s Blue-and-Red Toy Steam Train with 2 swaying coaches & steam puffs
 *  - Animated Mall Road Clock Tower with rotating hands & swinging brass pendulum
 *  - Curling Chimney & Tea-Kettle Steam Plumes + Soaring Mountain Swallows + Drifting Blossoms
 * ========================================================================== */
export function buildHillStationMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  addGroundPlane(ctx, textures, 0x7da468, 135);

  // Cobblestone Mall Road cross-promenade + scenic ring lane
  addRoadSegment(ctx, 0, 0, 5.2, 62, 0, textures, 0xbdb7ac);
  addRoadSegment(ctx, 0, 0, 5.2, 62, Math.PI / 2, textures, 0xbdb7ac);
  addRoadSegment(ctx, 0, -21, 3.8, 44, Math.PI / 2, textures, 0xc4beb2);
  addRoadSegment(ctx, 0, 21, 3.8, 44, Math.PI / 2, textures, 0xc4beb2);

  // Central Mall Road Clock Tower with animated hands & pendulum
  const towerStone = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xd9cbb8,
    roughness: 0.78,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x5c3924,
    roughness: 0.82,
  });
  const roofRedMat = new THREE.MeshStandardMaterial({
    color: 0xb83b32,
    roughness: 0.52,
    metalness: 0.12,
  });
  const roofGreenMat = new THREE.MeshStandardMaterial({
    color: 0x2c6e54,
    roughness: 0.55,
    metalness: 0.1,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe6b94c,
    roughness: 0.25,
    metalness: 0.82,
  });

  // Walkable stepped clock tower plinth
  addSolidBox(ctx, 0, 0, 5.8, 0.24, 5.8, towerStone, false, 0, {
    topY: 0.24,
    climbable: true,
  });
  addSolidBox(ctx, 0, 0, 3.1, 7.2, 3.1, towerStone, true, 0.24);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.35, 3.2, 4), roofRedMat);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 9.0, 0);
  spire.castShadow = true;
  ctx.group.add(spire);

  // Four illuminated clock faces with rotating hour & minute hands!
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e6,
    emissive: 0xffdf99,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  const handMat = new THREE.MeshStandardMaterial({ color: 0x221b16, roughness: 0.4 });
  const minuteHands: THREE.Object3D[] = [];
  const hourHands: THREE.Object3D[] = [];
  const clockFaces: Array<[number, number, number]> = [
    [0, 1.58, 0],
    [0, -1.58, Math.PI],
    [1.58, 0, Math.PI / 2],
    [-1.58, 0, -Math.PI / 2],
  ];
  for (const [fx, fz, ry] of clockFaces) {
    const faceGroup = new THREE.Group();
    faceGroup.position.set(fx, 5.9, fz);
    faceGroup.rotation.y = ry;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 20), faceMat);
    dial.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.08, 7, 20), brassMat);
    rim.position.z = 0.04;

    const minPivot = new THREE.Group();
    minPivot.position.z = 0.08;
    const minBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.04), handMat);
    minBar.position.y = 0.3;
    minPivot.add(minBar);

    const hrPivot = new THREE.Group();
    hrPivot.position.z = 0.07;
    const hrBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.04), handMat);
    hrBar.position.y = 0.2;
    hrPivot.add(hrBar);

    faceGroup.add(dial, rim, minPivot, hrPivot);
    ctx.group.add(faceGroup);
    minuteHands.push(minPivot);
    hourHands.push(hrPivot);
  }
  anim.add((t) => {
    for (let i = 0; i < minuteHands.length; i++) {
      minuteHands[i].rotation.z = -t * 0.55;
      hourHands[i].rotation.z = -t * 0.08;
    }
  });

  // Hanging brass pendulum visible in south clock alcove
  const pendulumPivot = new THREE.Group();
  pendulumPivot.position.set(0, 4.4, 1.66);
  const pRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 6), brassMat);
  pRod.position.y = -0.62;
  const pBob = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14), brassMat);
  pBob.rotation.x = Math.PI / 2;
  pBob.position.y = -1.28;
  pendulumPivot.add(pRod, pBob);
  ctx.group.add(pendulumPivot);
  anim.addPendulumSway(pendulumPivot, { ampX: 0, ampZ: 0.28, speed: 2.35 });

  ctx.buildings.push({ x: 0, z: 0, width: 3.4, depth: 3.4, rotY: 0, kind: 'temple' });
  ctx.hidingSpots.push({ x: 0, z: -2.4, label: 'Behind Mall Clock Tower', kind: 'gully' });

  // 6 Enterable Timber-Framed Hill Cottages with Puffing Stone Chimneys!
  const cottageWallCream = new THREE.MeshStandardMaterial({
    map: textures.wallCream,
    color: 0xf4ead8,
    roughness: 0.78,
  });
  const cottageWallBlue = new THREE.MeshStandardMaterial({
    map: textures.wallCream,
    color: 0xdbe9f4,
    roughness: 0.78,
  });
  const cottageWallButter = new THREE.MeshStandardMaterial({
    map: textures.wallOchre,
    color: 0xf2dfb5,
    roughness: 0.8,
  });
  const floorWood = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x875f3d,
    roughness: 0.85,
  });

  const cottages: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
    wallMat: THREE.Material;
    roofColor: number;
    trimColor: number;
    hasChimney?: boolean;
  }> = [
    { id: 'hs-1', label: 'Pineview Bakery Cottage', x: -12.5, z: -12.5, doorSide: 'south', wallMat: cottageWallCream, roofColor: 0xb83b32, trimColor: 0x5c3924, hasChimney: true },
    { id: 'hs-2', label: 'Darjeeling Tea House', x: 12.5, z: -12.5, doorSide: 'south', wallMat: cottageWallButter, roofColor: 0x2c6e54, trimColor: 0x6b3e26, hasChimney: true },
    { id: 'hs-3', label: 'Shimla Post & Bookshop', x: -13.0, z: 12.0, doorSide: 'north', wallMat: cottageWallBlue, roofColor: 0xb83b32, trimColor: 0x3b4d63, hasChimney: true },
    { id: 'hs-4', label: 'Woodcarver Workshop', x: 13.0, z: 12.0, doorSide: 'north', wallMat: cottageWallCream, roofColor: 0x2c6e54, trimColor: 0x5c3924 },
    { id: 'hs-5', label: 'Toy Station Ticket Lodge', x: -24.0, z: 0.0, doorSide: 'east', wallMat: cottageWallButter, roofColor: 0xb83b32, trimColor: 0x5c3924, hasChimney: true },
    { id: 'hs-6', label: 'Hillside Toy Museum', x: 24.0, z: 0.0, doorSide: 'west', wallMat: cottageWallBlue, roofColor: 0x2c6e54, trimColor: 0x3b4d63 },
  ];

  const furnitureMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
  for (const c of cottages) {
    buildEnterableRoom(ctx, {
      id: c.id,
      label: c.label,
      x: c.x,
      z: c.z,
      width: 7.4,
      depth: 6.2,
      height: 3.3,
      doorSide: c.doorSide,
      doorWidth: 2.0,
      wallMaterial: c.wallMat,
      floorMaterial: floorWood,
      roofStyle: 'pitched',
      roofColor: c.roofColor,
      trimColor: c.trimColor,
      textures,
      minimapKind: 'house',
      addInteriorProps: (g) => {
        addVisualBox(g, -2.0, 0.45, -1.6, 1.5, 0.9, 0.75, furnitureMat);
        addVisualBox(g, 2.0, 0.9, -1.8, 1.1, 1.8, 0.65, timberMat);
      },
    });
    if (c.hasChimney) {
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.6, 0.75), towerStone);
      chim.position.set(c.x + 2.1, 4.6, c.z - 1.4);
      chim.castShadow = true;
      ctx.group.add(chim);
      anim.addSteamPlume(ctx.group, { x: c.x + 2.1, y: 5.5, z: c.z - 1.4 }, {
        count: 6,
        color: 0xf7faff,
        riseHeight: 3.6,
        speed: 0.36,
        baseRadius: 0.22,
      });
    }
  }

  // Bandstand Gazebo Pavilion (North Plaza) with bouncing lantern glow
  const gazeboX = 0;
  const gazeboZ = -27.5;
  addSolidBox(ctx, gazeboX, gazeboZ, 6.2, 0.24, 6.2, timberMat, false, 0, {
    topY: 0.24,
    climbable: true,
  });
  const gazRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.9, 8), roofGreenMat);
  gazRoof.position.set(gazeboX, 4.2, gazeboZ);
  gazRoof.castShadow = true;
  ctx.group.add(gazRoof);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = gazeboX + Math.cos(a) * 2.55;
    const pz = gazeboZ + Math.sin(a) * 2.55;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.1, 7), timberMat);
    post.position.set(px, 1.75, pz);
    post.castShadow = true;
    ctx.group.add(post);
    ctx.circles.push({ x: px, z: pz, radius: 0.22, blocksSight: false });
  }
  const gazLantern = new THREE.Group();
  gazLantern.position.set(gazeboX, 3.2, gazeboZ);
  const glOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe494 }),
  );
  glOrb.position.y = -0.35;
  gazLantern.add(glOrb);
  ctx.group.add(gazLantern);
  anim.addPendulumSway(gazLantern, { ampZ: 0.14, speed: 1.7 });

  // String lights across Mall Road
  addGlowingStringLights(ctx, [-9, 4.4, -8], [9, 4.4, -8], 10, [0xffe07a, 0xff8a65, 0x90e0ef]);
  addGlowingStringLights(ctx, [-9, 4.4, 8], [9, 4.4, 8], 10, [0xffe07a, 0x90e0ef, 0xffb3c6]);

  // Scenic Perimeter Toy Steam Train Loop (radius 36m — dramatic, safe outside core cottages!)
  anim.addToyTrainLoop(ctx.group, {
    centerX: 0,
    centerZ: 0,
    radiusX: 35.5,
    radiusZ: 35.5,
    yBase: 0.06,
  });

  // Crates & hillside tea stall props for extra hiding cover
  addCrateStack(ctx, -6.5, -4.5, textures, 'Behind Hill Apple Crates');
  addCrateStack(ctx, 6.8, 5.2, textures, 'Behind Tea Chests');
  addCrateStack(ctx, -18.5, -18.0, textures, 'Behind Pine Logs');
  addCrateStack(ctx, 18.5, 18.0, textures, 'Behind Luggage Trunks');

  // Lush Pixar Pine & Pink Mountain Blossom Trees
  const trees: Array<[number, number, 'pine' | 'blossom', number]> = [
    [-21, -21, 'pine', 1.15],
    [21, -21, 'pine', 1.2],
    [-21, 21, 'pine', 1.15],
    [21, 21, 'pine', 1.1],
    [-8, -26, 'blossom', 1.05],
    [8, -26, 'blossom', 1.0],
    [-9, 25, 'blossom', 1.08],
    [9, 25, 'blossom', 1.04],
    [-29, -11, 'pine', 1.25],
    [29, -11, 'pine', 1.2],
    [-29, 11, 'pine', 1.2],
    [29, 11, 'pine', 1.25],
  ];
  trees.forEach(([tx, tz, k, sc], idx) =>
    placePixarTree(ctx, tx, tz, k, sc, idx * 1.7, `Under ${k === 'blossom' ? 'Blossom' : 'Pine'} Tree`),
  );

  addNaturalPerimeter(ctx, textures, 44.5, 40, [0x245e3d, 0x2d734b, 0x1e4d34], 'trees');

  // Pixar Living Air: Soaring Mountain Swallows + Drifting Pink Blossoms!
  anim.addFlyingCritters(ctx.group, {
    kind: 'bird',
    count: 9,
    centerX: 0,
    centerZ: 0,
    radiusX: 24,
    radiusZ: 22,
    minY: 6.5,
    maxY: 12.5,
    colors: [0x2a6699, 0x3b8cc4, 0xf2a93b, 0xd65a47],
  });
  anim.addAmbientParticles(ctx.group, {
    count: 55,
    areaRadius: 34,
    minY: 0.4,
    maxY: 11.0,
    color: 0xffc6d9,
    size: 0.085,
    fallSpeed: 0.65,
    swirlAmp: 1.6,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 8),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(-14, 0, 0),
    new THREE.Vector3(14, 0, 0),
    new THREE.Vector3(-18, 0, -18),
    new THREE.Vector3(18, 0, -18),
    new THREE.Vector3(-18, 0, 18),
    new THREE.Vector3(18, 0, 18),
    new THREE.Vector3(0, 0, -22),
    new THREE.Vector3(0, 0, 22),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.0 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.0,
      groundTint: '#658554',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0, 0, 8.2],
      previewCamPos: [1.6, 1.9, 12.0],
      previewLookAt: [0.6, 1.1, 7.6],
      hiders: [
        [-4.5, 8.5, Math.PI],
        [4.5, -8.5, 0],
        [-16.5, 0.0, 1.5],
        [16.5, 0.0, -1.5],
      ],
      seeker: [0.0, 5.2, Math.PI],
    },
  };
}

/* ============================================================================
 * LEVEL 10: DESERT FORT & BAZAAR (1990s Golden Jaisalmer Sandstone Citadel)
 * Signature Pixar Animations:
 *  - Dancing Kathputli Puppet Theatre with 4 animated Rajasthani marionettes
 *  - Rippling Silk Bazaar Canopy Tents & Rooftop Royal Pennants
 *  - Swaying Brass Haveli Lanterns + Gliding Desert Kites + Golden Dust Shimmer
 * ========================================================================== */
export function buildDesertFortMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  addGroundPlane(ctx, textures, 0xdcb47a, 135);

  // Warm sandstone courtyard avenues
  addRoadSegment(ctx, 0, 0, 5.8, 66, 0, textures, 0xe2c391);
  addRoadSegment(ctx, 0, 0, 5.8, 66, Math.PI / 2, textures, 0xe2c391);

  const sandstoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    color: 0xe6b873,
    roughness: 0.78,
  });
  const carvedMat = new THREE.MeshStandardMaterial({
    map: textures.wallOchre,
    color: 0xd99b52,
    roughness: 0.74,
  });
  const floorStone = new THREE.MeshStandardMaterial({
    map: textures.street,
    color: 0xcfa468,
    roughness: 0.88,
  });
  const silkColors = [0xd93b44, 0xf29f24, 0x1e8ca6, 0x9b3675, 0xe85a2a];

  // Central Royal Stepped Baori Courtyard & Kathputli Puppet Stage (South-Center)
  addStoneWell(ctx, 0, -5.5, textures, 'Behind Royal Sandstone Well');

  // Puppet Theatre Stage at (0, 11.5) with 4 dancing animated Rajasthani marionettes!
  addSolidBox(ctx, 0, 11.5, 7.6, 0.48, 4.2, sandstoneMat, false, 0, {
    topY: 0.48,
    climbable: true,
  });
  // Step up onto the stage
  addSolidBox(ctx, 0, 9.1, 4.2, 0.24, 0.7, sandstoneMat, false, 0, {
    topY: 0.24,
    climbable: true,
  });
  // Stage proscenium arch & puppet canopy
  for (const sx of [-3.4, 3.4]) {
    addSolidBox(ctx, sx, 13.2, 0.45, 3.6, 0.45, carvedMat, true, 0.48);
    addSolidBox(ctx, sx, 9.8, 0.45, 3.6, 0.45, carvedMat, false, 0.48);
  }
  const stageBackdrop = addSolidBox(ctx, 0, 13.3, 6.4, 3.2, 0.35, new THREE.MeshStandardMaterial({ color: 0x7a1c38, roughness: 0.7 }), true, 0.48);
  stageBackdrop.castShadow = true;
  const stageCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.35, 4.6),
    new THREE.MeshStandardMaterial({ color: 0xe85a2a, roughness: 0.52 }),
  );
  stageCanopy.position.set(0, 4.25, 11.5);
  stageCanopy.castShadow = true;
  ctx.group.add(stageCanopy);
  anim.addSquashBob(stageCanopy, { baseY: 4.25, bobAmp: 0.05, squashAmp: 0.025, speed: 2.1, tiltAmp: 0.012 });

  // 4 Expressive Dancing Kathputli Puppets on the stage!
  anim.addKathputliPuppet(ctx.group, -2.0, 0.52, 11.8, 0xe83b5b, 0);
  anim.addKathputliPuppet(ctx.group, -0.68, 0.52, 11.5, 0xf4b62c, 1.4);
  anim.addKathputliPuppet(ctx.group, 0.68, 0.52, 11.5, 0x1ea896, 2.7);
  anim.addKathputliPuppet(ctx.group, 2.0, 0.52, 11.8, 0x9b42d6, 4.1);
  ctx.hidingSpots.push({ x: 0, z: 14.6, label: 'Behind the Kathputli Puppet Stage', kind: 'gully' });

  // 6 Enterable Golden Sandstone Havelis & Spice/Carpet Shops
  const shops: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
    roofStyle: 'flat' | 'dome';
    trimColor: number;
  }> = [
    { id: 'df-1', label: 'Royal Spice Haveli', x: -13.5, z: -13.0, doorSide: 'south', roofStyle: 'dome', trimColor: 0x1e8ca6 },
    { id: 'df-2', label: 'Silk & Carpet Emporium', x: 13.5, z: -13.0, doorSide: 'south', roofStyle: 'dome', trimColor: 0xd93b44 },
    { id: 'df-3', label: 'Sandstone Watchhouse West', x: -23.0, z: 0.0, doorSide: 'east', roofStyle: 'flat', trimColor: 0xf29f24 },
    { id: 'df-4', label: 'Brass Lamp Workshop', x: 23.0, z: 0.0, doorSide: 'west', roofStyle: 'flat', trimColor: 0x9b3675 },
    { id: 'df-5', label: 'Desert Jeweller Courtyard', x: -14.5, z: 16.5, doorSide: 'north', roofStyle: 'dome', trimColor: 0xe85a2a },
    { id: 'df-6', label: 'Camel Trader Rest House', x: 14.5, z: 16.5, doorSide: 'north', roofStyle: 'dome', trimColor: 0x1e8ca6 },
  ];

  for (let i = 0; i < shops.length; i++) {
    const s = shops[i];
    buildEnterableRoom(ctx, {
      id: s.id,
      label: s.label,
      x: s.x,
      z: s.z,
      width: 8.0,
      depth: 6.6,
      height: 3.6,
      doorSide: s.doorSide,
      doorWidth: 2.2,
      wallMaterial: i % 2 === 0 ? sandstoneMat : carvedMat,
      floorMaterial: floorStone,
      roofStyle: s.roofStyle,
      roofColor: 0xdca55c,
      trimColor: s.trimColor,
      textures,
      minimapKind: 'house',
      addInteriorProps: (g) => {
        // Rolled colorful carpets & brass spice jars
        const rugMat = new THREE.MeshStandardMaterial({ color: silkColors[i % silkColors.length], roughness: 0.85 });
        addVisualBox(g, -2.0, 0.4, -1.5, 1.6, 0.8, 0.8, rugMat);
        addVisualBox(g, 2.0, 0.55, -1.8, 1.2, 1.1, 0.8, carvedMat);
      },
    });
  }

  // Colorful Rippling Silk Bazaar Tents with Swaying Hanging Brass Lanterns!
  const tentCoords: Array<[number, number, number]> = [
    [-11.5, -2.5, 0],
    [11.5, -2.5, 1],
    [-11.5, 6.5, 2],
    [11.5, 6.5, 3],
    [0, -21.5, 4],
  ];
  for (const [tx, tz, cIdx] of tentCoords) {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);
    ctx.group.add(tGroup);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 });
    for (const [px, pz] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.9, 6), poleMat);
      p.position.set(px, 1.45, pz);
      tGroup.add(p);
      ctx.circles.push({ x: tx + px, z: tz + pz, radius: 0.18, blocksSight: false });
    }
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(2.85, 1.1, 4),
      new THREE.MeshStandardMaterial({ color: silkColors[cIdx % silkColors.length], roughness: 0.56 }),
    );
    canopy.rotation.y = Math.PI / 4;
    canopy.position.y = 3.32;
    canopy.castShadow = true;
    tGroup.add(canopy);
    anim.addSquashBob(canopy, { baseY: 3.32, bobAmp: 0.06, squashAmp: 0.035, speed: 2.3, phase: cIdx * 1.1, tiltAmp: 0.035 });

    // Hanging glowing lantern under tent peak
    const lant = new THREE.Group();
    lant.position.set(0, 2.85, 0);
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd56b }),
    );
    orb.position.y = -0.34;
    lant.add(orb);
    tGroup.add(lant);
    anim.addPendulumSway(lant, { ampZ: 0.18, speed: 2.1, phase: cIdx * 0.9 });

    // Low spice counter inside tent for crouch hiding
    addSolidBox(ctx, tx, tz, 2.2, 0.95, 0.95, carvedMat, true, 0, { topY: 0.95, climbable: true });
    ctx.hidingSpots.push({ x: tx, z: tz + 1.2, label: 'Under Silk Bazaar Tent', kind: 'gully' });
  }

  // Grand Desert Fort Corner Bastion Towers with Fluttering Royal Pennants!
  const bastions: Array<[number, number]> = [
    [-29, -29],
    [29, -29],
    [-29, 29],
    [29, 29],
  ];
  for (let i = 0; i < bastions.length; i++) {
    const [bx, bz] = bastions[i];
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 8.8, 12), sandstoneMat);
    tower.position.set(bx, 4.4, bz);
    tower.castShadow = true;
    ctx.group.add(tower);
    ctx.circles.push({ x: bx, z: bz, radius: 4.0, blocksSight: true });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), carvedMat);
    pole.position.set(bx, 10.2, bz);
    ctx.group.add(pole);

    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 2.2, 3),
      new THREE.MeshStandardMaterial({ color: silkColors[i % silkColors.length], roughness: 0.5 }),
    );
    pennant.rotation.z = -Math.PI / 2;
    pennant.position.set(bx + 1.1, 11.4, bz);
    ctx.group.add(pennant);
    anim.addPendulumSway(pennant, { ampX: 0.14, ampZ: 0.08, speed: 3.1, phase: i * 1.4 });
  }

  // Desert Palms & Stacked Spice Crates
  const palms: Array<[number, number]> = [
    [-21, -21], [21, -21], [-22, 23], [22, 23], [-7, -28], [7, -28], [-27, 11], [27, -11],
  ];
  palms.forEach(([px, pz], idx) => placePixarTree(ctx, px, pz, 'palm', 1.12, idx * 1.5, 'Behind Oasis Palm'));
  addCrateStack(ctx, -6.2, -16.5, textures, 'Behind Spice Sacks');
  addCrateStack(ctx, 6.2, -16.5, textures, 'Behind Brass Urns');

  addNaturalPerimeter(ctx, textures, 44.5, 24, [0x4c7c42, 0x3b6938], 'stone_wall');

  // Pixar Living Desert Sky: Gliding Colorful Kites & Shimmering Golden Sand Motes!
  anim.addFlyingCritters(ctx.group, {
    kind: 'bird',
    count: 8,
    centerX: 0,
    centerZ: 0,
    radiusX: 25,
    radiusZ: 25,
    minY: 9.0,
    maxY: 16.0,
    colors: [0xe83b44, 0xf4b62c, 0x1ea896, 0x9b42d6],
  });
  anim.addAmbientParticles(ctx.group, {
    count: 60,
    areaRadius: 36,
    minY: 0.8,
    maxY: 9.0,
    color: 0xffe4a0,
    size: 0.07,
    fallSpeed: 0,
    swirlAmp: 1.8,
    glow: true,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(0, 0, -14),
    new THREE.Vector3(-15, 0, -5),
    new THREE.Vector3(15, 0, -5),
    new THREE.Vector3(-15, 0, 10),
    new THREE.Vector3(15, 0, 10),
    new THREE.Vector3(-20, 0, -20),
    new THREE.Vector3(20, 0, -20),
    new THREE.Vector3(0, 0, 22),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.5 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: null,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#c89e64',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0, 0, 4.8],
      previewCamPos: [1.5, 1.85, 8.6],
      previewLookAt: [0.4, 1.1, 4.4],
      hiders: [
        [-6.5, 4.0, Math.PI],
        [6.5, -10.0, 0],
        [-16.5, 2.0, 1.5],
        [16.5, -2.0, -1.5],
      ],
      seeker: [0.0, 1.2, Math.PI],
    },
  };
}

/* ============================================================================
 * LEVEL 11: MONSOON TEA ESTATE (1990s Munnar / Assam Emerald Terraces)
 * Signature Pixar Animations:
 *  - Turning Wooden Waterwheel beside Tea Factory with cascading animated splash droplets
 *  - Swirling Multi-Color Butterflies fluttering over emerald tea hedges
 *  - Expanding Shimmering Stream Ripples + Misty Monsoon Fireflies
 * ========================================================================== */
export function buildTeaEstateMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  addGroundPlane(ctx, textures, 0x3b7a44, 135);

  // Sparkling Mountain Stream slicing North-South at x = 0 with 3 arched stone bridges
  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0x26899e,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 0.14,
    metalness: 0.1,
    clearcoat: 0.85,
  });
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 90), streamMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(0, 0.04, 0);
  ctx.group.add(stream);
  ctx.pondWater = stream;
  ctx.waterRects.push({ x: 0, z: 0, width: 7.6, length: 90, rotY: 0 });

  // Solid stream water colliders leaving 3 wide walkable stone bridges at z = -16, 0, +16
  for (const [zMin, zMax] of [[-44, -18.5], [-13.5, -2.5], [2.5, 13.5], [18.5, 44]]) {
    ctx.boxes.push({ minX: -3.6, maxX: 3.6, minZ: zMin, maxZ: zMax, blocksSight: false });
  }

  const stoneMat = new THREE.MeshStandardMaterial({ map: textures.templeStone, color: 0x9aa49c, roughness: 0.82 });
  const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x6b472d, roughness: 0.85 });

  for (const bz of [-16, 0, 16]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.18, 4.6), stoneMat);
    deck.position.set(0, 0.09, bz);
    deck.receiveShadow = true;
    deck.castShadow = true;
    ctx.group.add(deck);
    for (const rz of [-2.1, 2.1]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.65, 0.24), stoneMat);
      parapet.position.set(0, 0.45, bz + rz);
      parapet.castShadow = true;
      ctx.group.add(parapet);
    }
    ctx.buildings.push({ x: 0, z: bz, width: 9.8, depth: 4.6, rotY: 0, kind: 'bridge' });
    ctx.roads.push({ x: 0, z: bz, width: 4.4, length: 42, rotY: Math.PI / 2 });
  }

  // Red-earth plantation paths on both banks
  addRoadSegment(ctx, -11.5, 0, 3.6, 62, 0, textures, 0x9e714c);
  addRoadSegment(ctx, 11.5, 0, 3.6, 62, 0, textures, 0x9e714c);

  // Planter's Bungalow (West) & Tea Drying Factory with Spinning Wooden Waterwheel (East)!
  const bungalowWall = new THREE.MeshStandardMaterial({ map: textures.wallCream, color: 0xf0f4ec, roughness: 0.78 });
  const factoryWall = new THREE.MeshStandardMaterial({ map: textures.brick, color: 0xb85842, roughness: 0.84 });
  const floorMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x734e32, roughness: 0.85 });

  buildEnterableRoom(ctx, {
    id: 'te-bungalow',
    label: 'Planter Colonial Bungalow',
    x: -20.5,
    z: -10.5,
    width: 9.2,
    depth: 7.4,
    height: 3.6,
    doorSide: 'east',
    doorWidth: 2.3,
    wallMaterial: bungalowWall,
    floorMaterial: floorMat,
    roofStyle: 'pitched',
    roofColor: 0x266348,
    trimColor: 0x3b281c,
    textures,
    minimapKind: 'house',
    addInteriorProps: (g) => {
      addVisualBox(g, -2.4, 0.42, -1.8, 1.8, 0.84, 1.0, woodMat);
      addVisualBox(g, 2.0, 0.95, -2.0, 1.2, 1.9, 0.65, woodMat);
    },
  });

  buildEnterableRoom(ctx, {
    id: 'te-factory',
    label: 'Old Tea Leaf Drying Factory',
    x: 20.5,
    z: -10.5,
    width: 9.2,
    depth: 7.4,
    height: 3.8,
    doorSide: 'west',
    doorWidth: 2.4,
    wallMaterial: factoryWall,
    floorMaterial: floorMat,
    roofStyle: 'tin',
    roofColor: 0x456b73,
    trimColor: 0x2b3e42,
    textures,
    minimapKind: 'shop',
    addInteriorProps: (g) => {
      addVisualBox(g, 0, 0.52, -1.8, 4.2, 1.04, 1.1, woodMat);
    },
  });

  // Spinning Wooden Waterwheel by the East Bank at (4.4, 1.45, -8.5)!
  anim.addWaterwheel(ctx.group, 4.2, 1.42, -8.5, Math.PI / 2);
  addSolidBox(ctx, 5.4, -8.5, 1.5, 2.2, 2.2, stoneMat, true, 0);

  // Two More Enterable Tea-Picker Cottages (South)
  buildEnterableRoom(ctx, {
    id: 'te-south-w',
    label: 'Tea Leaf Weighing Shed',
    x: -19.5,
    z: 14.5,
    width: 7.2,
    depth: 6.0,
    height: 3.2,
    doorSide: 'east',
    doorWidth: 2.0,
    wallMaterial: bungalowWall,
    floorMaterial: floorMat,
    roofStyle: 'pitched',
    roofColor: 0xa64632,
    trimColor: 0x543824,
    textures,
    minimapKind: 'house',
  });
  buildEnterableRoom(ctx, {
    id: 'te-south-e',
    label: 'Estate Manager Outhouse',
    x: 19.5,
    z: 14.5,
    width: 7.2,
    depth: 6.0,
    height: 3.2,
    doorSide: 'west',
    doorWidth: 2.0,
    wallMaterial: bungalowWall,
    floorMaterial: floorMat,
    roofStyle: 'pitched',
    roofColor: 0x266348,
    trimColor: 0x543824,
    textures,
    minimapKind: 'house',
  });

  // Lush Rounded Terraced Tea-Bush Rows (Perfect Pixar Emerald Hide-and-Seek Cover!)
  const teaBushMatA = new THREE.MeshStandardMaterial({ color: 0x2e8c45, roughness: 0.72 });
  const teaBushMatB = new THREE.MeshStandardMaterial({ color: 0x43a854, roughness: 0.68 });
  const hedgeRows: Array<[number, number, number, number]> = [
    [-21, 2.5, 9.5, 2.2],
    [-21, 7.2, 9.5, 2.2],
    [21, 2.5, 9.5, 2.2],
    [21, 7.2, 9.5, 2.2],
    [-19, -22.5, 10.0, 2.2],
    [19, -22.5, 10.0, 2.2],
    [-19, 25.0, 10.0, 2.2],
    [19, 25.0, 10.0, 2.2],
  ];
  hedgeRows.forEach(([hx, hz, hw, hd], idx) => {
    const hedge = addSolidBox(
      ctx,
      hx,
      hz,
      hw,
      1.18,
      hd,
      idx % 2 === 0 ? teaBushMatA : teaBushMatB,
      true,
      0,
      { topY: 1.18, climbable: false },
    );
    ctx.swayFoliage.push(hedge);
    ctx.hidingSpots.push({ x: hx, z: hz + 1.8, label: 'Between Emerald Tea Bushes', kind: 'farm' });
  });

  // Lush Pixar Shade Trees & Tea Basket Crates
  const shadeTrees: Array<[number, number]> = [
    [-9.5, -24], [9.5, -24], [-9.5, 24], [9.5, 24], [-29, -3], [29, -3], [-29, 18], [29, 18],
  ];
  shadeTrees.forEach(([tx, tz], i) =>
    placePixarTree(ctx, tx, tz, 'banyan_lush', 1.15, i * 1.9, 'Under Tea Shade Tree'),
  );
  addCrateStack(ctx, -7.8, 7.5, textures, 'Behind Fresh Tea Baskets');
  addCrateStack(ctx, 7.8, -1.5, textures, 'Behind Tea Sacks');

  addNaturalPerimeter(ctx, textures, 45.0, 38, [0x226636, 0x2f8246, 0x1b522c], 'hedges');

  // Pixar Living Tea Hills: Swirling Colorful Butterflies + Rising Mist Fireflies!
  anim.addFlyingCritters(ctx.group, {
    kind: 'butterfly',
    count: 18,
    centerX: 0,
    centerZ: 0,
    radiusX: 24,
    radiusZ: 24,
    minY: 1.4,
    maxY: 4.5,
    colors: [0xffd147, 0x4dd4ff, 0xff7da8, 0x9ef065, 0xff9347],
  });
  anim.addAmbientParticles(ctx.group, {
    count: 50,
    areaRadius: 34,
    minY: 1.0,
    maxY: 7.5,
    color: 0xd9ffef,
    size: 0.075,
    fallSpeed: 0,
    swirlAmp: 1.4,
    glow: true,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(-11.5, 0, -16),
    new THREE.Vector3(11.5, 0, -16),
    new THREE.Vector3(-11.5, 0, 0),
    new THREE.Vector3(11.5, 0, 0),
    new THREE.Vector3(-11.5, 0, 16),
    new THREE.Vector3(11.5, 0, 16),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -16),
    new THREE.Vector3(0, 0, 16),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.5 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: stream,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#366e3f',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [-11.5, 0, 5.5],
      previewCamPos: [-9.8, 1.85, 9.2],
      previewLookAt: [-10.8, 1.1, 5.0],
      hiders: [
        [-11.5, 9.0, Math.PI],
        [11.5, -9.0, 0],
        [-11.5, -18.0, 0.5],
        [11.5, 18.0, -0.5],
      ],
      seeker: [11.5, 0.0, -Math.PI / 2],
    },
  };
}

/* ============================================================================
 * LEVEL 12: COASTAL LIGHTHOUSE COVE (1990s Pixar Luca-Inspired Goa / Konkan Cove)
 * Signature Pixar Animations:
 *  - Towering Striped Coastal Lighthouse with Rotating 360° Volumetric Golden Beacon Beam
 *  - Bobbing & Pitching Painted Wooden Fishing Boats on Turquoise Ocean Waves
 *  - Circling White Seagulls + Spinning Beach Pinwheels + Swaying Coconut Palms
 * ========================================================================== */
export function buildCoastalLighthouseMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  // Golden sun-baked beach sand ground
  addGroundPlane(ctx, textures, 0xe8cd92, 135);

  // Sparkling Turquoise Ocean along the East Coast (x > 16)
  const oceanMat = new THREE.MeshPhysicalMaterial({
    color: 0x1698b8,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.52, 0.52),
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.95,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(58, 110), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(45, 0.03, 0);
  ctx.group.add(ocean);
  ctx.pondWater = ocean;
  ctx.waterRects.push({ x: 30, z: 0, width: 28, length: 90, rotY: 0 });

  // Solid coastline water boundary (leaving a walkable wooden jetty pier at z = -2..+2, x = 16..28!)
  ctx.boxes.push({ minX: 16.4, maxX: 46, minZ: -46, maxZ: -2.6, blocksSight: false });
  ctx.boxes.push({ minX: 16.4, maxX: 46, minZ: 2.6, maxZ: 46, blocksSight: false });
  ctx.boxes.push({ minX: 28.4, maxX: 46, minZ: -3.0, maxZ: 3.0, blocksSight: false });

  // Animated turquoise cresting shore foam ribbon!
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe6fbff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const foamStrip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 86), foamMat);
  foamStrip.rotation.x = -Math.PI / 2;
  foamStrip.position.set(16.6, 0.06, 0);
  ctx.group.add(foamStrip);
  anim.add((t) => {
    const wave = Math.sin(t * 1.45);
    foamStrip.position.x = 16.5 + wave * 0.65;
    foamMat.opacity = 0.36 + (wave * 0.5 + 0.5) * 0.34;
  });

  // Walkable Wooden Fishing Pier Jetty jutting out into the Cove (z = 0, x = 15..28)
  const pierMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x8f6641, roughness: 0.85 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.24, 4.6), pierMat);
  pierDeck.position.set(21.6, 0.12, 0);
  pierDeck.receiveShadow = true;
  pierDeck.castShadow = true;
  ctx.group.add(pierDeck);
  ctx.buildings.push({ x: 21.6, z: 0, width: 13.5, depth: 4.6, rotY: 0, kind: 'bridge' });
  ctx.roads.push({ x: 8, z: 0, width: 4.4, length: 34, rotY: Math.PI / 2 });
  addRoadSegment(ctx, -4.5, 0, 4.6, 62, 0, textures, 0xd8c298);

  // Towering Red-and-White Striped Coastal Lighthouse on the Northern Rocky Headland (12.0, -21.5)
  const lhX = 11.5;
  const lhZ = -21.5;
  const redStripe = new THREE.MeshStandardMaterial({ color: 0xd93b34, roughness: 0.48 });
  const whiteStripe = new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 0.52 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x26384a, roughness: 0.4, metalness: 0.45 });

  // Stepped walkable lighthouse base
  addSolidBox(ctx, lhX, lhZ, 6.8, 0.24, 6.8, whiteStripe, false, 0, { topY: 0.24, climbable: true });
  for (let tier = 0; tier < 5; tier++) {
    const rBot = 2.45 - tier * 0.2;
    const rTop = 2.25 - tier * 0.2;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 2.3, 18),
      tier % 2 === 0 ? whiteStripe : redStripe,
    );
    seg.position.set(lhX, 0.24 + 1.15 + tier * 2.3, lhZ);
    seg.castShadow = true;
    ctx.group.add(seg);
  }
  const lanternRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 1.5, 14),
    new THREE.MeshPhysicalMaterial({ color: 0xfff3b8, emissive: 0xffd260, emissiveIntensity: 0.65, roughness: 0.15 }),
  );
  lanternRoom.position.set(lhX, 12.5, lhZ);
  ctx.group.add(lanternRoom);
  const lhCap = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.4, 14), domeMat);
  lhCap.position.set(lhX, 13.9, lhZ);
  ctx.group.add(lhCap);
  ctx.circles.push({ x: lhX, z: lhZ, radius: 2.65, blocksSight: true });
  ctx.buildings.push({ x: lhX, z: lhZ, width: 5.4, depth: 5.4, rotY: 0, kind: 'temple' });

  // Rotating 360° Volumetric Golden Lighthouse Beacon!
  anim.addLighthouseBeacon(ctx.group, lhX, 12.6, lhZ);

  // 5 Vibrant Pastel Portuguese-Indian Coastal Cottages (Enterable!)
  const cottageSpecs: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
    wallColor: number;
    trimColor: number;
  }> = [
    { id: 'cl-1', label: 'Coral Fishermen Villa', x: -13.5, z: -16.5, doorSide: 'east', wallColor: 0xf48c72, trimColor: 0xfbf7f0 },
    { id: 'cl-2', label: 'Sunburst Konkan Bakery', x: -14.5, z: -3.5, doorSide: 'east', wallColor: 0xf5cf62, trimColor: 0x266fa6 },
    { id: 'cl-3', label: 'Azure Seaside Cafe', x: -13.5, z: 10.5, doorSide: 'east', wallColor: 0x6ec3e8, trimColor: 0xfbf7f0 },
    { id: 'cl-4', label: 'Lime Shell Souvenir Shop', x: 5.5, z: 14.5, doorSide: 'west', wallColor: 0x9cd984, trimColor: 0xd9483b },
    { id: 'cl-5', label: 'Boatbuilder Boathouse', x: -25.0, z: 4.5, doorSide: 'east', wallColor: 0xf2e4c9, trimColor: 0x1e8ca6 },
  ];
  const tileFloor = new THREE.MeshStandardMaterial({ map: textures.street, color: 0xd6b08c, roughness: 0.85 });
  for (const c of cottageSpecs) {
    buildEnterableRoom(ctx, {
      id: c.id,
      label: c.label,
      x: c.x,
      z: c.z,
      width: 7.4,
      depth: 6.2,
      height: 3.3,
      doorSide: c.doorSide,
      doorWidth: 2.1,
      wallMaterial: new THREE.MeshStandardMaterial({ map: textures.wallCream, color: c.wallColor, roughness: 0.72 }),
      floorMaterial: tileFloor,
      roofStyle: 'pitched',
      roofColor: 0xc24c2e,
      trimColor: c.trimColor,
      textures,
      minimapKind: 'house',
    });
  }

  // Bobbing & Pitching Painted Fishing Boats floating in the Turquoise Cove!
  const boatConfigs: Array<[number, number, number, number]> = [
    [22.5, -10.5, 0.3, 0xe84855],
    [24.5, 9.5, -0.4, 0xf4b62c],
    [29.5, -16.0, 0.15, 0x2fb38b],
    [28.0, 17.5, -0.2, 0x3b8cc4],
  ];
  for (let i = 0; i < boatConfigs.length; i++) {
    const [bx, bz, rot, col] = boatConfigs[i];
    const boat = new THREE.Group();
    boat.position.set(bx, 0.18, bz);
    boat.rotation.y = rot;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.68, 4.4),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }),
    );
    hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.16, 4.5), whiteStripe);
    stripe.position.y = 0.26;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), pierMat);
    mast.position.set(0, 1.7, 0.2);
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.4, 3),
      new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.65, side: THREE.DoubleSide }),
    );
    sail.position.set(0, 2.0, -0.35);
    boat.add(hull, stripe, mast, sail);
    ctx.group.add(boat);
    const phase = i * 1.65;
    anim.add((t) => {
      boat.position.y = 0.2 + Math.sin(t * 1.85 + phase) * 0.14;
      boat.rotation.z = Math.sin(t * 1.55 + phase) * 0.09;
      boat.rotation.x = Math.cos(t * 1.35 + phase) * 0.06;
    });
  }

  // Spinning Colorful Pixar Beach Pinwheels near the Pier & Cottages!
  const pinCoords: Array<[number, number]> = [[13.5, 4.5], [13.5, -4.5], [-4.5, -14.0], [-4.5, 16.5]];
  const pinColors = [0xff4f6d, 0xffd147, 0x3bd4ff, 0x6ce87a];
  for (let i = 0; i < pinCoords.length; i++) {
    const [px, pz] = pinCoords[i];
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), pierMat);
    stick.position.set(px, 1.1, pz);
    ctx.group.add(stick);
    const rotor = new THREE.Group();
    rotor.position.set(px, 2.15, pz + 0.08);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.16, 0.03),
        new THREE.MeshStandardMaterial({ color: pinColors[b], roughness: 0.35 }),
      );
      blade.rotation.z = (b * Math.PI) / 2;
      blade.position.set(Math.cos((b * Math.PI) / 2) * 0.24, Math.sin((b * Math.PI) / 2) * 0.24, 0);
      rotor.add(blade);
    }
    ctx.group.add(rotor);
    anim.add((t) => {
      rotor.rotation.z = t * (4.2 + i * 0.45);
    });
  }

  // Beached Boat Cover, Crates & Coconut Palm Groves
  addCrateStack(ctx, 7.5, -6.5, textures, 'Behind Fishing Crates');
  addCrateStack(ctx, 8.5, 6.2, textures, 'Behind Rope Barrels');
  addCrateStack(ctx, -20.0, -23.0, textures, 'Behind Coconut Baskets');
  const palms: Array<[number, number]> = [
    [9.5, -12], [11.5, 10], [11.0, 22], [-5, -24], [-22, -24], [-24, 18], [-8, 24], [-28, -9],
  ];
  palms.forEach(([px, pz], i) => placePixarTree(ctx, px, pz, 'palm', 1.18, i * 1.4, 'Under Coconut Palm'));

  addNaturalPerimeter(ctx, textures, 44.5, 22, [0x2d8a48, 0x3fa656], 'trees');

  // Circling White Seagulls overhead!
  anim.addFlyingCritters(ctx.group, {
    kind: 'seagull',
    count: 10,
    centerX: 8,
    centerZ: 0,
    radiusX: 24,
    radiusZ: 26,
    minY: 7.5,
    maxY: 14.5,
    colors: [0xffffff, 0xf2f7fc],
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(-4.5, 0, -12),
    new THREE.Vector3(-4.5, 0, 12),
    new THREE.Vector3(6.5, 0, 0),
    new THREE.Vector3(21.0, 0, 0),
    new THREE.Vector3(4.5, 0, -16),
    new THREE.Vector3(-18.5, 0, -10),
    new THREE.Vector3(-18.5, 0, 14),
    new THREE.Vector3(0.0, 0, 20),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.0 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: ocean,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.0,
      groundTint: '#d8bc82',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [-4.5, 0, 6.0],
      previewCamPos: [-2.8, 1.85, 9.8],
      previewLookAt: [-3.8, 1.1, 5.4],
      hiders: [
        [-4.5, 8.5, Math.PI],
        [-4.5, -8.5, 0],
        [7.5, 0.0, -1.5],
        [-18.0, 2.0, 1.5],
      ],
      seeker: [2.5, 2.5, Math.PI],
    },
  };
}

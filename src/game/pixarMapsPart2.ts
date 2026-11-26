import * as THREE from 'three';
import {
  addCrateStack,
  addGlowingStringLights,
  addGroundPlane,
  addNaturalPerimeter,
  addRoadSegment,
  addSolidBox,
  addVisualBox,
  buildEnterableRoom,
  createMapContext,
} from './mapHelpers';
import { buildPixarTree, PixarAnimator } from './pixarAnimator';
import { VillageTextureSet } from './textures';
import { VillageBuildResult } from './village';

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
 * LEVEL 13: ROYAL PALACE GARDENS (1990s Twilight Charbagh & Marble Pavilions)
 * Signature Pixar Animations:
 *  - Multi-Tier Dancing Water Fountains with parabolic sparkling droplet arcs
 *  - Glowing Floating Lotus Lamps drifting gently across reflecting pools
 *  - Strutting Animated Peacocks fanning iridescent turquoise tails + Golden Fireflies
 * ========================================================================== */
export function buildPalaceGardensMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  addGroundPlane(ctx, textures, 0x356b48, 135);

  // Symmetrical rose-sandstone & cream marble charbagh walkways
  addRoadSegment(ctx, 0, 0, 5.4, 68, 0, textures, 0xe8d9c5);
  addRoadSegment(ctx, 0, 0, 5.4, 68, Math.PI / 2, textures, 0xe8d9c5);
  addRoadSegment(ctx, -20, 0, 3.8, 46, 0, textures, 0xdecbb2);
  addRoadSegment(ctx, 20, 0, 3.8, 46, 0, textures, 0xdecbb2);

  // Central Dancing Royal Lotus Fountain at (0, 0) + Twin Flanking Fountains!
  anim.addDancingFountain(ctx.group, 0, 0, {
    basinRadius: 3.4,
    jetHeight: 4.2,
    streamCount: 10,
    waterColor: 0x4dd4eb,
    stoneColor: 0xf4eee2,
  });
  ctx.circles.push({ x: 0, z: 0, radius: 3.55, blocksSight: false });
  ctx.landmarks.push({ x: 0, z: 0, radius: 3.5, kind: 'well' });

  anim.addDancingFountain(ctx.group, -19.5, 0, {
    basinRadius: 2.2,
    jetHeight: 3.0,
    streamCount: 6,
    waterColor: 0x5be2f5,
    stoneColor: 0xf2e7d5,
  });
  ctx.circles.push({ x: -19.5, z: 0, radius: 2.35, blocksSight: false });

  anim.addDancingFountain(ctx.group, 19.5, 0, {
    basinRadius: 2.2,
    jetHeight: 3.0,
    streamCount: 6,
    waterColor: 0x5be2f5,
    stoneColor: 0xf2e7d5,
  });
  ctx.circles.push({ x: 19.5, z: 0, radius: 2.35, blocksSight: false });

  // Reflecting Lotus Pools flanking North & South Avenues with Glowing Drifting Lotus Lamps!
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d8da6,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 0.95,
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    map: textures.wallCream,
    color: 0xf5efe6,
    roughness: 0.52,
  });
  const roseStoneMat = new THREE.MeshStandardMaterial({
    map: textures.wallOchre,
    color: 0xd98a7c,
    roughness: 0.68,
  });

  const pools: Array<[number, number, number, number]> = [
    [-8.5, -13.5, 5.4, 9.0],
    [8.5, -13.5, 5.4, 9.0],
    [-8.5, 13.5, 5.4, 9.0],
    [8.5, 13.5, 5.4, 9.0],
  ];
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xff77a9, roughness: 0.4 });
  const glowCoreMat = new THREE.MeshBasicMaterial({ color: 0xffe885 });

  pools.forEach(([px, pz, pw, pd], pIdx) => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.5, 0.28, pd + 0.5), marbleMat);
    rim.position.set(px, 0.14, pz);
    rim.receiveShadow = true;
    ctx.group.add(rim);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), poolMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(px, 0.29, pz);
    ctx.group.add(water);
    if (!ctx.pondWater) ctx.pondWater = water;
    ctx.waterRects.push({ x: px, z: pz, width: pw, length: pd, rotY: 0 });
    ctx.boxes.push({
      minX: px - pw * 0.5 - 0.15,
      maxX: px + pw * 0.5 + 0.15,
      minZ: pz - pd * 0.5 - 0.15,
      maxZ: pz + pd * 0.5 + 0.15,
      blocksSight: false,
    });

    // 3 Glowing Floating Lotus Lamps drifting in each reflecting pool
    for (let l = 0; l < 3; l++) {
      const lotus = new THREE.Group();
      const baseX = px + (l - 1) * 1.1;
      const baseZ = pz + (l % 2 === 0 ? -2.2 : 2.2);
      lotus.position.set(baseX, 0.34, baseZ);
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.04, 10),
        new THREE.MeshStandardMaterial({ color: 0x2d8a4e, roughness: 0.65 }),
      );
      const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 6), petalMat);
      bloom.rotation.x = Math.PI;
      bloom.position.y = 0.12;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), glowCoreMat);
      flame.position.y = 0.22;
      lotus.add(pad, bloom, flame);
      ctx.group.add(lotus);
      const phase = pIdx * 1.7 + l * 2.1;
      anim.add((t) => {
        lotus.position.x = baseX + Math.sin(t * 0.65 + phase) * 0.65;
        lotus.position.z = baseZ + Math.cos(t * 0.52 + phase) * 0.9;
        lotus.position.y = 0.34 + Math.sin(t * 2.2 + phase) * 0.04;
        lotus.rotation.y = t * 0.35 + phase;
      });
    }
  });

  // 4 Enterable Marble Royal Baradari Pavilions & Conservatory Rooms
  const floorMarble = new THREE.MeshStandardMaterial({
    map: textures.street,
    color: 0xeae0d0,
    roughness: 0.62,
  });
  const pavilions: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
  }> = [
    { id: 'pg-n', label: 'North Mirror Baradari', x: 0, z: -26.5, doorSide: 'south' },
    { id: 'pg-s', label: 'South Royal Conservatory', x: 0, z: 26.5, doorSide: 'north' },
    { id: 'pg-w', label: 'West Peacock Pavilion', x: -29.0, z: -13.5, doorSide: 'east' },
    { id: 'pg-e', label: 'East Rose Guardhouse', x: 29.0, z: 13.5, doorSide: 'west' },
  ];
  for (let i = 0; i < pavilions.length; i++) {
    const p = pavilions[i];
    buildEnterableRoom(ctx, {
      id: p.id,
      label: p.label,
      x: p.x,
      z: p.z,
      width: 8.6,
      depth: 6.8,
      height: 3.9,
      doorSide: p.doorSide,
      doorWidth: 2.5,
      wallMaterial: i % 2 === 0 ? marbleMat : roseStoneMat,
      floorMaterial: floorMarble,
      roofStyle: 'dome',
      roofColor: 0xf4eee2,
      trimColor: 0xd9a13b,
      textures,
      minimapKind: 'temple',
    });
  }

  // Manicured Royal Topiary Hedge Maze Quadrants (Incredible Hide-and-Seek!)
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x22693c, roughness: 0.78 });
  const mazeWalls: Array<[number, number, number, number]> = [
    [-21, -22, 8.5, 1.5],
    [-25, -18, 1.5, 7.0],
    [21, -22, 8.5, 1.5],
    [25, -18, 1.5, 7.0],
    [-21, 22, 8.5, 1.5],
    [-25, 18, 1.5, 7.0],
    [21, 22, 8.5, 1.5],
    [25, 18, 1.5, 7.0],
    [-16, 11, 1.5, 6.5],
    [16, -11, 1.5, 6.5],
  ];
  for (const [mx, mz, mw, md] of mazeWalls) {
    addSolidBox(ctx, mx, mz, mw, 1.95, md, hedgeMat, true, 0);
    ctx.hidingSpots.push({ x: mx + (mw > md ? 0 : 1.7), z: mz + (mw > md ? 1.7 : 0), label: 'Inside Royal Hedge Maze', kind: 'gully' });
  }

  // 3 Proud Strutting Animated Peacocks fanning iridescent turquoise tails!
  anim.addAnimatedPeacock(ctx.group, -4.8, -5.2, 0.7, 0);
  anim.addAnimatedPeacock(ctx.group, 5.2, 5.0, -2.4, 2.2);
  anim.addAnimatedPeacock(ctx.group, -14.5, 4.5, 1.2, 4.1);

  // Royal Cypress & Pink Blossom Trees
  const trees: Array<[number, number, 'royal_cypress' | 'blossom']> = [
    [-4.2, -19.5, 'royal_cypress'], [4.2, -19.5, 'royal_cypress'],
    [-4.2, 19.5, 'royal_cypress'], [4.2, 19.5, 'royal_cypress'],
    [-14.5, -24.5, 'blossom'], [14.5, -24.5, 'blossom'],
    [-14.5, 24.5, 'blossom'], [14.5, 24.5, 'blossom'],
    [-31, 4, 'blossom'], [31, -4, 'blossom'],
  ];
  trees.forEach(([tx, tz, k], i) => placePixarTree(ctx, tx, tz, k, 1.15, i * 1.3, 'Behind Palace Garden Tree'));

  // Warm Twilight Golden Garden String Lights
  addGlowingStringLights(ctx, [-14, 4.2, -5], [14, 4.2, -5], 12, [0xffe07a, 0xff9ec4, 0x80e8ff]);
  addGlowingStringLights(ctx, [-14, 4.2, 5], [14, 4.2, 5], 12, [0xffe07a, 0x80e8ff, 0xff9ec4]);

  addNaturalPerimeter(ctx, textures, 44.5, 34, [0x1f5934, 0x2b7042], 'hedges');

  // Dancing Golden Twilight Fireflies!
  anim.addAmbientParticles(ctx.group, {
    count: 70,
    areaRadius: 36,
    minY: 0.8,
    maxY: 6.5,
    color: 0xffe478,
    size: 0.08,
    fallSpeed: 0,
    swirlAmp: 1.5,
    glow: true,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, -9),
    new THREE.Vector3(0, 0, 9),
    new THREE.Vector3(-12, 0, 0),
    new THREE.Vector3(12, 0, 0),
    new THREE.Vector3(-20, 0, -14),
    new THREE.Vector3(20, 0, -14),
    new THREE.Vector3(-20, 0, 14),
    new THREE.Vector3(20, 0, 14),
    new THREE.Vector3(0, 0, -21),
    new THREE.Vector3(0, 0, 21),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.5 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: ctx.pondWater,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#2c583c',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0, 0, 7.6],
      previewCamPos: [1.5, 1.85, 11.4],
      previewLookAt: [0.5, 1.1, 7.0],
      hiders: [
        [-4.5, 7.0, Math.PI],
        [4.5, -7.0, 0],
        [-14.5, 0.0, 1.5],
        [14.5, 0.0, -1.5],
      ],
      seeker: [0.0, 5.4, Math.PI],
    },
  };
}

/* ============================================================================
 * LEVEL 14: GRAND VILLAGE MELA (1990s Illuminated Indian Carnival Fairground)
 * Signature Pixar Animations:
 *  - Giant Rotating Ferris Wheel (Charkhi) with 10 independently level-swinging gondolas & chasing marquee lights
 *  - Spinning 8-Horse Merry-Go-Round Carousel with galloping painted horses
 *  - Bouncing Colorful Helium Balloon Clusters + Carnival Glowing Fairy Motes
 * ========================================================================== */
export function buildGrandMelaMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  addGroundPlane(ctx, textures, 0x6b5342, 135);

  // Festive Mela Midway Avenues & Circular Central Plaza
  addRoadSegment(ctx, 0, 0, 6.2, 68, 0, textures, 0xa88a68);
  addRoadSegment(ctx, 0, 0, 6.2, 68, Math.PI / 2, textures, 0xa88a68);
  addRoadSegment(ctx, -18, 0, 4.0, 44, 0, textures, 0x9c7f60);
  addRoadSegment(ctx, 18, 0, 4.0, 44, 0, textures, 0x9c7f60);

  // HERO SET-PIECE 1: Giant Illuminated Ferris Wheel (North Plaza at 0, -22.5)!
  anim.addFerrisWheel(ctx.group, 0, -22.5, { radius: 7.8, gondolas: 10, rotY: 0 });
  ctx.boxes.push({ minX: -3.5, maxX: 3.5, minZ: -25.4, maxZ: -19.6, blocksSight: true });
  ctx.buildings.push({ x: 0, z: -22.5, width: 7.0, depth: 5.8, rotY: 0, kind: 'temple' });
  ctx.hidingSpots.push({ x: 0, z: -27.2, label: 'Behind the Giant Ferris Wheel', kind: 'gully' });

  // HERO SET-PIECE 2: Spinning 8-Horse Merry-Go-Round Carousel (East Center at 16.5, 0)!
  anim.addCarousel(ctx.group, 16.5, 0);
  ctx.circles.push({ x: 16.5, z: 0, radius: 4.5, blocksSight: true });
  ctx.buildings.push({ x: 16.5, z: 0, width: 9.0, depth: 9.0, rotY: 0, kind: 'shop' });
  ctx.hidingSpots.push({ x: 22.0, z: 0, label: 'Behind the Spinning Carousel', kind: 'gully' });

  // 6 Enterable Colorful Striped Carnival Pavilions & Mela Booths
  const floorMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x7d5336, roughness: 0.85 });
  const boothSpecs: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
    wallColor: number;
    roofColor: number;
    trimColor: number;
  }> = [
    { id: 'gm-1', label: 'Jaadu Magic Show Tent', x: -16.5, z: 0, doorSide: 'east', wallColor: 0x5c368f, roofColor: 0xe84855, trimColor: 0xffd147 },
    { id: 'gm-2', label: 'Chaat & Jalebi Pavilion', x: -13.5, z: -14.5, doorSide: 'south', wallColor: 0xf4a836, roofColor: 0xd93b44, trimColor: 0xfff2cc },
    { id: 'gm-3', label: 'Glass Bangle Emporium', x: 14.5, z: -14.5, doorSide: 'south', wallColor: 0x1ea896, roofColor: 0xf4b62c, trimColor: 0xff6e9c },
    { id: 'gm-4', label: '1995 Wooden Toy Bazaar', x: -13.5, z: 14.5, doorSide: 'north', wallColor: 0xe85a4a, roofColor: 0x2980b9, trimColor: 0xffd147 },
    { id: 'gm-5', label: 'Bioscope Cinema Hall', x: 14.5, z: 14.5, doorSide: 'north', wallColor: 0x2b6ba8, roofColor: 0xe85a2a, trimColor: 0xffe484 },
    { id: 'gm-6', label: 'Grand Mela Welcome Stage', x: 0, z: 24.5, doorSide: 'north', wallColor: 0xc93b5b, roofColor: 0xf4b62c, trimColor: 0xfff5d6 },
  ];

  for (const b of boothSpecs) {
    buildEnterableRoom(ctx, {
      id: b.id,
      label: b.label,
      x: b.x,
      z: b.z,
      width: 7.8,
      depth: 6.4,
      height: 3.5,
      doorSide: b.doorSide,
      doorWidth: 2.3,
      wallMaterial: new THREE.MeshStandardMaterial({ map: textures.wallCream, color: b.wallColor, roughness: 0.68 }),
      floorMaterial: floorMat,
      roofStyle: 'pitched',
      roofColor: b.roofColor,
      trimColor: b.trimColor,
      textures,
      minimapKind: 'shop',
    });
  }

  // Bouncing Pixar Helium Balloon Clusters around the Central Midway!
  const balloonCoords: Array<[number, number]> = [
    [-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2], [-9.0, 20.5], [9.0, 20.5],
  ];
  for (const [bx, bz] of balloonCoords) {
    const cart = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.85, 8),
      new THREE.MeshStandardMaterial({ color: 0x7d4c2c, roughness: 0.8 }),
    );
    cart.position.set(bx, 0.425, bz);
    cart.castShadow = true;
    ctx.group.add(cart);
    ctx.circles.push({ x: bx, z: bz, radius: 0.6, blocksSight: false });
    anim.addBalloonCluster(ctx.group, bx, 0.85, bz, [0xff4b6e, 0xffd147, 0x3bd4ff, 0x6ce87a, 0xc975ff]);
  }

  // Festive Glowing Marigold & Carnival String Lights criss-crossing the Midway!
  const festColors = [0xffde6a, 0xff5e7e, 0x54e3ff, 0xff943d, 0x8ef576];
  addGlowingStringLights(ctx, [-12, 4.8, -9], [12, 4.8, -9], 14, festColors);
  addGlowingStringLights(ctx, [-12, 4.8, 9], [12, 4.8, 9], 14, festColors);
  addGlowingStringLights(ctx, [-9, 4.8, -12], [-9, 4.8, 12], 14, festColors);
  addGlowingStringLights(ctx, [9, 4.8, -12], [9, 4.8, 12], 14, festColors);

  // Stacked Mela Prize Crates & Lit Fairground Trees
  addCrateStack(ctx, -6.5, -18.5, textures, 'Behind Mela Prize Crates');
  addCrateStack(ctx, 6.5, -18.5, textures, 'Behind Popcorn Carts');
  addCrateStack(ctx, -24.5, -8.5, textures, 'Behind Circus Props');
  addCrateStack(ctx, 24.5, 10.5, textures, 'Behind Lantern Boxes');

  const melaTrees: Array<[number, number]> = [
    [-25, -22], [25, -22], [-25, 22], [25, 22], [-28, 6], [28, -8],
  ];
  melaTrees.forEach(([tx, tz], i) => placePixarTree(ctx, tx, tz, 'banyan_lush', 1.15, i * 1.4, 'Behind Lit Fairground Tree'));

  addNaturalPerimeter(ctx, textures, 44.5, 34, [0x2c5234, 0x3b633c], 'trees');

  // Shimmering Carnival Sparks & Glowing Fairy Motes!
  anim.addAmbientParticles(ctx.group, {
    count: 75,
    areaRadius: 36,
    minY: 1.0,
    maxY: 12.0,
    color: 0xffd970,
    size: 0.085,
    fallSpeed: 0,
    swirlAmp: 1.6,
    glow: true,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -12),
    new THREE.Vector3(0, 0, 12),
    new THREE.Vector3(-9, 0, 0),
    new THREE.Vector3(9, 0, 0),
    new THREE.Vector3(-19, 0, -10),
    new THREE.Vector3(19, 0, -10),
    new THREE.Vector3(-19, 0, 10),
    new THREE.Vector3(19, 0, 10),
    new THREE.Vector3(0, 0, 19),
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
      groundTint: '#594235',
      roads: ctx.roads,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0, 0, 6.8],
      previewCamPos: [1.6, 1.9, 10.6],
      previewLookAt: [0.4, 1.2, 6.2],
      hiders: [
        [-4.5, 8.0, Math.PI],
        [4.5, -8.0, 0],
        [-10.5, -4.0, 1.5],
        [8.5, 9.0, -1.5],
      ],
      seeker: [0.0, 2.0, Math.PI],
    },
  };
}

/* ============================================================================
 * LEVEL 15: HIMALAYAN SNOW HAMLET (1990s Moonlit Manali / Spiti Winter Village)
 * Signature Pixar Animations:
 *  - Gentle 3D Drifting Snowflakes swirling through aurora-lit mountain air
 *  - Spinning Golden Monastery Prayer Wheels in the Carved Stupa Pavilion
 *  - Bouncing Friendly Pixar Snowmen (squash-and-stretch) + Cozy Hearth Chimney Smoke
 *  - Rippling Colorful Himalayan Prayer Flag Lines
 * ========================================================================== */
export function buildSnowHamletMap(textures: VillageTextureSet): VillageBuildResult {
  const ctx = createMapContext();
  const anim = new PixarAnimator();

  // Crisp moonlit snow blanket ground
  addGroundPlane(ctx, textures, 0xdfeefa, 135);

  // Shimmering Frozen Mountain Creek running East-West at z = 0 with 3 Wooden Bridges!
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0x62b9d9,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.14,
    metalness: 0.12,
    clearcoat: 1.0,
  });
  const creek = new THREE.Mesh(new THREE.PlaneGeometry(90, 6.8), iceMat);
  creek.rotation.x = -Math.PI / 2;
  creek.position.set(0, 0.04, 0);
  ctx.group.add(creek);
  ctx.pondWater = creek;
  ctx.waterRects.push({ x: 0, z: 0, width: 90, length: 6.8, rotY: 0 });

  // Solid icy creek colliders leaving 3 wide walkable timber bridges at x = -16, 0, +16
  for (const [xMin, xMax] of [[-45, -18.5], [-13.5, -2.5], [2.5, 13.5], [18.5, 45]]) {
    ctx.boxes.push({ minX: xMin, maxX: xMax, minZ: -3.2, maxZ: 3.2, blocksSight: false });
  }

  const cedarMat = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x634029, roughness: 0.84 });
  const snowCapMat = new THREE.MeshPhysicalMaterial({ color: 0xf4faff, roughness: 0.36, clearcoat: 0.3 });

  for (const bx of [-16, 0, 16]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 8.8), cedarMat);
    deck.position.set(bx, 0.1, 0);
    deck.receiveShadow = true;
    deck.castShadow = true;
    ctx.group.add(deck);
    for (const rx of [-2.15, 2.15]) {
      addVisualBox(ctx.group, bx + rx, 0.55, 0, 0.18, 0.85, 8.4, cedarMat);
    }
    ctx.buildings.push({ x: bx, z: 0, width: 4.6, depth: 8.8, rotY: 0, kind: 'bridge' });
    ctx.roads.push({ x: bx, z: 0, width: 4.4, length: 42, rotY: 0 });
  }

  // Packed-snow village lanes on North & South banks
  addRoadSegment(ctx, 0, -12.0, 4.0, 56, Math.PI / 2, textures, 0xcbdbe8);
  addRoadSegment(ctx, 0, 12.0, 4.0, 56, Math.PI / 2, textures, 0xcbdbe8);

  // Carved Himalayan Monastery Pavilion with 8 Spinning Golden Prayer Wheels (North-Center at 0, -22.5)!
  const monX = 0;
  const monZ = -22.5;
  const whiteStucco = new THREE.MeshStandardMaterial({ map: textures.wallCream, color: 0xf5f2eb, roughness: 0.72 });
  const maroonMat = new THREE.MeshStandardMaterial({ color: 0x8c2332, roughness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c249, roughness: 0.26, metalness: 0.82 });

  addSolidBox(ctx, monX, monZ, 9.4, 0.26, 6.2, whiteStucco, false, 0, { topY: 0.26, climbable: true });
  addSolidBox(ctx, monX, monZ - 1.2, 6.6, 3.8, 3.4, maroonMat, true, 0.26);
  const monRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4), goldMat);
  monRoof.rotation.y = Math.PI / 4;
  monRoof.position.set(monX, 5.1, monZ - 0.8);
  monRoof.castShadow = true;
  ctx.group.add(monRoof);
  ctx.buildings.push({ x: monX, z: monZ, width: 9.4, depth: 6.2, rotY: 0, kind: 'temple' });

  // 8 Spinning Golden Prayer Wheels along the Monastery South Front!
  const prayerWheels: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const wx = monX - 3.15 + i * 0.9;
    const wz = monZ + 1.0;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.65, 10), goldMat);
    wheel.position.set(wx, 1.35, wz);
    wheel.castShadow = true;
    ctx.group.add(wheel);
    prayerWheels.push(wheel);
  }
  anim.add((t) => {
    for (let i = 0; i < prayerWheels.length; i++) {
      prayerWheels[i].rotation.y = t * (2.6 + Math.sin(t * 0.7 + i) * 0.6) + i * 0.5;
    }
  });
  ctx.hidingSpots.push({ x: monX, z: monZ - 4.0, label: 'Behind Monastery Prayer Stupa', kind: 'gully' });

  // 6 Cozy Enterable Snow-Capped Himalayan Cedar Chalets with Puffing Chimneys!
  const stoneWall = new THREE.MeshStandardMaterial({ map: textures.templeStone, color: 0xb5bcc4, roughness: 0.84 });
  const warmFloor = new THREE.MeshStandardMaterial({ map: textures.wood, color: 0x734b2f, roughness: 0.85 });
  const chalets: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    doorSide: 'south' | 'north' | 'east' | 'west';
  }> = [
    { id: 'sh-1', label: 'Warm Hearth Bakery', x: -16.5, z: -19.5, doorSide: 'south' },
    { id: 'sh-2', label: 'Wool Shawl Weaver Lodge', x: 16.5, z: -19.5, doorSide: 'south' },
    { id: 'sh-3', label: 'Deodar Woodcutter Cabin', x: -24.5, z: 12.0, doorSide: 'east' },
    { id: 'sh-4', label: 'Mountain Post Office', x: 24.5, z: 12.0, doorSide: 'west' },
    { id: 'sh-5', label: 'Snowy Apple Cider Inn', x: -10.0, z: 21.5, doorSide: 'north' },
    { id: 'sh-6', label: 'Spiti Stargazer Cabin', x: 10.0, z: 21.5, doorSide: 'north' },
  ];

  for (let i = 0; i < chalets.length; i++) {
    const ch = chalets[i];
    buildEnterableRoom(ctx, {
      id: ch.id,
      label: ch.label,
      x: ch.x,
      z: ch.z,
      width: 7.4,
      depth: 6.2,
      height: 3.3,
      doorSide: ch.doorSide,
      doorWidth: 2.1,
      wallMaterial: i % 2 === 0 ? cedarMat : stoneWall,
      floorMaterial: warmFloor,
      roofStyle: 'pitched',
      roofColor: 0xeef7ff,
      trimColor: 0x8c2332,
      textures,
      minimapKind: 'house',
      addInteriorProps: (g) => {
        // Warm glowing hearth inside each chalet!
        const hearth = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffa43b }),
        );
        hearth.position.set(0, 0.55, -2.3);
        g.add(hearth);
      },
    });
    // Stone chimney + curling cozy hearth smoke
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.5, 0.75), stoneWall);
    chim.position.set(ch.x + 2.0, 4.6, ch.z - 1.3);
    ctx.group.add(chim);
    anim.addSteamPlume(ctx.group, { x: ch.x + 2.0, y: 5.45, z: ch.z - 1.3 }, {
      count: 6,
      color: 0xe8f2ff,
      riseHeight: 3.8,
      speed: 0.34,
      baseRadius: 0.24,
    });
  }

  // Friendly Pixar Bouncing Snowmen (Squash-and-Stretch!) with Orange Carrot Noses & Scarves!
  const snowmenCoords: Array<[number, number, number]> = [
    [-6.5, 7.5, 0.4],
    [6.5, 7.5, -0.5],
    [-6.5, -7.5, 2.6],
    [6.5, -7.5, -2.4],
  ];
  const scarfColors = [0xd93b44, 0x2980b9, 0xf2a93b, 0x2fb38b];
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf26c24, roughness: 0.45 });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.6 });

  snowmenCoords.forEach(([sx, sz, rot], idx) => {
    const sm = new THREE.Group();
    sm.position.set(sx, 0, sz);
    sm.rotation.y = rot;
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), snowCapMat);
    bot.position.y = 0.54;
    bot.castShadow = true;
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.42, 11, 9), snowCapMat);
    mid.position.y = 1.3;
    mid.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), snowCapMat);
    head.position.y = 1.88;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), carrotMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.86, 0.34);
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.075, 6, 14),
      new THREE.MeshStandardMaterial({ color: scarfColors[idx % scarfColors.length], roughness: 0.7 }),
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.62;
    for (const ex of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), coalMat);
      eye.position.set(ex, 1.94, 0.24);
      sm.add(eye);
    }
    sm.add(bot, mid, head, nose, scarf);
    ctx.group.add(sm);
    ctx.circles.push({ x: sx, z: sz, radius: 0.72, blocksSight: false });
    anim.addSquashBob(sm, { baseY: 0, bobAmp: 0.09, squashAmp: 0.06, speed: 2.6, phase: idx * 1.4, tiltAmp: 0.05 });
  });

  // Colorful Himalayan Prayer Flag Lines crossing the bridges & plaza!
  const prayerColors = [0x2978d4, 0xf7f7f7, 0xd93b34, 0x2ca04c, 0xf4c430];
  addGlowingStringLights(ctx, [-14, 4.6, -6], [14, 4.6, -6], 15, prayerColors);
  addGlowingStringLights(ctx, [-14, 4.6, 6], [14, 4.6, 6], 15, prayerColors);

  // Snow-Laden Deodar Pine Forest & Stacked Firewood Crates
  const deodars: Array<[number, number]> = [
    [-25, -24], [25, -24], [-26, -8], [26, -8], [-22, 24], [22, 24], [0, 27], [-8, -28], [8, -28],
  ];
  deodars.forEach(([tx, tz], i) => placePixarTree(ctx, tx, tz, 'deodar_snow', 1.25, i * 1.7, 'Under Snow-Laden Deodar'));
  addCrateStack(ctx, -11.5, -7.5, textures, 'Behind Stacked Firewood');
  addCrateStack(ctx, 11.5, 7.5, textures, 'Behind Snow Sleds');

  addNaturalPerimeter(ctx, textures, 44.5, 38, [0x244f42, 0x2e6353, 0xdff2ff], 'trees');

  // Magical 3D Drifting Snowflakes swirling across the entire Snow Hamlet!
  anim.addAmbientParticles(ctx.group, {
    count: 110,
    areaRadius: 40,
    minY: 0.2,
    maxY: 14.0,
    color: 0xffffff,
    size: 0.095,
    fallSpeed: 1.15,
    swirlAmp: 1.5,
  });

  ctx.patrolPoints.push(
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(-16, 0, -10),
    new THREE.Vector3(16, 0, -10),
    new THREE.Vector3(-16, 0, 10),
    new THREE.Vector3(16, 0, 10),
    new THREE.Vector3(-16, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(16, 0, 0),
  );

  return {
    group: ctx.group,
    colliders: { boxes: ctx.boxes, circles: ctx.circles, worldRadius: 42.5 },
    swayFoliage: ctx.swayFoliage,
    patrolPoints: ctx.patrolPoints,
    hidingSpots: ctx.hidingSpots,
    houseInteriors: ctx.houseInteriors,
    pondWater: creek,
    animate: (elapsed, dt) => anim.update(elapsed, dt),
    minimapLayout: {
      worldRadius: 42.5,
      groundTint: '#b8d1e3',
      roads: ctx.roads,
      waterRects: ctx.waterRects,
      buildings: ctx.buildings,
      landmarks: ctx.landmarks,
    },
    spawnPoints: {
      previewPos: [0, 0, 9.2],
      previewCamPos: [1.5, 1.85, 13.0],
      previewLookAt: [0.4, 1.1, 8.6],
      hiders: [
        [-4.5, 11.5, Math.PI],
        [4.5, -11.5, 0],
        [-16.0, 9.0, 1.5],
        [16.0, -9.0, -1.5],
      ],
      seeker: [0.0, 12.0, Math.PI],
    },
  };
}

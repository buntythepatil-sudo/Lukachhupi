import * as THREE from 'three';
import { VillageTextureSet } from './textures';
import {
  BoxCollider,
  CircleCollider,
  HidingSpot,
  HouseInterior,
} from './types';

export interface LandmarkBuild {
  group: THREE.Group;
  boxes: BoxCollider[];
  circles: CircleCollider[];
  hidingSpots: HidingSpot[];
  interiors?: HouseInterior[];
  swayObjects?: THREE.Object3D[];
  waterMesh?: THREE.Mesh;
}

/**
 * 1990s woven jute charpai (khatiya)
 */
export function buildCharpai(
  x: number,
  z: number,
  rotationY: number,
  textures: VillageTextureSet,
  withRadio = false,
): { group: THREE.Group; collider: BoxCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.78,
  });
  const weaveMat = new THREE.MeshStandardMaterial({
    map: textures.charpaiWeave,
    roughness: 0.92,
  });

  const length = 1.9;
  const width = 1.05;
  const legH = 0.5;

  // 4 turned legs
  const legGeo = new THREE.CylinderGeometry(0.042, 0.036, legH, 8);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(sx * (width * 0.46), legH * 0.5, sz * (length * 0.46));
      leg.castShadow = true;
      group.add(leg);
    }
  }

  // Side rails
  const sideRailGeo = new THREE.CylinderGeometry(0.036, 0.036, length, 8);
  sideRailGeo.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(sideRailGeo, woodMat);
    rail.position.set(sx * (width * 0.46), legH - 0.04, 0);
    rail.castShadow = true;
    group.add(rail);
  }

  // End rails
  const endRailGeo = new THREE.CylinderGeometry(0.036, 0.036, width, 8);
  endRailGeo.rotateZ(Math.PI / 2);
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(endRailGeo, woodMat);
    rail.position.set(0, legH - 0.04, sz * (length * 0.46));
    rail.castShadow = true;
    group.add(rail);
  }

  // Woven rope bed surface
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.08, 0.05, length - 0.08),
    weaveMat,
  );
  mat.position.y = legH - 0.02;
  mat.castShadow = true;
  mat.receiveShadow = true;
  group.add(mat);

  if (withRadio) {
    const radio = buildVintageRadio(textures);
    radio.position.set(0.12, legH + 0.01, -0.45);
    radio.rotation.y = 0.35;
    group.add(radio);
  }

  const isRot90 = Math.abs(Math.sin(rotationY)) > 0.7;
  const halfX = (isRot90 ? length : width) * 0.5;
  const halfZ = (isRot90 ? width : length) * 0.5;

  return {
    group,
    collider: {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      blocksSight: false,
      topY: 0.52,
      climbable: true,
    },
  };
}

/**
 * Vintage 1990s Indian transistor radio (Vividh Bharati era)
 */
export function buildVintageRadio(textures: VillageTextureSet): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3b261b,
    roughness: 0.58,
    metalness: 0.08,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: textures.radioFace,
    roughness: 0.45,
    metalness: 0.12,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd0d4d8,
    roughness: 0.22,
    metalness: 0.9,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.14), bodyMat);
  body.position.y = 0.12;
  body.castShadow = true;
  group.add(body);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), faceMat);
  face.position.set(0, 0.12, 0.072);
  group.add(face);

  // Top carrying handle
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.012, 6, 12, Math.PI),
    chromeMat,
  );
  handle.position.set(0, 0.24, 0);
  group.add(handle);

  // Extended chrome telescopic antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.008, 0.46, 6),
    chromeMat,
  );
  antenna.position.set(0.16, 0.44, -0.02);
  antenna.rotation.z = -0.22;
  group.add(antenna);

  return group;
}

/**
 * Classic 1990s Indian steel bicycle (Hero / Atlas style)
 */
export function buildBicycle(
  x: number,
  z: number,
  rotationY: number,
  frameColor = 0x1c2124,
): { group: THREE.Group; collider: CircleCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;
  group.rotation.z = 0.12; // Slightly leaned on its kickstand

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1d1d1f,
    roughness: 0.88,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.36,
    metalness: 0.72,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcfd4d9,
    roughness: 0.22,
    metalness: 0.92,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x56321c,
    roughness: 0.65,
  });

  const wheelRadius = 0.36;
  const wheelGeo = new THREE.TorusGeometry(wheelRadius, 0.032, 8, 20);
  const rimGeo = new THREE.TorusGeometry(wheelRadius - 0.035, 0.012, 6, 18);

  for (const wz of [-0.56, 0.56]) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, wheelRadius, wz);
    wheelGroup.rotation.y = Math.PI / 2;

    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8),
      chromeMat,
    );
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(tire, rim, hub);

    // Spokes
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, wheelRadius * 1.85, 4),
        chromeMat,
      );
      spoke.rotation.z = (s * Math.PI) / 4;
      wheelGroup.add(spoke);
    }

    group.add(wheelGroup);
  }

  // Tubular steel diamond frame
  const addTube = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    mat: THREE.Material,
  ) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, len, 6),
      mat,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    mesh.castShadow = true;
    group.add(mesh);
  };

  const rearHub = new THREE.Vector3(0, wheelRadius, -0.56);
  const frontHub = new THREE.Vector3(0, wheelRadius, 0.56);
  const crank = new THREE.Vector3(0, 0.34, -0.08);
  const seatTop = new THREE.Vector3(0, 0.86, -0.2);
  const headTop = new THREE.Vector3(0, 0.9, 0.42);
  const headBot = new THREE.Vector3(0, 0.72, 0.46);

  addTube(rearHub, crank, 0.018, frameMat);
  addTube(rearHub, seatTop, 0.018, frameMat);
  addTube(crank, seatTop, 0.02, frameMat);
  addTube(seatTop, headTop, 0.02, frameMat);
  addTube(crank, headBot, 0.02, frameMat);
  addTube(headTop, frontHub, 0.018, frameMat);

  // Curved handlebars
  const stem = new THREE.Vector3(0, 1.02, 0.4);
  addTube(headTop, stem, 0.018, chromeMat);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.56, 8),
    chromeMat,
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.02, 0.38);
  group.add(bar);

  // Leather saddle
  const saddle = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.06, 0.26),
    leatherMat,
  );
  saddle.position.set(0, 0.92, -0.22);
  saddle.castShadow = true;
  group.add(saddle);

  // Classic Indian bicycle rear steel luggage carrier
  const carrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.025, 0.44),
    frameMat,
  );
  carrier.position.set(0, 0.76, -0.56);
  carrier.castShadow = true;
  group.add(carrier);

  return {
    group,
    collider: {
      x,
      z,
      radius: 0.78,
      blocksSight: false,
      topY: 0.92,
      climbable: true,
    },
  };
}

/**
 * Large spreading Banyan Tree (Bargad) with walk-around aerial roots & hiding pockets
 */
export function buildBanyanTree(
  x: number,
  z: number,
  textures: VillageTextureSet,
): {
  group: THREE.Group;
  foliage: THREE.Group;
  circles: CircleCollider[];
  hidingSpots: HidingSpot[];
} {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    roughness: 0.95,
  });
  const chabutraBrickMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    roughness: 0.88,
  });
  const chabutraTopMat = new THREE.MeshStandardMaterial({
    color: 0xd5b181,
    roughness: 0.9,
  });

  // Raised circular brick chaupal bench around central trunk
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.55, 0.44, 18),
    chabutraBrickMat,
  );
  base.position.y = 0.22;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(2.44, 2.44, 0.08, 18),
    chabutraTopMat,
  );
  cap.position.y = 0.46;
  cap.receiveShadow = true;
  group.add(cap);

  // Massive gnarled main banyan trunk
  const mainTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 1.08, 4.4, 11),
    barkMat,
  );
  mainTrunk.position.y = 2.4;
  mainTrunk.castShadow = true;
  mainTrunk.receiveShadow = true;
  group.add(mainTrunk);

  // Buttress roots flaring onto the chabutra
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const buttress = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.34, 1.7, 7),
      barkMat,
    );
    buttress.position.set(Math.cos(a) * 0.78, 1.0, Math.sin(a) * 0.78);
    buttress.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    buttress.castShadow = true;
    group.add(buttress);
  }

  // Spreading boughs + iconic hanging aerial prop roots forming natural hiding nooks!
  const circles: CircleCollider[] = [
    { x, z, radius: 2.38, blocksSight: true },
  ];
  const hidingSpots: HidingSpot[] = [];

  const boughAngles = [0.25, 1.45, 2.65, 3.85, 5.05];
  for (let i = 0; i < boughAngles.length; i++) {
    const ang = boughAngles[i];
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    // Wide horizontal limb
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.32, 4.4, 8),
      barkMat,
    );
    limb.position.set(cos * 2.1, 4.35, sin * 2.1);
    limb.rotation.z = -cos * 1.15;
    limb.rotation.x = sin * 1.15;
    limb.castShadow = true;
    group.add(limb);

    // Thick grounded aerial prop-root column forming an outer hiding pillar
    const rootDist = 3.55 + (i % 2) * 0.45;
    const rx = cos * rootDist;
    const rz = sin * rootDist;

    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rx * 0.88, 4.5, rz * 0.88),
      new THREE.Vector3(rx * 0.98, 2.4, rz * 0.98),
      new THREE.Vector3(rx, 0, rz),
    ]);
    const propRoot = new THREE.Mesh(
      new THREE.TubeGeometry(rootCurve, 10, 0.21, 7, false),
      barkMat,
    );
    propRoot.castShadow = true;
    propRoot.receiveShadow = true;
    group.add(propRoot);

    // Thinner companion aerial vine hanging beside it
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 3.8, 6),
      barkMat,
    );
    vine.position.set(rx + sin * 0.34, 2.2, rz - cos * 0.34);
    group.add(vine);

    circles.push({
      x: x + rx,
      z: z + rz,
      radius: 0.35,
      blocksSight: true,
    });

    // Tucked hiding spot nestled between the aerial root and central chabutra
    if (i % 2 === 0) {
      hidingSpots.push({
        x: x + cos * 3.05,
        z: z + sin * 3.05,
        label: 'Under the Banyan Tree Roots',
        kind: 'tree',
      });
    }
  }

  // Expansive lush sunlit Banyan canopy
  const foliage = new THREE.Group();
  foliage.position.set(0, 5.2, 0);
  const baseLeaf = new THREE.Color(0x3a6f30);

  const canopyClusters = [
    { x: 0, y: 1.1, z: 0, r: 3.1, l: 0.04 },
    { x: 2.7, y: 0.3, z: 1.2, r: 2.5, l: 0.01 },
    { x: -2.6, y: 0.35, z: 1.5, r: 2.6, l: -0.02 },
    { x: 1.4, y: 0.2, z: -2.7, r: 2.55, l: -0.03 },
    { x: -2.1, y: 0.25, z: -2.3, r: 2.45, l: 0.02 },
    { x: 0.1, y: 0.1, z: 2.8, r: 2.35, l: 0.03 },
  ];

  for (const c of canopyClusters) {
    const leafMat = new THREE.MeshStandardMaterial({
      color: baseLeaf.clone().offsetHSL(0, 0, c.l),
      roughness: 0.86,
      flatShading: true,
    });
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 1), leafMat);
    puff.position.set(c.x, c.y, c.z);
    puff.scale.set(1.22, 0.72, 1.18);
    puff.castShadow = true;
    puff.receiveShadow = true;
    foliage.add(puff);
  }

  group.add(foliage);

  return { group, foliage, circles, hidingSpots };
}

/**
 * Village Primary School (Prathmik Vidyalaya) with 2 walkable classrooms,
 * blackboards, benches, veranda, signboard, and fadeable roof!
 */
export function buildSchoolBuilding(
  x: number,
  z: number,
  textures: VillageTextureSet,
): LandmarkBuild {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const width = 12.6;
  const depth = 6.2;
  const height = 3.5;
  const wallThick = 0.3;
  const plinthH = 0.18;
  const doorW = 1.55;
  const doorH = 2.2;

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.schoolWall,
    roughness: 0.88,
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xa69682,
    roughness: 0.9,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x9c8f7e,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    roughness: 0.78,
    transparent: false,
    opacity: 1,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.8,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x26486b,
    roughness: 0.65,
  });
  const boardMat = new THREE.MeshStandardMaterial({
    map: textures.blackboard,
    roughness: 0.85,
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: textures.schoolSign,
    roughness: 0.62,
  });

  // Raised concrete school veranda & plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.8, plinthH, depth + 2.2),
    plinthMat,
  );
  plinth.position.set(0, plinthH * 0.5, 0.8);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.5, depth - 0.5),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, plinthH + 0.015, 0);
  floor.receiveShadow = true;
  group.add(floor);

  const wallY = plinthH + height * 0.5;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  // Back, left, right, and center partition wall between Classroom A & Classroom B
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wallThick),
    wallMat,
  );
  backWall.position.set(0, wallY, -halfD + wallThick * 0.5);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, height, depth - wallThick * 2),
    wallMat,
  );
  leftWall.position.set(-halfW + wallThick * 0.5, wallY, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, height, depth - wallThick * 2),
    wallMat,
  );
  rightWall.position.set(halfW - wallThick * 0.5, wallY, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const dividerWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, height, depth - wallThick * 2),
    wallMat,
  );
  dividerWall.position.set(0, wallY, 0);
  dividerWall.castShadow = true;
  dividerWall.receiveShadow = true;
  group.add(dividerWall);

  // Front wall (+Z) with 2 open classroom doorways centered at x = -3.15 and x = +3.15
  const frontZ = halfD - wallThick * 0.5;
  const doorCenters = [-3.15, 3.15];
  const segments: Array<[number, number]> = [
    [-halfW, doorCenters[0] - doorW * 0.5],
    [doorCenters[0] + doorW * 0.5, doorCenters[1] - doorW * 0.5],
    [doorCenters[1] + doorW * 0.5, halfW],
  ];

  const boxes: BoxCollider[] = [
    // Back wall
    {
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z - halfD + wallThick,
      blocksSight: true,
    },
    // Left wall
    {
      minX: x - halfW,
      maxX: x - halfW + wallThick,
      minZ: z - halfD,
      maxZ: z + halfD,
      blocksSight: true,
    },
    // Right wall
    {
      minX: x + halfW - wallThick,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD,
      blocksSight: true,
    },
    // Interior classroom divider wall
    {
      minX: x - wallThick * 0.5,
      maxX: x + wallThick * 0.5,
      minZ: z - halfD,
      maxZ: z + halfD,
      blocksSight: true,
    },
  ];

  for (const [x1, x2] of segments) {
    const segW = x2 - x1;
    const cx = (x1 + x2) * 0.5;
    const wallSeg = new THREE.Mesh(
      new THREE.BoxGeometry(segW, height, wallThick),
      wallMat,
    );
    wallSeg.position.set(cx, wallY, frontZ);
    wallSeg.castShadow = true;
    wallSeg.receiveShadow = true;
    group.add(wallSeg);

    boxes.push({
      minX: x + x1,
      maxX: x + x2,
      minZ: z + frontZ - wallThick * 0.5,
      maxZ: z + frontZ + wallThick * 0.5,
      blocksSight: true,
    });
  }

  // Door lintels & headers over both classroom entrances
  const headerH = height - doorH;
  for (const dcx of doorCenters) {
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, headerH, wallThick),
      wallMat,
    );
    header.position.set(dcx, plinthH + doorH + headerH * 0.5, frontZ);
    group.add(header);

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.24, 0.14, wallThick + 0.08),
      trimMat,
    );
    lintel.position.set(dcx, plinthH + doorH + 0.04, frontZ);
    group.add(lintel);
  }

  // Classroom interiors: Blackboards, teacher desks, wooden student benches & a vintage radio!
  const benchGeo = new THREE.BoxGeometry(1.65, 0.58, 0.52);
  const deskGeo = new THREE.BoxGeometry(1.3, 0.76, 0.65);

  for (const roomCenter of [-3.15, 3.15]) {
    // Blackboard on back wall
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.35, 0.06), boardMat);
    board.position.set(roomCenter, plinthH + 1.85, -halfD + wallThick + 0.05);
    group.add(board);

    // Teacher's wooden table near blackboard
    const teacherDesk = new THREE.Mesh(deskGeo, woodMat);
    teacherDesk.position.set(roomCenter + 1.25, plinthH + 0.38, -1.65);
    teacherDesk.castShadow = true;
    group.add(teacherDesk);

    // Two rows of student wooden benches (great visual atmosphere, low enough to weave around)
    for (const rowZ of [0.1, 1.25]) {
      const bench = new THREE.Mesh(benchGeo, woodMat);
      bench.position.set(roomCenter - 1.15, plinthH + 0.29, rowZ);
      bench.castShadow = true;
      group.add(bench);
    }
  }

  // Vintage radio resting on right classroom teacher's desk
  const schoolRadio = buildVintageRadio(textures);
  schoolRadio.position.set(3.15 + 1.25, plinthH + 0.76, -1.65);
  schoolRadio.rotation.y = 0.25;
  group.add(schoolRadio);

  // Pillared front school veranda + School Signboard ("PRATHMIK VIDYALAYA")
  const pillarGeo = new THREE.BoxGeometry(0.24, height - 0.1, 0.24);
  const circles: CircleCollider[] = [];
  for (const px of [-5.8, -1.8, 1.8, 5.8]) {
    const pillar = new THREE.Mesh(pillarGeo, wallMat);
    pillar.position.set(px, plinthH + (height - 0.1) * 0.5, halfD + 1.55);
    pillar.castShadow = true;
    group.add(pillar);
    circles.push({ x: x + px, z: z + halfD + 1.55, radius: 0.22, blocksSight: false });
  }

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.1, 0.12),
    signMat,
  );
  signBoard.position.set(0, plinthH + height + 0.58, halfD + 1.58);
  signBoard.castShadow = true;
  group.add(signBoard);

  // Sloped school roof (tracked so roof fades cleanly when player walks into either classroom!)
  const roofMeshes: THREE.Mesh[] = [];
  const mainRoof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 1.2, 0.24, depth + 2.9),
    roofMat,
  );
  mainRoof.position.set(0, plinthH + height + 0.24, 0.75);
  mainRoof.rotation.x = 0.08;
  mainRoof.castShadow = true;
  mainRoof.receiveShadow = true;
  group.add(mainRoof);
  roofMeshes.push(mainRoof);

  // School bell / flagpole outside left corner
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc0,
    roughness: 0.35,
    metalness: 0.85,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 5.2, 8), poleMat);
  pole.position.set(-halfW - 1.4, 2.6, halfD + 2.2);
  pole.castShadow = true;
  group.add(pole);

  const interiors: HouseInterior[] = [
    {
      id: 'school-room-a',
      label: 'School Classroom A',
      minX: x - halfW + wallThick,
      maxX: x - wallThick * 0.5,
      minZ: z - halfD + wallThick,
      maxZ: z + halfD - wallThick,
      doorX: x - 3.15,
      doorZ: z + halfD + 1.25,
      insideX: x - 3.15,
      insideZ: z - 1.1,
      roofMeshes,
    },
    {
      id: 'school-room-b',
      label: 'School Classroom B',
      minX: x + wallThick * 0.5,
      maxX: x + halfW - wallThick,
      minZ: z - halfD + wallThick,
      maxZ: z + halfD - wallThick,
      doorX: x + 3.15,
      doorZ: z + halfD + 1.25,
      insideX: x + 3.15,
      insideZ: z - 1.1,
      roofMeshes,
    },
  ];

  const hidingSpots: HidingSpot[] = [
    {
      x: x - 4.4,
      z: z - 1.5,
      label: 'Inside School Classroom A',
      kind: 'house',
    },
    {
      x: x + 4.4,
      z: z - 1.5,
      label: 'Inside School Classroom B',
      kind: 'house',
    },
  ];

  return { group, boxes, circles, hidingSpots, interiors };
}

/**
 * Village Temple (Mandir) with stepped plinth, carved sanctum, shikhara spire,
 * brass bell, saffron flag, and glowing warm diya light!
 */
export function buildVillageTemple(
  x: number,
  z: number,
  textures: VillageTextureSet,
): LandmarkBuild {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.templeStone,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.035,
    roughness: 0.82,
  });
  const saffronMat = new THREE.MeshStandardMaterial({
    color: 0xd96126,
    roughness: 0.65,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xf2dfc0,
    roughness: 0.78,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd8a842,
    roughness: 0.28,
    metalness: 0.85,
  });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc75f });

  // Stepped temple platform (jagati)
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.28, 8.2), stoneMat);
  step1.position.set(0, 0.14, 0.4);
  step1.receiveShadow = true;
  step1.castShadow = true;
  group.add(step1);

  const step2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 7.0), creamMat);
  step2.position.set(0, 0.4, 0.3);
  step2.receiveShadow = true;
  group.add(step2);

  // Sanctum (garbhagriha)
  const sanctumW = 4.6;
  const sanctumD = 4.4;
  const sanctumH = 3.2;
  const sanctum = new THREE.Mesh(
    new THREE.BoxGeometry(sanctumW, sanctumH, sanctumD),
    stoneMat,
  );
  sanctum.position.set(0, 0.52 + sanctumH * 0.5, -0.6);
  sanctum.castShadow = true;
  sanctum.receiveShadow = true;
  group.add(sanctum);

  // Recessed arched sanctum doorway & glowing inner diya lamp
  const doorArch = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.2, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x3b2214, roughness: 0.92 }),
  );
  doorArch.position.set(0, 0.52 + 1.1, 1.56);
  group.add(doorArch);

  const diyaFlame = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), flameMat);
  diyaFlame.position.set(0, 1.15, 1.72);
  group.add(diyaFlame);

  const diyaLight = new THREE.PointLight(0xffa748, 2.4, 9, 2);
  diyaLight.position.set(0, 1.7, 2.1);
  diyaLight.userData.optionalPointLight = true;
  group.add(diyaLight);

  // Tiered Shikhara spire
  const tier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 2.55, 1.65, 4),
    saffronMat,
  );
  tier1.rotation.y = Math.PI / 4;
  tier1.position.set(0, 4.52, -0.6);
  tier1.castShadow = true;
  group.add(tier1);

  const tier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.58, 1.55, 4),
    creamMat,
  );
  tier2.rotation.y = Math.PI / 4;
  tier2.position.set(0, 6.08, -0.6);
  tier2.castShadow = true;
  group.add(tier2);

  const tier3 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.88, 1.25, 4),
    saffronMat,
  );
  tier3.rotation.y = Math.PI / 4;
  tier3.position.set(0, 7.45, -0.6);
  tier3.castShadow = true;
  group.add(tier3);

  // Amalaka ring + Brass Kalash finial
  const amalaka = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.14, 8, 16),
    brassMat,
  );
  amalaka.rotation.x = Math.PI / 2;
  amalaka.position.set(0, 8.15, -0.6);
  group.add(amalaka);

  const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), brassMat);
  kalash.position.set(0, 8.48, -0.6);
  group.add(kalash);

  // Saffron Temple Flag (Dhwaja) waving at peak
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 1.65, 6),
    brassMat,
  );
  flagPole.position.set(0, 9.3, -0.6);
  group.add(flagPole);

  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(1.25, 0.25);
  flagShape.lineTo(0, 0.56);
  flagShape.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    new THREE.MeshStandardMaterial({
      color: 0xe85a1c,
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(0.02, 9.5, -0.6);
  group.add(flag);

  // Open front pillared porch (mandapa) + hanging brass temple bell
  const porchPillars = [
    [-1.75, 3.1],
    [1.75, 3.1],
  ];
  for (const [px, pz] of porchPillars) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 2.7, 10),
      creamMat,
    );
    pillar.position.set(px, 0.52 + 1.35, pz);
    pillar.castShadow = true;
    group.add(pillar);
  }

  const porchRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.28, 2.1),
    saffronMat,
  );
  porchRoof.position.set(0, 3.35, 2.45);
  porchRoof.castShadow = true;
  group.add(porchRoof);

  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.34, 10),
    brassMat,
  );
  bell.position.set(0, 2.78, 2.7);
  group.add(bell);

  const boxes: BoxCollider[] = [
    {
      minX: x - sanctumW * 0.5 - 0.15,
      maxX: x + sanctumW * 0.5 + 0.15,
      minZ: z - 0.6 - sanctumD * 0.5 - 0.15,
      maxZ: z - 0.6 + sanctumD * 0.5 + 0.15,
      blocksSight: true,
    },
  ];
  const circles: CircleCollider[] = [
    { x: x - 1.75, z: z + 3.1, radius: 0.28, blocksSight: false },
    { x: x + 1.75, z: z + 3.1, radius: 0.28, blocksSight: false },
  ];
  const hidingSpots: HidingSpot[] = [
    {
      x,
      z: z - 4.1,
      label: 'Behind the Village Temple',
      kind: 'gully',
    },
  ];

  return { group, boxes, circles, hidingSpots, swayObjects: [flag] };
}

/**
 * Small 1990s Village Market (Haat / Bazaar) with 3 stalls:
 * Chai Tapri (with old radio), Sabzi & Grain Stall (with burlap sacks), and Kirana Store
 */
export function buildVillageMarket(
  x: number,
  z: number,
  textures: VillageTextureSet,
): LandmarkBuild {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.025,
    roughness: 0.82,
  });
  const awningMat = new THREE.MeshStandardMaterial({
    map: textures.awning,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const tealAwningMat = new THREE.MeshStandardMaterial({
    color: 0x2a696c,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const sackMat = new THREE.MeshStandardMaterial({
    color: 0xb99463,
    roughness: 0.95,
  });

  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];
  const hidingSpots: HidingSpot[] = [];

  const stallConfigs = [
    { ox: 0, oz: -5.2, rotY: -Math.PI / 2, awning: awningMat, label: 'Chai Tapri', hasRadio: true },
    { ox: 0.4, oz: 0.8, rotY: -Math.PI / 2, awning: tealAwningMat, label: 'Sabzi & Grain Stall', hasRadio: false },
    { ox: 0, oz: 6.8, rotY: -Math.PI / 2, awning: awningMat, label: 'Kirana General Store', hasRadio: false },
  ];

  for (let i = 0; i < stallConfigs.length; i++) {
    const s = stallConfigs[i];
    const stall = new THREE.Group();
    stall.position.set(s.ox, 0, s.oz);
    stall.rotation.y = s.rotY;

    const w = 3.8;
    const d = 2.1;

    // 4 bamboo/wood corner posts
    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 2.5, 7);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(sx * (w * 0.46), 1.25, sz * (d * 0.46));
        post.castShadow = true;
        stall.add(post);
      }
    }

    // Sloped market cloth awning canopy
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.08, d + 0.8),
      s.awning,
    );
    canopy.position.set(0, 2.52, 0.1);
    canopy.rotation.x = 0.14;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    stall.add(canopy);

    // Wooden stall counter & back board
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.15, 0.92, 0.85),
      woodMat,
    );
    counter.position.set(0, 0.46, 0.48);
    counter.castShadow = true;
    counter.receiveShadow = true;
    stall.add(counter);

    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.15, 1.55, 0.12),
      woodMat,
    );
    backPanel.position.set(0, 0.78, -d * 0.45);
    backPanel.castShadow = true;
    stall.add(backPanel);

    // Goods on counter
    if (s.hasRadio) {
      const radio = buildVintageRadio(textures);
      radio.position.set(1.0, 0.92, 0.45);
      radio.rotation.y = -0.3;
      stall.add(radio);

      // Warm hanging lantern at the Chai Tapri
      const lantern = new THREE.PointLight(0xffb55c, 1.8, 8, 2);
      lantern.position.set(0, 2.1, 0.55);
      lantern.userData.optionalPointLight = true;
      stall.add(lantern);

      // Brass chai kettle & earthen kulhads
      const kettle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 0.24, 10),
        new THREE.MeshStandardMaterial({ color: 0xb78b46, roughness: 0.35, metalness: 0.75 }),
      );
      kettle.position.set(-0.65, 1.04, 0.48);
      stall.add(kettle);
    } else {
      // Colorful produce baskets & grain crates
      const basketColors = [0xd67c2b, 0x4e8537, 0xc73e2c];
      for (let b = 0; b < 3; b++) {
        const basket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.22, 0.24, 10),
          sackMat,
        );
        basket.position.set(-1.05 + b * 1.05, 1.04, 0.46);
        stall.add(basket);

        const produce = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 8, 6),
          new THREE.MeshStandardMaterial({
            color: basketColors[(b + i) % basketColors.length],
            roughness: 0.78,
          }),
        );
        produce.scale.set(1, 0.55, 1);
        produce.position.set(-1.05 + b * 1.05, 1.16, 0.46);
        stall.add(produce);
      }
    }

    // Stacked burlap grain sacks beside stall for crouch cover
    for (let k = 0; k < 2; k++) {
      const sack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.36, 0.72, 10),
        sackMat,
      );
      sack.position.set(-w * 0.5 - 0.36, 0.36, -0.3 + k * 0.68);
      sack.castShadow = true;
      stall.add(sack);
    }

    group.add(stall);

    // Rotated -90deg around Y: stall spans depth along X, width along Z
    boxes.push({
      minX: x + s.ox - d * 0.5,
      maxX: x + s.ox + d * 0.5,
      minZ: z + s.oz - w * 0.5,
      maxZ: z + s.oz + w * 0.5,
      blocksSight: true,
    });

    // Secret hiding nook right behind the market stalls
    hidingSpots.push({
      x: x + s.ox + 2.0,
      z: z + s.oz,
      label: `Behind the ${s.label}`,
      kind: 'gully',
    });
  }

  return { group, boxes, circles, hidingSpots };
}

/**
 * Traditional Wooden Bullock Cart (Bailgadi) with spoked wheels & hay bales
 */
export function buildBullockCart(
  x: number,
  z: number,
  rotationY: number,
  textures: VillageTextureSet,
): { group: THREE.Group; collider: BoxCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.85,
  });
  const ironRimMat = new THREE.MeshStandardMaterial({
    color: 0x3f4144,
    roughness: 0.48,
    metalness: 0.75,
  });
  const hayMat = new THREE.MeshStandardMaterial({
    map: textures.thatchRoof,
    roughness: 0.96,
  });

  const wheelR = 0.74;
  // Two large spoked wooden wheels
  for (const side of [-1, 1]) {
    const wheel = new THREE.Group();
    wheel.position.set(side * 0.96, wheelR, 0);
    wheel.rotation.y = Math.PI / 2;

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR, 0.065, 8, 18),
      woodMat,
    );
    rim.castShadow = true;
    const ironBand = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR + 0.04, 0.018, 6, 18),
      ironRimMat,
    );
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.22, 10),
      woodMat,
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(rim, ironBand, hub);

    for (let s = 0; s < 6; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.028, wheelR * 1.9, 6),
        woodMat,
      );
      spoke.rotation.z = (s * Math.PI) / 6;
      wheel.add(spoke);
    }

    group.add(wheel);
  }

  // Heavy wooden axle & slatted cargo bed
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 2.2, 8),
    woodMat,
  );
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, wheelR, 0);
  group.add(axle);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 2.75), woodMat);
  bed.position.set(0, wheelR + 0.12, -0.1);
  bed.castShadow = true;
  bed.receiveShadow = true;
  group.add(bed);

  // Side railing slats
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.56, 2.68),
      woodMat,
    );
    rail.position.set(side * 0.78, wheelR + 0.44, -0.1);
    rail.castShadow = true;
    group.add(rail);
  }

  // Twin wooden yoke shafts resting down onto the dirt in front (+Z)
  for (const side of [-0.32, 0.32]) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.045, 2.35, 7),
      woodMat,
    );
    shaft.rotation.x = Math.PI / 2 + 0.26;
    shaft.position.set(side, 0.52, 2.2);
    shaft.castShadow = true;
    group.add(shaft);
  }

  // Yoke bar across shaft tips
  const yoke = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 1.35, 8),
    woodMat,
  );
  yoke.rotation.z = Math.PI / 2;
  yoke.position.set(0, 0.22, 3.25);
  group.add(yoke);

  // Golden bundled hay stacked inside the cart
  const hayLoad = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.78, 2.1),
    hayMat,
  );
  hayLoad.position.set(0, wheelR + 0.56, -0.2);
  hayLoad.castShadow = true;
  group.add(hayLoad);

  const isRot90 = Math.abs(Math.sin(rotationY)) > 0.7;
  const halfX = isRot90 ? 1.65 : 1.08;
  const halfZ = isRot90 ? 1.08 : 1.65;

  return {
    group,
    collider: {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      blocksSight: true,
      topY: 1.06,
      climbable: true,
    },
  };
}

/**
 * Village Farm Area (Khet) with tilled plots, instanced golden crops,
 * conical haystacks (bhoosa), and a wooden bullock cart
 */
export function buildFarmArea(
  x: number,
  z: number,
  textures: VillageTextureSet,
): LandmarkBuild {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const soilMat = new THREE.MeshStandardMaterial({
    map: textures.farmSoil,
    roughness: 0.96,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const bundMat = new THREE.MeshStandardMaterial({
    color: 0x9e7a4e,
    roughness: 0.95,
  });
  const haystackMat = new THREE.MeshStandardMaterial({
    map: textures.thatchRoof,
    roughness: 0.96,
  });

  // Two large plowed crop plots separated by a walkable farm bund path
  const plotDefs = [
    { ox: -5.4, oz: 0, w: 8.4, d: 11.2 },
    { ox: 4.8, oz: 1.0, w: 8.2, d: 10.0 },
  ];

  for (const p of plotDefs) {
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), soilMat);
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(p.ox, 0.03, p.oz);
    plot.receiveShadow = true;
    group.add(plot);

    // Low mud bund border
    const bundTop = new THREE.Mesh(
      new THREE.BoxGeometry(p.w + 0.4, 0.16, 0.35),
      bundMat,
    );
    bundTop.position.set(p.ox, 0.08, p.oz - p.d * 0.5);
    group.add(bundTop);
  }

  // Instanced Golden Wheat & Mustard Crop Stalks (>20 repeated items -> InstancedMesh!)
  const cropCount = 260;
  const stalkGeo = new THREE.ConeGeometry(0.16, 1.05, 5);
  stalkGeo.translate(0, 0.52, 0);
  const stalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    flatShading: true,
  });

  const crops = new THREE.InstancedMesh(stalkGeo, stalkMat, cropCount);
  crops.castShadow = false;
  crops.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const cropPalette = [0xcfa642, 0xdcb94c, 0x8da43d, 0x6f8f35, 0xe0c056];

  for (let i = 0; i < cropCount; i++) {
    const plot = plotDefs[i < 135 ? 0 : 1];
    const localIdx = i < 135 ? i : i - 135;
    const cols = 10;
    const row = Math.floor(localIdx / cols);
    const colIdx = localIdx % cols;

    const u = (colIdx + 0.5) / cols - 0.5;
    const v = (row + 0.5) / 14 - 0.5;
    const jitterX = (((i * 73) % 100) / 100 - 0.5) * 0.35;
    const jitterZ = (((i * 41) % 100) / 100 - 0.5) * 0.35;

    const s = 0.85 + ((i * 29) % 100) / 300;
    dummy.position.set(
      plot.ox + u * (plot.w - 0.9) + jitterX,
      0.02,
      plot.oz + v * (plot.d - 0.9) + jitterZ,
    );
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set(s, s * (0.95 + (i % 3) * 0.12), s);
    dummy.updateMatrix();
    crops.setMatrixAt(i, dummy.matrix);

    col.setHex(cropPalette[i % cropPalette.length]);
    crops.setColorAt(i, col);
  }
  crops.instanceMatrix.needsUpdate = true;
  if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  crops.computeBoundingSphere();
  group.add(crops);

  // 3 Tall Conical Haystacks (Bhoosa) with secret hiding spots behind them
  const circles: CircleCollider[] = [];
  const hidingSpots: HidingSpot[] = [];
  const haySpecs = [
    { ox: -10.8, oz: -4.2, r: 1.75, h: 2.7 },
    { ox: -9.8, oz: 1.2, r: 1.55, h: 2.4 },
    { ox: 10.2, oz: -2.8, r: 1.8, h: 2.8 },
  ];

  for (const h of haySpecs) {
    const stack = new THREE.Mesh(
      new THREE.ConeGeometry(h.r, h.h, 12),
      haystackMat,
    );
    stack.position.set(h.ox, h.h * 0.5, h.oz);
    stack.castShadow = true;
    stack.receiveShadow = true;
    group.add(stack);

    circles.push({
      x: x + h.ox,
      z: z + h.oz,
      radius: h.r * 0.88,
      blocksSight: true,
    });
  }

  hidingSpots.push(
    {
      x: x - 11.2,
      z: z - 1.5,
      label: 'Between the Farm Haystacks',
      kind: 'gully',
    },
    {
      x: x + 10.6,
      z: z - 5.4,
      label: 'Behind the Farm Haystack',
      kind: 'gully',
    },
    {
      x: x - 5.0,
      z: z + 2.4,
      label: 'Crouching in the Farm Crops',
      kind: 'gully',
    },
  );

  // Traditional Bullock Cart parked at the farm edge
  const cart = buildBullockCart(x + 0.6, z - 7.4, 0.42, textures);
  // Add cart directly in local coordinates relative to farm group
  cart.group.position.set(0.6, 0, -7.4);
  group.add(cart.group);

  hidingSpots.push({
    x: x + 0.6,
    z: z - 9.4,
    label: 'Behind the Bullock Cart',
    kind: 'vehicle',
  });

  return {
    group,
    boxes: [cart.collider],
    circles,
    hidingSpots,
    swayObjects: [crops],
  };
}

/**
 * Village Pond (Talab) with stone bathing ghat steps, shimmering water, and reeds
 */
export function buildVillagePond(
  x: number,
  z: number,
  textures: VillageTextureSet,
): LandmarkBuild {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const bankMat = new THREE.MeshStandardMaterial({
    color: 0x8e724e,
    roughness: 0.94,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.032,
    roughness: 0.88,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x245d63,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    envMapIntensity: 1.35,
    roughness: 0.14,
    metalness: 0.12,
    clearcoat: 0.92,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const reedMat = new THREE.MeshStandardMaterial({
    color: 0x4b7936,
    roughness: 0.9,
  });

  // Earthy pond rim basin
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(6.3, 0.68, 8, 24),
    bankMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.18, 0.86, 0.42);
  rim.position.y = 0.08;
  rim.receiveShadow = true;
  group.add(rim);

  // Shimmering pond water surface
  const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(6.15, 24), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.scale.set(1.18, 0.86, 1);
  waterMesh.position.y = 0.07;
  waterMesh.userData.isAnimatedWater = true;
  group.add(waterMesh);

  // Stepped stone bathing ghat on the courtyard-facing (-X) edge of the pond
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 3.8),
      stoneMat,
    );
    step.position.set(-7.1 + s * 0.55, 0.34 - s * 0.1, 0);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // Low ghat privacy wall & clumps of tall pond reeds (secret hiding cover!)
  const ghatWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1.35, 3.2),
    stoneMat,
  );
  ghatWall.position.set(-7.9, 0.68, -2.5);
  ghatWall.castShadow = true;
  ghatWall.receiveShadow = true;
  group.add(ghatWall);

  // Reed clusters around pond perimeter
  const reedPositions: Array<[number, number]> = [
    [5.6, -3.4],
    [6.4, 1.8],
    [2.5, 4.8],
    [-3.6, 4.9],
    [-2.8, -4.8],
  ];
  for (const [rx, rz] of reedPositions) {
    for (let k = 0; k < 5; k++) {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.05, 1.35 + (k % 3) * 0.25, 5),
        reedMat,
      );
      stalk.position.set(
        rx + Math.cos(k * 1.4) * 0.42,
        0.65,
        rz + Math.sin(k * 1.4) * 0.42,
      );
      stalk.rotation.z = (k - 2) * 0.08;
      group.add(stalk);
    }
  }

  // Pond water collider so characters don't walk across deep water (two overlapping circles match oval pond)
  const circles: CircleCollider[] = [
    { x: x - 1.6, z, radius: 4.9, blocksSight: false },
    { x: x + 1.6, z, radius: 4.9, blocksSight: false },
  ];
  const boxes: BoxCollider[] = [
    {
      minX: x - 8.15,
      maxX: x - 7.65,
      minZ: z - 4.1,
      maxZ: z - 0.9,
      blocksSight: true,
      topY: 1.35,
      climbable: true,
    },
  ];
  const hidingSpots: HidingSpot[] = [
    {
      x: x - 8.8,
      z: z - 2.5,
      label: 'Behind the Pond Ghat Wall',
      kind: 'wall',
    },
    {
      x: x + 5.8,
      z: z - 4.2,
      label: 'By the Village Pond Reeds',
      kind: 'gully',
    },
  ];

  return { group, boxes, circles, hidingSpots, waterMesh };
}

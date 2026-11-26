import * as THREE from 'three';
import { VillageTextureSet } from './textures';
import {
  BoxCollider,
  CircleCollider,
  HidingSpot,
  HouseInterior,
  LevelSpawnPoints,
  SeatSpot,
  TempleBellInteractive,
  VillageColliders,
  VillageMinimapLayout,
} from './types';
import {
  buildBanyanTree,
  buildBicycle,
  buildCharpai,
  buildFarmArea,
  buildSchoolBuilding,
  buildVillageMarket,
  buildVillagePond,
  buildVillageTemple,
} from './villageProps';
import { addVintageVehicle, createMapContext } from './mapHelpers';

export interface VillageBuildResult {
  group: THREE.Group;
  colliders: VillageColliders;
  swayFoliage: THREE.Object3D[];
  patrolPoints: THREE.Vector3[];
  hidingSpots: HidingSpot[];
  houseInteriors: HouseInterior[];
  pondWater: THREE.Mesh | null;
  minimapLayout: VillageMinimapLayout;
  spawnPoints?: LevelSpawnPoints;
  templeBells?: TempleBellInteractive[];
  seats?: SeatSpot[];
}

interface HouseSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotationY: number;
  roofStyle: 'tile' | 'thatch' | 'terrace';
  wallTone: 'cream' | 'ochre';
  trimColor: number;
  enterable: boolean;
}

const HOUSE_SPECS: HouseSpec[] = [
  // --- Original 6 courtyard mud houses (positions preserved) ---
  {
    id: 'house-nw',
    label: 'North-West Mud House',
    x: -10.8,
    z: -9.5,
    width: 6.2,
    depth: 4.8,
    height: 3.1,
    rotationY: 0,
    roofStyle: 'tile',
    wallTone: 'cream',
    trimColor: 0x2f5d8a,
    enterable: true,
  },
  {
    id: 'house-ne',
    label: 'North-East Thatch House',
    x: 9.8,
    z: -10.5,
    width: 6.6,
    depth: 5.0,
    height: 3.3,
    rotationY: 0,
    roofStyle: 'thatch',
    wallTone: 'ochre',
    trimColor: 0x8f3a29,
    enterable: true,
  },
  {
    id: 'house-w',
    label: 'West Gully House',
    x: -13.2,
    z: 2.2,
    width: 4.8,
    depth: 6.2,
    height: 2.9,
    rotationY: Math.PI / 2,
    roofStyle: 'thatch',
    wallTone: 'ochre',
    trimColor: 0x2c6b58,
    enterable: true,
  },
  {
    id: 'house-e',
    label: 'East Gully House',
    x: 13.0,
    z: 3.6,
    width: 5.0,
    depth: 6.4,
    height: 3.0,
    rotationY: -Math.PI / 2,
    roofStyle: 'tile',
    wallTone: 'cream',
    trimColor: 0x2f5d8a,
    enterable: true,
  },
  {
    id: 'house-sw',
    label: 'South-West Mud House',
    x: -9.0,
    z: 12.6,
    width: 6.0,
    depth: 4.6,
    height: 3.0,
    rotationY: Math.PI,
    roofStyle: 'tile',
    wallTone: 'cream',
    trimColor: 0x99422c,
    enterable: true,
  },
  {
    id: 'house-se',
    label: 'South-East Thatch House',
    x: 8.6,
    z: 13.0,
    width: 5.8,
    depth: 4.6,
    height: 2.9,
    rotationY: Math.PI,
    roofStyle: 'thatch',
    wallTone: 'ochre',
    trimColor: 0x35697a,
    enterable: true,
  },

  // --- 5 Expanded Street & Secret Alley Mud Houses (with flat rooftops & narrow gullies) ---
  {
    id: 'house-nw-alley',
    label: 'West Terrace House',
    x: -25.8,
    z: -8.8,
    width: 6.2,
    depth: 4.8,
    height: 3.1,
    rotationY: 0,
    roofStyle: 'terrace',
    wallTone: 'cream',
    trimColor: 0x32628a,
    enterable: true,
  },
  {
    id: 'house-w-south',
    label: 'Far West Alley House',
    x: -26.2,
    z: 8.2,
    width: 5.6,
    depth: 4.6,
    height: 2.95,
    rotationY: Math.PI / 2,
    roofStyle: 'tile',
    wallTone: 'ochre',
    trimColor: 0x8d3d28,
    enterable: true,
  },
  {
    id: 'house-ne-alley',
    label: 'Temple Lane Terrace House',
    x: 18.2,
    z: -11.4,
    width: 5.2,
    depth: 4.4,
    height: 3.0,
    rotationY: 0,
    roofStyle: 'terrace',
    wallTone: 'ochre',
    trimColor: 0x2f685a,
    enterable: false,
  },
  {
    id: 'house-north',
    label: 'North Street Mud House',
    x: -8.6,
    z: -26.2,
    width: 6.0,
    depth: 4.6,
    height: 3.05,
    rotationY: 0,
    roofStyle: 'thatch',
    wallTone: 'cream',
    trimColor: 0x99422c,
    enterable: true,
  },
  {
    id: 'house-south-gully',
    label: 'Pond Lane Terrace House',
    x: 10.2,
    z: 25.0,
    width: 5.8,
    depth: 4.6,
    height: 3.0,
    rotationY: Math.PI,
    roofStyle: 'terrace',
    wallTone: 'cream',
    trimColor: 0x2f5d8a,
    enterable: true,
  },
];

function createMatkaGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.02),
    new THREE.Vector2(0.24, 0.14),
    new THREE.Vector2(0.25, 0.28),
    new THREE.Vector2(0.16, 0.42),
    new THREE.Vector2(0.11, 0.48),
    new THREE.Vector2(0.14, 0.54),
    new THREE.Vector2(0.11, 0.55),
  ];
  return new THREE.LatheGeometry(points, 14);
}

function localBoxToWorldCollider(
  spec: HouseSpec,
  localCenterX: number,
  localCenterZ: number,
  localSizeX: number,
  localSizeZ: number,
): BoxCollider {
  const cos = Math.cos(spec.rotationY);
  const sin = Math.sin(spec.rotationY);

  const worldX = spec.x + localCenterX * cos + localCenterZ * sin;
  const worldZ = spec.z - localCenterX * sin + localCenterZ * cos;

  const isRotated90 = Math.abs(sin) > 0.7;
  const halfX = (isRotated90 ? localSizeZ : localSizeX) * 0.5;
  const halfZ = (isRotated90 ? localSizeX : localSizeZ) * 0.5;

  return {
    minX: worldX - halfX,
    maxX: worldX + halfX,
    minZ: worldZ - halfZ,
    maxZ: worldZ + halfZ,
    blocksSight: true,
  };
}

function buildMudHouse(
  spec: HouseSpec,
  textures: VillageTextureSet,
  matkaGeo: THREE.LatheGeometry,
  matkaMat: THREE.MeshStandardMaterial,
): {
  group: THREE.Group;
  colliders: BoxCollider[];
  interior: HouseInterior | null;
} {
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.rotationY;

  const { width, depth, height } = spec;
  const wallThick = 0.28;
  const doorW = 1.48;
  const doorH = 2.05;
  const plinthH = 0.14;

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xb78b5d,
    roughness: 0.94,
    metalness: 0.0,
  });
  const interiorFloorMat = new THREE.MeshStandardMaterial({
    color: 0x8f6b47,
    roughness: 0.96,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: spec.wallTone === 'cream' ? textures.mudWall : textures.mudWallOchre,
    roughness: 0.92,
    metalness: 0.0,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map:
      spec.roofStyle === 'tile'
        ? textures.roofTile
        : spec.roofStyle === 'thatch'
          ? textures.thatchRoof
          : textures.courtyard,
    roughness: spec.roofStyle === 'tile' ? 0.78 : 0.95,
    metalness: 0.0,
    transparent: false,
    opacity: 1,
  });
  const gableMat = new THREE.MeshStandardMaterial({
    map: spec.wallTone === 'cream' ? textures.mudWall : textures.mudWallOchre,
    roughness: 0.92,
    metalness: 0.0,
    transparent: false,
    opacity: 1,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.82,
    metalness: 0.04,
  });
  const ridgeWoodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.82,
    metalness: 0.04,
    transparent: false,
    opacity: 1,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.trimColor,
    roughness: 0.65,
    metalness: 0.05,
  });
  const darkRecessMat = new THREE.MeshStandardMaterial({
    color: 0x261a12,
    roughness: 0.95,
  });

  // 1. Raised earthen plinth / veranda (chabutra)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.7, plinthH, depth + 1.05),
    plinthMat,
  );
  plinth.position.set(0, plinthH * 0.5, 0.25);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const wallY = plinthH + height * 0.5;
  const frontZ = depth * 0.5 - wallThick * 0.5;
  const sideFrontW = (width - doorW) * 0.5;

  let colliders: BoxCollider[] = [];

  if (spec.enterable) {
    // Cozy interior mud floor
    const interiorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(width - wallThick * 2, depth - wallThick * 2),
      interiorFloorMat,
    );
    interiorFloor.rotation.x = -Math.PI / 2;
    interiorFloor.position.set(0, plinthH + 0.015, 0);
    interiorFloor.receiveShadow = true;
    group.add(interiorFloor);

    // Interior clay storage pot
    const innerMatka = new THREE.Mesh(matkaGeo, matkaMat);
    innerMatka.position.set(-width * 0.32, plinthH + 0.01, -depth * 0.28);
    innerMatka.castShadow = true;
    group.add(innerMatka);

    // 4 hollow walls leaving open walkable front doorway
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThick),
      wallMat,
    );
    backWall.position.set(0, wallY, -depth * 0.5 + wallThick * 0.5);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    const sideWallLen = depth - wallThick * 2;
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, height, sideWallLen),
      wallMat,
    );
    leftWall.position.set(-width * 0.5 + wallThick * 0.5, wallY, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, height, sideWallLen),
      wallMat,
    );
    rightWall.position.set(width * 0.5 - wallThick * 0.5, wallY, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);

    const frontLeftWall = new THREE.Mesh(
      new THREE.BoxGeometry(sideFrontW, height, wallThick),
      wallMat,
    );
    frontLeftWall.position.set(-width * 0.5 + sideFrontW * 0.5, wallY, frontZ);
    frontLeftWall.castShadow = true;
    frontLeftWall.receiveShadow = true;
    group.add(frontLeftWall);

    const frontRightWall = new THREE.Mesh(
      new THREE.BoxGeometry(sideFrontW, height, wallThick),
      wallMat,
    );
    frontRightWall.position.set(width * 0.5 - sideFrontW * 0.5, wallY, frontZ);
    frontRightWall.castShadow = true;
    frontRightWall.receiveShadow = true;
    group.add(frontRightWall);

    const headerH = Math.max(0.35, height - doorH);
    const frontHeader = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, headerH, wallThick),
      wallMat,
    );
    frontHeader.position.set(0, plinthH + doorH + headerH * 0.5, frontZ);
    frontHeader.castShadow = true;
    group.add(frontHeader);

    // Open painted doorway jambs + ajar wooden door leaf
    const jambW = 0.13;
    const leftJamb = new THREE.Mesh(
      new THREE.BoxGeometry(jambW, doorH, wallThick + 0.08),
      trimMat,
    );
    leftJamb.position.set(-doorW * 0.5, plinthH + doorH * 0.5, frontZ);
    group.add(leftJamb);

    const rightJamb = new THREE.Mesh(
      new THREE.BoxGeometry(jambW, doorH, wallThick + 0.08),
      trimMat,
    );
    rightJamb.position.set(doorW * 0.5, plinthH + doorH * 0.5, frontZ);
    group.add(rightJamb);

    const topLintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + jambW * 2, 0.14, wallThick + 0.1),
      trimMat,
    );
    topLintel.position.set(0, plinthH + doorH + 0.04, frontZ);
    group.add(topLintel);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorW * 0.5 + 0.06, plinthH, frontZ - 0.12);
    doorPivot.rotation.y = 1.95;
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW * 0.65, doorH - 0.06, 0.07),
      woodMat,
    );
    doorPanel.position.set(doorW * 0.325, (doorH - 0.06) * 0.5, 0);
    doorPivot.add(doorPanel);
    group.add(doorPivot);

    colliders = [
      localBoxToWorldCollider(spec, 0, -depth * 0.5 + wallThick * 0.5, width, wallThick),
      localBoxToWorldCollider(spec, -width * 0.5 + wallThick * 0.5, 0, wallThick, depth),
      localBoxToWorldCollider(spec, width * 0.5 - wallThick * 0.5, 0, wallThick, depth),
      localBoxToWorldCollider(
        spec,
        -width * 0.5 + sideFrontW * 0.5,
        frontZ,
        sideFrontW,
        wallThick,
      ),
      localBoxToWorldCollider(
        spec,
        width * 0.5 - sideFrontW * 0.5,
        frontZ,
        sideFrontW,
        wallThick,
      ),
    ];
  } else {
    // Non-enterable solid mud house with closed carved teak door
    const solidBody = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      wallMat,
    );
    solidBody.position.set(0, wallY, 0);
    solidBody.castShadow = true;
    solidBody.receiveShadow = true;
    group.add(solidBody);

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.2, doorH + 0.16, 0.14),
      trimMat,
    );
    doorFrame.position.set(0, plinthH + (doorH + 0.16) * 0.5, depth * 0.5 + 0.02);
    group.add(doorFrame);

    const closedDoor = new THREE.Mesh(
      new THREE.BoxGeometry(doorW - 0.1, doorH - 0.05, 0.1),
      woodMat,
    );
    closedDoor.position.set(0, plinthH + doorH * 0.5, depth * 0.5 + 0.06);
    group.add(closedDoor);

    colliders = [localBoxToWorldCollider(spec, 0, 0, width + 0.12, depth + 0.12)];
  }

  // 3. Rooftop geometry (either sloped terracotta/thatch gable OR traditional flat terrace rooftop!)
  const roofMeshes: THREE.Mesh[] = [];
  if (spec.roofStyle === 'terrace') {
    // Flat mud-plastered terrace slab with low parapet walls, wooden roof beams & side bamboo ladder
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.45, 0.22, depth + 0.45),
      roofMat,
    );
    slab.position.set(0, plinthH + height + 0.11, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
    roofMeshes.push(slab);

    const paraH = 0.58;
    const paraT = 0.18;
    const paraY = plinthH + height + 0.22 + paraH * 0.5;
    const frontPara = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.35, paraH, paraT),
      gableMat,
    );
    frontPara.position.set(0, paraY, depth * 0.5 + 0.1);
    const backPara = frontPara.clone();
    backPara.position.z = -depth * 0.5 - 0.1;

    const leftPara = new THREE.Mesh(
      new THREE.BoxGeometry(paraT, paraH, depth + 0.2),
      gableMat,
    );
    leftPara.position.set(-width * 0.5 - 0.1, paraY, 0);
    const rightPara = leftPara.clone();
    rightPara.position.x = width * 0.5 + 0.1;

    for (const p of [frontPara, backPara, leftPara, rightPara]) {
      p.castShadow = true;
      p.receiveShadow = true;
      group.add(p);
      roofMeshes.push(p);
    }

    // Bamboo/wooden ladder leaning against the right wall up to the rooftop
    const ladderGroup = new THREE.Group();
    ladderGroup.position.set(width * 0.5 + 0.32, 0, -0.35);
    ladderGroup.rotation.z = 0.16;
    for (const rz of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, height + 0.55, 6),
        woodMat,
      );
      rail.position.set(0, (height + 0.55) * 0.5, rz);
      rail.castShadow = true;
      ladderGroup.add(rail);
    }
    for (let r = 0; r < 7; r++) {
      const rung = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.46, 6),
        woodMat,
      );
      rung.rotation.x = Math.PI / 2;
      rung.position.set(0, 0.45 + r * 0.44, 0);
      ladderGroup.add(rung);
    }
    group.add(ladderGroup);
  } else {
    // Sloped overhanging gable roof (khaprail tiles or golden thatch)
    const roofRise = 1.45;
    const overhangX = 0.55;
    const overhangZ = 0.62;
    const halfDepth = depth * 0.5 + overhangZ;
    const slopeLen = Math.hypot(halfDepth, roofRise);
    const slopeAngle = Math.atan2(roofRise, halfDepth);
    const roofWidth = width + overhangX * 2;
    const eaveY = plinthH + height - 0.06;

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-depth * 0.5, 0);
    gableShape.lineTo(depth * 0.5, 0);
    gableShape.lineTo(0, roofRise - 0.08);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: width - 0.04,
      bevelEnabled: false,
    });
    gableGeo.rotateY(Math.PI / 2);
    const gableMesh = new THREE.Mesh(gableGeo, gableMat);
    gableMesh.position.set(-(width - 0.04) * 0.5, plinthH + height, 0);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    group.add(gableMesh);
    roofMeshes.push(gableMesh);

    const slabGeo = new THREE.BoxGeometry(roofWidth, 0.16, slopeLen);
    const frontSlope = new THREE.Mesh(slabGeo, roofMat);
    frontSlope.position.set(0, eaveY + roofRise * 0.5, halfDepth * 0.5);
    frontSlope.rotation.x = slopeAngle;
    frontSlope.castShadow = true;
    frontSlope.receiveShadow = true;
    group.add(frontSlope);
    roofMeshes.push(frontSlope);

    const backSlope = new THREE.Mesh(slabGeo, roofMat);
    backSlope.position.set(0, eaveY + roofRise * 0.5, -halfDepth * 0.5);
    backSlope.rotation.x = -slopeAngle;
    backSlope.castShadow = true;
    backSlope.receiveShadow = true;
    group.add(backSlope);
    roofMeshes.push(backSlope);

    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, roofWidth + 0.12, 8),
      ridgeWoodMat,
    );
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set(0, eaveY + roofRise + 0.05, 0);
    ridge.castShadow = true;
    group.add(ridge);
    roofMeshes.push(ridge);
  }

  // 4. Shuttered Wooden Window (khidki) on front wing & side wall
  const winX = width * 0.5 - sideFrontW * 0.5;
  const winY = plinthH + 1.55;
  if (sideFrontW >= 1.15) {
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.82, 0.14),
      trimMat,
    );
    winFrame.position.set(winX, winY, depth * 0.5 + 0.02);
    group.add(winFrame);

    const winInner = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.64, 0.08),
      darkRecessMat,
    );
    winInner.position.set(winX, winY, depth * 0.5 + 0.06);
    group.add(winInner);

    for (let b = -1; b <= 1; b++) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.64, 6),
        woodMat,
      );
      bar.position.set(winX + b * 0.16, winY, depth * 0.5 + 0.09);
      group.add(bar);
    }
  }

  // Side barred window for authentic street-side village facade
  const sideWinFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.78, 0.82),
    trimMat,
  );
  sideWinFrame.position.set(-width * 0.5 - 0.02, winY, 0);
  group.add(sideWinFrame);
  const sideWinInner = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.6, 0.64),
    darkRecessMat,
  );
  sideWinInner.position.set(-width * 0.5 - 0.06, winY, 0);
  group.add(sideWinInner);

  // 5. Wooden veranda support posts
  const postGeo = new THREE.CylinderGeometry(0.08, 0.09, height - 0.15, 8);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(
      side * (width * 0.5 - 0.15),
      plinthH + (height - 0.15) * 0.5,
      depth * 0.5 + 0.55,
    );
    post.castShadow = true;
    group.add(post);
  }

  // 6. Terracotta water pots (matkas) on front plinth
  const pot1 = new THREE.Mesh(matkaGeo, matkaMat);
  pot1.position.set(-width * 0.38, plinthH, depth * 0.5 + 0.42);
  pot1.castShadow = true;
  pot1.receiveShadow = true;
  group.add(pot1);

  const pot2 = new THREE.Mesh(matkaGeo, matkaMat);
  pot2.scale.setScalar(0.78);
  pot2.position.set(-width * 0.38 + 0.44, plinthH, depth * 0.5 + 0.36);
  pot2.castShadow = true;
  group.add(pot2);

  let interior: HouseInterior | null = null;
  if (spec.enterable) {
    const cos = Math.cos(spec.rotationY);
    const sin = Math.sin(spec.rotationY);
    const isRotated90 = Math.abs(sin) > 0.7;
    const innerHalfX = ((isRotated90 ? depth : width) - wallThick * 2) * 0.5;
    const innerHalfZ = ((isRotated90 ? width : depth) - wallThick * 2) * 0.5;

    const doorLocalZ = depth * 0.5 + 1.05;
    const insideLocalZ = -depth * 0.14;
    const insideLocalX = width * 0.16;

    interior = {
      id: spec.id,
      label: spec.label,
      minX: spec.x - innerHalfX,
      maxX: spec.x + innerHalfX,
      minZ: spec.z - innerHalfZ,
      maxZ: spec.z + innerHalfZ,
      doorX: spec.x + doorLocalZ * sin,
      doorZ: spec.z + doorLocalZ * cos,
      insideX: spec.x + insideLocalX * cos + insideLocalZ * sin,
      insideZ: spec.z - insideLocalX * sin + insideLocalZ * cos,
      roofMeshes,
    };
  }

  return { group, colliders, interior };
}

function buildVillageWell(
  x: number,
  z: number,
  textures: VillageTextureSet,
): { group: THREE.Group; collider: CircleCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xa6937a,
    roughness: 0.9,
    metalness: 0.0,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.wellBrick,
    roughness: 0.88,
    metalness: 0.02,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x163842,
    roughness: 0.14,
    metalness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.82,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3b3d40,
    roughness: 0.42,
    metalness: 0.85,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc29243,
    roughness: 0.32,
    metalness: 0.78,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xc4a46c,
    roughness: 0.95,
  });

  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.35, 0.22, 20),
    stoneMat,
  );
  apron.position.y = 0.11;
  apron.castShadow = true;
  apron.receiveShadow = true;
  group.add(apron);

  const parapet = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.48, 1.15, 20),
    brickMat,
  );
  parapet.position.y = 0.22 + 0.575;
  parapet.castShadow = true;
  parapet.receiveShadow = true;
  group.add(parapet);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.26, 0.2, 10, 24),
    stoneMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.38;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const water = new THREE.Mesh(new THREE.CircleGeometry(1.12, 20), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 1.12;
  group.add(water);

  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.85, 8);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(side * 1.24, 1.35 + 0.85, 0);
    post.castShadow = true;
    group.add(post);
  }

  const crossBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.75, 8),
    woodMat,
  );
  crossBeam.rotation.z = Math.PI / 2;
  crossBeam.position.set(0, 3.05, 0);
  crossBeam.castShadow = true;
  group.add(crossBeam);

  const pulleyWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.055, 8, 16),
    ironMat,
  );
  pulleyWheel.position.set(0, 2.74, 0);
  pulleyWheel.rotation.y = Math.PI / 2;
  pulleyWheel.castShadow = true;
  group.add(pulleyWheel);

  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.08), ironMat);
  bracket.position.set(0, 2.9, 0);
  group.add(bracket);

  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.65, 6),
    ropeMat,
  );
  rope.position.set(0, 1.9, 0.12);
  group.add(rope);

  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.17, 0.38, 12),
    brassMat,
  );
  bucket.position.set(0.75, 1.58, 0.92);
  bucket.castShadow = true;
  group.add(bucket);

  const bucketHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.018, 6, 12, Math.PI),
    ironMat,
  );
  bucketHandle.position.set(0.75, 1.77, 0.92);
  group.add(bucketHandle);

  return {
    group,
    collider: {
      x,
      z,
      radius: 2.15,
      blocksSight: true,
    },
  };
}

export function buildHandPump(
  x: number,
  z: number,
  rotationY = 0,
): { group: THREE.Group; collider: CircleCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xa29c91,
    roughness: 0.92,
  });
  const wetPuddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b4f52,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pumpIronMat = new THREE.MeshStandardMaterial({
    color: 0x2a6955,
    roughness: 0.48,
    metalness: 0.62,
  });
  const rawSteelMat = new THREE.MeshStandardMaterial({
    color: 0x5c6266,
    roughness: 0.35,
    metalness: 0.84,
  });
  const bucketMat = new THREE.MeshStandardMaterial({
    color: 0xc2492d,
    roughness: 0.52,
    metalness: 0.05,
  });

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.38, 0.16, 16),
    concreteMat,
  );
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  pad.castShadow = true;
  group.add(pad);

  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14), wetPuddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0.32, 0.185, 0.08);
  group.add(puddle);

  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.12, 10),
    rawSteelMat,
  );
  flange.position.y = 0.22;
  flange.castShadow = true;
  group.add(flange);

  const standPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.92, 12),
    pumpIronMat,
  );
  standPipe.position.y = 0.72;
  standPipe.castShadow = true;
  group.add(standPipe);

  const headBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12),
    pumpIronMat,
  );
  headBody.position.y = 1.35;
  headBody.castShadow = true;
  group.add(headBody);

  const headDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    rawSteelMat,
  );
  headDome.position.y = 1.56;
  group.add(headDome);

  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 1.18, 0),
    new THREE.Vector3(0.42, 1.16, 0),
    new THREE.Vector3(0.55, 1.02, 0),
  ]);
  const spout = new THREE.Mesh(
    new THREE.TubeGeometry(spoutCurve, 10, 0.048, 8, false),
    pumpIronMat,
  );
  spout.castShadow = true;
  group.add(spout);

  const handleArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.038, 1.25, 8),
    rawSteelMat,
  );
  handleArm.rotation.z = Math.PI / 2.8;
  handleArm.position.set(-0.56, 1.22, 0);
  handleArm.castShadow = true;
  group.add(handleArm);

  const handleGrip = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 10, 8),
    pumpIronMat,
  );
  handleGrip.position.set(-1.08, 0.94, 0);
  handleGrip.castShadow = true;
  group.add(handleGrip);

  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.36, 12),
    bucketMat,
  );
  bucket.position.set(0.56, 0.34, 0);
  bucket.castShadow = true;
  group.add(bucket);

  return {
    group,
    collider: {
      x,
      z,
      radius: 1.05,
      blocksSight: true,
    },
  };
}

function buildVillageTree(
  x: number,
  z: number,
  scale: number,
  textures: VillageTextureSet,
  leafTintHex: number,
): { group: THREE.Group; foliage: THREE.Group; collider: CircleCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    roughness: 0.94,
    metalness: 0.0,
  });

  const rootBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * scale, 0.56 * scale, 0.7 * scale, 9),
    barkMat,
  );
  rootBase.position.y = 0.35 * scale;
  rootBase.castShadow = true;
  rootBase.receiveShadow = true;
  group.add(rootBase);

  const trunkH = 3.1 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.36 * scale, trunkH, 9),
    barkMat,
  );
  trunk.position.y = trunkH * 0.5 + 0.3 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const branchConfigs = [
    { rx: 0.45, rz: 0.5, y: 2.8, ox: 0.55, oz: 0.32 },
    { rx: -0.4, rz: -0.55, y: 2.95, ox: -0.6, oz: -0.25 },
    { rx: 0.5, rz: -0.35, y: 3.1, ox: -0.28, oz: 0.52 },
  ];
  for (const b of branchConfigs) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09 * scale, 0.16 * scale, 1.55 * scale, 7),
      barkMat,
    );
    branch.position.set(b.ox * scale, b.y * scale, b.oz * scale);
    branch.rotation.set(b.rx, 0, b.rz);
    branch.castShadow = true;
    group.add(branch);
  }

  const foliage = new THREE.Group();
  foliage.position.set(0, 3.85 * scale, 0);

  const baseColor = new THREE.Color(leafTintHex);
  const clusterSpecs = [
    { x: 0, y: 0.65, z: 0, r: 1.85, lOffset: 0.04 },
    { x: 1.15, y: 0.05, z: 0.55, r: 1.45, lOffset: -0.02 },
    { x: -1.1, y: 0.15, z: 0.65, r: 1.5, lOffset: 0.01 },
    { x: 0.55, y: 0.1, z: -1.1, r: 1.45, lOffset: -0.04 },
    { x: -0.85, y: -0.05, z: -0.95, r: 1.35, lOffset: -0.03 },
  ];

  for (const c of clusterSpecs) {
    const col = baseColor.clone().offsetHSL(0, 0, c.lOffset);
    const leafMat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.86,
      metalness: 0.0,
      flatShading: true,
    });
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(c.r * scale, 1),
      leafMat,
    );
    puff.position.set(c.x * scale, c.y * scale, c.z * scale);
    puff.scale.set(1.15, 0.78, 1.1);
    puff.castShadow = true;
    puff.receiveShadow = true;
    foliage.add(puff);
  }

  group.add(foliage);

  return {
    group,
    foliage,
    collider: {
      x,
      z,
      radius: 0.62 * scale,
      blocksSight: true,
    },
  };
}

function buildConnectedStreets(textures: VillageTextureSet): THREE.Group {
  const streets = new THREE.Group();
  const streetMat = new THREE.MeshStandardMaterial({
    map: textures.street,
    roughness: 0.94,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const addRoad = (
    x: number,
    z: number,
    width: number,
    length: number,
    rotY = 0,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), streetMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    streets.add(mesh);
  };

  // Main North-South village street through courtyard
  addRoad(0, -1, 4.2, 74, 0);
  // Main East-West village street through courtyard
  addRoad(-1, 0.6, 4.2, 72, Math.PI / 2);
  // North Cross Lane connecting School (NW) to Temple (NE)
  addRoad(0, -18.2, 3.8, 58, Math.PI / 2);
  // South Cross Lane connecting Farm (SW) to Village Pond (SE)
  addRoad(0, 19.2, 3.8, 58, Math.PI / 2);
  // East Market Street (Temple -> Market -> Pond)
  addRoad(21.4, 2, 3.6, 52, 0);
  // West Alley Street (School -> West Mud-House Gullies -> Farm)
  addRoad(-19.8, 1, 3.0, 50, 0);

  // Narrow secret connecting alleys (gullies) behind mud-house clusters
  addRoad(-15.5, -13.5, 2.0, 11, Math.PI / 2);
  addRoad(14.8, -11.5, 2.1, 13, 0);

  return streets;
}

function buildPerimeterGrove(textures: VillageTextureSet): THREE.Group {
  const grove = new THREE.Group();
  const count = 78;

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 4.6, 7);
  trunkGeo.translate(0, 2.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.bark,
    roughness: 0.95,
  });

  const canopyGeo = new THREE.DodecahedronGeometry(2.65, 1);
  canopyGeo.scale(1.18, 0.82, 1.18);
  canopyGeo.translate(0, 5.2, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    flatShading: true,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  trunks.receiveShadow = true;
  canopies.castShadow = false;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x4c7c39, 0x3e6d32, 0x5c8942, 0x457335, 0x628b40];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.03;
    const radius = 50.5 + (i % 4) * 4.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.92 + ((i * 37) % 100) / 260;

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, angle * 2.3, 0);
    dummy.scale.set(s, s * (0.95 + (i % 3) * 0.1), s);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);

    color.setHex(palette[i % palette.length]);
    canopies.setColorAt(i, color);
  }

  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();
  grove.add(trunks, canopies);

  // Natural outer hedgerow bushes framing the village perimeter
  const bushCount = 46;
  const bushGeo = new THREE.DodecahedronGeometry(1.35, 0);
  bushGeo.scale(1.35, 0.76, 1.15);
  bushGeo.translate(0, 0.65, 0);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    flatShading: true,
  });
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);

  for (let i = 0; i < bushCount; i++) {
    const angle = (i / bushCount) * Math.PI * 2;
    const r = 47.4 + (i % 2) * 1.4;
    dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.setScalar(0.9 + (i % 3) * 0.16);
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);
    color.setHex(i % 2 === 0 ? 0x5d823b : 0x4c7435);
    bushes.setColorAt(i, color);
  }
  bushes.instanceMatrix.needsUpdate = true;
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
  bushes.computeBoundingSphere();
  grove.add(bushes);

  return grove;
}

export function buildIndianVillage(
  textures: VillageTextureSet,
): VillageBuildResult {
  const group = new THREE.Group();
  const boxes: BoxCollider[] = [];
  const circles: CircleCollider[] = [];
  const swayFoliage: THREE.Object3D[] = [];
  const houseInteriors: HouseInterior[] = [];
  const hidingSpots: HidingSpot[] = [];

  // 1. Expansive sun-baked village terrain extending far into golden horizon fog
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.ground,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.045,
    roughness: 0.96,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 2. Connected Village Streets & Secret Alleys
  group.add(buildConnectedStreets(textures));

  // 3. Central Village Courtyard (Aangan / Chaupal)
  const courtyardMat = new THREE.MeshStandardMaterial({
    map: textures.courtyard,
    bumpMap: textures.surfaceBump,
    bumpScale: 0.028,
    roughness: 0.93,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const courtyard = new THREE.Mesh(
    new THREE.CylinderGeometry(9.2, 9.5, 0.05, 8),
    courtyardMat,
  );
  courtyard.position.set(0, 0.028, 0.6);
  courtyard.receiveShadow = true;
  group.add(courtyard);

  // 4. Grand Central Banyan Tree (Bargad) with aerial roots & hiding pockets
  const banyan = buildBanyanTree(-0.5, -1.8, textures);
  group.add(banyan.group);
  swayFoliage.push(banyan.foliage);
  circles.push(...banyan.circles);
  hidingSpots.push(...banyan.hidingSpots);

  // 5. 11 Traditional Mud Houses (courtyard + expanded street & narrow secret alleys)
  const matkaGeo = createMatkaGeometry();
  const matkaMat = new THREE.MeshStandardMaterial({
    color: 0xb65433,
    roughness: 0.68,
    metalness: 0.04,
  });

  for (const spec of HOUSE_SPECS) {
    const built = buildMudHouse(spec, textures, matkaGeo, matkaMat);
    group.add(built.group);
    boxes.push(...built.colliders);
    if (built.interior) {
      houseInteriors.push(built.interior);
      hidingSpots.push({
        x: built.interior.insideX,
        z: built.interior.insideZ,
        label: `Inside ${spec.label}`,
        kind: 'house',
      });
    }
  }

  // Secret narrow alley hiding nooks between mud houses
  hidingSpots.push(
    { x: -16.8, z: -9.5, label: 'In the North-West Secret Alley', kind: 'gully' },
    { x: 14.5, z: -11.2, label: 'In the Temple Lane Secret Alley', kind: 'gully' },
    { x: -20.5, z: 7.8, label: 'In the West Mud-House Alley', kind: 'gully' },
    { x: 16.5, z: 4.5, label: 'Behind the East Gully House', kind: 'gully' },
  );

  // 6. Village Primary School (Prathmik Vidyalaya) with 2 enterable classrooms
  const school = buildSchoolBuilding(-24.5, -26.5, textures);
  group.add(school.group);
  boxes.push(...school.boxes);
  circles.push(...school.circles);
  hidingSpots.push(...school.hidingSpots);
  if (school.interiors) houseInteriors.push(...school.interiors);

  // 7. Village Temple (Mandir) in North-East district
  const temple = buildVillageTemple(24.5, -25.5, textures);
  group.add(temple.group);
  boxes.push(...temple.boxes);
  circles.push(...temple.circles);
  hidingSpots.push(...temple.hidingSpots);
  if (temple.swayObjects) swayFoliage.push(...temple.swayObjects);

  // 8. Small Village Market (Haat / Bazaar) along East Market Street
  const market = buildVillageMarket(27.6, 4.5, textures);
  group.add(market.group);
  boxes.push(...market.boxes);
  circles.push(...market.circles);
  hidingSpots.push(...market.hidingSpots);

  // 9. Farm Area (Khet) with crops, haystacks, and bullock cart in South-West district
  const farm = buildFarmArea(-22.5, 29.5, textures);
  group.add(farm.group);
  boxes.push(...farm.boxes);
  circles.push(...farm.circles);
  hidingSpots.push(...farm.hidingSpots);

  // 10. Village Pond (Talab) in South-East district
  const pond = buildVillagePond(25.5, 28.5, textures);
  group.add(pond.group);
  boxes.push(...pond.boxes);
  circles.push(...pond.circles);
  hidingSpots.push(...pond.hidingSpots);

  // 11. Original Village Well (Kuan) + 3 Village Hand Pumps (Chapakal)
  const well = buildVillageWell(6.4, -2.0, textures);
  group.add(well.group);
  circles.push(well.collider);
  hidingSpots.push({
    x: 8.8,
    z: -2.6,
    label: 'Behind the Village Well',
    kind: 'well',
  });

  const pumpSpecs = [
    { x: -5.8, z: 3.0, rot: 0, hideX: -7.6, hideZ: 3.4, label: 'Behind the Courtyard Hand Pump' },
    { x: -16.2, z: -17.8, rot: Math.PI / 2, hideX: -17.6, hideZ: -18.5, label: 'Behind the School Lane Hand Pump' },
    { x: 19.2, z: 14.5, rot: -Math.PI / 2, hideX: 18.0, hideZ: 15.8, label: 'Behind the Market Hand Pump' },
  ];
  for (const p of pumpSpecs) {
    const pump = buildHandPump(p.x, p.z, p.rot);
    group.add(pump.group);
    circles.push(pump.collider);
    hidingSpots.push({ x: p.hideX, z: p.hideZ, label: p.label, kind: 'pump' });
  }

  // 12. Nostalgic 1990s Village Objects: Charpais (with old radio), Bicycles & Clay Pots
  const charpaiSpecs = [
    { x: -4.6, z: -3.6, rot: 0.3, withRadio: true },
    { x: -13.2, z: 14.2, rot: Math.PI / 2, withRadio: false },
    { x: -16.8, z: -6.8, rot: 0, withRadio: false },
    { x: 13.0, z: 14.0, rot: Math.PI / 2, withRadio: false },
    { x: 19.2, z: -22.6, rot: 0.25, withRadio: false },
  ];
  const seats: SeatSpot[] = [];
  for (let ci = 0; ci < charpaiSpecs.length; ci++) {
    const c = charpaiSpecs[ci];
    const ch = buildCharpai(c.x, c.z, c.rot, textures, c.withRadio);
    group.add(ch.group);
    boxes.push(ch.collider);

    // Expose two natural seated positions along the woven charpai edges
    const cosR = Math.cos(c.rot);
    const sinR = Math.sin(c.rot);
    const faceOut = c.rot + Math.PI / 2;
    const offsets = c.withRadio ? [0.46] : [-0.44, 0.44];
    for (let oi = 0; oi < offsets.length; oi++) {
      const localX = 0.24;
      const localZ = offsets[oi];
      seats.push({
        id: `l1_charpai_${ci}_${oi}`,
        x: c.x + localX * cosR + localZ * sinR,
        z: c.z - localX * sinR + localZ * cosR,
        seatY: 0.48,
        rotY: faceOut,
        label: 'Charpai',
        kind: 'charpai',
      });
    }
  }

  const bicycleSpecs = [
    { x: -7.0, z: -6.8, rot: 0.5, color: 0x1c2124 },
    { x: -17.4, z: -22.2, rot: -0.4, color: 0x1e4d3a },
    { x: 24.4, z: -1.8, rot: 1.4, color: 0x203a5e },
    { x: 16.8, z: 7.4, rot: 0.2, color: 0x6b2420 },
  ];
  for (const b of bicycleSpecs) {
    const bike = buildBicycle(b.x, b.z, b.rot, b.color);
    group.add(bike.group);
    circles.push(bike.collider);
  }

  // Parked 1995 village scooter along North Cross Lane (natural vehicle cover)
  addVintageVehicle(
    {
      ...createMapContext(),
      group,
      boxes,
      hidingSpots,
    },
    'scooter',
    -4.2,
    -14.6,
    0.2,
    0x3b6e75,
    'Behind the Parked 1995 Scooter',
  );

  // 13. Neem & Mango Village Trees across streets, temple, school yard, farm, and pond
  const villageTreeSpecs = [
    { x: -15.8, z: -4.2, scale: 1.05, tint: 0x4b8038 },
    { x: 2.2, z: -14.2, scale: 1.12, tint: 0x3b6e32 },
    { x: 15.8, z: -4.8, scale: 1.0, tint: 0x55873e },
    { x: -14.8, z: 10.2, scale: 1.08, tint: 0x457836 },
    { x: 14.8, z: 11.4, scale: 1.08, tint: 0x4e823a },
    { x: 2.4, z: 15.6, scale: 1.02, tint: 0x3d7334 },
    { x: -33.5, z: -18.5, scale: 1.22, tint: 0x427536 },
    { x: -15.5, z: -32.8, scale: 1.15, tint: 0x4c823b },
    { x: 16.5, z: -31.5, scale: 1.2, tint: 0x3b6e32 },
    { x: 33.2, z: -18.5, scale: 1.18, tint: 0x4c7c39 },
    { x: 34.5, z: 21.5, scale: 1.24, tint: 0x3f7533 },
    { x: 19.5, z: 36.2, scale: 1.12, tint: 0x4a7f38 },
    { x: -34.5, z: 18.2, scale: 1.15, tint: 0x52843c },
    { x: -7.2, z: 33.8, scale: 1.18, tint: 0x407234 },
  ];

  for (const t of villageTreeSpecs) {
    const tree = buildVillageTree(t.x, t.z, t.scale, textures, t.tint);
    group.add(tree.group);
    swayFoliage.push(tree.foliage);
    circles.push(tree.collider);
    hidingSpots.push({
      x: t.x + (t.x > 0 ? 1.2 : -1.2),
      z: t.z + (t.z > 0 ? 1.2 : -1.2),
      label: 'Behind a Village Tree',
      kind: 'tree',
    });
  }

  // 14. Outer natural perimeter grove & hedges
  group.add(buildPerimeterGrove(textures));

  // Seeker AI patrol waypoints covering courtyard, alleys, school, temple, market, farm, and pond
  const patrolPoints = [
    new THREE.Vector3(0.5, 0, 5.8), // Courtyard south
    new THREE.Vector3(-6.2, 0, -4.2), // Courtyard NW & Banyan
    new THREE.Vector3(-19.8, 0, -14.5), // West Alley north
    new THREE.Vector3(-24.5, 0, -19.8), // Outside Primary School classrooms
    new THREE.Vector3(-8.6, 0, -21.2), // North Street house
    new THREE.Vector3(10.5, 0, -18.2), // North Cross Lane east
    new THREE.Vector3(24.5, 0, -18.8), // Outside Village Temple
    new THREE.Vector3(21.4, 0, -2.5), // East Market Street north
    new THREE.Vector3(21.4, 0, 10.5), // East Market Street south
    new THREE.Vector3(16.2, 0, 22.8), // Near Pond ghat & south terrace house
    new THREE.Vector3(0.0, 0, 19.2), // South Cross Lane center
    new THREE.Vector3(-18.5, 0, 19.2), // Farm & Bullock Cart lane
    new THREE.Vector3(-19.8, 0, 4.5), // West Mud-House Alley
    new THREE.Vector3(8.5, 0, -1.5), // Village Well
  ];

  return {
    group,
    colliders: {
      boxes,
      circles,
      worldRadius: 45.5,
    },
    swayFoliage,
    patrolPoints,
    hidingSpots,
    houseInteriors,
    pondWater: pond.waterMesh ?? null,
    minimapLayout: VILLAGE_MINIMAP_LAYOUT,
    templeBells: temple.templeBells ?? [],
    seats,
  };
}

export const VILLAGE_MINIMAP_LAYOUT: VillageMinimapLayout = {
  worldRadius: 45.5,
  roads: [
    { x: 0, z: -1, width: 4.2, length: 74, rotY: 0 },
    { x: -1, z: 0.6, width: 4.2, length: 72, rotY: Math.PI / 2 },
    { x: 0, z: -18.2, width: 3.8, length: 58, rotY: Math.PI / 2 },
    { x: 0, z: 19.2, width: 3.8, length: 58, rotY: Math.PI / 2 },
    { x: 21.4, z: 2, width: 3.6, length: 52, rotY: 0 },
    { x: -19.8, z: 1, width: 3.0, length: 50, rotY: 0 },
    { x: -15.5, z: -13.5, width: 2.0, length: 11, rotY: Math.PI / 2 },
    { x: 14.8, z: -11.5, width: 2.1, length: 13, rotY: 0 },
  ],
  buildings: [
    ...HOUSE_SPECS.map((h) => ({
      x: h.x,
      z: h.z,
      width: h.width,
      depth: h.depth,
      rotY: h.rotationY,
      kind: 'house' as const,
    })),
    // Village Primary School (NW)
    { x: -24.5, z: -26.5, width: 12.2, depth: 6.2, rotY: 0, kind: 'school' },
    // Village Temple (NE)
    { x: 24.5, z: -25.5, width: 7.4, depth: 7.4, rotY: 0, kind: 'temple' },
    // Village Market stalls (East Market Street)
    { x: 27.6, z: 0.5, width: 3.4, depth: 3.6, rotY: 0, kind: 'market' },
    { x: 27.6, z: 5.2, width: 3.4, depth: 3.6, rotY: 0, kind: 'market' },
    { x: 27.6, z: 9.8, width: 3.4, depth: 3.6, rotY: 0, kind: 'market' },
  ],
  landmarks: [
    // Central courtyard
    { x: 0, z: 0.6, radius: 9.2, kind: 'courtyard' },
    // Farm crop fields (SW)
    { x: -22.5, z: 29.5, radius: 9.5, kind: 'farm' },
    // Village pond (SE)
    { x: 25.5, z: 28.5, radius: 7.6, kind: 'pond' },
    // Grand central Banyan tree
    { x: -0.5, z: -1.8, radius: 3.6, kind: 'banyan' },
    // Village Well
    { x: 6.4, z: -2.0, radius: 1.5, kind: 'well' },
    // Village Neem & Mango trees
    { x: -15.8, z: -4.2, radius: 1.6, kind: 'tree' },
    { x: 2.2, z: -14.2, radius: 1.7, kind: 'tree' },
    { x: 15.8, z: -4.8, radius: 1.5, kind: 'tree' },
    { x: -14.8, z: 10.2, radius: 1.6, kind: 'tree' },
    { x: 14.8, z: 11.4, radius: 1.6, kind: 'tree' },
    { x: 2.4, z: 15.6, radius: 1.6, kind: 'tree' },
    { x: -33.5, z: -18.5, radius: 1.8, kind: 'tree' },
    { x: -15.5, z: -32.8, radius: 1.7, kind: 'tree' },
    { x: 16.5, z: -31.5, radius: 1.8, kind: 'tree' },
    { x: 33.2, z: -18.5, radius: 1.8, kind: 'tree' },
    { x: 34.5, z: 21.5, radius: 1.9, kind: 'tree' },
    { x: 19.5, z: 36.2, radius: 1.7, kind: 'tree' },
    { x: -34.5, z: 18.2, radius: 1.7, kind: 'tree' },
    { x: -7.2, z: 33.8, radius: 1.8, kind: 'tree' },
  ],
};

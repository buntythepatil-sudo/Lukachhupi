import * as THREE from 'three';
import { VillageTextureSet } from './textures';

export type VillagerArchetype =
  | 'elder'
  | 'woman'
  | 'man'
  | 'vendor'
  | 'child_boy'
  | 'child_girl';

export type VillagerAnimMode =
  | 'walk'
  | 'idle'
  | 'talk'
  | 'sit_charpai'
  | 'sell'
  | 'buy'
  | 'cycle'
  | 'cricket_bat'
  | 'cricket_bowl'
  | 'cricket_field'
  | 'teach'
  | 'sit_bench'
  | 'slapped'
  | 'slapped_seated';

export type AnimalSpecies = 'cow' | 'buffalo' | 'goat' | 'dog';
export type AnimalAnimMode = 'walk' | 'graze' | 'idle' | 'rest' | 'sniff' | 'alert';

export interface VillagerBikeParts {
  root: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  crank: THREE.Group;
  handlebar: THREE.Group;
}

export interface VillagerRig {
  root: THREE.Group;
  bodyRoot: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  bike: VillagerBikeParts | null;
  shadowPlane: THREE.Mesh;
  walkPhase: number;
  idlePhase: number;
  archetype: VillagerArchetype;
  updatePose: (
    mode: VillagerAnimMode,
    dt: number,
    speed: number,
    actionPhase?: number,
    steerAngle?: number,
  ) => void;
}

export interface AnimalRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  neckHead: THREE.Group;
  headGroup: THREE.Group;
  jaw: THREE.Group;
  tail: THREE.Group;
  tailLower: THREE.Group | null;
  bellPivot: THREE.Group | null;
  legs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group]; // FL, FR, BL, BR hip/shoulder pivots
  lowerLegs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group]; // FL, FR, BL, BR knee/hock pivots
  ears: [THREE.Object3D, THREE.Object3D];
  species: AnimalSpecies;
  walkPhase: number;
  idlePhase: number;
  baseBodyY: number;
  updatePose: (
    mode: AnimalAnimMode,
    dt: number,
    speed: number,
    lookYawOffset?: number,
    excited?: boolean,
  ) => void;
}

export interface NpcAssetPool {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
  shadowGeo: THREE.PlaneGeometry;
  shadowMat: THREE.MeshBasicMaterial;
  // Shared villager geometries
  headGeo: THREE.SphereGeometry;
  neckGeo: THREE.CylinderGeometry;
  torsoGeo: THREE.BoxGeometry;
  hipsGeo: THREE.BoxGeometry;
  upperArmGeo: THREE.CylinderGeometry;
  forearmGeo: THREE.CylinderGeometry;
  handGeo: THREE.SphereGeometry;
  thighGeo: THREE.CylinderGeometry;
  shinGeo: THREE.CylinderGeometry;
  footGeo: THREE.BoxGeometry;
  dhotiGeo: THREE.CylinderGeometry;
  sareeSkirtGeo: THREE.CylinderGeometry;
  kurtaHemGeo: THREE.CylinderGeometry;
  hairCapGeo: THREE.SphereGeometry;
  bunGeo: THREE.SphereGeometry;
  turbanGeo: THREE.TorusGeometry;
  turbanTopGeo: THREE.SphereGeometry;
  // Shared bicycle geometries
  bikeTireGeo: THREE.TorusGeometry;
  bikeRimGeo: THREE.TorusGeometry;
  bikeSpokeGeo: THREE.CylinderGeometry;
  bikeSeatGeo: THREE.BoxGeometry;
  // Face textures keyed by archetype+skinIdx
  faceMats: Map<string, THREE.MeshStandardMaterial>;
  animalCoatMats: Map<string, THREE.MeshStandardMaterial>;
  skinMats: THREE.MeshStandardMaterial[];
  hairDarkMat: THREE.MeshStandardMaterial;
  hairGreyMat: THREE.MeshStandardMaterial;
  sandalMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  charpaiWeaveMat: THREE.MeshStandardMaterial;
  bikeTireMat: THREE.MeshStandardMaterial;
  bikeChromeMat: THREE.MeshStandardMaterial;
  bikeLeatherMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

const NATURAL_SKIN_HEXES = [0xdcb08a, 0xd19f78, 0xe2bc9a, 0xc9946d, 0xd8a882];

const SAREE_PALETTE = [
  { main: 0xb93730, border: 0xe6b447 }, // Vermilion & gold
  { main: 0x246b68, border: 0xdf9e3a }, // Peacock teal & mustard
  { main: 0xbf5c28, border: 0xf0d27a }, // Marigold saffron
  { main: 0x9c2f5d, border: 0xe8be56 }, // Rani pink & zari
  { main: 0x355c92, border: 0xd99b43 }, // Indigo blue & gold
  { main: 0x4f7836, border: 0xdfa83c }, // Parrot green & gold
];

const KURTA_PALETTE = [
  0xf2ead9, // Khadi cream
  0xdfcfb2, // Warm beige
  0xc8d7e3, // Sky cotton
  0xe3c398, // Mustard khadi
  0xd4e0c8, // Sage kurta
  0xd8b49e, // Terracotta cotton
];

const CHILD_TOP_PALETTE = [
  0xd65138,
  0x2f6fa3,
  0x3b8656,
  0xdca030,
  0x8e4c8f,
  0x2e8286,
];

function createVillagerFaceTexture(
  skinHex: number,
  options: {
    mustache?: 'dark' | 'white' | 'none';
    bindi?: boolean;
    child?: boolean;
    seed: number;
  },
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const c = new THREE.Color(skinHex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  // Soft warm gradient base skin tone
  const grad = ctx.createRadialGradient(64, 58, 12, 64, 64, 72);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 14)}, ${Math.min(255, g + 11)}, ${Math.min(255, b + 8)})`);
  grad.addColorStop(1, `rgb(${Math.max(0, r - 18)}, ${Math.max(0, g - 16)}, ${Math.max(0, b - 14)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle rosy cheeks
  ctx.fillStyle = 'rgba(216, 118, 96, 0.22)';
  ctx.beginPath();
  ctx.ellipse(38, 72, 11, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(90, 72, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = options.mustache === 'white' ? '#6c6864' : '#251812';
  ctx.lineWidth = options.child ? 3.2 : 3.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(35, 48);
  ctx.quadraticCurveTo(46, 44, 55, 48);
  ctx.moveTo(73, 48);
  ctx.quadraticCurveTo(82, 44, 93, 48);
  ctx.stroke();

  // Clear realistic eyes (sclera + dark iris + bright catchlight)
  const drawEye = (ex: number, ey: number) => {
    ctx.fillStyle = '#fbf7f2';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 8.5, options.child ? 6.2 : 5.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d1a10';
    ctx.beginPath();
    ctx.arc(ex, ey, options.child ? 4.3 : 3.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#140c08';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1.5, ey - 1.5, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Subtle upper lash line
    ctx.strokeStyle = '#241710';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ex, ey + 1.5, 8.2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  };
  drawEye(46, 58);
  drawEye(82, 58);

  // Nose bridge & soft tip shadow
  ctx.strokeStyle = `rgba(${Math.max(0, r - 45)}, ${Math.max(0, g - 42)}, ${Math.max(0, b - 38)}, 0.55)`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(64, 56);
  ctx.lineTo(62, 71);
  ctx.quadraticCurveTo(64, 74, 67, 71);
  ctx.stroke();

  // Traditional bindi for village women
  if (options.bindi) {
    ctx.fillStyle = options.seed % 2 === 0 ? '#b81f24' : '#8f1722';
    ctx.beginPath();
    ctx.arc(64, 44, 3.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Friendly natural mouth / smile
  ctx.strokeStyle = options.bindi ? '#9e433d' : '#8f4f42';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(52, 85);
  ctx.quadraticCurveTo(64, 92, 76, 85);
  ctx.stroke();

  // Classic Indian village mustache
  if (options.mustache && options.mustache !== 'none') {
    ctx.fillStyle = options.mustache === 'white' ? '#dcd8d2' : '#241a15';
    ctx.beginPath();
    ctx.moveTo(64, 77);
    ctx.quadraticCurveTo(54, 75, 45, 81);
    ctx.quadraticCurveTo(54, 83, 64, 80);
    ctx.quadraticCurveTo(74, 83, 83, 81);
    ctx.quadraticCurveTo(74, 75, 64, 77);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createNpcAssetPool(textures: VillageTextureSet): NpcAssetPool {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const createdTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const shadowGeo = trackGeo(new THREE.PlaneGeometry(1.12, 1.12));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    }),
  );

  // Shared villager primitive geometries (low-poly clean silhouettes for Android speed)
  const headGeo = trackGeo(new THREE.SphereGeometry(0.185, 12, 10));
  const neckGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.076, 0.1, 8));
  const torsoGeo = trackGeo(new THREE.BoxGeometry(0.41, 0.47, 0.24));
  const hipsGeo = trackGeo(new THREE.BoxGeometry(0.39, 0.16, 0.23));
  const upperArmGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.058, 0.24, 7));
  const forearmGeo = trackGeo(new THREE.CylinderGeometry(0.052, 0.044, 0.25, 7));
  const handGeo = trackGeo(new THREE.SphereGeometry(0.05, 7, 6));
  const thighGeo = trackGeo(new THREE.CylinderGeometry(0.084, 0.072, 0.34, 7));
  const shinGeo = trackGeo(new THREE.CylinderGeometry(0.064, 0.052, 0.32, 7));
  const footGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.068, 0.21));
  const dhotiGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.25, 0.56, 10));
  const sareeSkirtGeo = trackGeo(new THREE.CylinderGeometry(0.2, 0.31, 0.62, 10));
  const kurtaHemGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 0.38, 10));
  const hairCapGeo = trackGeo(
    new THREE.SphereGeometry(0.194, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
  );
  const bunGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
  const turbanGeo = trackGeo(new THREE.TorusGeometry(0.175, 0.055, 7, 14));
  const turbanTopGeo = trackGeo(
    new THREE.SphereGeometry(0.195, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52),
  );

  // Shared bicycle geometries
  const bikeTireGeo = trackGeo(new THREE.TorusGeometry(0.33, 0.028, 7, 16));
  const bikeRimGeo = trackGeo(new THREE.TorusGeometry(0.3, 0.011, 5, 14));
  const bikeSpokeGeo = trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4));
  const bikeSeatGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.055, 0.22));

  const skinMats = NATURAL_SKIN_HEXES.map((hex) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.64,
        metalness: 0.0,
      }),
    ),
  );

  const hairDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 0.78 }),
  );
  const hairGreyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xbcb8b0, roughness: 0.82 }),
  );
  const sandalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4f3422, roughness: 0.78 }),
  );
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.82 }),
  );
  const charpaiWeaveMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.charpaiWeave,
      roughness: 0.92,
    }),
  );
  const bikeTireMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.88 }),
  );
  const bikeChromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd0d5da,
      roughness: 0.24,
      metalness: 0.88,
    }),
  );
  const bikeLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x57331d, roughness: 0.68 }),
  );

  const faceMats = new Map<string, THREE.MeshStandardMaterial>();
  const animalCoatMats = new Map<string, THREE.MeshStandardMaterial>();

  return {
    geometries,
    materials,
    textures: createdTextures,
    shadowGeo,
    shadowMat,
    headGeo,
    neckGeo,
    torsoGeo,
    hipsGeo,
    upperArmGeo,
    forearmGeo,
    handGeo,
    thighGeo,
    shinGeo,
    footGeo,
    dhotiGeo,
    sareeSkirtGeo,
    kurtaHemGeo,
    hairCapGeo,
    bunGeo,
    turbanGeo,
    turbanTopGeo,
    bikeTireGeo,
    bikeRimGeo,
    bikeSpokeGeo,
    bikeSeatGeo,
    faceMats,
    animalCoatMats,
    skinMats,
    hairDarkMat,
    hairGreyMat,
    sandalMat,
    woodMat,
    charpaiWeaveMat,
    bikeTireMat,
    bikeChromeMat,
    bikeLeatherMat,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of createdTextures) t.dispose();
      geometries.length = 0;
      materials.length = 0;
      createdTextures.length = 0;
      faceMats.clear();
      animalCoatMats.clear();
    },
  };
}

function getPooledFaceMaterial(
  pool: NpcAssetPool,
  archetype: VillagerArchetype,
  skinIndex: number,
  seed: number,
): THREE.MeshStandardMaterial {
  const mustache =
    archetype === 'elder'
      ? 'white'
      : archetype === 'man' || archetype === 'vendor'
        ? 'dark'
        : 'none';
  const bindi = archetype === 'woman';
  const child = archetype === 'child_boy' || archetype === 'child_girl';
  const key = `${archetype}_${skinIndex}_${seed % 2}`;
  const existing = pool.faceMats.get(key);
  if (existing) return existing;

  const tex = createVillagerFaceTexture(NATURAL_SKIN_HEXES[skinIndex], {
    mustache,
    bindi,
    child,
    seed,
  });
  pool.textures.push(tex);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.64,
    metalness: 0.0,
  });
  pool.materials.push(mat);
  pool.faceMats.set(key, mat);
  return mat;
}

function buildRideableBicycle(
  pool: NpcAssetPool,
  frameColor: number,
): VillagerBikeParts {
  const root = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.36,
    metalness: 0.72,
  });
  pool.materials.push(frameMat);

  const wheelY = 0.33;
  const makeWheel = (wz: number): THREE.Group => {
    const wg = new THREE.Group();
    wg.position.set(0, wheelY, wz);

    const spinGroup = new THREE.Group();
    spinGroup.rotation.y = Math.PI / 2;
    const tire = new THREE.Mesh(pool.bikeTireGeo, pool.bikeTireMat);
    const rim = new THREE.Mesh(pool.bikeRimGeo, pool.bikeChromeMat);
    spinGroup.add(tire, rim);

    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(pool.bikeSpokeGeo, pool.bikeChromeMat);
      spoke.rotation.z = (s * Math.PI) / 3;
      spinGroup.add(spoke);
    }
    wg.add(spinGroup);
    root.add(wg);
    return wg;
  };

  const rearWheel = makeWheel(-0.52);
  const frontWheel = makeWheel(0.52);

  const addTube = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D = root,
  ) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
    pool.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(mesh);
  };

  const rearHub = new THREE.Vector3(0, wheelY, -0.52);
  const crankPos = new THREE.Vector3(0, 0.31, -0.06);
  const seatTop = new THREE.Vector3(0, 0.78, -0.18);
  const headTop = new THREE.Vector3(0, 0.82, 0.38);
  const headBot = new THREE.Vector3(0, 0.65, 0.42);
  const frontHub = new THREE.Vector3(0, wheelY, 0.52);

  addTube(rearHub, crankPos, 0.017, frameMat);
  addTube(rearHub, seatTop, 0.017, frameMat);
  addTube(crankPos, seatTop, 0.02, frameMat);
  addTube(crankPos, headBot, 0.02, frameMat);
  addTube(seatTop, headTop, 0.018, frameMat);
  addTube(headBot, headTop, 0.022, frameMat);
  addTube(headBot, frontHub, 0.016, frameMat);

  // Saddle
  const seat = new THREE.Mesh(pool.bikeSeatGeo, pool.bikeLeatherMat);
  seat.position.set(0, 0.82, -0.19);
  root.add(seat);

  // Handlebar group
  const handlebar = new THREE.Group();
  handlebar.position.set(0, 0.85, 0.37);
  const barGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6);
  barGeo.rotateZ(Math.PI / 2);
  pool.geometries.push(barGeo);
  const bar = new THREE.Mesh(barGeo, pool.bikeChromeMat);
  handlebar.add(bar);
  root.add(handlebar);

  // Spinning pedal crank
  const crank = new THREE.Group();
  crank.position.copy(crankPos);
  const gearGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10);
  gearGeo.rotateZ(Math.PI / 2);
  pool.geometries.push(gearGeo);
  const gear = new THREE.Mesh(gearGeo, pool.bikeChromeMat);
  crank.add(gear);

  const pedalGeo = new THREE.BoxGeometry(0.08, 0.024, 0.045);
  pool.geometries.push(pedalGeo);
  const leftPedal = new THREE.Mesh(pedalGeo, pool.bikeTireMat);
  leftPedal.position.set(-0.14, 0.11, 0);
  const rightPedal = new THREE.Mesh(pedalGeo, pool.bikeTireMat);
  rightPedal.position.set(0.14, -0.11, 0);
  crank.add(leftPedal, rightPedal);
  root.add(crank);

  return { root, frontWheel, rearWheel, crank, handlebar };
}

export interface VillagerBuildOptions {
  archetype: VillagerArchetype;
  seed: number;
  withBike?: boolean;
  withCricketBat?: boolean;
  withBasket?: boolean;
  withMatka?: boolean;
  withWalkingStick?: boolean;
  withJhola?: boolean;
  withSpectacles?: boolean;
  withChalkStick?: boolean;
}

export function createVillagerNpc(
  pool: NpcAssetPool,
  opts: VillagerBuildOptions,
): VillagerRig {
  const { archetype, seed } = opts;
  const isChild = archetype === 'child_boy' || archetype === 'child_girl';
  const isWoman = archetype === 'woman';
  const isElder = archetype === 'elder';

  const root = new THREE.Group();
  root.userData.isAmbientNpc = true;

  const heightScale = isChild
    ? 0.78 + (seed % 3) * 0.03
    : isElder
      ? 1.04
      : isWoman
        ? 1.0
        : 1.05;
  root.scale.setScalar(heightScale);

  const shadowPlane = new THREE.Mesh(pool.shadowGeo, pool.shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  root.add(shadowPlane);

  const skinIdx = seed % pool.skinMats.length;
  const skinMat = pool.skinMats[skinIdx];
  const faceMat = getPooledFaceMaterial(pool, archetype, skinIdx, seed);

  // Outfit materials
  let topColor = KURTA_PALETTE[seed % KURTA_PALETTE.length];
  let bottomColor = 0xf0e7d6;
  let accentColor = 0xc94228;

  if (isWoman) {
    const sp = SAREE_PALETTE[seed % SAREE_PALETTE.length];
    topColor = sp.main;
    bottomColor = sp.main;
    accentColor = sp.border;
  } else if (isChild) {
    topColor = CHILD_TOP_PALETTE[seed % CHILD_TOP_PALETTE.length];
    bottomColor = archetype === 'child_girl' ? topColor : 0x2e3f58;
    accentColor = 0xe8ba48;
  } else if (isElder) {
    topColor = 0xf4eee0;
    bottomColor = 0xefe7d5;
    accentColor = seed % 2 === 0 ? 0xd67c2b : 0xb3382c;
  } else if (archetype === 'vendor') {
    topColor = seed % 2 === 0 ? 0xe5d3b0 : 0xc6d5dc;
    bottomColor = 0x6f5a44;
    accentColor = 0xc43628;
  } else {
    bottomColor = seed % 2 === 0 ? 0xebe2d0 : 0x454a56;
    accentColor = seed % 2 === 0 ? 0xc43628 : 0x2a6658;
  }

  const topMat = new THREE.MeshStandardMaterial({
    color: topColor,
    roughness: 0.85,
  });
  const bottomMat = new THREE.MeshStandardMaterial({
    color: bottomColor,
    roughness: 0.88,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.78,
  });
  pool.materials.push(topMat, bottomMat, accentMat);

  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0.66;
  root.add(bodyRoot);

  // Legs
  const makeLeg = (xOffset: number): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(xOffset, 0, 0);

    const thighMat =
      archetype === 'child_girl' ? skinMat : bottomMat;
    const thigh = new THREE.Mesh(pool.thighGeo, thighMat);
    thigh.position.y = -0.16;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.32, 0);
    hip.add(knee);

    const shinMat = isChild ? skinMat : bottomMat;
    const shin = new THREE.Mesh(pool.shinGeo, shinMat);
    shin.position.y = -0.15;
    knee.add(shin);

    const foot = new THREE.Mesh(pool.footGeo, pool.sandalMat);
    foot.position.set(0, -0.31, 0.04);
    knee.add(foot);

    return { hip, knee };
  };

  const leftLegParts = makeLeg(-0.115);
  const rightLegParts = makeLeg(0.115);
  bodyRoot.add(leftLegParts.hip, rightLegParts.hip);

  // Torso
  const torso = new THREE.Group();
  bodyRoot.add(torso);

  const hipsMesh = new THREE.Mesh(pool.hipsGeo, bottomMat);
  hipsMesh.position.y = 0.04;
  torso.add(hipsMesh);

  const chestMesh = new THREE.Mesh(pool.torsoGeo, topMat);
  chestMesh.position.y = 0.33;
  torso.add(chestMesh);

  // Traditional garment silhouettes
  if (isWoman) {
    // Flowing saree skirt + diagonal draped pallu + zari border
    const sareeSkirt = new THREE.Mesh(pool.sareeSkirtGeo, topMat);
    sareeSkirt.scale.set(1.0, 1.0, 0.76);
    sareeSkirt.position.y = -0.16;
    torso.add(sareeSkirt);

    const borderGeo = new THREE.CylinderGeometry(0.295, 0.315, 0.08, 10);
    pool.geometries.push(borderGeo);
    const border = new THREE.Mesh(borderGeo, accentMat);
    border.scale.set(1.0, 1.0, 0.76);
    border.position.y = -0.43;
    torso.add(border);

    const palluGeo = new THREE.BoxGeometry(0.13, 0.56, 0.27);
    pool.geometries.push(palluGeo);
    const pallu = new THREE.Mesh(palluGeo, accentMat);
    pallu.position.set(-0.04, 0.33, 0.01);
    pallu.rotation.z = 0.54;
    torso.add(pallu);
  } else if (isElder) {
    // Draped traditional dhoti & long white kurta + shoulder shawl/gamcha
    const dhoti = new THREE.Mesh(pool.dhotiGeo, bottomMat);
    dhoti.scale.set(1.0, 1.0, 0.72);
    dhoti.position.y = -0.14;
    torso.add(dhoti);

    const kurtaHem = new THREE.Mesh(pool.kurtaHemGeo, topMat);
    kurtaHem.scale.set(1.0, 1.0, 0.68);
    kurtaHem.position.y = -0.02;
    torso.add(kurtaHem);

    const gamchaGeo = new THREE.BoxGeometry(0.11, 0.42, 0.28);
    pool.geometries.push(gamchaGeo);
    const gamcha = new THREE.Mesh(gamchaGeo, accentMat);
    gamcha.position.set(0.14, 0.36, 0.01);
    torso.add(gamcha);
  } else if (archetype === 'man' || archetype === 'vendor') {
    const kurtaHem = new THREE.Mesh(pool.kurtaHemGeo, topMat);
    kurtaHem.scale.set(1.0, 1.0, 0.68);
    kurtaHem.position.y = -0.04;
    torso.add(kurtaHem);

    // Classic red/cream village gamcha on shoulder
    const gamchaGeo = new THREE.BoxGeometry(0.1, 0.38, 0.27);
    pool.geometries.push(gamchaGeo);
    const gamcha = new THREE.Mesh(gamchaGeo, accentMat);
    gamcha.position.set(-0.14, 0.37, 0.01);
    torso.add(gamcha);
  } else if (archetype === 'child_girl') {
    const frockGeo = new THREE.CylinderGeometry(0.19, 0.34, 0.42, 10);
    pool.geometries.push(frockGeo);
    const frock = new THREE.Mesh(frockGeo, topMat);
    frock.scale.set(1.0, 1.0, 0.8);
    frock.position.y = -0.08;
    torso.add(frock);
  }

  // Arms
  const makeArm = (xOffset: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOffset, 0.5, 0);

    const upper = new THREE.Mesh(pool.upperArmGeo, topMat);
    upper.position.y = -0.11;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.22, 0);
    shoulder.add(elbow);

    const longSleeve = isElder || archetype === 'man';
    const fore = new THREE.Mesh(pool.forearmGeo, longSleeve ? topMat : skinMat);
    fore.position.y = -0.12;
    elbow.add(fore);

    const hand = new THREE.Mesh(pool.handGeo, skinMat);
    hand.position.y = -0.25;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArmParts = makeArm(-0.27);
  const rightArmParts = makeArm(0.27);
  torso.add(leftArmParts.shoulder, rightArmParts.shoulder);

  // Head + clear face sphere oriented so UV center faces +Z
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  torso.add(head);

  const neck = new THREE.Mesh(pool.neckGeo, skinMat);
  neck.position.y = 0.02;
  head.add(neck);

  const headMesh = new THREE.Mesh(pool.headGeo, skinMat);
  headMesh.position.y = 0.17;
  head.add(headMesh);

  // Curved face patch on front (+Z) of head so face texture is crisp and undistorted
  const faceGeo = new THREE.SphereGeometry(
    0.188,
    12,
    10,
    -Math.PI * 0.34,
    Math.PI * 0.68,
    Math.PI * 0.22,
    Math.PI * 0.58,
  );
  pool.geometries.push(faceGeo);
  const facePatch = new THREE.Mesh(faceGeo, faceMat);
  facePatch.position.y = 0.17;
  facePatch.rotation.y = Math.PI * 0.5;
  head.add(facePatch);

  // Hair / Pagri Turban / Bun
  const hairMat = isElder ? pool.hairGreyMat : pool.hairDarkMat;
  if (isElder) {
    // Traditional Indian village pagri (turban)
    const turbanRing = new THREE.Mesh(pool.turbanGeo, accentMat);
    turbanRing.rotation.x = Math.PI / 2 - 0.12;
    turbanRing.position.set(0, 0.25, -0.01);
    head.add(turbanRing);

    const turbanCrown = new THREE.Mesh(pool.turbanTopGeo, accentMat);
    turbanCrown.position.set(0, 0.22, -0.01);
    head.add(turbanCrown);
  } else {
    const cap = new THREE.Mesh(pool.hairCapGeo, hairMat);
    cap.position.set(0, 0.175, -0.015);
    cap.rotation.x = -0.18;
    head.add(cap);

    if (isWoman || archetype === 'child_girl') {
      const bun = new THREE.Mesh(pool.bunGeo, hairMat);
      bun.position.set(0, 0.21, -0.17);
      head.add(bun);

      if (isWoman) {
        const gajraGeo = new THREE.TorusGeometry(0.072, 0.016, 5, 10);
        pool.geometries.push(gajraGeo);
        const gajraMat = new THREE.MeshStandardMaterial({
          color: 0xfbf4e4,
          roughness: 0.72,
        });
        pool.materials.push(gajraMat);
        const gajra = new THREE.Mesh(gajraGeo, gajraMat);
        gajra.position.set(0, 0.21, -0.14);
        head.add(gajra);
      }
    }
  }

  // Optional authentic hand/head props
  if (opts.withCricketBat) {
    const batGroup = new THREE.Group();
    const handleGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.24, 6);
    const bladeGeo = new THREE.BoxGeometry(0.095, 0.52, 0.032);
    pool.geometries.push(handleGeo, bladeGeo);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2a292b, roughness: 0.85 });
    const willowMat = new THREE.MeshStandardMaterial({ color: 0xdab27c, roughness: 0.72 });
    pool.materials.push(gripMat, willowMat);
    const handle = new THREE.Mesh(handleGeo, gripMat);
    handle.position.y = -0.08;
    const blade = new THREE.Mesh(bladeGeo, willowMat);
    blade.position.y = -0.44;
    batGroup.add(handle, blade);
    batGroup.position.set(0, -0.24, 0.04);
    batGroup.rotation.x = 0.25;
    rightArmParts.elbow.add(batGroup);
  }

  if (opts.withWalkingStick) {
    const stickGeo = new THREE.CylinderGeometry(0.018, 0.015, 1.05, 6);
    pool.geometries.push(stickGeo);
    const stick = new THREE.Mesh(stickGeo, pool.woodMat);
    stick.position.set(0, -0.58, 0.08);
    stick.rotation.x = 0.15;
    rightArmParts.elbow.add(stick);
  }

  if (opts.withJhola) {
    const jholaGeo = new THREE.BoxGeometry(0.22, 0.26, 0.1);
    pool.geometries.push(jholaGeo);
    const jholaMat = new THREE.MeshStandardMaterial({
      color: seed % 2 === 0 ? 0xc29e68 : 0x9c4832,
      roughness: 0.92,
    });
    pool.materials.push(jholaMat);
    const jhola = new THREE.Mesh(jholaGeo, jholaMat);
    jhola.position.set(0, -0.36, 0.02);
    leftArmParts.elbow.add(jhola);
  }

  if (opts.withBasket) {
    const basketGeo = new THREE.CylinderGeometry(0.24, 0.16, 0.18, 10);
    pool.geometries.push(basketGeo);
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xb3844c, roughness: 0.9 });
    const veggieMat = new THREE.MeshStandardMaterial({ color: 0x4b8736, roughness: 0.8 });
    pool.materials.push(basketMat, veggieMat);
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.position.set(0, -0.32, 0.14);
    const veggies = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), veggieMat);
    pool.geometries.push(veggies.geometry);
    veggies.scale.set(1, 0.55, 1);
    veggies.position.set(0, 0.08, 0);
    basket.add(veggies);
    leftArmParts.elbow.add(basket);
  }

  if (opts.withMatka) {
    const matkaGeo = new THREE.SphereGeometry(0.18, 10, 8);
    pool.geometries.push(matkaGeo);
    const matkaMat = new THREE.MeshStandardMaterial({ color: 0xa44d30, roughness: 0.86 });
    pool.materials.push(matkaMat);
    const matka = new THREE.Mesh(matkaGeo, matkaMat);
    matka.scale.set(1.0, 0.9, 1.0);
    matka.position.set(0, 0.52, 0);
    head.add(matka);
  }

  if (opts.withSpectacles) {
    // Classic 1990s village schoolmaster round wire-rim glasses
    const rimGeo = new THREE.TorusGeometry(0.044, 0.006, 6, 12);
    const bridgeGeo = new THREE.BoxGeometry(0.032, 0.008, 0.008);
    pool.geometries.push(rimGeo, bridgeGeo);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x26221e,
      metalness: 0.7,
      roughness: 0.3,
    });
    pool.materials.push(rimMat);
    const leftLens = new THREE.Mesh(rimGeo, rimMat);
    leftLens.position.set(-0.056, 0.18, 0.175);
    const rightLens = new THREE.Mesh(rimGeo, rimMat);
    rightLens.position.set(0.056, 0.18, 0.175);
    const bridge = new THREE.Mesh(bridgeGeo, rimMat);
    bridge.position.set(0, 0.182, 0.178);
    head.add(leftLens, rightLens, bridge);
  }

  if (opts.withChalkStick) {
    // Wooden blackboard pointer / chalk stick in teacher's right hand
    const pointerGeo = new THREE.CylinderGeometry(0.009, 0.012, 0.42, 6);
    const chalkGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.08, 6);
    pool.geometries.push(pointerGeo, chalkGeo);
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0xf8f6ef, roughness: 0.92 });
    pool.materials.push(chalkMat);
    const pointer = new THREE.Mesh(pointerGeo, pool.woodMat);
    pointer.position.set(0, -0.34, 0.16);
    pointer.rotation.x = 1.15;
    rightArmParts.elbow.add(pointer);

    const chalk = new THREE.Mesh(chalkGeo, chalkMat);
    chalk.position.set(0, -0.25, 0.05);
    chalk.rotation.x = Math.PI / 2;
    leftArmParts.elbow.add(chalk);
  }

  let bike: VillagerBikeParts | null = null;
  if (opts.withBike) {
    const bikeColors = [0x1c2428, 0x1d4d3a, 0x203a5e, 0x6b2420];
    bike = buildRideableBicycle(pool, bikeColors[seed % bikeColors.length]);
    // Keep bicycle at natural size relative to child
    bike.root.scale.setScalar(1 / heightScale * 0.92);
    root.add(bike.root);
    shadowPlane.scale.set(1.3, 1.85, 1);
  }

  const rig: VillagerRig = {
    root,
    bodyRoot,
    torso,
    head,
    leftArm: leftArmParts.shoulder,
    leftForearm: leftArmParts.elbow,
    rightArm: rightArmParts.shoulder,
    rightForearm: rightArmParts.elbow,
    leftLeg: leftLegParts.hip,
    leftShin: leftLegParts.knee,
    rightLeg: rightLegParts.hip,
    rightShin: rightLegParts.knee,
    bike,
    shadowPlane,
    walkPhase: (seed * 1.37) % (Math.PI * 2),
    idlePhase: (seed * 2.13) % (Math.PI * 2),
    archetype,

    updatePose(mode, dt, speed, actionPhase = 0, steerAngle = 0) {
      rig.idlePhase += dt;
      const t = rig.idlePhase;
      const k = 10;

      if (mode === 'slapped' || mode === 'slapped_seated') {
        // actionPhase runs 0 -> 1 across the ~1.2s comical slap recoil & indignant reaction
        const p = THREE.MathUtils.clamp(actionPhase, 0, 1);
        const recoil = p < 0.38 ? Math.sin((p / 0.38) * Math.PI) : 0;
        const scold = p >= 0.34 ? Math.sin(((p - 0.34) / 0.66) * Math.PI) : 0;
        const shake = Math.sin(t * 22);

        const baseY = mode === 'slapped_seated' ? 0.52 : bike ? 0.88 : 0.66;
        const hopY = mode === 'slapped_seated' || bike ? recoil * 0.06 : recoil * 0.14;
        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, baseY + hopY, 18, dt);

        torso.rotation.x = THREE.MathUtils.damp(
          torso.rotation.x,
          -0.28 * recoil + 0.08 * scold,
          16,
          dt,
        );
        torso.rotation.y = THREE.MathUtils.damp(
          torso.rotation.y,
          0.42 * recoil + shake * 0.08 * scold,
          16,
          dt,
        );
        torso.rotation.z = THREE.MathUtils.damp(
          torso.rotation.z,
          -0.22 * recoil + shake * 0.05 * scold,
          16,
          dt,
        );

        // Head whips sideways on impact, then shakes indignantly!
        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -0.2 * recoil, 18, dt);
        head.rotation.y = THREE.MathUtils.damp(
          head.rotation.y,
          0.62 * recoil + Math.sin(t * 16) * 0.28 * scold,
          18,
          dt,
        );
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, -0.26 * recoil, 18, dt);

        // Left hand clutches cheek in shock, right hand waves indignantly!
        leftArmParts.shoulder.rotation.set(
          -1.65 * recoil - 1.25 * scold,
          0,
          0.32 * recoil + 0.12 * scold,
        );
        leftArmParts.elbow.rotation.x = -1.65;
        rightArmParts.shoulder.rotation.set(
          -1.85 * recoil - (1.1 + Math.sin(t * 18) * 0.45) * scold,
          0,
          -0.48 * recoil - 0.25 * scold,
        );
        rightArmParts.elbow.rotation.x = -0.55 - 0.55 * scold;

        if (mode === 'slapped_seated') {
          leftLegParts.hip.rotation.set(-1.38, 0, -0.06);
          rightLegParts.hip.rotation.set(-1.38, 0, 0.06);
          leftLegParts.knee.rotation.x = 1.38;
          rightLegParts.knee.rotation.x = 1.38;
        } else if (!bike) {
          leftLegParts.hip.rotation.set(-0.22 * recoil, 0, -0.14 * recoil);
          rightLegParts.hip.rotation.set(0.24 * recoil, 0, 0.14 * recoil);
          leftLegParts.knee.rotation.x = 0.32 * recoil + 0.08;
          rightLegParts.knee.rotation.x = 0.24 * recoil + 0.08;
        }
        return;
      }

      if (mode === 'cycle' && bike) {
        rig.walkPhase += dt * Math.max(2.5, speed * 2.6);
        const wheelSpin = dt * speed * 3.1;
        bike.frontWheel.rotation.x += wheelSpin;
        bike.rearWheel.rotation.x += wheelSpin;
        bike.crank.rotation.x += wheelSpin * 0.95;
        bike.handlebar.rotation.y = THREE.MathUtils.damp(
          bike.handlebar.rotation.y,
          steerAngle * 0.55,
          10,
          dt,
        );

        const pedal = rig.walkPhase;
        bodyRoot.position.set(0, 0.88, -0.18);
        torso.rotation.set(0.32, 0, Math.sin(pedal) * 0.04);
        head.rotation.set(-0.22, steerAngle * 0.35, 0);

        // Hands gripping handlebars forward
        leftArmParts.shoulder.rotation.set(-1.18, 0, 0.14);
        rightArmParts.shoulder.rotation.set(-1.18, 0, -0.14);
        leftArmParts.elbow.rotation.x = -0.35;
        rightArmParts.elbow.rotation.x = -0.35;

        // Pumping pedals smoothly
        const lP = Math.sin(pedal);
        const rP = Math.sin(pedal + Math.PI);
        leftLegParts.hip.rotation.x = -0.78 + lP * 0.44;
        rightLegParts.hip.rotation.x = -0.78 + rP * 0.44;
        leftLegParts.knee.rotation.x = 0.88 - lP * 0.38;
        rightLegParts.knee.rotation.x = 0.88 - rP * 0.38;
        return;
      }

      if (mode === 'sit_charpai') {
        const breathe = Math.sin(t * 2.1) * 0.012;
        const chatGesture = Math.sin(t * 2.7 + seed);
        bodyRoot.position.set(0, 0.52 + breathe, 0);
        torso.rotation.set(
          0.06 + Math.sin(t * 1.4) * 0.03,
          Math.sin(t * 0.85 + seed) * 0.12,
          0,
        );
        head.rotation.set(
          Math.sin(t * 1.8) * 0.07,
          Math.sin(t * 0.95 + seed) * 0.24,
          Math.cos(t * 1.1) * 0.04,
        );
        // Legs bent naturally over the edge of the woven charpai
        leftLegParts.hip.rotation.set(-1.38, 0, -0.06);
        rightLegParts.hip.rotation.set(-1.38, 0, 0.06);
        leftLegParts.knee.rotation.x = 1.38 + Math.sin(t * 1.6) * 0.06;
        rightLegParts.knee.rotation.x = 1.36 - Math.sin(t * 1.6) * 0.06;

        // Relaxed seated hands with occasional conversational gesturing
        leftArmParts.shoulder.rotation.set(-0.35, 0, 0.14);
        leftArmParts.elbow.rotation.x = -0.75;
        rightArmParts.shoulder.rotation.set(
          -0.48 - Math.max(0, chatGesture) * 0.38,
          0,
          -0.16,
        );
        rightArmParts.elbow.rotation.x = -0.82 - Math.max(0, chatGesture) * 0.3;
        return;
      }

      if (mode === 'sit_bench') {
        // Seated student at a 1995 wooden school desk & bench (listening & writing notes)
        const breathe = Math.sin(t * 2.3 + seed) * 0.008;
        const writeCycle = Math.sin(t * 4.8 + seed * 1.7);
        const lookUp = Math.sin(t * 0.72 + seed) > 0.15;

        bodyRoot.position.set(0, 0.48 + breathe, 0);
        torso.rotation.set(lookUp ? 0.08 : 0.22, Math.sin(t * 0.65 + seed) * 0.08, 0);
        head.rotation.set(
          lookUp ? -0.06 + Math.sin(t * 1.9) * 0.05 : 0.22,
          Math.sin(t * 0.85 + seed) * 0.16,
          0,
        );

        // Legs tucked neatly under the school desk
        leftLegParts.hip.rotation.set(-1.42, 0, -0.05);
        rightLegParts.hip.rotation.set(-1.42, 0, 0.05);
        leftLegParts.knee.rotation.x = 1.44;
        rightLegParts.knee.rotation.x = 1.44;

        // Left hand steadying slate/notebook, right hand writing gently on desk
        leftArmParts.shoulder.rotation.set(-0.68, 0, 0.12);
        leftArmParts.elbow.rotation.x = -0.86;
        rightArmParts.shoulder.rotation.set(
          -0.72 + (lookUp ? 0 : writeCycle * 0.05),
          lookUp ? 0 : writeCycle * 0.1,
          -0.12,
        );
        rightArmParts.elbow.rotation.x = -0.88 + (lookUp ? 0.08 : writeCycle * 0.08);
        return;
      }

      if (mode === 'teach') {
        // 1995 village schoolmaster: alternating between explaining to class and pointing at the blackboard
        const phase = (t * 0.26) % 1;
        const turnToBoard = phase > 0.64 && phase < 0.92;
        const boardBlend = turnToBoard
          ? Math.sin(((phase - 0.64) / 0.28) * Math.PI)
          : 0;
        const explainWave = Math.sin(t * 3.1);

        bodyRoot.position.set(0, 0.66 + Math.abs(Math.sin(t * 1.6)) * 0.01, 0);
        torso.rotation.set(
          0.05,
          -boardBlend * 1.05 + Math.sin(t * 0.9) * 0.18 * (1 - boardBlend),
          Math.sin(t * 1.2) * 0.02,
        );
        head.rotation.set(
          -0.06 * boardBlend + Math.sin(t * 2.2) * 0.07,
          -boardBlend * 0.55 + Math.sin(t * 1.1) * 0.28 * (1 - boardBlend),
          0,
        );

        leftLegParts.hip.rotation.set(0.04, 0, -0.06);
        rightLegParts.hip.rotation.set(-0.04, 0, 0.06);
        leftLegParts.knee.rotation.x = 0.05;
        rightLegParts.knee.rotation.x = 0.05;

        // Right arm gestures with wooden pointer / points up at blackboard
        rightArmParts.shoulder.rotation.set(
          -0.68 - boardBlend * 0.95 - Math.max(0, explainWave) * 0.35 * (1 - boardBlend),
          0,
          -0.18 - boardBlend * 0.28,
        );
        rightArmParts.elbow.rotation.x = -0.62 + boardBlend * 0.25;
        // Left arm holds chalk / gestures gently
        leftArmParts.shoulder.rotation.set(
          -0.46 - Math.max(0, -explainWave) * 0.24,
          0,
          0.16,
        );
        leftArmParts.elbow.rotation.x = -0.78;
        return;
      }

      if (mode === 'cricket_bat') {
        // Batting cycle: stance -> backlift -> crisp front-foot drive -> follow-through
        const p = actionPhase % 1;
        const swing =
          p > 0.42 && p < 0.66
            ? Math.sin(((p - 0.42) / 0.24) * Math.PI)
            : 0;
        bodyRoot.position.set(0, 0.61 - swing * 0.04, 0);
        torso.rotation.set(0.24, -0.45 + swing * 1.15, 0.08 * swing);
        head.rotation.set(-0.1, 0.42 - swing * 0.45, 0);

        leftLegParts.hip.rotation.set(-0.28 - swing * 0.28, 0, -0.16);
        rightLegParts.hip.rotation.set(0.18, 0, 0.16);
        leftLegParts.knee.rotation.x = 0.42 + swing * 0.25;
        rightLegParts.knee.rotation.x = 0.25;

        rightArmParts.shoulder.rotation.set(-0.55 - swing * 1.1, 0, -0.22);
        rightArmParts.elbow.rotation.x = -0.58 + swing * 0.3;
        leftArmParts.shoulder.rotation.set(-0.68 - swing * 0.75, 0, 0.35);
        leftArmParts.elbow.rotation.x = -0.7;
        return;
      }

      if (mode === 'cricket_bowl') {
        // Bowler: jogging approach + classic overarm bowling windmill release
        const p = actionPhase % 1;
        const bowlingWindow = p < 0.36;
        if (bowlingWindow) {
          const u = p / 0.36;
          rig.walkPhase += dt * 11;
          const sw = Math.sin(rig.walkPhase);
          bodyRoot.position.set(0, 0.66 + Math.abs(sw) * 0.05, 0);
          torso.rotation.set(0.18, Math.sin(u * Math.PI) * 0.4, 0);
          leftLegParts.hip.rotation.x = sw * 0.55;
          rightLegParts.hip.rotation.x = -sw * 0.55;
          leftLegParts.knee.rotation.x = Math.max(0, -sw) * 0.6;
          rightLegParts.knee.rotation.x = Math.max(0, sw) * 0.6;
          // Full overarm bowling arm rotation at release
          const armSpin = u > 0.5 ? -((u - 0.5) / 0.5) * Math.PI * 1.85 : -0.3;
          rightArmParts.shoulder.rotation.set(armSpin, 0, -0.18);
          rightArmParts.elbow.rotation.x = -0.15;
          leftArmParts.shoulder.rotation.set(-0.85 * Math.sin(u * Math.PI), 0, 0.22);
          leftArmParts.elbow.rotation.x = -0.45;
          head.rotation.set(-0.08, 0, 0);
        } else {
          // Watching the shot & clapping/waiting for fielder return
          const bob = Math.sin(t * 2.4) * 0.015;
          bodyRoot.position.set(0, 0.66 + bob, 0);
          torso.rotation.set(0.06, Math.sin(t * 1.2) * 0.08, 0);
          leftLegParts.hip.rotation.set(0, 0, -0.06);
          rightLegParts.hip.rotation.set(0, 0, 0.06);
          leftLegParts.knee.rotation.x = 0.08;
          rightLegParts.knee.rotation.x = 0.08;
          leftArmParts.shoulder.rotation.set(-0.25, 0, 0.14);
          rightArmParts.shoulder.rotation.set(-0.25, 0, -0.14);
          leftArmParts.elbow.rotation.x = -0.4;
          rightArmParts.elbow.rotation.x = -0.4;
          head.rotation.set(0, Math.sin(t * 1.5) * 0.22, 0);
        }
        return;
      }

      if (mode === 'cricket_field') {
        const p = actionPhase % 1;
        const cheer = p > 0.58 && p < 0.85;
        const hop = cheer ? Math.abs(Math.sin(t * 11)) * 0.08 : 0;
        bodyRoot.position.set(0, (cheer ? 0.66 : 0.57) + hop, 0);
        torso.rotation.set(cheer ? 0.04 : 0.34, Math.sin(t * 1.8) * 0.08, 0);
        leftLegParts.hip.rotation.set(cheer ? 0 : -0.35, 0, -0.14);
        rightLegParts.hip.rotation.set(cheer ? 0 : -0.35, 0, 0.14);
        leftLegParts.knee.rotation.x = cheer ? 0.1 : 0.56;
        rightLegParts.knee.rotation.x = cheer ? 0.1 : 0.56;
        leftArmParts.shoulder.rotation.set(cheer ? -2.2 + Math.sin(t * 12) * 0.3 : -0.55, 0, 0.25);
        rightArmParts.shoulder.rotation.set(cheer ? -2.2 - Math.sin(t * 12) * 0.3 : -0.55, 0, -0.25);
        leftArmParts.elbow.rotation.x = -0.45;
        rightArmParts.elbow.rotation.x = -0.45;
        head.rotation.set(cheer ? -0.1 : -0.2, Math.sin(t * 1.6) * 0.18, 0);
        return;
      }

      if (mode === 'talk' || mode === 'sell' || mode === 'buy') {
        const wave = Math.sin(t * (mode === 'sell' ? 3.4 : 2.6) + seed);
        const wave2 = Math.cos(t * 1.9 + seed);
        const sway = Math.sin(t * 1.4 + seed) * 0.025;
        bodyRoot.position.set(0, 0.66 + Math.abs(sway) * 0.4, 0);
        torso.rotation.set(
          mode === 'sell' ? 0.1 + wave * 0.04 : 0.04,
          wave2 * 0.12,
          sway,
        );
        leftLegParts.hip.rotation.set(0.03, 0, -0.05);
        rightLegParts.hip.rotation.set(-0.03, 0, 0.05);
        leftLegParts.knee.rotation.x = 0.06;
        rightLegParts.knee.rotation.x = 0.06;

        // Expressive bargaining / market / chatting gestures
        const rightLift =
          mode === 'sell'
            ? -0.72 - Math.max(0, wave) * 0.45
            : mode === 'buy'
              ? -0.52 - Math.max(0, -wave) * 0.36
              : -0.42 - Math.max(0, wave) * 0.48;
        const leftLift =
          opts.withBasket || opts.withJhola
            ? -0.45
            : -0.35 - Math.max(0, -wave2) * 0.38;

        rightArmParts.shoulder.rotation.set(rightLift, 0, -0.18 - Math.abs(wave) * 0.12);
        rightArmParts.elbow.rotation.x = -0.78 - Math.max(0, wave) * 0.3;
        leftArmParts.shoulder.rotation.set(leftLift, 0, 0.18);
        leftArmParts.elbow.rotation.x = -0.72;

        head.rotation.set(
          Math.sin(t * 2.5 + seed) * 0.09,
          Math.sin(t * 1.2 + seed) * 0.22,
          Math.cos(t * 1.4) * 0.05,
        );
        return;
      }

      // Walk or Idle
      const isWalking = mode === 'walk' && speed > 0.12;
      if (isWalking) {
        rig.walkPhase += dt * (4.3 + speed * 1.6);
      }
      const sinW = Math.sin(rig.walkPhase);
      const cosW = Math.cos(rig.walkPhase);

      const stride = isWalking ? Math.min(0.62, 0.24 + speed * 0.17) : 0;
      const targetHipY = isWalking
        ? 0.66 + Math.abs(sinW) * 0.038
        : 0.66 + Math.sin(t * 2.0) * 0.012;

      bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, targetHipY, k, dt);
      bodyRoot.position.z = THREE.MathUtils.damp(bodyRoot.position.z, 0, k, dt);
      torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, isWalking ? 0.06 : 0.02, k, dt);
      torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, isWalking ? sinW * 0.09 : 0, k, dt);
      torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, isWalking ? cosW * 0.035 : 0, k, dt);

      const lHipX = isWalking ? sinW * stride : 0.02;
      const rHipX = isWalking ? -sinW * stride : -0.02;
      const lKneeX = isWalking ? Math.max(0, -cosW) * stride * 0.95 + 0.06 : 0.05;
      const rKneeX = isWalking ? Math.max(0, cosW) * stride * 0.95 + 0.06 : 0.05;

      leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, lHipX, k, dt);
      rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, rHipX, k, dt);
      leftLegParts.hip.rotation.z = THREE.MathUtils.damp(leftLegParts.hip.rotation.z, 0, k, dt);
      rightLegParts.hip.rotation.z = THREE.MathUtils.damp(rightLegParts.hip.rotation.z, 0, k, dt);
      leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, lKneeX, k, dt);
      rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, rKneeX, k, dt);

      // If woman carries matka on head, raise right arm gently to steady the pot!
      const lArmX = opts.withBasket
        ? -0.52
        : isWalking
          ? -sinW * stride * 0.78
          : Math.sin(t * 1.4) * 0.04;
      const rArmX = opts.withMatka
        ? -2.35
        : opts.withWalkingStick
          ? -0.35 + (isWalking ? sinW * 0.25 : 0)
          : isWalking
            ? sinW * stride * 0.78
            : -Math.sin(t * 1.4) * 0.04;

      leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, lArmX, k, dt);
      rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, rArmX, k, dt);
      leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, 0.1, k, dt);
      rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(
        rightArmParts.shoulder.rotation.z,
        opts.withMatka ? -0.32 : -0.1,
        k,
        dt,
      );
      leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(
        leftArmParts.elbow.rotation.x,
        opts.withBasket ? -0.95 : isWalking ? -0.25 - Math.max(0, -sinW) * 0.28 : -0.16,
        k,
        dt,
      );
      rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(
        rightArmParts.elbow.rotation.x,
        opts.withMatka ? -1.45 : isWalking ? -0.25 - Math.max(0, sinW) * 0.28 : -0.16,
        k,
        dt,
      );

      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, Math.sin(t * 1.2) * 0.03, 6, dt);
      head.rotation.y = THREE.MathUtils.damp(
        head.rotation.y,
        isWalking ? Math.sin(t * 0.65 + seed) * 0.16 : Math.sin(t * 0.8 + seed) * 0.28,
        5,
        dt,
      );
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, 6, dt);
    },
  };

  return rig;
}

/**
 * Generates organic procedural fur / hide textures for Indian village animals
 * with directional bristle grain, natural dappled/piebald markings, and subtle shading.
 */
function createAnimalCoatTexture(
  species: AnimalSpecies,
  variant: number,
  baseHex: number,
  spotHex: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const baseColor = new THREE.Color(baseHex);
  const spotColor = new THREE.Color(spotHex);
  const br = Math.round(baseColor.r * 255);
  const bg = Math.round(baseColor.g * 255);
  const bb = Math.round(baseColor.b * 255);
  const sr = Math.round(spotColor.r * 255);
  const sg = Math.round(spotColor.g * 255);
  const sb = Math.round(spotColor.b * 255);

  // Dorsal-to-ventral coat gradient (slightly darker spine, warmer soft flanks)
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(
    0,
    `rgb(${Math.max(0, br - 18)}, ${Math.max(0, bg - 16)}, ${Math.max(0, bb - 14)})`,
  );
  grad.addColorStop(0.55, `rgb(${br}, ${bg}, ${bb})`);
  grad.addColorStop(
    1,
    `rgb(${Math.min(255, br + 16)}, ${Math.min(255, bg + 14)}, ${Math.min(255, bb + 11)})`,
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // Deterministic pseudo-random helper for repeatable organic markings
  let rng = (variant + 1) * 9301 + species.charCodeAt(0) * 497;
  const rand = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng & 0xffff) / 0xffff;
  };

  if (species === 'cow' || species === 'goat') {
    // Organic dappled / piebald hide patches with feathered edges
    const patchCount = species === 'cow' ? 5 : 4;
    for (let i = 0; i < patchCount; i++) {
      const px = rand() * 128;
      const py = 18 + rand() * 92;
      const rx = 14 + rand() * 22;
      const ry = 10 + rand() * 18;
      const pGrad = ctx.createRadialGradient(px, py, rx * 0.25, px, py, Math.max(rx, ry));
      pGrad.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, 0.88)`);
      pGrad.addColorStop(0.75, `rgba(${sr}, ${sg}, ${sb}, 0.62)`);
      pGrad.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0)`);
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (species === 'buffalo') {
    // Authentic damp slate hide sheen + subtle village mud-dust weathering along lower belly
    const mudGrad = ctx.createLinearGradient(0, 74, 0, 128);
    mudGrad.addColorStop(0, 'rgba(92, 78, 64, 0)');
    mudGrad.addColorStop(1, 'rgba(92, 78, 64, 0.34)');
    ctx.fillStyle = mudGrad;
    ctx.fillRect(0, 74, 128, 54);

    // Subtle skin fold lines along shoulder/neck
    ctx.strokeStyle = 'rgba(14, 15, 18, 0.34)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 20;
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.quadraticCurveTo(x + 4, 64, x - 3, 116);
      ctx.stroke();
    }
  } else {
    // Indian Indie Pariah dog: warm fawn saddle + lighter cream belly/chest
    const saddleGrad = ctx.createLinearGradient(0, 0, 0, 62);
    saddleGrad.addColorStop(0, `rgba(${Math.max(0, br - 36)}, ${Math.max(0, bg - 30)}, ${Math.max(0, bb - 24)}, 0.72)`);
    saddleGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = saddleGrad;
    ctx.fillRect(0, 0, 128, 62);

    const bellyGrad = ctx.createLinearGradient(0, 78, 0, 128);
    bellyGrad.addColorStop(0, 'rgba(242, 230, 210, 0)');
    bellyGrad.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0.65)`);
    ctx.fillStyle = bellyGrad;
    ctx.fillRect(0, 78, 128, 50);
  }

  // Fine directional fur / hide bristle strokes for crisp close-up texture
  const strokeCount = species === 'buffalo' ? 140 : 280;
  ctx.lineWidth = 1.1;
  for (let i = 0; i < strokeCount; i++) {
    const x = rand() * 128;
    const y = rand() * 128;
    const len = 4 + rand() * 7;
    const light = rand() > 0.5;
    ctx.strokeStyle = light
      ? 'rgba(255, 248, 236, 0.11)'
      : 'rgba(22, 16, 12, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.85, y + (rand() - 0.5) * 2.5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function getPooledAnimalCoatMaterial(
  pool: NpcAssetPool,
  species: AnimalSpecies,
  variant: number,
  baseHex: number,
  spotHex: number,
  roughness: number,
): THREE.MeshStandardMaterial {
  const key = `${species}_${variant}`;
  const existing = pool.animalCoatMats.get(key);
  if (existing) return existing;

  const tex = createAnimalCoatTexture(species, variant, baseHex, spotHex);
  pool.textures.push(tex);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness,
    metalness: species === 'buffalo' ? 0.06 : 0.02,
  });
  pool.materials.push(mat);
  pool.animalCoatMats.set(key, mat);
  return mat;
}

/**
 * Builds a smoothly tapered organic tube along a 3D CatmullRomCurve3
 * (ideal for authentic curved buffalo/cow/goat horns and curled pariah dog tails).
 */
function createTaperedTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegments: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    // Smooth organic taper from thick base to fine tip
    const r = radiusStart + (radiusEnd - radiusStart) * Math.pow(u, 0.82);

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = -Math.cos(angle);
      v.set(
        p.x + r * (cos * N.x + sin * B.x),
        p.y + r * (cos * N.y + sin * B.y),
        p.z + r * (cos * N.z + sin * B.z),
      );
      positions.push(v.x, v.y, v.z);
      uvs.push(u, j / radialSegments);
    }
  }

  const ringStride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an anatomical barrel torso using LatheGeometry rotated along +Z
 * (front chest at +Z, muscular shoulders, natural mid-belly, rounded rump at -Z).
 */
function createSculptedTorsoGeometry(
  species: AnimalSpecies,
  bodyW: number,
  bodyH: number,
  bodyL: number,
): THREE.BufferGeometry {
  const halfL = bodyL * 0.5;
  const rBase = bodyH * 0.5;

  // Profile pairs: [normalizedZ from -1 (rump) to +1 (chest), radiusMultiplier]
  const profile: Array<[number, number]> =
    species === 'dog'
      ? [
          [-1.0, 0.0],
          [-0.92, 0.48],
          [-0.68, 0.78], // Hind haunches
          [-0.25, 0.72], // Athletic tucked waist
          [0.22, 0.94], // Deep ribcage
          [0.68, 1.0], // Muscular chest
          [0.92, 0.62],
          [1.0, 0.0],
        ]
      : species === 'buffalo'
        ? [
            [-1.0, 0.0],
            [-0.92, 0.56],
            [-0.65, 0.94],
            [-0.1, 1.06], // Heavy broad barrel
            [0.45, 1.04], // Massive shoulders
            [0.86, 0.78],
            [1.0, 0.0],
          ]
        : species === 'cow'
          ? [
              [-1.0, 0.0],
              [-0.92, 0.52],
              [-0.62, 0.9], // Rounded rump
              [-0.08, 1.02], // Full barrel belly
              [0.42, 0.95], // Shoulder girth
              [0.86, 0.68],
              [1.0, 0.0],
            ]
          : [
              // Slender agile village goat
              [-1.0, 0.0],
              [-0.9, 0.48],
              [-0.58, 0.88],
              [-0.05, 0.96],
              [0.48, 0.88],
              [0.88, 0.58],
              [1.0, 0.0],
            ];

  const pts = profile.map(([nz, rm]) => new THREE.Vector2(Math.max(0.002, rBase * rm), nz * halfL));
  const geo = new THREE.LatheGeometry(pts, 12);
  // Rotate so Lathe +Y maps to +Z (chest forward), -Y maps to -Z (rump back)
  geo.rotateX(Math.PI / 2);
  // Elliptical cross-section matching species width-to-height ratio
  const xRatio = bodyW / bodyH;
  geo.scale(xRatio, 1, 1);

  // Subtle anatomical ventral tuck on dog waist & dorsal flatness on cattle
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (species === 'dog' && y < 0 && z < 0.05) {
      // Lift belly slightly behind ribcage for authentic pariah silhouette
      const tuck = Math.max(0, 1 - Math.abs(z + halfL * 0.35) / (halfL * 0.55));
      pos.setY(i, y + tuck * bodyH * 0.14);
    } else if ((species === 'cow' || species === 'buffalo') && y > rBase * 0.55) {
      // Gently flatten upper spine ridge
      pos.setY(i, y - (y - rBase * 0.55) * 0.18);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds high-craft composite procedural Indian village animals:
 * Desi Zebu Cow (Gaay), Murrah Water Buffalo (Bhains), Village Goat (Bakri),
 * and Indian Pariah Street Dog (Indie).
 * Features sculpted LatheGeometry torsos, tapered curved horns/tails, procedural
 * fur/hide textures, 2-joint articulated legs, chewing jaw, expressive ears,
 * and exact bottom-center ground contact at y = 0.
 */
export function createVillageAnimal(
  pool: NpcAssetPool,
  species: AnimalSpecies,
  seed: number,
): AnimalRig {
  const root = new THREE.Group();
  root.userData.isAmbientNpc = true;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    pool.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    pool.materials.push(m);
    return m;
  };

  // Authentic species physical proportions & Indian village coat variants
  const variantCount = species === 'buffalo' ? 3 : 4;
  const variant = Math.abs(seed) % variantCount;

  const spec =
    species === 'cow'
      ? {
          bodyW: 0.66,
          bodyH: 0.64,
          bodyL: 1.54,
          legH: 0.74,
          upperLegR: 0.088,
          lowerLegR: 0.048,
          neckLen: 0.44,
          headW: 0.27,
          headH: 0.26,
          headL: 0.44,
          coatColor: [0xf3ead8, 0xd49b66, 0xe7e1d6, 0xc9884f][variant],
          spotColor: [0x8b522c, 0xf5efe2, 0x6c5a4d, 0xf2e9da][variant],
          muzzleColor: 0x5c4740,
          roughness: 0.84,
          shadowScaleX: 1.42,
          shadowScaleZ: 2.1,
          hornColor: 0x6b5844,
          eyeColor: 0x1a120d,
        }
      : species === 'buffalo'
        ? {
            bodyW: 0.82,
            bodyH: 0.72,
            bodyL: 1.64,
            legH: 0.7,
            upperLegR: 0.105,
            lowerLegR: 0.06,
            neckLen: 0.4,
            headW: 0.34,
            headH: 0.3,
            headL: 0.48,
            coatColor: [0x2c2e34, 0x35373e, 0x24272d][variant],
            spotColor: 0x1d1f24,
            muzzleColor: 0x202226,
            roughness: 0.58, // Authentic damp/oiled water buffalo hide sheen
            shadowScaleX: 1.62,
            shadowScaleZ: 2.24,
            hornColor: 0x1e1e22,
            eyeColor: 0x141212,
          }
        : species === 'goat'
          ? {
              bodyW: 0.33,
              bodyH: 0.35,
              bodyL: 0.8,
              legH: 0.46,
              upperLegR: 0.048,
              lowerLegR: 0.026,
              neckLen: 0.3,
              headW: 0.16,
              headH: 0.16,
              headL: 0.27,
              coatColor: [0xf1ece2, 0xc58e5a, 0x45362c, 0xe5dac6][variant],
              spotColor: [0x5d412d, 0xf4eee2, 0xece4d8, 0x8d5834][variant],
              muzzleColor: 0x4b3a34,
              roughness: 0.88,
              shadowScaleX: 0.76,
              shadowScaleZ: 1.12,
              hornColor: 0x6d5c4c,
              eyeColor: 0x2a2010,
            }
          : {
              // Authentic Indian Pariah / Indie Street Dog
              bodyW: 0.29,
              bodyH: 0.31,
              bodyL: 0.78,
              legH: 0.4,
              upperLegR: 0.046,
              lowerLegR: 0.025,
              neckLen: 0.24,
              headW: 0.175,
              headH: 0.165,
              headL: 0.29,
              coatColor: [0xd19452, 0xba7539, 0xdbb988, 0x6f4e34][variant],
              spotColor: 0xf4e8d4,
              muzzleColor: 0x2c221d,
              roughness: 0.86,
              shadowScaleX: 0.72,
              shadowScaleZ: 1.08,
              hornColor: 0x2c221c,
              eyeColor: 0x26160c,
            };

  // Subtle natural individual size variation (±7%)
  const sizeJitter = 0.94 + ((seed * 37) % 15) * 0.01;
  root.scale.setScalar(sizeJitter);

  const shadowPlane = new THREE.Mesh(pool.shadowGeo, pool.shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  shadowPlane.scale.set(spec.shadowScaleX, spec.shadowScaleZ, 1);
  root.add(shadowPlane);

  const coatMat = getPooledAnimalCoatMaterial(
    pool,
    species,
    variant,
    spec.coatColor,
    spec.spotColor,
    spec.roughness,
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.spotColor,
      roughness: spec.roughness + 0.04,
      metalness: 0.01,
    }),
  );
  const muzzleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.muzzleColor,
      roughness: 0.32, // Slightly moist muzzle/nose specular contrast!
      metalness: 0.04,
    }),
  );
  const hoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: species === 'dog' ? 0x3b2c23 : 0x25201c,
      roughness: species === 'dog' ? 0.78 : 0.42,
      metalness: 0.04,
    }),
  );
  const hornMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.hornColor,
      roughness: 0.36,
      metalness: 0.08,
    }),
  );
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.eyeColor,
      roughness: 0.08,
      metalness: 0.12,
    }),
  );
  const eyeGlintMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const pinkSoftMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9968c,
      roughness: 0.62,
      metalness: 0.0,
    }),
  );

  // Exact ground height: hip pivot at -bodyH * 0.36 + legH => hooves sit flush on y = 0!
  const hipOffsetY = -spec.bodyH * 0.36;
  const baseBodyY = spec.legH - hipOffsetY;
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = baseBodyY;
  root.add(bodyGroup);

  // 1. Sculpted organic barrel torso (LatheGeometry with species contour)
  const torsoMesh = new THREE.Mesh(
    trackGeo(createSculptedTorsoGeometry(species, spec.bodyW, spec.bodyH, spec.bodyL)),
    coatMat,
  );
  bodyGroup.add(torsoMesh);

  // Sculpted muscular shoulder & haunch contours (gives real quadruped silhouette)
  const muscleGeo = trackGeo(new THREE.SphereGeometry(spec.bodyW * 0.32, 9, 8));
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(muscleGeo, coatMat);
    shoulder.scale.set(0.62, 1.05, 0.92);
    shoulder.position.set(
      side * spec.bodyW * 0.34,
      -spec.bodyH * 0.05,
      spec.bodyL * 0.3,
    );
    const haunch = new THREE.Mesh(muscleGeo, coatMat);
    haunch.scale.set(0.64, 1.08, 1.02);
    haunch.position.set(
      side * spec.bodyW * 0.33,
      -spec.bodyH * 0.04,
      -spec.bodyL * 0.31,
    );
    bodyGroup.add(shoulder, haunch);
  }

  let bellPivot: THREE.Group | null = null;

  // 2. Authentic Indian species-defining body traits
  if (species === 'cow') {
    // Prominent Desi Zebu shoulder hump (Gir / Sahiwal silhouette)
    const hump = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.24, 10, 8)),
      coatMat,
    );
    hump.scale.set(0.76, 1.02, 1.24);
    hump.position.set(0, spec.bodyH * 0.48, spec.bodyL * 0.24);
    bodyGroup.add(hump);

    // Sculpted beveled hanging dewlap fold under chest & throat
    const dewShape = new THREE.Shape();
    dewShape.moveTo(0, 0.16);
    dewShape.quadraticCurveTo(0.22, 0.12, 0.28, -0.06);
    dewShape.quadraticCurveTo(0.16, -0.22, -0.06, -0.18);
    dewShape.quadraticCurveTo(-0.22, -0.1, -0.18, 0.08);
    dewShape.closePath();
    const dewGeo = trackGeo(
      new THREE.ExtrudeGeometry(dewShape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.022,
        bevelSegments: 2,
      }),
    );
    dewGeo.center();
    dewGeo.rotateY(Math.PI / 2);
    const dewlap = new THREE.Mesh(dewGeo, coatMat);
    dewlap.position.set(0, -spec.bodyH * 0.36, spec.bodyL * 0.36);
    bodyGroup.add(dewlap);

    // Subtle realistic udder tucked under hind belly
    const udder = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.135, 8, 7)),
      pinkSoftMat,
    );
    udder.scale.set(0.95, 0.72, 1.15);
    udder.position.set(0, -spec.bodyH * 0.48, -spec.bodyL * 0.22);
    bodyGroup.add(udder);

    // Braided vermilion/saffron village neck cord + swinging brass cowbell (ghanti)!
    const ropeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: variant % 2 === 0 ? 0xb53226 : 0xc97b1e,
        roughness: 0.88,
      }),
    );
    const neckRope = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(spec.headW * 0.72, 0.024, 6, 14)),
      ropeMat,
    );
    neckRope.position.set(0, spec.bodyH * 0.14, spec.bodyL * 0.44);
    neckRope.rotation.x = 0.55;
    bodyGroup.add(neckRope);

    bellPivot = new THREE.Group();
    bellPivot.position.set(0, spec.bodyH * 0.14 - 0.2, spec.bodyL * 0.49);
    const brassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd9a13a,
        roughness: 0.28,
        metalness: 0.82,
      }),
    );
    const bellCone = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.052, 0.095, 8)),
      brassMat,
    );
    bellCone.position.y = -0.05;
    const bellClapper = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.018, 6, 5)),
      brassMat,
    );
    bellClapper.position.y = -0.105;
    bellPivot.add(bellCone, bellClapper);
    bodyGroup.add(bellPivot);
  } else if (species === 'buffalo') {
    // Massive muscular Murrah shoulder ridge & broad withers
    const withers = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.28, 9, 7)),
      coatMat,
    );
    withers.scale.set(1.18, 0.72, 1.18);
    withers.position.set(0, spec.bodyH * 0.34, spec.bodyL * 0.22);
    bodyGroup.add(withers);

    // Thick dark neck-chest brisket fold
    const brisket = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.22, 8, 7)),
      coatMat,
    );
    brisket.scale.set(0.92, 0.88, 1.15);
    brisket.position.set(0, -spec.bodyH * 0.28, spec.bodyL * 0.36);
    bodyGroup.add(brisket);
  } else if (species === 'goat') {
    // Colorful village woven tether cord around neck
    const tetherMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: variant % 2 === 0 ? 0x266d78 : 0xb83c2e,
        roughness: 0.9,
      }),
    );
    const collar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(spec.headW * 0.56, 0.014, 6, 12)),
      tetherMat,
    );
    collar.position.set(0, spec.bodyH * 0.2, spec.bodyL * 0.42);
    collar.rotation.x = 0.65;
    bodyGroup.add(collar);
  } else {
    // Indie Pariah dog soft cream chest ruff
    const chestRuff = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(spec.bodyW * 0.44, 8, 7)),
      accentMat,
    );
    chestRuff.scale.set(0.84, 0.92, 0.72);
    chestRuff.position.set(0, -spec.bodyH * 0.08, spec.bodyL * 0.41);
    bodyGroup.add(chestRuff);
  }

  // 3. Articulated Neck + Sculpted Head + Chewing Lower Jaw
  const neckHead = new THREE.Group();
  neckHead.position.set(0, spec.bodyH * 0.16, spec.bodyL * 0.44);
  bodyGroup.add(neckHead);

  const neckGeo = trackGeo(
    new THREE.CylinderGeometry(
      spec.headW * 0.44,
      spec.headW * 0.68,
      spec.neckLen * 1.1,
      10,
    ),
  );
  const neckMesh = new THREE.Mesh(neckGeo, coatMat);
  neckMesh.scale.set(0.9, 1, 1.08);
  const neckTilt =
    species === 'goat' ? 0.35 : species === 'dog' ? 0.44 : 0.64;
  neckMesh.rotation.x = neckTilt;
  neckMesh.position.set(
    0,
    Math.cos(neckTilt) * spec.neckLen * 0.42,
    Math.sin(neckTilt) * spec.neckLen * 0.44,
  );
  neckHead.add(neckMesh);

  // Separate headGroup mounted at top of neck for expressive tilts & look-at
  const headGroup = new THREE.Group();
  headGroup.position.set(
    0,
    Math.cos(neckTilt) * spec.neckLen * 0.84 + spec.headH * 0.06,
    Math.sin(neckTilt) * spec.neckLen * 0.88 + spec.headL * 0.06,
  );
  neckHead.add(headGroup);

  // Sculpted cranium (organic ovoid instead of box)
  const skull = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(spec.headW * 0.54, 11, 9)),
    coatMat,
  );
  skull.scale.set(0.98, spec.headH / spec.headW * 0.96, (spec.headL * 0.62) / spec.headW);
  headGroup.add(skull);

  // Forehead saffron tilak on select Desi cows
  if (species === 'cow' && variant % 2 === 0) {
    const tilak = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.026, 0.075, 0.012)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xd9381e, roughness: 0.72 })),
    );
    tilak.position.set(0, spec.headH * 0.22, spec.headL * 0.33);
    tilak.rotation.x = -0.35;
    headGroup.add(tilak);
  }

  // Tapered upper muzzle bridge
  const snoutLen = spec.headL * 0.56;
  const snoutGeo = trackGeo(
    new THREE.CylinderGeometry(
      spec.headW * (species === 'dog' ? 0.22 : 0.32),
      spec.headW * (species === 'dog' ? 0.36 : 0.44),
      snoutLen,
      9,
    ),
  );
  snoutGeo.rotateX(Math.PI / 2);
  const snout = new THREE.Mesh(snoutGeo, species === 'dog' ? coatMat : coatMat);
  snout.scale.set(1.0, 0.78, 1.0);
  snout.position.set(0, -spec.headH * 0.08, spec.headL * 0.36);
  snout.rotation.x = species === 'cow' || species === 'buffalo' ? 0.24 : 0.08;
  headGroup.add(snout);

  // Soft glossy nose pad / wet muzzle tip + twin nostrils
  const nosePad = new THREE.Mesh(
    trackGeo(
      new THREE.SphereGeometry(
        species === 'dog' ? 0.036 : spec.headW * 0.34,
        9,
        7,
      ),
    ),
    muzzleMat,
  );
  if (species === 'dog') {
    nosePad.scale.set(1.08, 0.82, 0.85);
    nosePad.position.set(0, -spec.headH * 0.06, spec.headL * 0.66);
  } else {
    nosePad.scale.set(1.12, 0.72, 0.64);
    nosePad.position.set(0, -spec.headH * 0.16, spec.headL * 0.58);
  }
  headGroup.add(nosePad);

  if (species !== 'dog') {
    const nostrilGeo = trackGeo(new THREE.SphereGeometry(spec.headW * 0.062, 6, 5));
    const nostrilMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x161110, roughness: 0.4 }),
    );
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      nostril.position.set(
        side * spec.headW * 0.16,
        -spec.headH * 0.15,
        spec.headL * 0.66,
      );
      headGroup.add(nostril);
    }
  }

  // Articulated lower jaw (chews cud on cow/buffalo/goat; pants gently on dog!)
  const jaw = new THREE.Group();
  jaw.position.set(0, -spec.headH * 0.24, spec.headL * 0.14);
  headGroup.add(jaw);

  const jawMesh = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        spec.headW * (species === 'dog' ? 0.18 : 0.26),
        spec.headW * 0.32,
        snoutLen * 0.82,
        8,
      ),
    ),
    species === 'dog' ? accentMat : coatMat,
  );
  jawMesh.rotation.x = Math.PI / 2;
  jawMesh.scale.set(0.95, 0.52, 1);
  jawMesh.position.set(0, -0.02, snoutLen * 0.36);
  jaw.add(jawMesh);

  if (species === 'dog') {
    // Cute soft pink panting tongue tucked inside lower jaw
    const tongue = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.024, 6, 5)),
      pinkSoftMat,
    );
    tongue.scale.set(0.85, 0.36, 1.75);
    tongue.position.set(0, 0.008, snoutLen * 0.58);
    tongue.rotation.x = 0.28;
    jaw.add(tongue);
  } else if (species === 'goat') {
    // Authentic Village Goat chin beard attached to jaw so it moves when chewing!
    const beard = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.032, 0.11, 6)),
      accentMat,
    );
    beard.rotation.x = Math.PI + 0.18;
    beard.position.set(0, -0.075, snoutLen * 0.52);
    jaw.add(beard);
  }

  // Expressive glossy eyes with subtle brow contour & bright specular catchlight
  const eyeRadius =
    species === 'cow' || species === 'buffalo' ? 0.032 : 0.023;
  const eyeGeo = trackGeo(new THREE.SphereGeometry(eyeRadius, 8, 7));
  const glintGeo = trackGeo(new THREE.SphereGeometry(eyeRadius * 0.28, 5, 5));
  const browGeo = trackGeo(new THREE.SphereGeometry(eyeRadius * 1.18, 7, 5));

  for (const side of [-1, 1]) {
    const ex = side * (spec.headW * 0.45);
    const ey = spec.headH * 0.12;
    const ez = spec.headL * 0.16;

    const brow = new THREE.Mesh(browGeo, coatMat);
    brow.scale.set(0.65, 0.45, 1.35);
    brow.position.set(ex * 0.96, ey + eyeRadius * 0.82, ez);
    headGroup.add(brow);

    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, ey, ez);
    headGroup.add(eye);

    const glint = new THREE.Mesh(glintGeo, eyeGlintMat);
    glint.position.set(
      ex + side * eyeRadius * 0.72,
      ey + eyeRadius * 0.35,
      ez + eyeRadius * 0.52,
    );
    headGroup.add(glint);
  }

  // 4. Sculpted Species-Accurate Ears (pivoted cleanly at base for independent flicks!)
  const ears: [THREE.Object3D, THREE.Object3D] = [
    new THREE.Group(),
    new THREE.Group(),
  ];
  const earBaseGeo = trackGeo(
    species === 'dog'
      ? new THREE.ConeGeometry(0.044, 0.135, 6)
      : new THREE.SphereGeometry(0.078, 8, 6),
  );
  const innerEarGeo =
    species === 'dog'
      ? trackGeo(new THREE.ConeGeometry(0.026, 0.095, 5))
      : null;

  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const earPivot = ears[i];
    if (species === 'dog') {
      // Alert triangular Indie street dog ears with soft pink inner lining
      earPivot.position.set(
        side * spec.headW * 0.36,
        spec.headH * 0.46,
        -spec.headL * 0.05,
      );
      const outer = new THREE.Mesh(earBaseGeo, coatMat);
      outer.scale.set(0.82, 1.0, 0.56);
      outer.position.y = 0.062;
      earPivot.add(outer);

      if (innerEarGeo) {
        const inner = new THREE.Mesh(innerEarGeo, pinkSoftMat);
        inner.scale.set(0.76, 0.92, 0.32);
        inner.position.set(0, 0.056, 0.015);
        earPivot.add(inner);
      }
      earPivot.rotation.z = -side * 0.22;
      earPivot.rotation.x = 0.16;
    } else if (species === 'goat') {
      // Iconic long droopy velvety Indian village goat ears!
      earPivot.position.set(
        side * spec.headW * 0.48,
        spec.headH * 0.24,
        -spec.headL * 0.06,
      );
      const flap = new THREE.Mesh(earBaseGeo, coatMat);
      flap.scale.set(0.45, 1.48, 0.72);
      flap.position.set(side * 0.04, -0.085, 0.01);
      flap.rotation.z = side * 0.28;
      earPivot.add(flap);
    } else {
      // Leaf-shaped broad cattle/buffalo ears extending naturally from skull
      earPivot.position.set(
        side * spec.headW * 0.48,
        spec.headH * 0.2,
        -spec.headL * 0.1,
      );
      const leaf = new THREE.Mesh(earBaseGeo, coatMat);
      const earScale = species === 'buffalo' ? 1.18 : 1.05;
      leaf.scale.set(1.42 * earScale, 0.54 * earScale, 0.82 * earScale);
      leaf.position.set(side * 0.1 * earScale, -0.02, 0);
      earPivot.add(leaf);
      earPivot.rotation.z = -side * 0.26;
      earPivot.rotation.y = -side * 0.18;
    }
    headGroup.add(earPivot);
  }

  // 5. Authentic Curved Tapered Horns (Murrah Buffalo crescents, Desi Cow lyre, Goat sweep)
  if (species === 'cow' || species === 'buffalo' || species === 'goat') {
    for (const side of [-1, 1]) {
      let curve: THREE.CatmullRomCurve3;
      let rStart: number;
      let rEnd: number;

      if (species === 'buffalo') {
        // Iconic wide swept-back crescent Murrah Water Buffalo horns
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * spec.headW * 0.34, spec.headH * 0.34, -spec.headL * 0.06),
          new THREE.Vector3(side * 0.33, spec.headH * 0.38, -spec.headL * 0.14),
          new THREE.Vector3(side * 0.44, spec.headH * 0.52, -spec.headL * 0.48),
          new THREE.Vector3(side * 0.31, spec.headH * 0.78, -spec.headL * 0.68),
        ]);
        rStart = 0.048;
        rEnd = 0.012;
      } else if (species === 'cow') {
        // Graceful curved Desi Zebu horns sweeping outward and gently upward
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * spec.headW * 0.32, spec.headH * 0.36, -spec.headL * 0.04),
          new THREE.Vector3(side * 0.22, spec.headH * 0.54, spec.headL * 0.02),
          new THREE.Vector3(side * 0.26, spec.headH * 0.92, spec.headL * 0.12),
          new THREE.Vector3(side * 0.21, spec.headH * 1.18, spec.headL * 0.14),
        ]);
        rStart = 0.032;
        rEnd = 0.008;
      } else {
        // Agile village goat backward-curved horns
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * spec.headW * 0.28, spec.headH * 0.38, -spec.headL * 0.04),
          new THREE.Vector3(side * 0.09, spec.headH * 0.82, -spec.headL * 0.14),
          new THREE.Vector3(side * 0.11, spec.headH * 1.04, -spec.headL * 0.4),
        ]);
        rStart = 0.019;
        rEnd = 0.005;
      }

      const hornMesh = new THREE.Mesh(
        trackGeo(createTaperedTubeGeometry(curve, 9, rStart, rEnd, 6)),
        hornMat,
      );
      headGroup.add(hornMesh);
    }
  }

  // 6. Sculpted Tail (2-segment whip tail for cattle, curled sickle tail for Indie dog)
  const tail = new THREE.Group();
  tail.position.set(0, spec.bodyH * 0.22, -spec.bodyL * 0.48);
  bodyGroup.add(tail);
  let tailLower: THREE.Group | null = null;

  if (species === 'dog') {
    // Classic curled upward sickle tail of an Indian Pariah Street Dog
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.08, -0.14),
      new THREE.Vector3(0, 0.24, -0.19),
      new THREE.Vector3(0, 0.34, -0.09),
    ]);
    const tailMesh = new THREE.Mesh(
      trackGeo(createTaperedTubeGeometry(tailCurve, 9, 0.032, 0.012, 6)),
      coatMat,
    );
    tail.add(tailMesh);
  } else if (species === 'goat') {
    // Cute tufted upturned goat tail
    const stub = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.036, 0.16, 6)),
      coatMat,
    );
    stub.position.set(0, 0.06, -0.06);
    stub.rotation.x = -0.78;
    tail.add(stub);
  } else {
    // Articulated 2-segment swishing cattle tail with dark brush tuft
    const upperLen = species === 'buffalo' ? 0.36 : 0.4;
    const lowerLen = species === 'buffalo' ? 0.36 : 0.4;
    const upperShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.028, 0.02, upperLen, 6)),
      coatMat,
    );
    upperShaft.position.set(0, -upperLen * 0.5, -0.025);
    tail.add(upperShaft);

    tailLower = new THREE.Group();
    tailLower.position.set(0, -upperLen, -0.03);
    tail.add(tailLower);

    const lowerShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.02, 0.014, lowerLen, 6)),
      coatMat,
    );
    lowerShaft.position.set(0, -lowerLen * 0.5, 0);
    const tuft = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.056, 7, 6)),
      hoofMat,
    );
    tuft.scale.set(0.82, 1.95, 0.82);
    tuft.position.set(0, -lowerLen - 0.05, 0);
    tailLower.add(lowerShaft, tuft);
  }

  // 7. 4 Two-Joint Articulated Legs (Hip/Shoulder + Knee/Hock + Cloven Hoof / Cushioned Paw)
  const upperH = spec.legH * 0.52;
  const lowerH = spec.legH * 0.48;
  const hoofH = species === 'dog' ? 0.048 : 0.072;

  const upperLegGeo = trackGeo(
    new THREE.CylinderGeometry(spec.upperLegR, spec.lowerLegR * 1.15, upperH, 8),
  );
  const kneeCapGeo = trackGeo(
    new THREE.SphereGeometry(spec.lowerLegR * 1.12, 7, 6),
  );
  const lowerLegGeo = trackGeo(
    new THREE.CylinderGeometry(spec.lowerLegR * 1.06, spec.lowerLegR * 0.86, lowerH - hoofH * 0.45, 7),
  );
  const hoofGeo = trackGeo(
    species === 'dog'
      ? new THREE.SphereGeometry(spec.lowerLegR * 1.48, 7, 6)
      : new THREE.CylinderGeometry(spec.lowerLegR * 0.96, spec.lowerLegR * 1.24, hoofH, 8),
  );

  const legOffsets: Array<[number, number]> = [
    [-spec.bodyW * 0.34, spec.bodyL * 0.32], // 0: FL
    [spec.bodyW * 0.34, spec.bodyL * 0.32], // 1: FR
    [-spec.bodyW * 0.34, -spec.bodyL * 0.33], // 2: BL
    [spec.bodyW * 0.34, -spec.bodyL * 0.33], // 3: BR
  ];

  const legs: THREE.Group[] = [];
  const lowerLegs: THREE.Group[] = [];

  for (let i = 0; i < 4; i++) {
    const [lx, lz] = legOffsets[i];
    const isHind = i >= 2;

    const hipPivot = new THREE.Group();
    hipPivot.position.set(lx, hipOffsetY, lz);

    const upperMesh = new THREE.Mesh(upperLegGeo, coatMat);
    upperMesh.scale.set(1, 1, isHind ? 1.18 : 1.05);
    upperMesh.position.y = -upperH * 0.5;
    hipPivot.add(upperMesh);

    const kneeCap = new THREE.Mesh(kneeCapGeo, coatMat);
    kneeCap.position.y = -upperH;
    hipPivot.add(kneeCap);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -upperH;
    hipPivot.add(kneePivot);

    const lowerMesh = new THREE.Mesh(lowerLegGeo, coatMat);
    lowerMesh.position.y = -(lowerH - hoofH * 0.45) * 0.5;
    kneePivot.add(lowerMesh);

    const footMesh = new THREE.Mesh(
      hoofGeo,
      species === 'dog' ? accentMat : hoofMat,
    );
    if (species === 'dog') {
      footMesh.scale.set(0.95, 0.62, 1.38);
      footMesh.position.set(0, -lowerH + hoofH * 0.45, 0.018);
    } else {
      footMesh.position.set(0, -lowerH + hoofH * 0.5, 0.008);
    }
    kneePivot.add(footMesh);

    bodyGroup.add(hipPivot);
    legs.push(hipPivot);
    lowerLegs.push(kneePivot);
  }

  const typedLegs = legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  const typedLowerLegs = lowerLegs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];

  // Store base ear rotations so independent ear flicks return cleanly to neutral
  const baseEarRotZ: [number, number] = [ears[0].rotation.z, ears[1].rotation.z];
  const baseEarRotX: [number, number] = [ears[0].rotation.x, ears[1].rotation.x];

  const rig: AnimalRig = {
    root,
    bodyGroup,
    neckHead,
    headGroup,
    jaw,
    tail,
    tailLower,
    bellPivot,
    legs: typedLegs,
    lowerLegs: typedLowerLegs,
    ears,
    species,
    walkPhase: (seed * 1.9) % (Math.PI * 2),
    idlePhase: (seed * 2.7) % (Math.PI * 2),
    baseBodyY,

    updatePose(mode, dt, speed, lookYawOffset = 0, excited = false) {
      rig.idlePhase += dt;
      const t = rig.idlePhase;
      const k = 9;

      // Subtle living ribcage breathing pulse
      const breathRate = species === 'dog' ? (excited ? 4.4 : 2.8) : 1.45;
      const breath = Math.sin(t * breathRate + seed) * 0.018;
      bodyGroup.scale.set(1 + breath, 1 + breath * 0.5, 1);

      // Periodic natural independent ear flicks (shooing flies / listening to footsteps)
      const flickCycleL = (t * 0.55 + seed * 0.7) % 4.2;
      const flickCycleR = (t * 0.48 + seed * 1.3 + 2.1) % 4.6;
      const flickL = flickCycleL < 0.28 ? Math.sin((flickCycleL / 0.28) * Math.PI * 2) * 0.34 : 0;
      const flickR = flickCycleR < 0.28 ? Math.sin((flickCycleR / 0.28) * Math.PI * 2) * 0.34 : 0;
      const alertEarTilt = mode === 'alert' || excited ? 0.18 : 0;
      ears[0].rotation.z = THREE.MathUtils.damp(
        ears[0].rotation.z,
        baseEarRotZ[0] + flickL - alertEarTilt * 0.5,
        14,
        dt,
      );
      ears[1].rotation.z = THREE.MathUtils.damp(
        ears[1].rotation.z,
        baseEarRotZ[1] - flickR + alertEarTilt * 0.5,
        14,
        dt,
      );
      ears[0].rotation.x = THREE.MathUtils.damp(
        ears[0].rotation.x,
        baseEarRotX[0] + alertEarTilt + (species === 'goat' && speed > 0.2 ? Math.sin(rig.walkPhase * 2) * 0.16 : 0),
        12,
        dt,
      );
      ears[1].rotation.x = THREE.MathUtils.damp(
        ears[1].rotation.x,
        baseEarRotX[1] + alertEarTilt + (species === 'goat' && speed > 0.2 ? Math.sin(rig.walkPhase * 2) * 0.16 : 0),
        12,
        dt,
      );

      // Clamped look-at head yaw toward nearby player or natural village curiosity
      const clampedLook = THREE.MathUtils.clamp(lookYawOffset, -0.78, 0.78);

      // --- RESTING POSE (Natural folded knees for cattle/goats, sphinx nap for dogs) ---
      if (mode === 'rest') {
        const restY = spec.bodyH * (species === 'dog' ? 0.44 : 0.48);
        bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, restY, 5, dt);
        bodyGroup.rotation.z = THREE.MathUtils.damp(bodyGroup.rotation.z, 0.05, 5, dt);
        bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, 0, 5, dt);

        if (species === 'dog') {
          // Sphinx-like street dog nap: front paws stretched forward, hind legs tucked
          typedLegs[0].rotation.x = THREE.MathUtils.damp(typedLegs[0].rotation.x, -1.42, 6, dt);
          typedLegs[1].rotation.x = THREE.MathUtils.damp(typedLegs[1].rotation.x, -1.42, 6, dt);
          typedLegs[0].rotation.z = THREE.MathUtils.damp(typedLegs[0].rotation.z, 0.12, 6, dt);
          typedLegs[1].rotation.z = THREE.MathUtils.damp(typedLegs[1].rotation.z, -0.12, 6, dt);
          typedLowerLegs[0].rotation.x = THREE.MathUtils.damp(typedLowerLegs[0].rotation.x, 0.14, 6, dt);
          typedLowerLegs[1].rotation.x = THREE.MathUtils.damp(typedLowerLegs[1].rotation.x, 0.14, 6, dt);

          typedLegs[2].rotation.x = THREE.MathUtils.damp(typedLegs[2].rotation.x, -1.36, 6, dt);
          typedLegs[3].rotation.x = THREE.MathUtils.damp(typedLegs[3].rotation.x, -1.36, 6, dt);
          typedLegs[2].rotation.z = THREE.MathUtils.damp(typedLegs[2].rotation.z, 0.28, 6, dt);
          typedLegs[3].rotation.z = THREE.MathUtils.damp(typedLegs[3].rotation.z, -0.28, 6, dt);
          typedLowerLegs[2].rotation.x = THREE.MathUtils.damp(typedLowerLegs[2].rotation.x, 2.55, 6, dt);
          typedLowerLegs[3].rotation.x = THREE.MathUtils.damp(typedLowerLegs[3].rotation.x, 2.55, 6, dt);

          neckHead.rotation.x = THREE.MathUtils.damp(neckHead.rotation.x, 0.44 + Math.sin(t * 2.2) * 0.03, 5, dt);
          neckHead.rotation.y = THREE.MathUtils.damp(neckHead.rotation.y, clampedLook * 0.7 + Math.sin(t * 0.45 + seed) * 0.15, 4, dt);
          headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, -0.22, 5, dt);
          headGroup.rotation.z = THREE.MathUtils.damp(headGroup.rotation.z, 0.08, 4, dt);
          jaw.rotation.x = THREE.MathUtils.damp(jaw.rotation.x, 0.08 + Math.max(0, Math.sin(t * 5.2)) * 0.08, 10, dt);
          tail.rotation.z = Math.sin(t * (excited ? 9.5 : 2.8)) * (excited ? 0.42 : 0.14);
        } else {
          // Cattle / goat comfortable tucked-knee rest while chewing cud!
          for (let i = 0; i < 4; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            typedLegs[i].rotation.x = THREE.MathUtils.damp(typedLegs[i].rotation.x, -1.42, 6, dt);
            typedLegs[i].rotation.z = THREE.MathUtils.damp(
              typedLegs[i].rotation.z,
              side * (i >= 2 ? 0.22 : 0.1),
              6,
              dt,
            );
            typedLowerLegs[i].rotation.x = THREE.MathUtils.damp(
              typedLowerLegs[i].rotation.x,
              i < 2 ? 2.75 : 2.62,
              6,
              dt,
            );
          }
          neckHead.rotation.x = THREE.MathUtils.damp(neckHead.rotation.x, 0.08 + Math.sin(t * 2.0) * 0.03, 5, dt);
          neckHead.rotation.y = THREE.MathUtils.damp(
            neckHead.rotation.y,
            clampedLook * 0.6 + Math.sin(t * 0.55 + seed) * 0.25,
            4,
            dt,
          );
          headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, 0.04, 5, dt);
          headGroup.rotation.z = THREE.MathUtils.damp(headGroup.rotation.z, Math.sin(t * 3.8) * 0.03, 6, dt);
          // Rhythmic cud chewing
          jaw.rotation.x = THREE.MathUtils.damp(jaw.rotation.x, 0.06 + Math.abs(Math.sin(t * 3.8)) * 0.14, 12, dt);
          jaw.rotation.y = Math.sin(t * 3.8) * 0.06;
          const tailSway = Math.sin(t * 2.1 + seed) * 0.22;
          tail.rotation.z = tailSway;
          if (tailLower) tailLower.rotation.z = Math.sin(t * 2.1 + seed - 0.7) * 0.26;
        }
        if (bellPivot) {
          bellPivot.rotation.z = THREE.MathUtils.damp(bellPivot.rotation.z, 0, 5, dt);
        }
        return;
      }

      // --- STANDING / WALKING / GRAZING / SNIFFING / ALERT ---
      const isWalking = mode === 'walk' && speed > 0.08;
      if (isWalking) {
        const cadence =
          species === 'dog'
            ? 6.4 + speed * 2.5
            : species === 'goat'
              ? 5.6 + speed * 2.2
              : 3.3 + speed * 1.55;
        rig.walkPhase += dt * cadence;
      }

      const stride = isWalking
        ? species === 'dog'
          ? 0.62
          : species === 'goat'
            ? 0.54
            : 0.36
        : 0;

      // Realistic quadruped gait phases:
      // 4-beat heavy cattle walk (FL=0, BR=PI/2, FR=PI, BL=3PI/2) vs lively diagonal trot for dog/goat
      const phaseOffsets =
        species === 'cow' || species === 'buffalo'
          ? [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5]
          : [0, Math.PI, Math.PI, 0];

      for (let i = 0; i < 4; i++) {
        const isHind = i >= 2;
        const ph = rig.walkPhase + phaseOffsets[i];
        const s = Math.sin(ph);
        const c = Math.cos(ph);

        const targetHipX = isWalking ? s * stride : 0;
        // Front knees bend backward (+X) on swing forward; hind hocks flex cleanly (-X)
        const swingLift = isWalking ? Math.max(0, c) : 0;
        const targetKneeX = isWalking
          ? isHind
            ? -swingLift * stride * 0.92
            : swingLift * stride * 1.12
          : isHind
            ? -0.06
            : 0.04;

        typedLegs[i].rotation.x = THREE.MathUtils.damp(typedLegs[i].rotation.x, targetHipX, k, dt);
        typedLegs[i].rotation.z = THREE.MathUtils.damp(typedLegs[i].rotation.z, 0, k, dt);
        typedLowerLegs[i].rotation.x = THREE.MathUtils.damp(typedLowerLegs[i].rotation.x, targetKneeX, k, dt);
      }

      const sw = Math.sin(rig.walkPhase);
      const cw = Math.cos(rig.walkPhase);
      const bob = isWalking
        ? Math.abs(sw) * (species === 'dog' ? 0.036 : species === 'goat' ? 0.032 : 0.022)
        : Math.sin(t * 1.7) * 0.006;

      bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, baseBodyY + bob, k, dt);
      bodyGroup.rotation.z = THREE.MathUtils.damp(
        bodyGroup.rotation.z,
        isWalking ? cw * (species === 'buffalo' ? 0.04 : 0.028) : 0,
        k,
        dt,
      );
      bodyGroup.rotation.x = THREE.MathUtils.damp(
        bodyGroup.rotation.x,
        mode === 'graze' || mode === 'sniff' ? 0.06 : 0,
        6,
        dt,
      );

      // Expressive neck, head, and jaw choreography per behavioral state
      let targetNeckX = 0.04;
      let targetNeckY = clampedLook * 0.55 + Math.sin(t * 0.72 + seed) * 0.22;
      let targetHeadX = 0.02;
      let targetHeadZ = 0;
      let targetJawX = 0.02;
      let targetJawY = 0;

      if (mode === 'graze') {
        targetNeckX = (species === 'goat' ? 0.86 : 0.78) + Math.sin(t * 3.2) * 0.07;
        targetNeckY = Math.sin(t * 1.15 + seed) * 0.26;
        targetHeadX = 0.22 + Math.sin(t * 4.5) * 0.06;
        targetJawX = 0.08 + Math.abs(Math.sin(t * 4.8)) * 0.16;
        targetJawY = Math.sin(t * 4.8) * 0.07;
      } else if (mode === 'sniff') {
        // Dog nose lowered sniffing the village lane left and right!
        targetNeckX = 0.74 + Math.sin(t * 6.5) * 0.05;
        targetNeckY = Math.sin(t * 2.6 + seed) * 0.36;
        targetHeadX = 0.18 + Math.sin(t * 8.2) * 0.04;
        targetJawX = 0.04;
      } else if (mode === 'alert') {
        // Curious attentive look toward player with adorable slight head tilt
        targetNeckX = -0.14;
        targetNeckY = clampedLook * 0.85;
        targetHeadX = -0.06;
        targetHeadZ = species === 'dog' ? Math.sin(t * 1.4 + seed) * 0.18 : 0.05;
        targetJawX = species === 'dog' ? 0.14 + Math.max(0, Math.sin(t * 7.5)) * 0.1 : 0.06;
      } else if (isWalking) {
        targetNeckX = 0.12 + Math.sin(rig.walkPhase * 2) * 0.055;
        targetNeckY = clampedLook * 0.45 + Math.sin(t * 0.8 + seed) * 0.12;
        targetHeadX = -0.04;
        targetJawX = species === 'dog' ? 0.1 + Math.max(0, Math.sin(t * 6.8)) * 0.09 : 0.04;
      } else {
        // Relaxed idle with subtle cud chewing / dog panting
        targetNeckX = 0.04 + Math.sin(t * 1.3) * 0.03;
        targetJawX =
          species === 'dog'
            ? 0.1 + Math.max(0, Math.sin(t * 5.8)) * 0.09
            : 0.04 + Math.abs(Math.sin(t * 3.1)) * 0.11;
      }

      neckHead.rotation.x = THREE.MathUtils.damp(neckHead.rotation.x, targetNeckX, 6, dt);
      neckHead.rotation.y = THREE.MathUtils.damp(neckHead.rotation.y, targetNeckY, 6, dt);
      headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, targetHeadX, 7, dt);
      headGroup.rotation.z = THREE.MathUtils.damp(headGroup.rotation.z, targetHeadZ, 6, dt);
      jaw.rotation.x = THREE.MathUtils.damp(jaw.rotation.x, targetJawX, 12, dt);
      jaw.rotation.y = THREE.MathUtils.damp(jaw.rotation.y, targetJawY, 10, dt);

      // Swinging brass cowbell synced to cow's steps!
      if (bellPivot) {
        const bellTarget = isWalking
          ? cw * 0.42
          : Math.sin(t * 1.8 + seed) * 0.07;
        bellPivot.rotation.z = THREE.MathUtils.damp(bellPivot.rotation.z, bellTarget, 8, dt);
      }

      // Multi-segment expressive tail motion
      if (species === 'dog') {
        const wagFreq = excited ? 14.5 : isWalking ? 10.5 : mode === 'sniff' ? 9.0 : 6.8;
        const wagAmp = excited ? 0.56 : isWalking ? 0.44 : 0.34;
        tail.rotation.z = Math.sin(t * wagFreq) * wagAmp;
        tail.rotation.x = excited ? -0.18 : 0;
      } else if (species === 'goat') {
        tail.rotation.z = Math.sin(t * (isWalking ? 8.5 : 5.5)) * 0.34;
      } else {
        // Periodic energetic fly-swat whip on cow & buffalo tails
        const swatPhase = (t * 0.35 + seed) % 5.0;
        const swatBoost = swatPhase < 0.85 ? 2.4 : 1.0;
        const sway = Math.sin(t * 2.6 * swatBoost + seed) * (swatBoost > 1 ? 0.58 : 0.28);
        tail.rotation.z = THREE.MathUtils.damp(tail.rotation.z, sway, 9, dt);
        tail.rotation.x = Math.cos(t * 1.6) * 0.1;
        if (tailLower) {
          const lagSway = Math.sin(t * 2.6 * swatBoost + seed - 0.85) * (swatBoost > 1 ? 0.68 : 0.32);
          tailLower.rotation.z = THREE.MathUtils.damp(tailLower.rotation.z, lagSway, 9, dt);
        }
      }
    },
  };

  return rig;
}

/**
 * Purely visual (zero-collider) ambient 1995 woven charpai for maps 2-8
 */
export function createAmbientCharpaiMesh(pool: NpcAssetPool): THREE.Group {
  const group = new THREE.Group();
  const length = 1.85;
  const width = 1.02;
  const legH = 0.48;

  const legGeo = new THREE.CylinderGeometry(0.038, 0.032, legH, 6);
  const railSideGeo = new THREE.CylinderGeometry(0.032, 0.032, length, 6);
  railSideGeo.rotateX(Math.PI / 2);
  const railEndGeo = new THREE.CylinderGeometry(0.032, 0.032, width, 6);
  railEndGeo.rotateZ(Math.PI / 2);
  const bedGeo = new THREE.BoxGeometry(width - 0.08, 0.05, length - 0.08);
  pool.geometries.push(legGeo, railSideGeo, railEndGeo, bedGeo);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, pool.woodMat);
      leg.position.set(sx * width * 0.45, legH * 0.5, sz * length * 0.45);
      group.add(leg);
    }
  }
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(railSideGeo, pool.woodMat);
    rail.position.set(sx * width * 0.45, legH - 0.04, 0);
    group.add(rail);
  }
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(railEndGeo, pool.woodMat);
    rail.position.set(0, legH - 0.04, sz * length * 0.45);
    group.add(rail);
  }
  const bed = new THREE.Mesh(bedGeo, pool.charpaiWeaveMat);
  bed.position.y = legH - 0.02;
  group.add(bed);

  return group;
}

/**
 * Purely visual wooden gully-cricket stumps + bails + animated tennis ball
 */
export function createCricketSetProps(pool: NpcAssetPool): {
  stumps: THREE.Group;
  ball: THREE.Mesh;
} {
  const stumps = new THREE.Group();
  const stumpGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.72, 6);
  const bailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5);
  bailGeo.rotateZ(Math.PI / 2);
  const ballGeo = new THREE.SphereGeometry(0.055, 8, 7);
  pool.geometries.push(stumpGeo, bailGeo, ballGeo);

  const stumpMat = new THREE.MeshStandardMaterial({ color: 0xd9b37c, roughness: 0.76 });
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xd8eb3c,
    roughness: 0.6,
  });
  pool.materials.push(stumpMat, ballMat);

  for (const sx of [-0.11, 0, 0.11]) {
    const s = new THREE.Mesh(stumpGeo, stumpMat);
    s.position.set(sx, 0.36, 0);
    stumps.add(s);
  }
  for (const bx of [-0.055, 0.055]) {
    const b = new THREE.Mesh(bailGeo, stumpMat);
    b.position.set(bx, 0.73, 0);
    stumps.add(b);
  }

  const ball = new THREE.Mesh(ballGeo, ballMat);
  return { stumps, ball };
}

/**
 * Compact purely-visual village vendor basket/thela mat for maps without stalls
 */
export function createAmbientVendorDisplay(pool: NpcAssetPool): THREE.Group {
  const g = new THREE.Group();
  const matGeo = new THREE.BoxGeometry(1.5, 0.04, 1.0);
  const basketGeo = new THREE.CylinderGeometry(0.28, 0.2, 0.22, 9);
  const moundGeo = new THREE.SphereGeometry(0.23, 8, 6);
  pool.geometries.push(matGeo, basketGeo, moundGeo);

  const clothMat = new THREE.MeshStandardMaterial({ color: 0xbf4d32, roughness: 0.92 });
  const wickerMat = new THREE.MeshStandardMaterial({ color: 0xb6884e, roughness: 0.9 });
  const colors = [0xd67c2b, 0x4c8736, 0xc93a2b];
  pool.materials.push(clothMat, wickerMat);

  const cloth = new THREE.Mesh(matGeo, clothMat);
  cloth.position.y = 0.02;
  g.add(cloth);

  for (let i = 0; i < 3; i++) {
    const basket = new THREE.Mesh(basketGeo, wickerMat);
    basket.position.set(-0.46 + i * 0.46, 0.14, 0);
    const pMat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.78 });
    pool.materials.push(pMat);
    const mound = new THREE.Mesh(moundGeo, pMat);
    mound.scale.set(1, 0.55, 1);
    mound.position.y = 0.12;
    basket.add(mound);
    g.add(basket);
  }

  return g;
}

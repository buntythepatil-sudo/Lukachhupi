import * as THREE from 'three';

type ApparitionPhase = 'hidden' | 'appearing' | 'active' | 'disappearing';

interface HauntSpot {
  name: string;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  idleYaw: number;
  mode: 'walk' | 'window_loom';
}

/**
 * Curated Bhutiya Haveli (Level 6) apparition spots: dark corridors, staircases,
 * upper galleries, underground cellar, and distant moonlight windows.
 * Completely independent of player positions or hiding spots.
 */
const HAVELI_HAUNT_SPOTS: HauntSpot[] = [
  // 1. Grand Ceremonial Central Sandstone Staircase (Top Landing overlooking Courtyard)
  {
    name: 'Grand Central Staircase',
    startX: 0.0,
    startY: 2.6,
    startZ: -14.8,
    endX: 0.0,
    endY: 2.6,
    endZ: -17.4,
    idleYaw: 0,
    mode: 'walk',
  },
  // 2. West Courtyard Wooden Staircase Upper Landing
  {
    name: 'West Wooden Staircase',
    startX: -14.5,
    startY: 3.2,
    startZ: 4.8,
    endX: -14.5,
    endY: 3.2,
    endZ: 0.2,
    idleYaw: Math.PI / 2,
    mode: 'walk',
  },
  // 3. East Courtyard Wooden Staircase Upper Landing
  {
    name: 'East Wooden Staircase',
    startX: 14.5,
    startY: 3.2,
    startZ: 4.8,
    endX: 14.5,
    endY: 3.2,
    endZ: 0.2,
    idleYaw: -Math.PI / 2,
    mode: 'walk',
  },
  // 4. West Upper Dark Corridor by Moonlight Broken Window (-28.75, 4.8, 12.0)
  {
    name: 'West Upper Window Corridor',
    startX: -24.4,
    startY: 3.2,
    startZ: 12.0,
    endX: -24.4,
    endY: 3.2,
    endZ: 7.4,
    idleYaw: Math.PI / 2,
    mode: 'walk',
  },
  // 5. East Upper Dark Corridor by Moonlight Broken Window (28.75, 4.8, -2.0)
  {
    name: 'East Upper Window Corridor',
    startX: 24.4,
    startY: 3.2,
    startZ: -2.0,
    endX: 24.4,
    endY: 3.2,
    endZ: 2.4,
    idleYaw: -Math.PI / 2,
    mode: 'walk',
  },
  // 6. South Upper Wooden Bridge Gallery overlooking Courtyard
  {
    name: 'South Upper Bridge Gallery',
    startX: -4.2,
    startY: 3.2,
    startZ: 23.4,
    endX: 3.8,
    endY: 3.2,
    endZ: 23.4,
    idleYaw: Math.PI,
    mode: 'walk',
  },
  // 7. Distant Ground-Floor Portrait Gallery Broken Window (-28.75, 1.75, 14.5)
  {
    name: 'West Portrait Gallery Window',
    startX: -27.2,
    startY: 0.08,
    startZ: 14.5,
    endX: -26.6,
    endY: 0.08,
    endZ: 14.5,
    idleYaw: Math.PI / 2,
    mode: 'window_loom',
  },
  // 8. Distant Ground-Floor Banquet Hall Broken Window (28.75, 1.75, 3.0)
  {
    name: 'East Banquet Window',
    startX: 27.2,
    startY: 0.08,
    startZ: 3.0,
    endX: 26.6,
    endY: 0.08,
    endZ: 3.0,
    idleYaw: -Math.PI / 2,
    mode: 'window_loom',
  },
  // 9. Dark Underground Tehkhana Cellar near Secret Wooden Stairs
  {
    name: 'Underground Tehkhana Passage',
    startX: -7.5,
    startY: 0.02,
    startZ: -24.2,
    endX: -2.4,
    endY: 0.02,
    endZ: -24.2,
    idleYaw: 0,
    mode: 'walk',
  },
  // 10. Narrow Secret Rear Corridor behind Durbar Hall
  {
    name: 'Secret Rear Corridor',
    startX: -5.4,
    startY: 2.6,
    startZ: -32.4,
    endX: 4.4,
    endY: 2.6,
    endZ: -32.4,
    idleYaw: 0,
    mode: 'walk',
  },
];

function createProceduralCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Realistic weathered aged bone texture with fine pores & sepia cracks */
function createBoneTexture(): THREE.CanvasTexture {
  return createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ebe3cf');
    grad.addColorStop(0.5, '#d9ceb2');
    grad.addColorStop(1, '#c6b898');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic bone mottling & porous grain
    for (let i = 0; i < 420; i++) {
      const px = (i * 83) % w;
      const py = (i * 149) % h;
      const r = 1 + (i % 5);
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(92, 74, 52, 0.14)' : 'rgba(255, 252, 240, 0.12)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine aged hairline cracks
    ctx.strokeStyle = 'rgba(72, 56, 40, 0.28)';
    ctx.lineWidth = 1.1;
    for (let c = 0; c < 14; c++) {
      let cx = (c * 59) % w;
      let cy = (c * 41) % h;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) {
        cx += ((c * 13 + s * 29) % 24) - 12;
        cy += 8 + ((c * 7 + s * 11) % 14);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  });
}

/** Deep gothic midnight velvet cloak texture with subtle dark crimson damask sheen */
function createVampireVelvetTexture(crimsonTint: boolean): THREE.CanvasTexture {
  return createProceduralCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = crimsonTint ? '#3a0a12' : '#121118';
    ctx.fillRect(0, 0, w, h);

    // Subtle vertical woven velvet folds & gothic sheen
    for (let x = 0; x < w; x += 8) {
      const shade = Math.sin((x / w) * Math.PI * 8) * 0.5 + 0.5;
      ctx.fillStyle = crimsonTint
        ? `rgba(115, 16, 28, ${0.08 + shade * 0.16})`
        : `rgba(48, 44, 62, ${0.06 + shade * 0.14})`;
      ctx.fillRect(x, 0, 5, h);
    }

    // Antique embroidered gothic edge trim near bottom hem
    const hemY = h - 22;
    ctx.fillStyle = crimsonTint
      ? 'rgba(165, 36, 48, 0.42)'
      : 'rgba(112, 20, 32, 0.48)';
    ctx.fillRect(0, hemY, w, 4);
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 8, hemY - 6);
      ctx.lineTo(x + 13, hemY);
      ctx.lineTo(x + 8, hemY + 6);
      ctx.lineTo(x + 3, hemY);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Soft radial glow texture for subtle eerie red eye aura & ground shadow mist */
function createSoftRadialTexture(
  innerColor: string,
  midColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.45, midColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface VampireRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  jawGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  capeMesh: THREE.Mesh;
  capeBasePos: Float32Array;
  eyeMeshes: THREE.Mesh[];
  eyeHaloSprites: THREE.Sprite[];
  mistDiscs: THREE.Mesh[];
  fadeMaterials: Array<{ mat: THREE.Material; maxOpacity: number }>;
  eyeMat: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
}

function buildSkeletonVampireRig(): VampireRig {
  const root = new THREE.Group();
  root.name = 'BhutiyaHaveliSkeletonVampire';

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const boneTex = createBoneTexture();
  const blackVelvetTex = createVampireVelvetTexture(false);
  const crimsonVelvetTex = createVampireVelvetTexture(true);
  const eyeGlowTex = createSoftRadialTexture(
    'rgba(255, 42, 42, 0.95)',
    'rgba(210, 10, 20, 0.42)',
  );
  const mistTex = createSoftRadialTexture(
    'rgba(24, 14, 24, 0.72)',
    'rgba(55, 16, 26, 0.28)',
  );

  const fadeMaterials: Array<{ mat: THREE.Material; maxOpacity: number }> = [];
  const trackMat = <T extends THREE.Material>(mat: T, maxOpacity = 1): T => {
    mat.transparent = true;
    mat.opacity = 0;
    fadeMaterials.push({ mat, maxOpacity });
    return mat;
  };

  const boneMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: boneTex,
      color: 0xf0e8d5,
      roughness: 0.72,
      metalness: 0.05,
    }),
    1.0,
  );
  const darkBoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: boneTex,
      color: 0xa89b82,
      roughness: 0.85,
      metalness: 0.04,
    }),
    1.0,
  );
  const socketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090507,
      roughness: 0.98,
    }),
    1.0,
  );
  const fangMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      emissive: 0x261e1a,
      emissiveIntensity: 0.25,
      roughness: 0.24,
      metalness: 0.08,
    }),
    1.0,
  );
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff1616,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    }),
    1.0,
  );
  const blackCoatMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: blackVelvetTex,
      color: 0x16141e,
      roughness: 0.88,
      metalness: 0.08,
    }),
    1.0,
  );
  const crimsonLiningMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: crimsonVelvetTex,
      color: 0x6b101d,
      roughness: 0.78,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
    1.0,
  );
  const capeOuterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: blackVelvetTex,
      color: 0x121018,
      roughness: 0.86,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    0.96,
  );
  const silverBroochMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb8bcc6,
      roughness: 0.28,
      metalness: 0.88,
    }),
    1.0,
  );

  // ---------------------------------------------------------------------------
  // 1. SKELETAL LEGS & GOTHIC TROUSERS (Grounded bottom-center pivot y = 0)
  // ---------------------------------------------------------------------------
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.145, 0.86, 0);

    // Tapered dark gothic trouser leg
    const upperPant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.062, 0.44, 8),
      blackCoatMat,
    );
    upperPant.position.y = -0.22;
    upperPant.castShadow = true;
    leg.add(upperPant);

    // Lower skeletal tibia & fibula peeking below tattered cuff
    const tibia = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.026, 0.36, 7),
      boneMat,
    );
    tibia.position.y = -0.58;
    tibia.castShadow = true;
    leg.add(tibia);

    const kneeBone = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 8, 6),
      darkBoneMat,
    );
    kneeBone.position.set(0, -0.43, 0.022);
    leg.add(kneeBone);

    // Pointed gothic boot/shoe
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.075, 0.23),
      blackCoatMat,
    );
    shoe.position.set(0, -0.82, 0.055);
    shoe.castShadow = true;
    leg.add(shoe);

    return leg;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  bodyPivot.add(leftLeg, rightLeg);

  // ---------------------------------------------------------------------------
  // 2. PELVIS, SPINE, RIBCAGE & BLACK VAMPIRE COAT WITH HIGH COLLAR
  // ---------------------------------------------------------------------------
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.88, 0);
  bodyPivot.add(torsoGroup);

  // Skeletal pelvis & gothic tailcoat lower panels
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.14, 0.18),
    darkBoneMat,
  );
  pelvis.position.y = 0.04;
  torsoGroup.add(pelvis);

  // Long split black gothic coat tails draping down to knees
  for (const side of [-1, 1]) {
    const coatTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.56, 0.2),
      blackCoatMat,
    );
    coatTail.position.set(side * 0.1, -0.22, -0.02);
    coatTail.castShadow = true;
    torsoGroup.add(coatTail);
  }

  // Articulated spine column (6 visible vertebrae)
  const vertebraGeo = new THREE.CylinderGeometry(0.04, 0.044, 0.068, 7);
  for (let v = 0; v < 6; v++) {
    const vert = new THREE.Mesh(vertebraGeo, darkBoneMat);
    vert.position.set(0, 0.14 + v * 0.088, -0.035);
    torsoGroup.add(vert);
  }

  // Sternum & 5 pairs of curved skeletal ribs clearly visible inside the open vampire coat!
  const sternum = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.34, 0.04),
    boneMat,
  );
  sternum.position.set(0, 0.42, 0.092);
  torsoGroup.add(sternum);

  const ribGeo = new THREE.TorusGeometry(0.115, 0.014, 6, 12, Math.PI * 0.92);
  for (let r = 0; r < 5; r++) {
    const ry = 0.28 + r * 0.068;
    const scaleX = 1.0 - Math.abs(r - 2) * 0.08;
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(ribGeo, boneMat);
      rib.position.set(side * 0.032, ry, 0.01);
      rib.rotation.x = Math.PI / 2 + 0.14;
      rib.rotation.z = side > 0 ? -0.35 : Math.PI + 0.35;
      rib.scale.set(scaleX, 0.82, 1);
      torsoGroup.add(rib);
    }
  }

  // Clavicles (collarbones)
  for (const side of [-1, 1]) {
    const clav = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.22, 6),
      boneMat,
    );
    clav.position.set(side * 0.11, 0.59, 0.065);
    clav.rotation.z = side * (Math.PI / 2 - 0.18);
    torsoGroup.add(clav);
  }

  // Tailored black vampire jacket framing the skeletal ribcage (open V-front with crimson lapels!)
  const coatBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.56, 0.09),
    blackCoatMat,
  );
  coatBack.position.set(0, 0.36, -0.1);
  coatBack.castShadow = true;
  torsoGroup.add(coatBack);

  for (const side of [-1, 1]) {
    const jacketSide = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.54, 0.22),
      blackCoatMat,
    );
    jacketSide.position.set(side * 0.19, 0.36, -0.01);
    jacketSide.castShadow = true;
    torsoGroup.add(jacketSide);

    // Crimson satin lapel trim
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.44, 0.035),
      crimsonLiningMat,
    );
    lapel.position.set(side * 0.135, 0.4, 0.105);
    lapel.rotation.z = side * -0.14;
    torsoGroup.add(lapel);

    // Sharp structured gothic shoulder pad
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.22),
      blackCoatMat,
    );
    shoulder.position.set(side * 0.24, 0.61, -0.01);
    shoulder.rotation.z = side * 0.14;
    shoulder.castShadow = true;
    torsoGroup.add(shoulder);
  }

  // Antique silver & crimson ruby cloak clasp brooch at the throat
  const brooch = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.042, 0),
    silverBroochMat,
  );
  brooch.position.set(0, 0.59, 0.115);
  torsoGroup.add(brooch);

  const ruby = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 6),
    eyeMat,
  );
  ruby.position.set(0, 0.59, 0.142);
  torsoGroup.add(ruby);

  // Dramatic High Vampire Collar (flared black velvet outer + crimson inner lining framing the skull!)
  const collarBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.155, 0.28, 10, 1, true, Math.PI * 0.58, Math.PI * 1.84),
    crimsonLiningMat,
  );
  collarBack.position.set(0, 0.72, -0.03);
  collarBack.rotation.x = -0.14;
  torsoGroup.add(collarBack);

  const collarOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.252, 0.164, 0.29, 10, 1, true, Math.PI * 0.58, Math.PI * 1.84),
    blackCoatMat,
  );
  collarOuter.position.set(0, 0.72, -0.038);
  collarOuter.rotation.x = -0.14;
  torsoGroup.add(collarOuter);

  // ---------------------------------------------------------------------------
  // 3. DETAILED SKULL, GLOWING RED EYES & SHARP VAMPIRE FANGS
  // ---------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0.02);
  torsoGroup.add(headGroup);

  // Cervical neck vertebrae
  const neckBone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.04, 0.11, 7),
    darkBoneMat,
  );
  neckBone.position.y = 0.04;
  headGroup.add(neckBone);

  // Sculpted cranium dome
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 14, 12),
    boneMat,
  );
  cranium.scale.set(0.92, 1.06, 1.02);
  cranium.position.set(0, 0.2, -0.01);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Prominent brow ridge & zygomatic cheekbones
  const brow = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.042, 0.08),
    boneMat,
  );
  brow.position.set(0, 0.235, 0.105);
  headGroup.add(brow);

  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 8, 6),
      boneMat,
    );
    cheek.scale.set(1.15, 0.78, 0.9);
    cheek.position.set(side * 0.088, 0.145, 0.098);
    headGroup.add(cheek);
  }

  // Upper maxilla (mouth arch)
  const maxilla = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.068, 0.105),
    boneMat,
  );
  maxilla.position.set(0, 0.11, 0.095);
  headGroup.add(maxilla);

  // Dark hollow nasal cavity
  const noseHole = new THREE.Mesh(
    new THREE.ConeGeometry(0.024, 0.048, 3),
    socketMat,
  );
  noseHole.position.set(0, 0.156, 0.144);
  headGroup.add(noseHole);

  // Deep Dark Eye Sockets + Glowing Red Vampire Eyes + Subtle Red Aura Sprites
  const eyeMeshes: THREE.Mesh[] = [];
  const eyeHaloSprites: THREE.Sprite[] = [];
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 9, 8),
      socketMat,
    );
    socket.scale.set(1.15, 0.92, 0.6);
    socket.position.set(side * 0.052, 0.196, 0.125);
    headGroup.add(socket);

    const eyeOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      eyeMat,
    );
    eyeOrb.position.set(side * 0.052, 0.196, 0.145);
    headGroup.add(eyeOrb);
    eyeMeshes.push(eyeOrb);

    const haloMat = trackMat(
      new THREE.SpriteMaterial({
        map: eyeGlowTex,
        color: 0xff2b2b,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.72,
    );
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(side * 0.052, 0.196, 0.158);
    halo.scale.set(0.11, 0.11, 1);
    headGroup.add(halo);
    eyeHaloSprites.push(halo);
  }

  // Upper teeth row + TWO SHARP CURVED VAMPIRE FANGS!
  const toothGeo = new THREE.BoxGeometry(0.015, 0.024, 0.016);
  for (let t = -2; t <= 2; t++) {
    if (Math.abs(t) === 2) continue; // Space for long fangs
    const tooth = new THREE.Mesh(toothGeo, boneMat);
    tooth.position.set(t * 0.02, 0.068, 0.14);
    headGroup.add(tooth);
  }
  const fangGeo = new THREE.ConeGeometry(0.012, 0.058, 6);
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(fangGeo, fangMat);
    fang.rotation.x = Math.PI + 0.08;
    fang.position.set(side * 0.042, 0.052, 0.142);
    headGroup.add(fang);
  }

  // Articulated Skeletal Lower Jaw (opens slightly for the creepy laugh!)
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, 0.105, 0.045);
  headGroup.add(jawGroup);

  const jawChin = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.048, 0.105),
    darkBoneMat,
  );
  jawChin.position.set(0, -0.048, 0.046);
  jawGroup.add(jawChin);

  for (let t = -2; t <= 2; t++) {
    const lt = new THREE.Mesh(toothGeo, boneMat);
    lt.position.set(t * 0.019, -0.018, 0.09);
    jawGroup.add(lt);
  }

  // ---------------------------------------------------------------------------
  // 4. ARTICULATED SKELETAL ARMS & BONY CLAWED HANDS
  // ---------------------------------------------------------------------------
  const buildArm = (side: -1 | 1): { arm: THREE.Group; forearm: THREE.Group } => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.28, 0.56, 0);

    // Gothic black upper sleeve
    const upperSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.046, 0.32, 8),
      blackCoatMat,
    );
    upperSleeve.position.y = -0.16;
    upperSleeve.castShadow = true;
    arm.add(upperSleeve);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.32, 0);
    arm.add(forearm);

    // Flared gothic cuff with crimson edge
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.064, 0.14, 8),
      blackCoatMat,
    );
    cuff.position.y = -0.07;
    forearm.add(cuff);

    const cuffTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.01, 6, 10),
      crimsonLiningMat,
    );
    cuffTrim.rotation.x = Math.PI / 2;
    cuffTrim.position.y = -0.14;
    forearm.add(cuffTrim);

    // Exposed skeletal forearm bones (radius & ulna)
    for (const offset of [-0.012, 0.012]) {
      const foreBone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.011, 0.2, 6),
        boneMat,
      );
      foreBone.position.set(offset, -0.22, 0);
      forearm.add(foreBone);
    }

    // Skeletal bony hand + 4 tapered claw fingers
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.065, 0.025),
      boneMat,
    );
    palm.position.set(0, -0.34, 0.01);
    forearm.add(palm);

    const fingerGeo = new THREE.CylinderGeometry(0.006, 0.004, 0.075, 5);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(fingerGeo, boneMat);
      finger.position.set(-0.02 + f * 0.014, -0.4, 0.024);
      finger.rotation.x = 0.35;
      forearm.add(finger);
    }

    return { arm, forearm };
  };

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);
  torsoGroup.add(leftArmRig.arm, rightArmRig.arm);

  // ---------------------------------------------------------------------------
  // 5. ANIMATED FLOATING / BILLOWING LONG VAMPIRE CAPE (Real-time wave mesh!)
  // ---------------------------------------------------------------------------
  const capeGeo = new THREE.PlaneGeometry(1.08, 1.56, 8, 12);
  // Shift pivot to top shoulder line so cape hangs cleanly down the back & flares out
  const posAttr = capeGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    // Normalized drop 0 (shoulders) -> 1 (hem)
    const drop = (0.78 - y) / 1.56;
    // Taper narrow at shoulders (0.46x), wide sweeping gothic flare at bottom hem (1.28x)!
    const widthScale = 0.44 + drop * 0.86;
    // Slight natural backward curve away from heels
    const curveZ = -0.06 - drop * 0.24 - Math.abs(x) * 0.12 * drop;
    // Jagged tattered gothic edge notches at the very bottom row
    const tatterY = drop > 0.96 ? -Math.abs(Math.sin(x * 11.5)) * 0.1 : 0;
    posAttr.setXYZ(i, x * widthScale, y - 0.78 + tatterY, curveZ);
  }
  capeGeo.computeVertexNormals();
  const capeBasePos = new Float32Array(posAttr.array);

  const capeMesh = new THREE.Mesh(capeGeo, capeOuterMat);
  capeMesh.position.set(0, 0.62, -0.1);
  capeMesh.castShadow = true;
  torsoGroup.add(capeMesh);

  // Inner crimson cape lining layer slightly forward for dramatic gothic contrast
  const capeLiningMesh = new THREE.Mesh(capeGeo, crimsonLiningMat);
  capeLiningMesh.position.set(0, 0.615, -0.088);
  torsoGroup.add(capeLiningMesh);

  // ---------------------------------------------------------------------------
  // 6. EERIE TRANSLUCENT DARK MIST SWIRL AT FEET (for mysterious appear/vanish!)
  // ---------------------------------------------------------------------------
  const mistDiscs: THREE.Mesh[] = [];
  for (let m = 0; m < 2; m++) {
    const mistMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: mistTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      m === 0 ? 0.68 : 0.48,
    );
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75 + m * 0.55, 1.75 + m * 0.55),
      mistMat,
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05 + m * 0.14;
    root.add(disc);
    mistDiscs.push(disc);
  }

  root.visible = false;

  return {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    jawGroup,
    leftArm: leftArmRig.arm,
    rightArm: rightArmRig.arm,
    leftForearm: leftArmRig.forearm,
    rightForearm: rightArmRig.forearm,
    leftLeg,
    rightLeg,
    capeMesh,
    capeBasePos,
    eyeMeshes,
    eyeHaloSprites,
    mistDiscs,
    fadeMaterials,
    eyeMat,
    textures: [boneTex, blackVelvetTex, crimsonVelvetTex, eyeGlowTex, mistTex],
  };
}

export interface SkeletonVampireAudioCallbacks {
  onAppear?: (distanceToCamera: number) => void;
  onDisappear?: (distanceToCamera: number) => void;
}

/**
 * Purely atmospheric non-playable Skeleton Vampire apparition controller for Bhutiya Haveli (Level 6).
 * - Never attacks, chases, catches, or reveals any player.
 * - Occasionally materializes in dark corridors, near staircases, or at distant windows,
 *   walks/looms eerily with glowing red eyes and a floating cape, laughs creepily,
 *   and mysteriously vanishes into mist after a few seconds.
 */
export class SkeletonVampireController {
  public readonly group: THREE.Group;

  private rig: VampireRig;
  private phase: ApparitionPhase = 'hidden';
  private phaseTimer = 5.5; // First eerie sighting shortly after entering Bhutiya Haveli
  private activeDuration = 7.5;
  private animClock = 0;
  private laughTimer = 0;
  private currentSpot: HauntSpot = HAVELI_HAUNT_SPOTS[0];
  private lastSpotIndex = -1;
  private walkProgress = 0;
  private currentOpacity = 0;
  private callbacks: SkeletonVampireAudioCallbacks;

  constructor(callbacks: SkeletonVampireAudioCallbacks = {}) {
    this.callbacks = callbacks;
    this.rig = buildSkeletonVampireRig();
    this.group = this.rig.root;
  }

  public reset(): void {
    this.phase = 'hidden';
    this.phaseTimer = 5.0 + Math.random() * 4.5;
    this.currentOpacity = 0;
    this.applyOpacity(0);
    this.group.visible = false;
  }

  private chooseNextSpot(cameraPos: THREE.Vector3): HauntSpot {
    // Score spots purely by scenic atmospheric distance from the camera (never any player/hider!)
    const candidates: Array<{ idx: number; weight: number }> = [];
    for (let i = 0; i < HAVELI_HAUNT_SPOTS.length; i++) {
      if (i === this.lastSpotIndex) continue;
      const s = HAVELI_HAUNT_SPOTS[i];
      const dist = Math.hypot(s.startX - cameraPos.x, s.startZ - cameraPos.z);
      // Prefer eerie mid-to-far glimpses (8m..36m) so the player can actually notice it in corridors/windows/stairs
      const inScenicBand = dist >= 7.5 && dist <= 38;
      candidates.push({ idx: i, weight: inScenicBand ? 4.0 : 1.0 });
    }

    let totalWeight = 0;
    for (const c of candidates) totalWeight += c.weight;
    let r = Math.random() * totalWeight;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) {
        this.lastSpotIndex = c.idx;
        return HAVELI_HAUNT_SPOTS[c.idx];
      }
    }
    this.lastSpotIndex = 0;
    return HAVELI_HAUNT_SPOTS[0];
  }

  private applyOpacity(alpha: number): void {
    const clamped = Math.max(0, Math.min(1, alpha));
    this.currentOpacity = clamped;
    for (let i = 0; i < this.rig.fadeMaterials.length; i++) {
      const entry = this.rig.fadeMaterials[i];
      entry.mat.opacity = entry.maxOpacity * clamped;
    }
  }

  private updateFloatingCape(t: number, walkFactor: number, vanishLift: number): void {
    const geo = this.rig.capeMesh.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const base = this.rig.capeBasePos;

    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const bx = base[ix];
      const by = base[ix + 1];
      const bz = base[ix + 2];

      // 0 at shoulders, 1 at tattered lower hem
      const drop = Math.max(0, Math.min(1, -by / 1.56));
      const dropSq = drop * drop;

      // Supernatural slow floating billow + walking draft
      const wave1 = Math.sin(t * 2.35 - drop * 4.2 + bx * 2.4) * (0.14 + walkFactor * 0.08);
      const wave2 = Math.cos(t * 1.55 - drop * 2.8 - bx * 3.1) * 0.065;
      const floatZ = bz - (0.08 + walkFactor * 0.1 + vanishLift * 0.22) * dropSq + (wave1 + wave2) * dropSq;
      const swayX = bx + Math.sin(t * 1.4 - drop * 2.2) * 0.06 * dropSq;
      const liftY = by + (0.06 + vanishLift * 0.16) * dropSq * (0.5 + 0.5 * Math.sin(t * 1.9 + bx * 2.0));

      pos.setXYZ(i, swayX, liftY, floatZ);
    }
    pos.needsUpdate = true;
  }

  public update(dt: number, cameraPos: THREE.Vector3): void {
    const clampedDt = Math.min(dt, 0.05);
    this.animClock += clampedDt;

    if (this.phase === 'hidden') {
      this.phaseTimer -= clampedDt;
      if (this.phaseTimer <= 0) {
        this.currentSpot = this.chooseNextSpot(cameraPos);
        this.phase = 'appearing';
        this.phaseTimer = 0;
        this.walkProgress = 0;
        this.activeDuration = 6.2 + Math.random() * 3.4;
        this.laughTimer = 2.6; // Articulated jaw laugh matches the spooky appear laugh!

        this.group.position.set(
          this.currentSpot.startX,
          this.currentSpot.startY,
          this.currentSpot.startZ,
        );
        this.group.rotation.y = this.currentSpot.idleYaw;
        this.group.visible = true;
        this.applyOpacity(0);

        const dist = Math.hypot(
          this.currentSpot.startX - cameraPos.x,
          this.currentSpot.startZ - cameraPos.z,
        );
        this.callbacks.onAppear?.(dist);
      }
      return;
    }

    const t = this.animClock;
    let vanishLift = 0;
    let isWalking = false;

    if (this.phase === 'appearing') {
      this.phaseTimer += clampedDt;
      const p = Math.min(1, this.phaseTimer / 1.45);
      // Smooth cubic ease-out fade-in rising subtly from the floor shadows
      const eased = 1 - Math.pow(1 - p, 3);
      this.applyOpacity(eased);
      this.rig.bodyPivot.position.y = (1 - eased) * -0.18;
      if (p >= 1) {
        this.phase = 'active';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'active') {
      this.phaseTimer += clampedDt;
      this.applyOpacity(1);

      // Slow creepy walk along corridor/stair landing OR eerie looming idle at distant window
      const s = this.currentSpot;
      const moveDist = Math.hypot(s.endX - s.startX, s.endZ - s.startZ);
      if (s.mode === 'walk' && moveDist > 0.35) {
        const walkDuration = this.activeDuration * 0.82;
        this.walkProgress = Math.min(1, this.phaseTimer / walkDuration);
        isWalking = this.walkProgress < 0.98;
        // Smooth ease-in-out gliding walk
        const wp =
          this.walkProgress < 0.5
            ? 2 * this.walkProgress * this.walkProgress
            : 1 - Math.pow(-2 * this.walkProgress + 2, 2) / 2;

        const cx = s.startX + (s.endX - s.startX) * wp;
        const cy = s.startY + (s.endY - s.startY) * wp;
        const cz = s.startZ + (s.endZ - s.startZ) * wp;
        this.group.position.set(cx, cy, cz);

        // Face direction of slow walk, then eerily turn toward its idle vista at the end
        const walkYaw = Math.atan2(s.endX - s.startX, s.endZ - s.startZ);
        const targetYaw = isWalking ? walkYaw : s.idleYaw;
        let diff = targetYaw - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * (1 - Math.exp(-3.2 * clampedDt));
      } else {
        // Window loom: eerie subtle sway & slow head scan
        this.group.position.set(s.startX, s.startY, s.startZ);
        this.group.rotation.y = s.idleYaw + Math.sin(t * 0.65) * 0.24;
      }

      // Subtle supernatural hover/bob
      this.rig.bodyPivot.position.y =
        Math.sin(t * 2.1) * 0.035 + (isWalking ? Math.abs(Math.sin(t * 3.1)) * 0.025 : 0);

      if (this.phaseTimer >= this.activeDuration) {
        this.phase = 'disappearing';
        this.phaseTimer = 0;
        const dist = Math.hypot(
          this.group.position.x - cameraPos.x,
          this.group.position.z - cameraPos.z,
        );
        this.callbacks.onDisappear?.(dist);
      }
    } else if (this.phase === 'disappearing') {
      this.phaseTimer += clampedDt;
      const p = Math.min(1, this.phaseTimer / 1.55);
      const fade = Math.max(0, 1 - p * p);
      vanishLift = p;
      this.applyOpacity(fade);
      // Rise mysteriously into shadow mist as it vanishes
      this.rig.bodyPivot.position.y = p * 0.34;
      this.group.rotation.y += clampedDt * 0.38;

      if (p >= 1) {
        this.phase = 'hidden';
        this.phaseTimer = 11.5 + Math.random() * 8.0; // Occasional, atmospheric appearances
        this.group.visible = false;
        this.rig.bodyPivot.position.y = 0;
        return;
      }
    }

    // -------------------------------------------------------------------------
    // Creepy Limb, Head, Jaw, Glowing Eyes & Floating Cape Animations
    // -------------------------------------------------------------------------
    const walkAmp = isWalking ? 1.0 : 0.0;
    const stride = Math.sin(t * 3.1) * 0.34 * walkAmp;

    this.rig.leftLeg.rotation.x = stride;
    this.rig.rightLeg.rotation.x = -stride;

    // Creepy raised/lurking skeletal arms with subtle claw sway
    this.rig.leftArm.rotation.x = -0.34 - stride * 0.42 + Math.sin(t * 1.4) * 0.08;
    this.rig.rightArm.rotation.x = -0.38 + stride * 0.42 + Math.cos(t * 1.3) * 0.08;
    this.rig.leftArm.rotation.z = 0.14 + Math.sin(t * 1.2) * 0.05;
    this.rig.rightArm.rotation.z = -0.14 - Math.sin(t * 1.2) * 0.05;
    this.rig.leftForearm.rotation.x = -0.58 + Math.sin(t * 1.9) * 0.08;
    this.rig.rightForearm.rotation.x = -0.64 + Math.cos(t * 1.7) * 0.08;

    // Slight eerie hunched torso sway
    this.rig.torsoGroup.rotation.x = 0.09 + Math.sin(t * 1.35) * 0.035;
    this.rig.torsoGroup.rotation.z = Math.sin(t * 1.55) * 0.035;

    // Unsettling slow skull tilt & look around
    this.rig.headGroup.rotation.y = Math.sin(t * 0.92) * 0.32;
    this.rig.headGroup.rotation.z = Math.sin(t * 0.68) * 0.13;
    this.rig.headGroup.rotation.x = -0.05 + Math.sin(t * 1.5) * 0.04;

    // Jaw laughs eerily when appearing, otherwise subtle sinister grin breathing
    if (this.laughTimer > 0) {
      this.laughTimer = Math.max(0, this.laughTimer - clampedDt);
      this.rig.jawGroup.rotation.x = 0.14 + Math.abs(Math.sin(t * 11.5)) * 0.24;
    } else {
      this.rig.jawGroup.rotation.x = 0.05 + Math.max(0, Math.sin(t * 1.8)) * 0.06;
    }

    // Pulsing eerie crimson red eyes & soft glowing eye halos
    const eyePulse = 2.3 + Math.sin(t * 4.4) * 0.75 + (this.laughTimer > 0 ? 0.65 : 0);
    this.rig.eyeMat.emissiveIntensity = eyePulse;
    const haloScale = 0.105 + Math.sin(t * 4.4) * 0.022;
    for (let i = 0; i < this.rig.eyeHaloSprites.length; i++) {
      this.rig.eyeHaloSprites[i].scale.set(haloScale, haloScale, 1);
    }

    // Swirling dark mist discs at feet (expand subtly while appearing & vanishing)
    const mistBoost =
      this.phase === 'appearing' || this.phase === 'disappearing' ? 1.25 : 0.92;
    for (let m = 0; m < this.rig.mistDiscs.length; m++) {
      const disc = this.rig.mistDiscs[m];
      disc.rotation.z += clampedDt * (m === 0 ? 0.55 : -0.42);
      const ms = mistBoost + Math.sin(t * 1.8 + m) * 0.08;
      disc.scale.set(ms, ms, 1);
    }

    // Floating / billowing cape wave deformation
    this.updateFloatingCape(t, walkAmp, vanishLift);
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    for (const entry of this.rig.fadeMaterials) {
      entry.mat.dispose();
    }
    for (const tex of this.rig.textures) {
      tex.dispose();
    }
  }
}

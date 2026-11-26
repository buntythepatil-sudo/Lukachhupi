import * as THREE from 'three';
import { getPresetById } from './characterPresets';
import {
  buildDetailedCharacterFace,
  FacialExpressionRig,
} from './characterFaces';
import {
  AccessoryType,
  CharacterAnimState,
  CharacterCustomization,
  CharacterPreset,
  FacialExpression,
  HairStyle,
  OutfitStyle,
} from './types';

export interface CharacterAnimationInput {
  dt: number;
  moveSpeed: number;
  state: CharacterAnimState;
  lookAroundPhase?: number;
  caughtElapsed?: number;
  expression?: FacialExpression;
  eyeLookX?: number;
  eyeLookY?: number;
  headLookYaw?: number;
  headLookPitch?: number;
  isConversing?: boolean;
  isSpeaking?: boolean;
  interactionProgress?: number;
  seatY?: number;
  airHeight?: number;
}

export interface CharacterRig {
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
  dizzyStars: THREE.Group;
  faceRig: FacialExpressionRig;
  tagRing: THREE.Mesh | null;
  crouchBlend: number;
  coverBlend: number;
  walkPhase: number;
  idlePhase: number;
  updateAnimation: (input: CharacterAnimationInput) => void;
}

export interface CharacterBuildConfig {
  preset: CharacterPreset;
  outfitStyle: OutfitStyle;
  outfitColor: number;
  accessory: AccessoryType;
  isSeeker: boolean;
  includeTagRing: boolean;
}

function addHairGeometry(
  head: THREE.Group,
  hairStyle: HairStyle,
  hairMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
): void {
  // Base scalp cap shared across most hairstyles
  if (hairStyle === 'buzz') {
    const buzz = new THREE.Mesh(
      new THREE.SphereGeometry(0.198, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hairMat,
    );
    buzz.position.set(0, 0.172, -0.01);
    buzz.rotation.x = -0.15;
    head.add(buzz);
    return;
  }

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.207, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  cap.position.set(0, 0.178, -0.015);
  cap.rotation.x = -0.2;
  cap.castShadow = true;
  head.add(cap);

  switch (hairStyle) {
    case 'short_part': {
      // Classic 1990s oiled side-part fringe
      const fringe = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.06, 0.12),
        hairMat,
      );
      fringe.position.set(0.03, 0.28, 0.11);
      fringe.rotation.z = -0.14;
      fringe.rotation.x = 0.2;
      head.add(fringe);
      break;
    }

    case 'twin_braids': {
      // Two neat braids with colorful ribbons (classic Indian village schoolgirl look)
      for (const side of [-1, 1]) {
        const braid = new THREE.Group();
        braid.position.set(side * 0.18, 0.14, -0.06);
        braid.rotation.z = side * 0.18;
        for (let b = 0; b < 4; b++) {
          const bead = new THREE.Mesh(
            new THREE.SphereGeometry(0.044 - b * 0.004, 8, 8),
            hairMat,
          );
          bead.position.set(0, -b * 0.072, -b * 0.01);
          bead.castShadow = true;
          braid.add(bead);
        }
        // Ribbon bow at bottom of each braid
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.095, 0.045, 0.04),
          accentMat,
        );
        ribbon.position.set(0, -0.27, -0.03);
        braid.add(ribbon);
        head.add(braid);
      }
      break;
    }

    case 'curly': {
      const puffOffsets = [
        [0, 0.34, 0.05],
        [-0.12, 0.31, 0.06],
        [0.12, 0.31, 0.05],
        [-0.16, 0.25, -0.04],
        [0.16, 0.25, -0.04],
        [0, 0.32, -0.1],
        [-0.09, 0.26, -0.15],
        [0.09, 0.26, -0.15],
      ];
      for (const [px, py, pz] of puffOffsets) {
        const curl = new THREE.Mesh(
          new THREE.SphereGeometry(0.068, 8, 8),
          hairMat,
        );
        curl.position.set(px, py, pz);
        curl.castShadow = true;
        head.add(curl);
      }
      break;
    }

    case 'long_braid': {
      // Single thick central braid down the back with white jasmine gajra accent
      const gajraMat = new THREE.MeshStandardMaterial({
        color: 0xfbf4e4,
        roughness: 0.7,
      });
      const gajra = new THREE.Mesh(
        new THREE.TorusGeometry(0.068, 0.018, 6, 12),
        gajraMat,
      );
      gajra.position.set(0, 0.14, -0.21);
      head.add(gajra);

      for (let b = 0; b < 5; b++) {
        const seg = new THREE.Mesh(
          new THREE.SphereGeometry(0.055 - b * 0.005, 8, 8),
          hairMat,
        );
        seg.position.set(0, 0.11 - b * 0.075, -0.21 - b * 0.008);
        seg.castShadow = true;
        head.add(seg);
      }
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.035, 0.035),
        accentMat,
      );
      tie.position.set(0, -0.24, -0.24);
      head.add(tie);
      break;
    }

    case 'swept_back': {
      // Classic 1990s Bollywood-inspired swept back teen hair
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.09, 0.24),
        hairMat,
      );
      crest.position.set(0, 0.31, 0.02);
      crest.rotation.x = -0.26;
      crest.castShadow = true;
      head.add(crest);

      const backSweep = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, 0.1),
        hairMat,
      );
      backSweep.position.set(0, 0.16, -0.17);
      head.add(backSweep);
      break;
    }

    case 'high_bun': {
      // Neat traditional bun (jooda) at back-top of head with bright hair clip
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), hairMat);
      bun.position.set(0, 0.29, -0.17);
      bun.castShadow = true;
      head.add(bun);

      const clip = new THREE.Mesh(
        new THREE.TorusGeometry(0.088, 0.015, 6, 12),
        accentMat,
      );
      clip.position.set(0, 0.285, -0.15);
      clip.rotation.x = 0.45;
      head.add(clip);
      break;
    }

    case 'spiky': {
      const spikes = [
        [0, 0.36, 0.06, 0.25, 0],
        [-0.09, 0.35, 0.05, 0.2, 0.3],
        [0.09, 0.35, 0.05, 0.2, -0.3],
        [-0.06, 0.36, -0.05, -0.2, 0.2],
        [0.06, 0.36, -0.05, -0.2, -0.2],
      ];
      for (const [sx, sy, sz, rx, rz] of spikes) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, 0.13, 6),
          hairMat,
        );
        spike.position.set(sx, sy, sz);
        spike.rotation.set(rx, 0, rz);
        spike.castShadow = true;
        head.add(spike);
      }
      break;
    }

    case 'bob_band': {
      // Rounded 90s bob cut framing cheeks + bright hairband
      const bob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.215, 0.228, 0.22, 14, 1, false, Math.PI * 0.28, Math.PI * 1.44),
        hairMat,
      );
      bob.position.set(0, 0.14, -0.01);
      bob.rotation.y = Math.PI;
      bob.castShadow = true;
      head.add(bob);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.205, 0.02, 6, 16, Math.PI),
        accentMat,
      );
      band.position.set(0, 0.21, 0.02);
      band.rotation.x = -0.3;
      head.add(band);
      break;
    }

    case 'wavy': {
      // Medium wavy teen hair covering nape and ears
      const backMass = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 12, 10),
        hairMat,
      );
      backMass.scale.set(1.06, 0.92, 0.96);
      backMass.position.set(0, 0.18, -0.055);
      backMass.castShadow = true;
      head.add(backMass);

      const wave = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.07, 0.13),
        hairMat,
      );
      wave.position.set(-0.02, 0.29, 0.09);
      wave.rotation.z = 0.15;
      head.add(wave);
      break;
    }
  }
}

function addAccessoryGeometry(
  accessory: AccessoryType,
  torso: THREE.Group,
  head: THREE.Group,
  leftForearm: THREE.Group,
  rightForearm: THREE.Group,
): void {
  switch (accessory) {
    case 'none':
      return;

    case 'gamcha': {
      // Classic Indian red-and-cream checkered cotton gamcha draped over shoulder
      const gamchaMat = new THREE.MeshStandardMaterial({
        color: 0xc43628,
        roughness: 0.92,
      });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xf4e3c5,
        roughness: 0.92,
      });

      const neckWrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.165, 0.04, 8, 16),
        gamchaMat,
      );
      neckWrap.rotation.x = Math.PI / 2;
      neckWrap.position.set(0, 0.57, 0);
      torso.add(neckWrap);

      const frontDrape = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.36, 0.045),
        gamchaMat,
      );
      frontDrape.position.set(0.14, 0.4, 0.145);
      frontDrape.rotation.z = -0.08;
      frontDrape.castShadow = true;
      torso.add(frontDrape);

      const border = new THREE.Mesh(
        new THREE.BoxGeometry(0.114, 0.05, 0.048),
        stripeMat,
      );
      border.position.set(0.15, 0.24, 0.145);
      torso.add(border);
      break;
    }

    case 'cap': {
      // 1990s gully-cricket cotton cap
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x224b7a,
        roughness: 0.8,
      });
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.214, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
        capMat,
      );
      crown.position.set(0, 0.195, 0);
      crown.castShadow = true;
      head.add(crown);

      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.025, 0.17),
        new THREE.MeshStandardMaterial({ color: 0xe6a832, roughness: 0.75 }),
      );
      visor.position.set(0, 0.23, 0.19);
      visor.rotation.x = 0.12;
      visor.castShadow = true;
      head.add(visor);
      break;
    }

    case 'spectacles': {
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x24201e,
        roughness: 0.35,
        metalness: 0.6,
      });
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.043, 0.006, 6, 16),
          frameMat,
        );
        rim.position.set(side * 0.065, 0.173, 0.199);
        head.add(rim);
      }
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, 0.007, 0.007),
        frameMat,
      );
      bridge.position.set(0, 0.176, 0.201);
      head.add(bridge);
      break;
    }

    case 'satchel': {
      // Classic 1990s khaki canvas village school bag slung diagonally across back
      const bagMat = new THREE.MeshStandardMaterial({
        color: 0x7a5c3c,
        roughness: 0.9,
      });
      const strapMat = new THREE.MeshStandardMaterial({
        color: 0x5c422a,
        roughness: 0.88,
      });
      const flapMat = new THREE.MeshStandardMaterial({
        color: 0x8e6d48,
        roughness: 0.88,
      });

      const bagBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.3, 0.12),
        bagMat,
      );
      bagBody.position.set(-0.04, 0.28, -0.185);
      bagBody.castShadow = true;
      torso.add(bagBody);

      const flap = new THREE.Mesh(
        new THREE.BoxGeometry(0.33, 0.12, 0.13),
        flapMat,
      );
      flap.position.set(-0.04, 0.37, -0.19);
      torso.add(flap);

      // Diagonal shoulder strap across chest
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.56, 0.29),
        strapMat,
      );
      strap.position.set(0.02, 0.34, 0);
      strap.rotation.z = 0.62;
      torso.add(strap);
      break;
    }

    case 'bangles': {
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd9a841,
        roughness: 0.28,
        metalness: 0.85,
      });
      const redMat = new THREE.MeshStandardMaterial({
        color: 0xc2342c,
        roughness: 0.38,
        metalness: 0.25,
      });
      for (const arm of [leftForearm, rightForearm]) {
        for (let b = 0; b < 3; b++) {
          const bangle = new THREE.Mesh(
            new THREE.TorusGeometry(0.056, 0.008, 6, 12),
            b === 1 ? redMat : goldMat,
          );
          bangle.rotation.x = Math.PI / 2;
          bangle.position.y = -0.18 - b * 0.022;
          arm.add(bangle);
        }
      }
      break;
    }

    case 'wristwatch': {
      const strapMat = new THREE.MeshStandardMaterial({
        color: 0x262220,
        roughness: 0.7,
      });
      const dialMat = new THREE.MeshStandardMaterial({
        color: 0xe6dec8,
        roughness: 0.25,
        metalness: 0.5,
      });
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.011, 6, 12),
        strapMat,
      );
      strap.rotation.x = Math.PI / 2;
      strap.position.y = -0.21;
      leftForearm.add(strap);

      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.016, 10),
        dialMat,
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.055, -0.21, 0.01);
      leftForearm.add(dial);
      break;
    }
  }
}

export function createCustomizedCharacter(
  config: CharacterBuildConfig,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  const { preset, outfitStyle, outfitColor, accessory, isSeeker, includeTagRing } =
    config;

  const root = new THREE.Group();
  root.scale.setScalar(preset.heightScale);

  // Grounded radial contact shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.56,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  root.add(shadowPlane);

  // Diegetic TAG range ring for hiders
  let tagRing: THREE.Mesh | null = null;
  if (includeTagRing) {
    const ringGeo = new THREE.RingGeometry(0.68, 0.84, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc845,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    tagRing = new THREE.Mesh(ringGeo, ringMat);
    tagRing.rotation.x = -Math.PI / 2;
    tagRing.position.y = 0.05;
    root.add(tagRing);
  }

  // Materials
  const primaryOutfitColor =
    outfitStyle === 'school_uniform' ? 0xf2ede0 : outfitColor;
  const secondaryBottomColor =
    outfitStyle === 'school_uniform'
      ? preset.outfitStyle === 'school_uniform'
        ? preset.secondaryColor
        : 0x263f66
      : outfitStyle === 'kurta_pyjama'
        ? 0xeee2cc
        : preset.secondaryColor;

  const topMat = new THREE.MeshStandardMaterial({
    color: primaryOutfitColor,
    roughness: 0.82,
    metalness: 0.0,
  });
  const bottomMat = new THREE.MeshStandardMaterial({
    color: secondaryBottomColor,
    roughness: 0.86,
    metalness: 0.0,
  });
  const trimAccentMat = new THREE.MeshStandardMaterial({
    color:
      outfitStyle === 'school_uniform'
        ? 0xb8362a
        : new THREE.Color(outfitColor).offsetHSL(0.06, 0.08, -0.14),
    roughness: 0.72,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: preset.skinColor,
    roughness: 0.58,
    metalness: 0.0,
    sheen: 0.2,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(preset.skinColor).lerp(
      new THREE.Color(0xffe6d4),
      0.45,
    ),
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.72,
    metalness: 0.04,
  });
  const sandalMat = new THREE.MeshStandardMaterial({
    color: preset.sandalColor,
    roughness: 0.74,
  });

  // Hip-level articulated body container
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0.68;
  root.add(bodyRoot);

  // Articulated 2-segment legs (thigh + knee pivot -> shin + sandal)
  const isLongPants = outfitStyle === 'kurta_pyjama';
  const makeLeg = (xOffset: number): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(xOffset, 0, 0);

    const thighMat = outfitStyle === 'frock' ? skinMat : bottomMat;
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.075, 0.34, 8),
      thighMat,
    );
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.32, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.056, 0.32, 8),
      isLongPants ? bottomMat : skinMat,
    );
    shin.position.y = -0.15;
    shin.castShadow = true;
    knee.add(shin);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.072, 0.23),
      sandalMat,
    );
    foot.position.set(0, -0.32, 0.045);
    foot.castShadow = true;
    knee.add(foot);

    return { hip, knee };
  };

  const leftLegParts = makeLeg(-0.12);
  const rightLegParts = makeLeg(0.12);
  bodyRoot.add(leftLegParts.hip, rightLegParts.hip);

  // Torso group pivoted at waist
  const torso = new THREE.Group();
  bodyRoot.add(torso);

  // Waist / Hips + Outfit-specific silhouette
  const hipsMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.16, 0.24),
    outfitStyle === 'frock' ? topMat : bottomMat,
  );
  hipsMesh.position.y = 0.04;
  hipsMesh.castShadow = true;
  torso.add(hipsMesh);

  const chestMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.43, 0.48, 0.26),
    topMat,
  );
  chestMesh.position.y = 0.34;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.175, 0.08, 10),
    topMat,
  );
  collar.position.y = 0.59;
  torso.add(collar);

  // Outfit-specific traditional 1990s Indian garment details
  if (outfitStyle === 'kurta_pyjama') {
    // Flowing knee-length kurta hem & embroidered placket down chest
    const kurtaSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.28, 0.42, 12),
      topMat,
    );
    kurtaSkirt.scale.set(1.0, 1.0, 0.68);
    kurtaSkirt.position.y = -0.07;
    kurtaSkirt.castShadow = true;
    torso.add(kurtaSkirt);

    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.28, 0.025),
      trimAccentMat,
    );
    placket.position.set(0, 0.42, 0.132);
    torso.add(placket);
  } else if (outfitStyle === 'frock') {
    // Flared pleated 1990s village cotton frock with waist sash & contrast border
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.39, 0.48, 14),
      topMat,
    );
    skirt.scale.set(1.0, 1.0, 0.85);
    skirt.position.y = -0.08;
    skirt.castShadow = true;
    torso.add(skirt);

    const hemTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.365, 0.395, 0.075, 14),
      bottomMat,
    );
    hemTrim.scale.set(1.0, 1.0, 0.85);
    hemTrim.position.y = -0.29;
    torso.add(hemTrim);

    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.075, 0.285),
      trimAccentMat,
    );
    sash.position.y = 0.13;
    torso.add(sash);
  } else if (outfitStyle === 'school_uniform') {
    // Crisp 1990s Indian school tie, belt, and pleated skirt or khaki shorts
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.32, 0.022),
      trimAccentMat,
    );
    tie.position.set(0, 0.39, 0.135);
    torso.add(tie);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.425, 0.06, 0.265),
      new THREE.MeshStandardMaterial({ color: 0x2d2219, roughness: 0.65 }),
    );
    belt.position.y = 0.11;
    torso.add(belt);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.015),
      bottomMat,
    );
    pocket.position.set(0.12, 0.41, 0.133);
    torso.add(pocket);

    // Pinafore pleats for girls in school uniform
    if (preset.hairStyle === 'high_bun' || preset.hairStyle === 'twin_braids' || preset.hairStyle === 'bob_band') {
      const uniformSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.215, 0.34, 0.42, 12),
        bottomMat,
      );
      uniformSkirt.scale.set(1.0, 1.0, 0.8);
      uniformSkirt.position.y = -0.08;
      uniformSkirt.castShadow = true;
      torso.add(uniformSkirt);
    }
  } else {
    // Shirt & Shorts: front button strip & chest pocket
    const buttonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.42, 0.016),
      trimAccentMat,
    );
    buttonStrip.position.set(0, 0.35, 0.132);
    torso.add(buttonStrip);
  }

  // Articulated 2-segment arms (shoulder -> upperArm -> elbow -> forearm/hand)
  const isLongSleeve = outfitStyle === 'kurta_pyjama';
  const makeArm = (
    xOffset: number,
  ): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOffset, 0.52, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.076, 0.066, 0.24, 8),
      topMat,
    );
    upperArm.position.y = -0.11;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.047, 0.26, 8),
      isLongSleeve ? topMat : skinMat,
    );
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.054, 8, 8), skinMat);
    hand.position.y = -0.26;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArmParts = makeArm(-0.285);
  const rightArmParts = makeArm(0.285);
  torso.add(leftArmParts.shoulder, rightArmParts.shoulder);

  // Head + Sculpted Human Facial Features + Hairstyle
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  torso.add(head);

  const faceRig = buildDetailedCharacterFace(
    head,
    preset,
    skinMat,
    preset.hairColor,
  );
  addHairGeometry(head, preset.hairStyle, hairMat, trimAccentMat);

  // Add chosen accessory
  addAccessoryGeometry(
    accessory,
    torso,
    head,
    leftArmParts.elbow,
    rightArmParts.elbow,
  );

  // Bright saffron Seeker headband so the seeker is always unmistakable on the village field
  if (isSeeker) {
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf4b632,
      roughness: 0.55,
    });
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.03, 8, 18),
      bandMat,
    );
    band.rotation.x = Math.PI / 2 - 0.1;
    band.position.set(0, 0.235, 0);
    head.add(band);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.03), bandMat);
    tail.position.set(0.04, 0.13, -0.22);
    tail.rotation.x = 0.38;
    tail.rotation.z = -0.22;
    head.add(tail);
  }

  // Comical floating golden dizzy stars shown above head during funny caught animation
  const dizzyStars = new THREE.Group();
  dizzyStars.position.set(0, 0.45, 0);
  dizzyStars.visible = false;
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), starMat);
    star.position.set(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
    dizzyStars.add(star);
  }
  head.add(dizzyStars);

  // Reusable smooth animation controller
  const rig: CharacterRig = {
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
    dizzyStars,
    faceRig,
    tagRing,
    crouchBlend: 0,
    coverBlend: 0,
    walkPhase: 0,
    idlePhase: Math.random() * Math.PI * 2,

    updateAnimation({
      dt,
      moveSpeed,
      state,
      lookAroundPhase = 0,
      caughtElapsed = 0,
      expression,
      eyeLookX,
      eyeLookY,
      headLookYaw = 0,
      headLookPitch = 0,
      isConversing = false,
      isSpeaking = false,
      interactionProgress = 0,
      seatY = 0.46,
      airHeight = 0,
    }: CharacterAnimationInput) {
      rig.idlePhase += dt;
      const safeAir = Math.max(0, airHeight);
      shadowPlane.position.y = 0.03 - safeAir;
      const shadowScale = Math.max(0.55, 1 - safeAir * 0.25);
      shadowPlane.scale.set(shadowScale, shadowScale, 1);

      faceRig.updateExpression({
        dt,
        state,
        expression,
        lookAroundPhase,
        caughtElapsed,
        eyeLookX,
        eyeLookY,
        isConversing,
        isSpeaking,
        idlePhase: rig.idlePhase,
      });

      // Funny Caught Animation: startled jump -> frantic dizzy spin -> comical hands-on-head slump
      if (state === 'caught_funny') {
        dizzyStars.visible = true;
        dizzyStars.rotation.y += dt * 7.5;

        const t = caughtElapsed;
        if (t < 0.45) {
          // Stage 1: Surprised "Dhappa!" jump with arms & legs splayed wide
          const jumpArc = Math.sin((t / 0.45) * Math.PI);
          bodyRoot.position.y = 0.68 + jumpArc * 0.62;
          bodyRoot.rotation.set(0, 0, 0);
          torso.rotation.set(-0.22 * jumpArc, 0, Math.sin(t * 28) * 0.15);
          leftArmParts.shoulder.rotation.set(-2.65, 0, -0.55);
          rightArmParts.shoulder.rotation.set(-2.65, 0, 0.55);
          leftArmParts.elbow.rotation.x = -0.35;
          rightArmParts.elbow.rotation.x = -0.35;
          leftLegParts.hip.rotation.set(-0.35, 0, -0.28);
          rightLegParts.hip.rotation.set(-0.35, 0, 0.28);
          leftLegParts.knee.rotation.x = 0.7;
          rightLegParts.knee.rotation.x = 0.7;
          head.rotation.set(-0.2, 0, Math.sin(t * 32) * 0.2);
        } else if (t < 1.35) {
          // Stage 2: Comical dizzy wobble spin with flailing arms
          const u = t - 0.45;
          bodyRoot.position.y = 0.68 + Math.abs(Math.sin(u * 10)) * 0.08;
          bodyRoot.rotation.y = u * 9.5;
          bodyRoot.rotation.z = Math.sin(u * 12) * 0.14;
          torso.rotation.set(0.1, 0, Math.cos(u * 11) * 0.18);
          leftArmParts.shoulder.rotation.set(
            -1.9 + Math.sin(u * 16) * 0.5,
            0,
            -0.7,
          );
          rightArmParts.shoulder.rotation.set(
            -1.9 - Math.sin(u * 16) * 0.5,
            0,
            0.7,
          );
          leftArmParts.elbow.rotation.x = -0.6;
          rightArmParts.elbow.rotation.x = -0.6;
          leftLegParts.hip.rotation.set(Math.sin(u * 14) * 0.35, 0, 0);
          rightLegParts.hip.rotation.set(-Math.sin(u * 14) * 0.35, 0, 0);
          leftLegParts.knee.rotation.x = 0.25;
          rightLegParts.knee.rotation.x = 0.25;
          head.rotation.set(0.1, Math.sin(u * 14) * 0.3, Math.cos(u * 10) * 0.22);
        } else {
          // Stage 3: Dramatic "Oh no!" slump sitting/crouching with hands on head
          const s = Math.min(1, (t - 1.35) / 0.4);
          bodyRoot.position.y = THREE.MathUtils.lerp(0.68, 0.38, s);
          bodyRoot.rotation.y = THREE.MathUtils.damp(bodyRoot.rotation.y, 0, 8, dt);
          bodyRoot.rotation.z = THREE.MathUtils.damp(bodyRoot.rotation.z, 0, 8, dt);
          torso.rotation.set(0.32 * s, 0, 0);
          leftArmParts.shoulder.rotation.set(-2.3 * s, 0, -0.35 * s);
          rightArmParts.shoulder.rotation.set(-2.3 * s, 0, 0.35 * s);
          leftArmParts.elbow.rotation.x = -1.65 * s;
          rightArmParts.elbow.rotation.x = -1.65 * s;
          leftLegParts.hip.rotation.set(-0.95 * s, 0, -0.15 * s);
          rightLegParts.hip.rotation.set(-0.95 * s, 0, 0.15 * s);
          leftLegParts.knee.rotation.x = 1.45 * s;
          rightLegParts.knee.rotation.x = 1.45 * s;
          head.rotation.set(0.28 * s, Math.sin(t * 7) * 0.28, 0);
        }
        return;
      }

      // Reset caught extras
      dizzyStars.visible = false;
      bodyRoot.rotation.y = THREE.MathUtils.damp(bodyRoot.rotation.y, 0, 12, dt);
      bodyRoot.rotation.z = THREE.MathUtils.damp(bodyRoot.rotation.z, 0, 12, dt);

      const isCrouched =
        state === 'crouch' || state === 'sneak' || state === 'hide_cover';
      const isCoverHide = state === 'hide_cover';
      rig.crouchBlend = THREE.MathUtils.damp(
        rig.crouchBlend,
        isCrouched ? 1 : 0,
        11,
        dt,
      );
      rig.coverBlend = THREE.MathUtils.damp(
        rig.coverBlend,
        isCoverHide ? 1 : 0,
        9,
        dt,
      );

      const c = rig.crouchBlend;
      const cov = rig.coverBlend;

      // Traditional Hide-and-Seek Seeker Pose: Eyes tightly closed, both hands covering face while counting
      if (state === 'counting_eyes_closed') {
        const t = rig.idlePhase;
        const countNod = Math.sin(t * 2.6);
        const k = 14;
        bodyRoot.position.y = THREE.MathUtils.damp(
          bodyRoot.position.y,
          0.68 + Math.abs(countNod) * 0.015,
          k,
          dt,
        );
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, 0.1 + countNod * 0.03, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, 0, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, 0, k, dt);

        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, 0.04, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, -0.04, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, 0.08, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, 0.08, k, dt);

        // Raise both arms and fold elbows so hands cover closed eyes
        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, -1.78, k, dt);
        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, -1.78, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, -0.18, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, 0.18, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, -1.72, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, -1.72, k, dt);

        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, 0.18 + countNod * 0.07, k, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, k, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, k, dt);
        return;
      }

      // Realistic "Dhappa!" Tag Lunge Pose: Seeker leans forward and reaches out with right hand to tag
      if (state === 'tag_lunge') {
        const k = 18;
        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, 0.62, k, dt);
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, 0.44, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, 0.28, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, 0.06, k, dt);

        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, 0.45, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, -0.52, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, 0.42, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, 0.56, k, dt);

        // Left arm swings back for balance, right arm stretches out forward to tap
        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, 0.58, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, 0.24, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, -0.5, k, dt);

        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, -1.62, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, -0.06, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, -0.08, k, dt);

        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -0.26, k, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, -0.18, k, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, k, dt);
        return;
      }

      // Crisp athletic Jump pose with raised arms and tucked knees
      if (state === 'jump') {
        const k = 18;
        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, 0.72, k, dt);
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, 0.14, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, 0, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, 0, k, dt);

        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, -0.52, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, -0.34, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, 0.92, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, 0.68, k, dt);

        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, -1.05, k, dt);
        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, -0.88, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, 0.42, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, -0.42, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, -0.78, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, -0.78, k, dt);

        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -0.1, k, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, k, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, k, dt);
        return;
      }

      // Start screen character showcase: expressive breathing idle + friendly periodic wave
      if (state === 'showcase') {
        const t = rig.idlePhase;
        const breathe = Math.sin(t * 2.2) * 0.015;
        const waveWindow = (t % 4.6);
        const waving = waveWindow > 0.6 && waveWindow < 2.2;
        const waveEnv = waving
          ? Math.sin(((waveWindow - 0.6) / 1.6) * Math.PI)
          : 0;

        bodyRoot.position.y = THREE.MathUtils.damp(
          bodyRoot.position.y,
          0.68 + breathe,
          10,
          dt,
        );
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, 0.02, 8, dt);
        torso.rotation.y = THREE.MathUtils.damp(
          torso.rotation.y,
          Math.sin(t * 1.1) * 0.08,
          8,
          dt,
        );
        torso.rotation.z = THREE.MathUtils.damp(
          torso.rotation.z,
          Math.sin(t * 0.9) * 0.03,
          8,
          dt,
        );

        leftLegParts.hip.rotation.set(0.03, 0, -0.04);
        rightLegParts.hip.rotation.set(-0.03, 0, 0.04);
        leftLegParts.knee.rotation.x = 0.04;
        rightLegParts.knee.rotation.x = 0.04;

        leftArmParts.shoulder.rotation.set(0.06 + Math.sin(t * 1.6) * 0.04, 0, 0.12);
        leftArmParts.elbow.rotation.x = -0.18;

        // Friendly right-hand wave
        rightArmParts.shoulder.rotation.set(
          THREE.MathUtils.lerp(0.06, -2.55, waveEnv),
          0,
          THREE.MathUtils.lerp(-0.12, -0.45 + Math.sin(t * 11) * 0.24, waveEnv),
        );
        rightArmParts.elbow.rotation.x = THREE.MathUtils.lerp(-0.18, -0.65, waveEnv);

        head.rotation.set(
          Math.sin(t * 1.3) * 0.04,
          Math.sin(t * 0.85) * 0.16,
          waveEnv * 0.08,
        );
        return;
      }

      // Friendly Two-Player Handshake Animation: reach forward, clasp & 3 smooth vertical pumps, warm nod
      if (state === 'handshake') {
        const t = rig.idlePhase;
        const p = THREE.MathUtils.clamp(interactionProgress, 0, 1);
        // Smooth attack (0..0.18), sustained pumping clasp (0.18..0.82), smooth release (0.82..1)
        const reachEnv =
          p < 0.18
            ? THREE.MathUtils.smoothstep(p, 0, 0.18)
            : p > 0.82
              ? 1 - THREE.MathUtils.smoothstep(p, 0.82, 1)
              : 1;
        const shakeWave =
          p > 0.15 && p < 0.85
            ? Math.sin(((p - 0.15) / 0.7) * Math.PI * 5) * reachEnv
            : 0;
        const k = 15;

        const hipY = 0.68 - 0.015 * reachEnv + Math.abs(shakeWave) * 0.01;
        const torsoX = 0.1 * reachEnv + shakeWave * 0.025;
        const torsoY = -0.14 * reachEnv; // slight right-shoulder lead
        const torsoZ = -0.03 * reachEnv;

        const lHipX = 0.08 * reachEnv;
        const rHipX = -0.1 * reachEnv;
        const lKneeX = 0.08;
        const rKneeX = 0.12 * reachEnv + 0.05;

        // Left arm rests naturally slightly back for poise
        const lArmX = 0.12 * reachEnv;
        const lArmZ = 0.14;
        const lElbowX = -0.26;

        // Right arm extends naturally forward at waist/chest height and pumps gently
        const rArmX = THREE.MathUtils.lerp(0.04, -1.04 + shakeWave * 0.17, reachEnv);
        const rArmZ = THREE.MathUtils.lerp(-0.1, 0.12, reachEnv);
        const rElbowX = THREE.MathUtils.lerp(-0.18, -0.52 + shakeWave * 0.14, reachEnv);

        // Warm nod & attentive eye contact
        const headX = -0.04 + shakeWave * 0.07 + THREE.MathUtils.clamp(headLookPitch, -0.35, 0.35);
        const headY =
          THREE.MathUtils.clamp(headLookYaw, -0.55, 0.55) + Math.sin(t * 2.2) * 0.03;
        const headZ = 0.06 * reachEnv;

        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, hipY, k, dt);
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, torsoX, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, torsoY, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, torsoZ, k, dt);
        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, lHipX, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, rHipX, k, dt);
        leftLegParts.hip.rotation.z = THREE.MathUtils.damp(leftLegParts.hip.rotation.z, -0.04, k, dt);
        rightLegParts.hip.rotation.z = THREE.MathUtils.damp(rightLegParts.hip.rotation.z, 0.04, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, lKneeX, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, rKneeX, k, dt);
        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, lArmX, k, dt);
        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, rArmX, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, lArmZ, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, rArmZ, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, lElbowX, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, rElbowX, k, dt);
        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headX, k, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headY, 12, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, headZ, 12, dt);
        return;
      }

      // Natural Sitting Down, Seated Relaxed Pose, and Standing Up Animations (for charpais & benches)
      if (state === 'sit_down' || state === 'sitting' || state === 'stand_up') {
        const t = rig.idlePhase;
        const p = THREE.MathUtils.clamp(interactionProgress, 0, 1);
        const ease = p * p * (3 - 2 * p);
        // Scale hip height cleanly relative to seat surface (account for heightScale)
        const seatedHipY = THREE.MathUtils.clamp(
          (seatY + 0.06) / Math.max(0.75, preset.heightScale),
          0.36,
          0.56,
        );

        let sitBlend = 1;
        let leanArc = 0;
        let braceHands = 0;
        if (state === 'sit_down') {
          sitBlend = ease;
          leanArc = Math.sin(p * Math.PI);
          braceHands = leanArc;
        } else if (state === 'stand_up') {
          sitBlend = 1 - ease;
          leanArc = Math.sin(p * Math.PI);
          braceHands = leanArc;
        }

        const breathe = Math.sin(t * 2.1) * 0.008 * sitBlend;
        const legRelax = state === 'sitting' ? Math.sin(t * 0.95) * 0.04 : 0;
        const hipY = THREE.MathUtils.lerp(0.68, seatedHipY, sitBlend) + breathe;
        const torsoX = 0.04 * sitBlend + leanArc * 0.28;
        const torsoY =
          state === 'sitting'
            ? THREE.MathUtils.clamp(headLookYaw * 0.22, -0.18, 0.18) + Math.sin(t * 0.7) * 0.02
            : 0;
        const torsoZ = state === 'sitting' ? Math.sin(t * 0.85) * 0.02 : 0;

        // Thighs swing horizontally forward, shins hang vertically down naturally
        const lHipX = THREE.MathUtils.lerp(0, -1.44, sitBlend);
        const rHipX = THREE.MathUtils.lerp(0, -1.42, sitBlend);
        const lKneeX = THREE.MathUtils.lerp(0.05, 1.46 + legRelax, sitBlend);
        const rKneeX = THREE.MathUtils.lerp(0.05, 1.44 - legRelax, sitBlend);

        // Hands rest relaxed on knees/thighs while seated; push gently during sit_down / stand_up
        const lArmX = THREE.MathUtils.lerp(0.04, -0.58, sitBlend) - braceHands * 0.24;
        const rArmX = THREE.MathUtils.lerp(0.04, -0.56, sitBlend) - braceHands * 0.24;
        const lArmZ = THREE.MathUtils.lerp(0.1, 0.18, sitBlend) + braceHands * 0.08;
        const rArmZ = THREE.MathUtils.lerp(-0.1, -0.18, sitBlend) - braceHands * 0.08;
        const lElbowX = THREE.MathUtils.lerp(-0.16, -0.72, sitBlend) + braceHands * 0.28;
        const rElbowX = THREE.MathUtils.lerp(-0.16, -0.7, sitBlend) + braceHands * 0.28;

        // Conversational head look-at & natural nodding while seated
        const convNod = isConversing
          ? Math.sin(t * (isSpeaking ? 5.2 : 2.3)) * (isSpeaking ? 0.055 : 0.03)
          : 0;
        const convTilt = isConversing ? Math.sin(t * 1.4) * 0.06 : 0;
        const headX =
          -leanArc * 0.16 +
          THREE.MathUtils.clamp(headLookPitch, -0.35, 0.35) +
          convNod;
        const headY =
          isConversing || Math.abs(headLookYaw) > 0.01
            ? THREE.MathUtils.clamp(headLookYaw, -0.72, 0.72)
            : Math.sin(t * 0.75) * 0.14;
        const headZ = convTilt;

        const k = state === 'sitting' ? 11 : 16;
        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, hipY, k, dt);
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, torsoX, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, torsoY, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, torsoZ, k, dt);
        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, lHipX, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, rHipX, k, dt);
        leftLegParts.hip.rotation.z = THREE.MathUtils.damp(leftLegParts.hip.rotation.z, -0.07 * sitBlend, k, dt);
        rightLegParts.hip.rotation.z = THREE.MathUtils.damp(rightLegParts.hip.rotation.z, 0.07 * sitBlend, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, lKneeX, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, rKneeX, k, dt);
        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, lArmX, k, dt);
        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, rArmX, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, lArmZ, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, rArmZ, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, lElbowX, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, rElbowX, k, dt);
        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headX, 11, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headY, 10, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, headZ, 10, dt);
        return;
      }

      // Expressive 3D Emotes: Laugh, Surprise, Wave, Dance, Clap, Cry
      if (
        state === 'emote_laugh' ||
        state === 'emote_surprise' ||
        state === 'emote_wave' ||
        state === 'emote_dance' ||
        state === 'emote_clap' ||
        state === 'emote_cry'
      ) {
        const t = rig.idlePhase;
        const k = 15;
        let hipY = 0.68;
        let torsoX = 0;
        let torsoY = 0;
        let torsoZ = 0;
        let lHipX = 0;
        let rHipX = 0;
        let lKneeX = 0.05;
        let rKneeX = 0.05;
        let lArmX = 0;
        let rArmX = 0;
        let lArmZ = 0.1;
        let rArmZ = -0.1;
        let lElbowX = -0.2;
        let rElbowX = -0.2;
        let headX = 0;
        let headY = 0;
        let headZ = 0;

        if (state === 'emote_laugh') {
          const shake = Math.sin(t * 16);
          const bounce = Math.abs(Math.sin(t * 8));
          hipY = 0.68 - 0.04 + bounce * 0.06;
          torsoX = -0.14 + shake * 0.08;
          torsoY = Math.sin(t * 5) * 0.08;
          torsoZ = Math.sin(t * 7) * 0.06;
          lHipX = -0.14;
          rHipX = -0.14;
          lKneeX = 0.24;
          rKneeX = 0.24;
          // Holding belly & shaking with laughter
          lArmX = -0.78 + shake * 0.12;
          rArmX = -0.78 - shake * 0.12;
          lArmZ = 0.28;
          rArmZ = -0.28;
          lElbowX = -1.25;
          rElbowX = -1.25;
          headX = -0.24 + shake * 0.1;
          headY = Math.sin(t * 6) * 0.14;
          headZ = Math.cos(t * 7) * 0.12;
        } else if (state === 'emote_surprise') {
          // Startled lean-back with raised hands and wide-eyed surprise expression
          const pulse = Math.sin(t * 9) * 0.04;
          hipY = 0.68 + Math.abs(Math.sin(t * 4.5)) * 0.045;
          torsoX = -0.15 + pulse;
          torsoY = Math.sin(t * 3.2) * 0.06;
          torsoZ = Math.cos(t * 3.6) * 0.05;
          lHipX = -0.08;
          rHipX = -0.08;
          lKneeX = 0.16;
          rKneeX = 0.16;
          // Hands pop up open near cheeks/chest in genuine surprise
          lArmX = -1.62 + pulse;
          rArmX = -1.62 - pulse;
          lArmZ = 0.36;
          rArmZ = -0.36;
          lElbowX = -1.35;
          rElbowX = -1.35;
          headX = -0.14 + pulse * 0.5;
          headY = THREE.MathUtils.clamp(headLookYaw, -0.45, 0.45) + Math.sin(t * 4) * 0.08;
          headZ = 0.08 * Math.sin(t * 3.5);
        } else if (state === 'emote_wave') {
          hipY = 0.68 + Math.sin(t * 3.5) * 0.02;
          torsoX = -0.02;
          torsoY = 0.1;
          torsoZ = -0.06;
          lArmX = 0.08;
          lArmZ = 0.16;
          lElbowX = -0.22;
          // Enthusiastic high wave with right hand
          rArmX = -2.65;
          rArmZ = -0.45 + Math.sin(t * 12) * 0.34;
          rElbowX = -0.55 + Math.cos(t * 12) * 0.18;
          headX = -0.05;
          headY = Math.sin(t * 3) * 0.14;
          headZ = 0.12;
        } else if (state === 'emote_dance') {
          // Joyful 1990s desi bhangra-style shoulder & alternating-arm dance!
          const beat = Math.sin(t * 9.5);
          const halfBeat = Math.sin(t * 4.75);
          const stepBounce = Math.abs(Math.cos(t * 9.5));
          hipY = 0.68 - 0.07 + stepBounce * 0.11;
          torsoX = 0.05;
          torsoY = beat * 0.26;
          torsoZ = halfBeat * 0.14;
          lHipX = Math.max(0, beat) * -0.42;
          rHipX = Math.max(0, -beat) * -0.42;
          lKneeX = 0.22 + Math.max(0, beat) * 0.62;
          rKneeX = 0.22 + Math.max(0, -beat) * 0.62;
          lArmX = -2.15 + beat * 0.48;
          rArmX = -2.15 - beat * 0.48;
          lArmZ = 0.52 + halfBeat * 0.22;
          rArmZ = -0.52 + halfBeat * 0.22;
          lElbowX = -0.95 + Math.sin(t * 19) * 0.2;
          rElbowX = -0.95 - Math.sin(t * 19) * 0.2;
          headX = -0.06;
          headY = -beat * 0.18;
          headZ = halfBeat * 0.18;
        } else if (state === 'emote_clap') {
          const clapCycle = Math.abs(Math.sin(t * 9.5));
          hipY = 0.68 + clapCycle * 0.03;
          torsoX = 0.04;
          torsoY = Math.sin(t * 3.5) * 0.06;
          // Hands come together rhythmically in front of chest
          lArmX = -1.08;
          rArmX = -1.08;
          lArmZ = -0.26 + clapCycle * 0.34;
          rArmZ = 0.26 - clapCycle * 0.34;
          lElbowX = -1.12;
          rElbowX = -1.12;
          headX = 0.04 + clapCycle * 0.07;
          headY = Math.sin(t * 4.5) * 0.1;
        } else {
          // emote_cry: dramatic comical sobbing with hands rubbing eyes
          const sob = Math.sin(t * 11);
          hipY = 0.68 - 0.08 + Math.abs(sob) * 0.025;
          torsoX = 0.26 + sob * 0.04;
          torsoZ = Math.sin(t * 4.5) * 0.08;
          lHipX = -0.18;
          rHipX = -0.18;
          lKneeX = 0.32;
          rKneeX = 0.32;
          lArmX = -1.85 + sob * 0.1;
          rArmX = -1.85 - sob * 0.1;
          lArmZ = -0.12;
          rArmZ = 0.12;
          lElbowX = -1.75;
          rElbowX = -1.75;
          headX = 0.32;
          headY = Math.sin(t * 5) * 0.2;
          headZ = Math.cos(t * 5) * 0.14;
        }

        bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, hipY, k, dt);
        torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, torsoX, k, dt);
        torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, torsoY, k, dt);
        torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, torsoZ, k, dt);
        leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, lHipX, k, dt);
        rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, rHipX, k, dt);
        leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, lKneeX, k, dt);
        rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, rKneeX, k, dt);
        leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, lArmX, k, dt);
        rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, rArmX, k, dt);
        leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, lArmZ, k, dt);
        rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, rArmZ, k, dt);
        leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, lElbowX, k, dt);
        rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, rElbowX, k, dt);
        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headX, k, dt);
        head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headY, k, dt);
        head.rotation.z = THREE.MathUtils.damp(head.rotation.z, headZ, k, dt);
        return;
      }

      // Compute movement gait parameters (Idle / Walk / Run / Sneak / Hide-in-Cover)
      const isMoving =
        moveSpeed > 0.15 &&
        (state === 'walk' || state === 'run' || state === 'sneak');
      const isRunning = state === 'run' && moveSpeed > 3.6;

      if (isMoving) {
        const cadence = isRunning
          ? 7.8 + moveSpeed * 1.2
          : state === 'sneak'
            ? 4.4 + moveSpeed * 1.3
            : 5.2 + moveSpeed * 1.35;
        rig.walkPhase += dt * cadence;
      }

      const sinW = Math.sin(rig.walkPhase);
      const cosW = Math.cos(rig.walkPhase);

      let targetHipY = 0.68;
      let targetTorsoX = 0;
      let targetTorsoY = 0;
      let targetTorsoZ = 0;
      let lHipX = 0;
      let rHipX = 0;
      let lKneeX = 0;
      let rKneeX = 0;
      let lArmX = 0;
      let rArmX = 0;
      let lArmZ = 0.09;
      let rArmZ = -0.09;
      let lElbowX = -0.15;
      let rElbowX = -0.15;
      let headX = 0;
      let headY = lookAroundPhase ? Math.sin(lookAroundPhase) * 0.58 : 0;
      let headZ = 0;

      if (!isMoving) {
        // Breathing Idle / Stationary Crouch / Hiding Behind Wall or Object
        const breathe = Math.sin(rig.idlePhase * 2.4) * 0.014;
        const sway = Math.sin(rig.idlePhase * 1.2) * 0.025;

        targetHipY = 0.68 - c * 0.31 - cov * 0.06 + breathe;
        targetTorsoX = c * 0.44 + cov * 0.18;
        targetTorsoY = sway;
        targetTorsoZ = 0;

        lHipX = -c * 0.88 - cov * 0.14;
        rHipX = -c * 0.88 - cov * 0.14;
        lKneeX = c * 1.42 + cov * 0.22;
        rKneeX = c * 1.42 + cov * 0.22;

        // When hiding behind a wall/object, hug arms close to knees and peek cautiously left & right!
        const peekCycle = Math.sin(rig.idlePhase * 1.7);
        lArmX = -c * 0.62 - cov * 0.35;
        rArmX = -c * 0.62 - cov * 0.35;
        lArmZ = 0.09 + c * 0.14 - cov * 0.16;
        rArmZ = -0.09 - c * 0.14 + cov * 0.16;
        lElbowX = -0.18 - c * 0.52 - cov * 0.48;
        rElbowX = -0.18 - c * 0.52 - cov * 0.48;

        headX = -c * 0.34 - cov * 0.14;
        if (!lookAroundPhase) {
          if (cov > 0.25) {
            headY = peekCycle * 0.65 * cov;
            headZ = cov * peekCycle * 0.12;
          } else if (isConversing || Math.abs(headLookYaw) > 0.01) {
            // Attentive conversational head tracking, natural nodding & gentle listening tilt
            const nodAmp = isSpeaking ? 0.06 : 0.032;
            const nodFreq = isSpeaking ? 5.6 : 2.4;
            headX +=
              THREE.MathUtils.clamp(headLookPitch, -0.35, 0.35) +
              Math.sin(rig.idlePhase * nodFreq) * nodAmp;
            headY = THREE.MathUtils.clamp(headLookYaw, -0.68, 0.68);
            headZ = Math.sin(rig.idlePhase * 1.45) * 0.065;
            targetTorsoY += THREE.MathUtils.clamp(headLookYaw * 0.18, -0.14, 0.14);
          } else {
            headY = Math.sin(rig.idlePhase * 0.8) * 0.14;
          }
        }
      } else if (state === 'sneak') {
        // Cautious crouched tiptoe sneaking
        const step = sinW * 0.42;
        const bob = Math.abs(cosW) * 0.032;

        targetHipY = 0.68 - 0.3 + bob;
        targetTorsoX = 0.52;
        targetTorsoY = -sinW * 0.14;
        targetTorsoZ = sinW * 0.05;

        lHipX = -0.78 + step;
        rHipX = -0.78 - step;
        lKneeX = 1.25 + Math.max(0, -cosW) * 0.45;
        rKneeX = 1.25 + Math.max(0, cosW) * 0.45;

        // Arms held out slightly for quiet balance while sneaking
        lArmX = -0.45 - step * 0.55;
        rArmX = -0.45 + step * 0.55;
        lArmZ = 0.32;
        rArmZ = -0.32;
        lElbowX = -0.82;
        rElbowX = -0.82;
        headX = -0.42;
      } else if (isRunning) {
        // Energetic full running cycle: forward sprint lean, high knee lift, pumping elbows
        const stride = sinW * 0.88;
        const bounce = Math.abs(cosW) * 0.095;

        targetHipY = 0.68 + bounce - 0.04;
        targetTorsoX = 0.24;
        targetTorsoY = -sinW * 0.2;
        targetTorsoZ = sinW * 0.045;

        lHipX = stride - 0.12;
        rHipX = -stride - 0.12;
        lKneeX = Math.max(0.08, -cosW * 0.98 + 0.32);
        rKneeX = Math.max(0.08, cosW * 0.98 + 0.32);

        lArmX = -stride * 1.05;
        rArmX = stride * 1.05;
        lArmZ = 0.16;
        rArmZ = -0.16;
        lElbowX = -1.18 + Math.max(0, -sinW) * 0.28;
        rElbowX = -1.18 + Math.max(0, sinW) * 0.28;
        headX = -0.16;
      } else {
        // Natural relaxed walking gait
        const amp = Math.min(0.56, moveSpeed * 0.15);
        const stride = sinW * amp;
        const bounce = Math.abs(cosW) * 0.045;

        targetHipY = 0.68 + bounce;
        targetTorsoX = 0.07;
        targetTorsoY = -sinW * 0.1;
        targetTorsoZ = sinW * 0.025;

        lHipX = stride;
        rHipX = -stride;
        lKneeX = Math.max(0.04, -cosW * 0.55 + 0.14);
        rKneeX = Math.max(0.04, cosW * 0.55 + 0.14);

        lArmX = -stride * 0.82;
        rArmX = stride * 0.82;
        lArmZ = 0.1;
        rArmZ = -0.1;
        lElbowX = -0.35 + Math.max(0, -sinW) * 0.18;
        rElbowX = -0.35 + Math.max(0, sinW) * 0.18;
        headX = -0.04;
        if (!lookAroundPhase && (isConversing || Math.abs(headLookYaw) > 0.01)) {
          headY = THREE.MathUtils.clamp(headLookYaw * 0.65, -0.45, 0.45);
          headX += THREE.MathUtils.clamp(headLookPitch * 0.5, -0.2, 0.2);
        }
      }

      // Smooth exponential joint damping for realistic weight and fluid state transitions
      const k = 14;
      bodyRoot.position.y = THREE.MathUtils.damp(bodyRoot.position.y, targetHipY, k, dt);
      torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, targetTorsoX, k, dt);
      torso.rotation.y = THREE.MathUtils.damp(torso.rotation.y, targetTorsoY, k, dt);
      torso.rotation.z = THREE.MathUtils.damp(torso.rotation.z, targetTorsoZ, k, dt);

      leftLegParts.hip.rotation.x = THREE.MathUtils.damp(leftLegParts.hip.rotation.x, lHipX, k, dt);
      rightLegParts.hip.rotation.x = THREE.MathUtils.damp(rightLegParts.hip.rotation.x, rHipX, k, dt);
      leftLegParts.hip.rotation.z = THREE.MathUtils.damp(leftLegParts.hip.rotation.z, 0, k, dt);
      rightLegParts.hip.rotation.z = THREE.MathUtils.damp(rightLegParts.hip.rotation.z, 0, k, dt);
      leftLegParts.knee.rotation.x = THREE.MathUtils.damp(leftLegParts.knee.rotation.x, lKneeX, k, dt);
      rightLegParts.knee.rotation.x = THREE.MathUtils.damp(rightLegParts.knee.rotation.x, rKneeX, k, dt);

      leftArmParts.shoulder.rotation.x = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.x, lArmX, k, dt);
      rightArmParts.shoulder.rotation.x = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.x, rArmX, k, dt);
      leftArmParts.shoulder.rotation.z = THREE.MathUtils.damp(leftArmParts.shoulder.rotation.z, lArmZ, k, dt);
      rightArmParts.shoulder.rotation.z = THREE.MathUtils.damp(rightArmParts.shoulder.rotation.z, rArmZ, k, dt);
      leftArmParts.elbow.rotation.x = THREE.MathUtils.damp(leftArmParts.elbow.rotation.x, lElbowX, k, dt);
      rightArmParts.elbow.rotation.x = THREE.MathUtils.damp(rightArmParts.elbow.rotation.x, rElbowX, k, dt);

      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headX, k, dt);
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headY, 10, dt);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, headZ, 10, dt);
    },
  };

  return rig;
}

export function createCharacterFromCustomization(
  customization: CharacterCustomization,
  isSeeker: boolean,
  contactShadowTexture: THREE.Texture,
): CharacterRig {
  const preset = getPresetById(customization.presetId);
  return createCustomizedCharacter(
    {
      preset,
      outfitStyle: customization.outfitStyle,
      outfitColor: customization.outfitColor,
      accessory: customization.accessory,
      isSeeker,
      includeTagRing: !isSeeker,
    },
    contactShadowTexture,
  );
}

export function disposeCharacterRig(rig: CharacterRig): void {
  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
}

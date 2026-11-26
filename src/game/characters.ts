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

// ============================================================================
// Cached Procedural 1990s Indian Fabric, Skin Pore & Hair Strand PBR Textures
// Shared across all player rigs for silky Android GPU performance
// ============================================================================
const fabricTexCache = new Map<string, THREE.CanvasTexture>();
let cachedSkinBumpTex: THREE.CanvasTexture | null = null;
let cachedHairStrandTex: THREE.CanvasTexture | null = null;

function getSkinBumpTexture(): THREE.CanvasTexture {
  if (cachedSkinBumpTex) return cachedSkinBumpTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 650; i++) {
    const px = (i * 53) % 128;
    const py = (i * 97) % 128;
    const v = 114 + ((i * 29) % 28);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(px, py, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  cachedSkinBumpTex = tex;
  return tex;
}

function getHairStrandTexture(): THREE.CanvasTexture {
  if (cachedHairStrandTex) return cachedHairStrandTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 2) {
    const shade = 104 + Math.round(Math.sin(x * 0.7) * 24 + ((x * 19) % 18));
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, 0, 1, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.needsUpdate = true;
  cachedHairStrandTex = tex;
  return tex;
}

function getFabricTexture(
  kind: 'cotton_weave' | 'kurta_khadi' | 'frock_print' | 'twill',
  baseHex: number,
): THREE.CanvasTexture {
  const key = `${kind}_${baseHex.toString(16)}`;
  const hit = fabricTexCache.get(key);
  if (hit) return hit;

  const W = 256;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const base = new THREE.Color(baseHex);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.18);
  const dark = base.clone().lerp(new THREE.Color(0x1a1410), 0.22);
  const accent = base.clone().offsetHSL(0.08, 0.14, 0.22);

  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, W, H);

  // Fine woven cotton warp & weft threads (authentic 1990s handloom/mill cloth)
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle =
      y % 8 === 0
        ? `rgba(255,250,240,0.065)`
        : `rgba(20,14,10,0.055)`;
    ctx.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 4) {
    ctx.fillStyle =
      x % 8 === 0
        ? `rgba(255,250,240,0.05)`
        : `rgba(20,14,10,0.045)`;
    ctx.fillRect(x, 0, 1, H);
  }

  if (kind === 'cotton_weave') {
    // Classic 1990s Indian village checkered cotton shirt pattern
    ctx.fillStyle = `#${dark.getHexString()}`;
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < W; i += 32) {
      ctx.fillRect(i, 0, 4, H);
      ctx.fillRect(0, i, W, 4);
    }
    ctx.fillStyle = `#${light.getHexString()}`;
    ctx.globalAlpha = 0.14;
    for (let i = 16; i < W; i += 32) {
      ctx.fillRect(i, 0, 2, H);
      ctx.fillRect(0, i, W, 2);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'kurta_khadi') {
    // Organic hand-spun khadi slub texture & delicate woven vertical stripes
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = `#${light.getHexString()}`;
    for (let x = 0; x < W; x += 24) {
      ctx.fillRect(x, 0, 2, H);
      ctx.fillRect(x + 5, 0, 1, H);
    }
    ctx.fillStyle = `#${dark.getHexString()}`;
    for (let i = 0; i < 160; i++) {
      const sx = (i * 47) % W;
      const sy = (i * 83) % H;
      ctx.fillRect(sx, sy, 10 + (i % 14), 1);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'frock_print') {
    // Nostalgic 1990s Indian block-printed cotton floral motifs
    for (let gy = 16; gy < H; gy += 32) {
      for (let gx = 16; gx < W; gx += 32) {
        const ox = gx + ((gy / 32) % 2 === 0 ? 0 : 14);
        ctx.fillStyle = `#${light.getHexString()}`;
        ctx.globalAlpha = 0.34;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(ox + Math.cos(a) * 4.5, gy + Math.sin(a) * 4.5, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `#${accent.getHexString()}`;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(ox, gy, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else {
    // Crisp school-uniform cotton twill diagonal weave
    ctx.strokeStyle = 'rgba(20, 20, 24, 0.05)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  fabricTexCache.set(key, tex);
  return tex;
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
      new THREE.SphereGeometry(0.198, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
      hairMat,
    );
    buzz.position.set(0, 0.172, -0.01);
    buzz.rotation.x = -0.15;
    head.add(buzz);
    return;
  }

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.207, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  cap.position.set(0, 0.178, -0.015);
  cap.rotation.x = -0.2;
  cap.castShadow = true;
  head.add(cap);

  // Subtle sideburn/temple locks for natural hairline framing
  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.028, 0.065, 4, 8),
      hairMat,
    );
    temple.position.set(side * 0.185, 0.16, 0.025);
    temple.rotation.z = side * 0.12;
    head.add(temple);
  }

  switch (hairStyle) {
    case 'short_part': {
      // Sculpted layered 1990s oiled side-part fringe (organic rounded locks instead of boxy cube)
      const mainLock = new THREE.Mesh(
        new THREE.SphereGeometry(0.145, 12, 8),
        hairMat,
      );
      mainLock.scale.set(1.08, 0.34, 0.72);
      mainLock.position.set(0.035, 0.285, 0.095);
      mainLock.rotation.z = -0.16;
      mainLock.rotation.x = 0.22;
      head.add(mainLock);

      const sideLock = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        hairMat,
      );
      sideLock.scale.set(1.1, 0.36, 0.65);
      sideLock.position.set(-0.085, 0.275, 0.105);
      sideLock.rotation.z = 0.28;
      head.add(sideLock);
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
      // Sculpted 1990s Bollywood-inspired swept-back teen hair
      const crest = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        hairMat,
      );
      crest.scale.set(0.95, 0.44, 1.08);
      crest.position.set(0, 0.315, 0.02);
      crest.rotation.x = -0.26;
      crest.castShadow = true;
      head.add(crest);

      const backSweep = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 8),
        hairMat,
      );
      backSweep.scale.set(1.12, 0.72, 0.62);
      backSweep.position.set(0, 0.165, -0.16);
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
      // Medium wavy teen hair covering nape and ears with organic soft front wave
      const backMass = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 14, 10),
        hairMat,
      );
      backMass.scale.set(1.06, 0.92, 0.96);
      backMass.position.set(0, 0.18, -0.055);
      backMass.castShadow = true;
      head.add(backMass);

      const wave = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 8),
        hairMat,
      );
      wave.scale.set(1.06, 0.38, 0.7);
      wave.position.set(-0.02, 0.292, 0.092);
      wave.rotation.z = 0.15;
      wave.rotation.x = 0.16;
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

  const topFabricKind =
    outfitStyle === 'kurta_pyjama'
      ? 'kurta_khadi'
      : outfitStyle === 'frock'
        ? 'frock_print'
        : outfitStyle === 'school_uniform'
          ? 'twill'
          : 'cotton_weave';
  const bottomFabricKind =
    outfitStyle === 'kurta_pyjama' ? 'kurta_khadi' : 'twill';

  const topMat = new THREE.MeshPhysicalMaterial({
    map: getFabricTexture(topFabricKind, primaryOutfitColor),
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.26,
    sheenRoughness: 0.84,
    sheenColor: new THREE.Color(primaryOutfitColor).lerp(
      new THREE.Color(0xfff5e8),
      0.35,
    ),
  });
  const bottomMat = new THREE.MeshPhysicalMaterial({
    map: getFabricTexture(bottomFabricKind, secondaryBottomColor),
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.18,
    sheenRoughness: 0.88,
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
    bumpMap: getSkinBumpTexture(),
    bumpScale: 0.0022,
    roughness: 0.55,
    metalness: 0.0,
    sheen: 0.24,
    sheenRoughness: 0.74,
    sheenColor: new THREE.Color(preset.skinColor).lerp(
      new THREE.Color(0xffe6d4),
      0.48,
    ),
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    bumpMap: getHairStrandTexture(),
    bumpScale: 0.004,
    roughness: 0.56,
    metalness: 0.08,
  });
  const sandalMat = new THREE.MeshStandardMaterial({
    color: outfitStyle === 'school_uniform' ? 0x1d1e22 : preset.sandalColor,
    roughness: 0.68,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: 0xf4f0e6,
    roughness: 0.88,
  });

  // Subtle realistic human proportion differentiation between children & teens
  const isTeen = preset.ageGroup === 'teen';
  const shoulderHalfW = isTeen ? 0.255 : 0.238;
  const hipHalfW = isTeen ? 0.112 : 0.105;

  // Hip-level articulated body container
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0.68;
  root.add(bodyRoot);

  // Articulated realistic 2-segment legs (tapered thigh -> rounded knee -> contoured calf -> realistic foot & chappal/shoe)
  const isLongPants = outfitStyle === 'kurta_pyjama';
  const makeLeg = (xOffset: number): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(xOffset, 0, 0);

    const thighMat = outfitStyle === 'frock' ? skinMat : bottomMat;
    // Rounded hip cap so leg rotates cleanly without gap
    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 10, 8),
      thighMat,
    );
    hip.add(hipCap);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.084, 0.066, 0.34, 12),
      thighMat,
    );
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    hip.add(thigh);

    // Hem cuff for shorts
    if (!isLongPants && outfitStyle !== 'frock') {
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.074, 0.055, 12),
        bottomMat,
      );
      cuff.position.y = -0.27;
      hip.add(cuff);
    }

    const knee = new THREE.Group();
    knee.position.set(0, -0.32, 0);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 10, 8),
      isLongPants ? bottomMat : skinMat,
    );
    knee.add(kneeCap);

    // Contoured calf & slender ankle
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.044, 0.31, 12),
      isLongPants ? bottomMat : skinMat,
    );
    calf.position.y = -0.155;
    calf.castShadow = true;
    knee.add(calf);

    if (outfitStyle === 'school_uniform') {
      // White cotton school sock + sculpted black canvas school shoe with white sole trim
      const sock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.051, 0.045, 0.13, 10),
        sockMat,
      );
      sock.position.y = -0.245;
      knee.add(sock);

      const shoeUpper = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052, 0.105, 5, 10),
        sandalMat,
      );
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1.06, 1.0, 0.78);
      shoeUpper.position.set(0, -0.322, 0.048);
      shoeUpper.castShadow = true;
      knee.add(shoeUpper);

      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.108, 0.022, 0.215),
        sockMat,
      );
      sole.position.set(0, -0.352, 0.048);
      knee.add(sole);
    } else {
      // Sculpted human foot + authentic 1990s Indian chappal (sandal sole & V-strap)
      const footMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.046, 0.095, 5, 10),
        skinMat,
      );
      footMesh.rotation.x = Math.PI / 2;
      footMesh.scale.set(1.04, 1.0, 0.72);
      footMesh.position.set(0, -0.318, 0.046);
      footMesh.castShadow = true;
      knee.add(footMesh);

      const chappalSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.112, 0.022, 0.22),
        sandalMat,
      );
      chappalSole.position.set(0, -0.35, 0.048);
      chappalSole.castShadow = true;
      knee.add(chappalSole);

      // Classic Y / V sandal straps across top of foot
      for (const s of [-1, 1]) {
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.012, 0.105),
          sandalMat,
        );
        strap.position.set(s * 0.025, -0.292, 0.068);
        strap.rotation.y = s * -0.32;
        strap.rotation.x = 0.22;
        knee.add(strap);
      }
    }

    return { hip, knee };
  };

  const leftLegParts = makeLeg(-hipHalfW);
  const rightLegParts = makeLeg(hipHalfW);
  bodyRoot.add(leftLegParts.hip, rightLegParts.hip);

  // Torso group pivoted at waist with natural sculpted human anatomy (zero boxy blocks!)
  const torso = new THREE.Group();
  bodyRoot.add(torso);

  // Sculpted pelvis & lower waist
  const hipsMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.185, 0.195, 0.18, 16),
    outfitStyle === 'frock' ? topMat : bottomMat,
  );
  hipsMesh.scale.set(1.04, 1.0, 0.68);
  hipsMesh.position.y = 0.045;
  hipsMesh.castShadow = true;
  torso.add(hipsMesh);

  // Sculpted contoured upper torso (anatomical waist -> ribcage -> broad chest -> tapered shoulders)
  const torsoLathePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.172, 0.02), // waist
    new THREE.Vector2(0.184, 0.14), // lower ribcage
    new THREE.Vector2(isTeen ? 0.218 : 0.205, 0.34), // chest
    new THREE.Vector2(isTeen ? 0.228 : 0.212, 0.45), // upper chest / shoulders
    new THREE.Vector2(0.145, 0.515), // trapezius slope
    new THREE.Vector2(0.088, 0.535), // collar base
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoLathePts, 18);
  const chestMesh = new THREE.Mesh(torsoGeo, topMat);
  chestMesh.scale.set(1.0, 1.0, 0.64);
  chestMesh.position.y = 0.085;
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  torso.add(chestMesh);

  // Anatomical neck cylinder bridging shoulders seamlessly into head
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.078, 0.13, 12),
    skinMat,
  );
  neckMesh.position.y = 0.635;
  neckMesh.castShadow = true;
  torso.add(neckMesh);

  // Crisp folded shirt/kurta collar ring
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.024, 8, 16),
    topMat,
  );
  collar.rotation.x = Math.PI / 2 + 0.12;
  collar.scale.set(1.05, 0.9, 1.0);
  collar.position.set(0, 0.605, 0.01);
  torso.add(collar);

  // Outfit-specific traditional 1990s Indian garment details
  if (outfitStyle === 'kurta_pyjama') {
    // Flowing knee-length kurta hem & embroidered placket down chest
    const kurtaSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.255, 0.44, 16),
      topMat,
    );
    kurtaSkirt.scale.set(1.02, 1.0, 0.68);
    kurtaSkirt.position.y = -0.075;
    kurtaSkirt.castShadow = true;
    torso.add(kurtaSkirt);

    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.056, 0.27, 0.024),
      trimAccentMat,
    );
    placket.position.set(0, 0.42, 0.134);
    torso.add(placket);
  } else if (outfitStyle === 'frock') {
    // Flared pleated 1990s village cotton frock with waist sash & contrast border
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.38, 0.49, 18),
      topMat,
    );
    skirt.scale.set(1.0, 1.0, 0.84);
    skirt.position.y = -0.085;
    skirt.castShadow = true;
    torso.add(skirt);

    const hemTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.355, 0.385, 0.075, 18),
      bottomMat,
    );
    hemTrim.scale.set(1.0, 1.0, 0.84);
    hemTrim.position.y = -0.295;
    torso.add(hemTrim);

    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.194, 0.072, 16),
      trimAccentMat,
    );
    sash.scale.set(1.02, 1.0, 0.72);
    sash.position.y = 0.12;
    torso.add(sash);
  } else if (outfitStyle === 'school_uniform') {
    // Crisp 1990s Indian school tie with knot, belt with brass buckle, and pleated skirt or khaki shorts
    const tieKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      trimAccentMat,
    );
    tieKnot.position.set(0, 0.56, 0.118);
    torso.add(tieKnot);

    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.32, 0.018),
      trimAccentMat,
    );
    tie.position.set(0, 0.39, 0.132);
    torso.add(tie);

    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.192, 0.055, 16),
      new THREE.MeshStandardMaterial({ color: 0x261d15, roughness: 0.58 }),
    );
    belt.scale.set(1.04, 1.0, 0.69);
    belt.position.y = 0.105;
    torso.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.048, 0.022),
      new THREE.MeshStandardMaterial({
        color: 0xd4a64a,
        roughness: 0.32,
        metalness: 0.82,
      }),
    );
    buckle.position.set(0, 0.105, 0.138);
    torso.add(buckle);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.082, 0.086, 0.014),
      bottomMat,
    );
    pocket.position.set(0.1, 0.42, 0.128);
    torso.add(pocket);

    // Pinafore pleats for girls in school uniform
    if (
      preset.hairStyle === 'high_bun' ||
      preset.hairStyle === 'twin_braids' ||
      preset.hairStyle === 'bob_band'
    ) {
      const uniformSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.33, 0.42, 16),
        bottomMat,
      );
      uniformSkirt.scale.set(1.0, 1.0, 0.8);
      uniformSkirt.position.y = -0.08;
      uniformSkirt.castShadow = true;
      torso.add(uniformSkirt);
    }
  } else {
    // Shirt & Shorts: front button placket, tiny buttons & chest pocket
    const buttonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.41, 0.016),
      trimAccentMat,
    );
    buttonStrip.position.set(0, 0.35, 0.132);
    torso.add(buttonStrip);

    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xf4ecdc,
      roughness: 0.4,
    });
    for (let b = 0; b < 4; b++) {
      const btn = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 6, 6),
        btnMat,
      );
      btn.position.set(0, 0.21 + b * 0.095, 0.142);
      torso.add(btn);
    }
  }

  // Articulated 2-segment realistic arms (deltoid cap -> tapered upperArm -> elbow joint -> tapered forearm -> detailed sculpted hand!)
  const isLongSleeve = outfitStyle === 'kurta_pyjama';
  const makeArm = (
    xOffset: number,
  ): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const side = xOffset < 0 ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(xOffset, 0.525, 0);

    // Rounded deltoid sleeve cap seamlessly joining torso
    const deltoid = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 8),
      topMat,
    );
    deltoid.scale.set(0.95, 1.0, 0.92);
    deltoid.castShadow = true;
    shoulder.add(deltoid);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.056, 0.23, 10),
      topMat,
    );
    upperArm.position.y = -0.115;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.051, 8, 8),
      isLongSleeve ? topMat : skinMat,
    );
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.039, 0.245, 10),
      isLongSleeve ? topMat : skinMat,
    );
    forearm.position.y = -0.122;
    forearm.castShadow = true;
    elbow.add(forearm);

    // Realistic sculpted human hand (palm + angled thumb + tapered curved fingers)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.255, 0);
    elbow.add(handGroup);

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.068, 0.032),
      skinMat,
    );
    palm.position.set(0, -0.025, 0.004);
    handGroup.add(palm);

    // Tapered finger cluster curved naturally inward
    const fingers = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.038, 4, 8),
      skinMat,
    );
    fingers.scale.set(1.05, 1.0, 0.62);
    fingers.position.set(0, -0.072, 0.012);
    fingers.rotation.x = 0.22;
    handGroup.add(fingers);

    // Distinct anatomical thumb angled inward toward body
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.028, 4, 6),
      skinMat,
    );
    thumb.position.set(-side * 0.03, -0.034, 0.022);
    thumb.rotation.z = side * 0.45;
    thumb.rotation.x = 0.35;
    handGroup.add(thumb);

    return { shoulder, elbow };
  };

  const leftArmParts = makeArm(-shoulderHalfW);
  const rightArmParts = makeArm(shoulderHalfW);
  torso.add(leftArmParts.shoulder, rightArmParts.shoulder);

  // Head + Sculpted Human Facial Features + Hairstyle
  const head = new THREE.Group();
  head.position.set(0, 0.665, 0);
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

  // Track angular yaw velocity internally so turning lean & head-lead work automatically across singleplayer & multiplayer!
  let prevRootYaw = root.rotation.y;
  let smoothTurnRate = 0;

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
      // Measure smooth turning rate (rad/sec) from root yaw changes
      let yawDelta = root.rotation.y - prevRootYaw;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      prevRootYaw = root.rotation.y;
      const rawTurnRate = dt > 0.0005 ? THREE.MathUtils.clamp(yawDelta / dt, -6, 6) : 0;
      smoothTurnRate = THREE.MathUtils.damp(smoothTurnRate, rawTurnRate, 10, dt);

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

      const turnBank = THREE.MathUtils.clamp(smoothTurnRate * 0.045, -0.18, 0.18);
      const turnHeadLead = THREE.MathUtils.clamp(smoothTurnRate * 0.08, -0.26, 0.26);

      if (!isMoving) {
        // Natural Breathing Idle, Relaxed Weight-Shift & In-Place Turn Step
        const breathe = Math.sin(rig.idlePhase * 2.25) * 0.014;
        const sway = Math.sin(rig.idlePhase * 1.05) * 0.032;
        const weightShift = Math.sin(rig.idlePhase * 0.85) * 0.022;
        const idleTurnStep = Math.min(1, Math.abs(smoothTurnRate) * 0.22);
        const pivotStep = Math.sin(rig.idlePhase * 7.5) * 0.16 * idleTurnStep;

        targetHipY = 0.68 - c * 0.31 - cov * 0.06 + breathe;
        targetTorsoX = c * 0.44 + cov * 0.18 + Math.sin(rig.idlePhase * 2.25) * 0.015;
        targetTorsoY = sway + turnHeadLead * 0.35;
        targetTorsoZ = weightShift * (1 - c) - turnBank * 0.35;

        lHipX = -c * 0.88 - cov * 0.14 + pivotStep;
        rHipX = -c * 0.88 - cov * 0.14 - pivotStep;
        lKneeX = c * 1.42 + cov * 0.22 + Math.max(0, pivotStep) * 0.75 + 0.04;
        rKneeX = c * 1.42 + cov * 0.22 + Math.max(0, -pivotStep) * 0.75 + 0.04;

        // Relaxed natural arms with gentle breathing swing (or hugged close when hiding behind cover)
        const peekCycle = Math.sin(rig.idlePhase * 1.7);
        const armBreath = Math.sin(rig.idlePhase * 2.25) * 0.025;
        lArmX = -c * 0.62 - cov * 0.35 + armBreath;
        rArmX = -c * 0.62 - cov * 0.35 - armBreath * 0.6;
        lArmZ = 0.1 + c * 0.14 - cov * 0.16;
        rArmZ = -0.1 - c * 0.14 + cov * 0.16;
        lElbowX = -0.22 - c * 0.52 - cov * 0.48;
        rElbowX = -0.22 - c * 0.52 - cov * 0.48;

        headX = -c * 0.34 - cov * 0.14 + Math.sin(rig.idlePhase * 1.4) * 0.022;
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
            headY = Math.sin(rig.idlePhase * 0.75) * 0.16 + turnHeadLead * 0.85;
            headZ = Math.sin(rig.idlePhase * 0.6) * 0.035;
          }
        }
      } else if (state === 'sneak') {
        // Cautious crouched tiptoe sneaking with smooth turn lean
        const step = sinW * 0.42;
        const bob = Math.abs(cosW) * 0.032;

        targetHipY = 0.68 - 0.3 + bob;
        targetTorsoX = 0.52;
        targetTorsoY = -sinW * 0.14;
        targetTorsoZ = sinW * 0.05 - turnBank * 0.5;

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
        if (!lookAroundPhase) headY = turnHeadLead * 0.8;
      } else if (isRunning) {
        // Energetic athletic running biomechanics: forward drive, high knee lift, banking into turns!
        const stride = sinW * 0.9;
        const bounce = Math.abs(cosW) * 0.09;

        targetHipY = 0.68 + bounce - 0.042;
        targetTorsoX = 0.25;
        targetTorsoY = -sinW * 0.21;
        targetTorsoZ = sinW * 0.04 - turnBank * 1.15;

        lHipX = stride - 0.14;
        rHipX = -stride - 0.14;
        lKneeX = Math.max(0.08, -cosW * 1.02 + 0.34);
        rKneeX = Math.max(0.08, cosW * 1.02 + 0.34);

        lArmX = -stride * 1.08;
        rArmX = stride * 1.08;
        lArmZ = 0.17;
        rArmZ = -0.17;
        lElbowX = -1.22 + Math.max(0, -sinW) * 0.32;
        rElbowX = -1.22 + Math.max(0, sinW) * 0.32;
        headX = -0.16;
        if (!lookAroundPhase) headY = turnHeadLead;
      } else {
        // Natural fluid human walking gait with heel-strike rhythm & turn banking
        const amp = Math.min(0.58, moveSpeed * 0.155);
        const stride = sinW * amp;
        const bounce = Math.abs(cosW) * 0.042;

        targetHipY = 0.68 + bounce - 0.01;
        targetTorsoX = 0.075;
        targetTorsoY = -sinW * 0.115;
        targetTorsoZ = sinW * 0.028 - turnBank * 0.72;

        lHipX = stride - 0.03;
        rHipX = -stride - 0.03;
        lKneeX = Math.max(0.05, -cosW * 0.58 + 0.15);
        rKneeX = Math.max(0.05, cosW * 0.58 + 0.15);

        lArmX = -stride * 0.86;
        rArmX = stride * 0.86;
        lArmZ = 0.11;
        rArmZ = -0.11;
        lElbowX = -0.34 + Math.max(0, -sinW) * 0.22;
        rElbowX = -0.34 + Math.max(0, sinW) * 0.22;
        headX = -0.04;
        if (!lookAroundPhase && (isConversing || Math.abs(headLookYaw) > 0.01)) {
          headY = THREE.MathUtils.clamp(headLookYaw * 0.65, -0.45, 0.45);
          headX += THREE.MathUtils.clamp(headLookPitch * 0.5, -0.2, 0.2);
        } else if (!lookAroundPhase) {
          headY = turnHeadLead * 0.9;
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

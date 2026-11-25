import * as THREE from 'three';
import { CharacterAnimState, CharacterPreset, FacialExpression } from './types';

export interface CharacterFaceProfile {
  eyeColorHex: string;
  eyeIrisDetailHex: string;
  lipColorHex: string;
  cheekTintHex: string;
  jawTaper: number; // 0.10 (broader) to 0.18 (slender oval)
  chinLength: number; // subtle chin prominence
  cheekFullness: number;
  eyeSpacing: number; // half-IPD around ~0.064
  eyeScaleX: number;
  eyeScaleY: number;
  browThickness: number;
  browArch: number;
  noseBridgeWidth: number;
  noseTipScale: number;
  noseLength: number;
  lipFullness: number;
  mouthWidth: number;
  foreheadMark: 'none' | 'crimson_bindi' | 'maroon_bindi' | 'chandan_tilak';
  cheekMark: 'none' | 'right_mole' | 'chin_mole' | 'freckles';
  kajalLiner: boolean;
  browNick: boolean;
  earStuds: boolean;
  defaultExpression: FacialExpression;
}

const DEFAULT_FACE_PROFILE: CharacterFaceProfile = {
  eyeColorHex: '#2c190f',
  eyeIrisDetailHex: '#5e3920',
  lipColorHex: '#8d4b3e',
  cheekTintHex: '#d4745c',
  jawTaper: 0.14,
  chinLength: 0.008,
  cheekFullness: 0.004,
  eyeSpacing: 0.064,
  eyeScaleX: 1.04,
  eyeScaleY: 0.96,
  browThickness: 0.0048,
  browArch: 0.008,
  noseBridgeWidth: 1.0,
  noseTipScale: 1.0,
  noseLength: 1.0,
  lipFullness: 1.0,
  mouthWidth: 1.0,
  foreheadMark: 'none',
  cheekMark: 'none',
  kajalLiner: false,
  browNick: false,
  earStuds: false,
  defaultExpression: 'happy',
};

export const CHARACTER_FACE_PROFILES: Record<string, CharacterFaceProfile> = {
  raju: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#2d1a0f',
    eyeIrisDetailHex: '#6b4226',
    lipColorHex: '#9d6452',
    cheekTintHex: '#d4826b',
    jawTaper: 0.145,
    chinLength: 0.007,
    cheekFullness: 0.0052,
    eyeSpacing: 0.064,
    eyeScaleX: 1.06,
    eyeScaleY: 1.0,
    browThickness: 0.0046,
    browArch: 0.009,
    noseBridgeWidth: 0.96,
    noseTipScale: 0.96,
    noseLength: 0.94,
    lipFullness: 0.88,
    mouthWidth: 1.04,
    cheekMark: 'freckles',
    defaultExpression: 'happy',
  },
  meena: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#1f120b',
    eyeIrisDetailHex: '#4f2f1c',
    lipColorHex: '#a3584f',
    cheekTintHex: '#d47c6a',
    jawTaper: 0.165,
    chinLength: 0.007,
    cheekFullness: 0.0046,
    eyeSpacing: 0.062,
    eyeScaleX: 1.08,
    eyeScaleY: 1.02,
    browThickness: 0.0042,
    browArch: 0.011,
    noseBridgeWidth: 0.88,
    noseTipScale: 0.88,
    noseLength: 0.92,
    lipFullness: 0.95,
    mouthWidth: 0.96,
    foreheadMark: 'crimson_bindi',
    kajalLiner: true,
    earStuds: true,
    defaultExpression: 'happy',
  },
  chintu: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#28170d',
    eyeIrisDetailHex: '#633c20',
    lipColorHex: '#8d5746',
    cheekTintHex: '#c67862',
    jawTaper: 0.135,
    chinLength: 0.006,
    cheekFullness: 0.0062,
    eyeSpacing: 0.065,
    eyeScaleX: 1.08,
    eyeScaleY: 1.04,
    browThickness: 0.0048,
    browArch: 0.01,
    noseBridgeWidth: 1.02,
    noseTipScale: 1.08,
    noseLength: 0.88,
    lipFullness: 0.9,
    mouthWidth: 1.05,
    cheekMark: 'right_mole',
    defaultExpression: 'excited',
  },
  guddi: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#352012',
    eyeIrisDetailHex: '#744c2b',
    lipColorHex: '#a25c53',
    cheekTintHex: '#d48270',
    jawTaper: 0.168,
    chinLength: 0.009,
    cheekFullness: 0.0036,
    eyeSpacing: 0.063,
    eyeScaleX: 1.05,
    eyeScaleY: 0.95,
    browThickness: 0.004,
    browArch: 0.0105,
    noseBridgeWidth: 0.86,
    noseTipScale: 0.86,
    noseLength: 1.05,
    lipFullness: 0.94,
    mouthWidth: 0.95,
    foreheadMark: 'maroon_bindi',
    kajalLiner: true,
    earStuds: true,
    defaultExpression: 'neutral',
  },
  bhola: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#26160d',
    eyeIrisDetailHex: '#59361d',
    lipColorHex: '#8c5546',
    cheekTintHex: '#c67860',
    jawTaper: 0.105,
    chinLength: 0.011,
    cheekFullness: 0.0032,
    eyeSpacing: 0.065,
    eyeScaleX: 1.02,
    eyeScaleY: 0.9,
    browThickness: 0.0058,
    browArch: 0.007,
    noseBridgeWidth: 1.1,
    noseTipScale: 1.06,
    noseLength: 1.08,
    lipFullness: 0.9,
    mouthWidth: 1.02,
    foreheadMark: 'chandan_tilak',
    defaultExpression: 'determined',
  },
  munna: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#1d120b',
    eyeIrisDetailHex: '#4b2d1a',
    lipColorHex: '#824f40',
    cheekTintHex: '#ba6e59',
    jawTaper: 0.128,
    chinLength: 0.0085,
    cheekFullness: 0.0042,
    eyeSpacing: 0.064,
    eyeScaleX: 1.04,
    eyeScaleY: 0.92,
    browThickness: 0.0052,
    browArch: 0.0085,
    noseBridgeWidth: 1.08,
    noseTipScale: 1.1,
    noseLength: 0.98,
    lipFullness: 0.92,
    mouthWidth: 1.02,
    browNick: true,
    defaultExpression: 'happy',
  },
  kavita: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#432714',
    eyeIrisDetailHex: '#82552b',
    lipColorHex: '#ab6056',
    cheekTintHex: '#db8a76',
    jawTaper: 0.172,
    chinLength: 0.009,
    cheekFullness: 0.004,
    eyeSpacing: 0.062,
    eyeScaleX: 1.08,
    eyeScaleY: 0.98,
    browThickness: 0.004,
    browArch: 0.0115,
    noseBridgeWidth: 0.85,
    noseTipScale: 0.84,
    noseLength: 1.03,
    lipFullness: 0.96,
    mouthWidth: 0.96,
    foreheadMark: 'crimson_bindi',
    kajalLiner: true,
    earStuds: true,
    defaultExpression: 'happy',
  },
  bunty: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#2f1c10',
    eyeIrisDetailHex: '#694022',
    lipColorHex: '#945b4b',
    cheekTintHex: '#cf7d65',
    jawTaper: 0.118,
    chinLength: 0.01,
    cheekFullness: 0.0038,
    eyeSpacing: 0.065,
    eyeScaleX: 1.04,
    eyeScaleY: 0.94,
    browThickness: 0.0052,
    browArch: 0.009,
    noseBridgeWidth: 1.02,
    noseTipScale: 0.98,
    noseLength: 1.05,
    lipFullness: 0.86,
    mouthWidth: 1.03,
    defaultExpression: 'happy',
  },
  pinki: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#23140c',
    eyeIrisDetailHex: '#5a361f',
    lipColorHex: '#a35b52',
    cheekTintHex: '#d6806c',
    jawTaper: 0.158,
    chinLength: 0.006,
    cheekFullness: 0.0058,
    eyeSpacing: 0.062,
    eyeScaleX: 1.1,
    eyeScaleY: 1.05,
    browThickness: 0.004,
    browArch: 0.0105,
    noseBridgeWidth: 0.88,
    noseTipScale: 0.9,
    noseLength: 0.88,
    lipFullness: 0.92,
    mouthWidth: 0.98,
    kajalLiner: true,
    earStuds: true,
    defaultExpression: 'happy',
  },
  sonu: {
    ...DEFAULT_FACE_PROFILE,
    eyeColorHex: '#311d11',
    eyeIrisDetailHex: '#6a4224',
    lipColorHex: '#8d5648',
    cheekTintHex: '#c87862',
    jawTaper: 0.145,
    chinLength: 0.0095,
    cheekFullness: 0.0038,
    eyeSpacing: 0.063,
    eyeScaleX: 1.04,
    eyeScaleY: 0.94,
    browThickness: 0.0048,
    browArch: 0.0085,
    noseBridgeWidth: 0.96,
    noseTipScale: 0.94,
    noseLength: 1.04,
    lipFullness: 0.88,
    mouthWidth: 0.98,
    cheekMark: 'chin_mole',
    defaultExpression: 'neutral',
  },
};

export function getFaceProfile(presetId: string): CharacterFaceProfile {
  return CHARACTER_FACE_PROFILES[presetId] ?? DEFAULT_FACE_PROFILE;
}

let cachedMaxAnisotropy = 4;
const faceTextureCache = new Map<string, THREE.CanvasTexture>();
const eyeTextureCache = new Map<string, THREE.CanvasTexture>();

export function setFaceTextureAnisotropy(maxAnisotropy: number): void {
  cachedMaxAnisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  faceTextureCache.forEach((tex) => {
    tex.anisotropy = cachedMaxAnisotropy;
    tex.needsUpdate = true;
  });
  eyeTextureCache.forEach((tex) => {
    tex.anisotropy = cachedMaxAnisotropy;
    tex.needsUpdate = true;
  });
}

function seededRand(seed: number): () => number {
  let s = seed | 0 || 1337;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const _tmpSrgb = { r: 0, g: 0, b: 0 };
function colorToSrgbCss(col: THREE.Color, alpha = 1): string {
  col.getRGB(_tmpSrgb, THREE.SRGBColorSpace);
  const r = Math.round(THREE.MathUtils.clamp(_tmpSrgb.r, 0, 1) * 255);
  const g = Math.round(THREE.MathUtils.clamp(_tmpSrgb.g, 0, 1) * 255);
  const b = Math.round(THREE.MathUtils.clamp(_tmpSrgb.b, 0, 1) * 255);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Generates a crisp 2:1 equirectangular (1024x512) natural Indian skin texture
 * matched to SphereGeometry(phiStart = -Math.PI/2) so u=0.5 faces directly +Z.
 */
function getOrCreateFaceSkinTexture(
  preset: CharacterPreset,
  profile: CharacterFaceProfile,
): THREE.CanvasTexture {
  const cacheKey = `${preset.id}_${preset.skinHex}_v2`;
  const existing = faceTextureCache.get(cacheKey);
  if (existing) return existing;

  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const baseColor = new THREE.Color(preset.skinColor);
  const highlightColor = baseColor.clone().lerp(new THREE.Color(0xfff0e2), 0.14);
  const shadowColor = baseColor.clone().lerp(new THREE.Color(0x6e432c), 0.22);
  const cheekColor = baseColor.clone().lerp(new THREE.Color(profile.cheekTintHex), 0.45);

  // 1. Exact sRGB-matched skin base (matches arms, legs, neck & ears seamlessly)
  ctx.fillStyle = colorToSrgbCss(baseColor);
  ctx.fillRect(0, 0, W, H);

  // 2. Subtle forehead, nose bridge & cheekbone tonal warmth
  const foreheadGrad = ctx.createRadialGradient(512, 185, 10, 512, 195, 110);
  foreheadGrad.addColorStop(0, colorToSrgbCss(highlightColor, 0.28));
  foreheadGrad.addColorStop(1, colorToSrgbCss(baseColor, 0));
  ctx.fillStyle = foreheadGrad;
  ctx.fillRect(360, 80, 304, 240);

  // Chin highlight
  const chinGrad = ctx.createRadialGradient(512, 344, 4, 512, 344, 52);
  chinGrad.addColorStop(0, colorToSrgbCss(highlightColor, 0.22));
  chinGrad.addColorStop(1, colorToSrgbCss(baseColor, 0));
  ctx.fillStyle = chinGrad;
  ctx.fillRect(430, 290, 164, 110);

  // 3. Soft natural cheek warmth (gentle healthy blush, no dark brown blotches)
  for (const side of [-1, 1]) {
    const cx = 512 + side * 78;
    const cy = 278;
    const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
    cGrad.addColorStop(0, colorToSrgbCss(cheekColor, 0.15));
    cGrad.addColorStop(1, colorToSrgbCss(cheekColor, 0));
    ctx.fillStyle = cGrad;
    ctx.fillRect(cx - 60, cy - 60, 120, 120);
  }

  // 4. Soft orbital eye socket ambient occlusion
  for (const side of [-1, 1]) {
    const ex = 512 + side * 54;
    const ey = 247;
    const sockGrad = ctx.createRadialGradient(ex, ey, 6, ex, ey, 34);
    sockGrad.addColorStop(0, colorToSrgbCss(shadowColor, 0.18));
    sockGrad.addColorStop(0.7, colorToSrgbCss(shadowColor, 0.06));
    sockGrad.addColorStop(1, colorToSrgbCss(shadowColor, 0));
    ctx.fillStyle = sockGrad;
    ctx.fillRect(ex - 38, ey - 38, 76, 76);

    ctx.strokeStyle = colorToSrgbCss(shadowColor, 0.15);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey + 5, 19, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  // 5. Subtle under-lip dimple & far-underside neck transition (below chin at y > 432)
  const underLipGrad = ctx.createRadialGradient(512, 327, 2, 512, 327, 24);
  underLipGrad.addColorStop(0, colorToSrgbCss(shadowColor, 0.16));
  underLipGrad.addColorStop(1, colorToSrgbCss(shadowColor, 0));
  ctx.fillStyle = underLipGrad;
  ctx.fillRect(480, 300, 64, 54);

  const neckShadow = ctx.createLinearGradient(0, 432, 0, H);
  neckShadow.addColorStop(0, colorToSrgbCss(shadowColor, 0));
  neckShadow.addColorStop(1, colorToSrgbCss(shadowColor, 0.2));
  ctx.fillStyle = neckShadow;
  ctx.fillRect(0, 432, W, H - 432);

  // Subtle philtrum vertical groove shading
  const philtrumGrad = ctx.createLinearGradient(512, 286, 512, 310);
  philtrumGrad.addColorStop(0, colorToSrgbCss(shadowColor, 0.1));
  philtrumGrad.addColorStop(1, colorToSrgbCss(shadowColor, 0));
  ctx.fillStyle = philtrumGrad;
  ctx.fillRect(507, 286, 10, 24);

  // 6. Soft organic hairline feathering around temples & forehead crown
  const hairCol = new THREE.Color(preset.hairColor);
  const hairlineGrad = ctx.createLinearGradient(0, 95, 0, 160);
  hairlineGrad.addColorStop(0, colorToSrgbCss(hairCol, 0.62));
  hairlineGrad.addColorStop(0.55, colorToSrgbCss(hairCol, 0.14));
  hairlineGrad.addColorStop(1, colorToSrgbCss(hairCol, 0));
  ctx.fillStyle = hairlineGrad;
  ctx.fillRect(220, 95, 584, 66);

  // 7. Character-specific cultural marks & beauty traits
  if (profile.foreheadMark === 'crimson_bindi') {
    ctx.fillStyle = '#b91c22';
    ctx.beginPath();
    ctx.arc(512, 210, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,215,205,0.35)';
    ctx.beginPath();
    ctx.arc(510.5, 208.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (profile.foreheadMark === 'maroon_bindi') {
    ctx.fillStyle = '#7c1824';
    ctx.beginPath();
    ctx.ellipse(512, 211, 4.4, 7.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (profile.foreheadMark === 'chandan_tilak') {
    ctx.fillStyle = 'rgba(222, 162, 62, 0.82)';
    ctx.beginPath();
    ctx.roundRect(509, 198, 6, 22, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(182, 46, 36, 0.85)';
    ctx.beginPath();
    ctx.arc(512, 214, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (profile.cheekMark === 'right_mole') {
    ctx.fillStyle = 'rgba(42, 24, 16, 0.72)';
    ctx.beginPath();
    ctx.arc(448, 286, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (profile.cheekMark === 'chin_mole') {
    ctx.fillStyle = 'rgba(42, 24, 16, 0.72)';
    ctx.beginPath();
    ctx.arc(542, 336, 2.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (profile.cheekMark === 'freckles') {
    const fPts = [
      [446, 272],
      [454, 276],
      [462, 273],
      [562, 273],
      [570, 276],
      [576, 271],
    ];
    ctx.fillStyle = 'rgba(112, 64, 38, 0.28)';
    for (const [fx, fy] of fPts) {
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 8. Fine natural organic skin pore/grain micro-variation (prevents flat plastic look)
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  const rng = seededRand(preset.skinColor ^ 0x51a9);
  for (let i = 0; i < d.length; i += 4) {
    const jitter = (rng() - 0.5) * 7.5;
    d[i] = Math.max(0, Math.min(255, d[i] + jitter));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + jitter * 0.9));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + jitter * 0.8));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = cachedMaxAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  faceTextureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Crisp 2:1 equirectangular (512x256) human eye texture:
 * warm ivory sclera, subtle eyelid/corner shading, detailed iris fibers,
 * dark limbal ring, deep pupil, and crisp corneal catchlight.
 */
function getOrCreateEyeTexture(profile: CharacterFaceProfile): THREE.CanvasTexture {
  const key = `${profile.eyeColorHex}_${profile.eyeIrisDetailHex}`;
  const existing = eyeTextureCache.get(key);
  if (existing) return existing;

  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Warm natural ivory sclera (never harsh pure #fff)
  ctx.fillStyle = '#f3ece2';
  ctx.fillRect(0, 0, W, H);

  // Subtle sclera ambient curvature shading from poles & corners
  const scleraShade = ctx.createRadialGradient(256, 128, 30, 256, 128, 125);
  scleraShade.addColorStop(0, 'rgba(255, 252, 248, 0.25)');
  scleraShade.addColorStop(0.55, 'rgba(235, 220, 206, 0.16)');
  scleraShade.addColorStop(1, 'rgba(182, 134, 118, 0.42)');
  ctx.fillStyle = scleraShade;
  ctx.fillRect(0, 0, W, H);

  // Subtle upper eyelid contact shadow on sclera
  const upperLidAO = ctx.createLinearGradient(0, 68, 0, 118);
  upperLidAO.addColorStop(0, 'rgba(120, 82, 70, 0.34)');
  upperLidAO.addColorStop(1, 'rgba(120, 82, 70, 0)');
  ctx.fillStyle = upperLidAO;
  ctx.fillRect(150, 68, 212, 52);

  // 2. Outer dark limbal ring + Iris (radius ~36px at 2:1 scale -> 1:1 round on sphere!)
  const cx = 256;
  const cy = 128;
  const irisR = 36;
  const pupilR = 15.5;

  const irisGrad = ctx.createRadialGradient(cx, cy, pupilR * 0.7, cx, cy, irisR);
  irisGrad.addColorStop(0, profile.eyeIrisDetailHex);
  irisGrad.addColorStop(0.62, profile.eyeColorHex);
  irisGrad.addColorStop(0.88, '#140c08');
  irisGrad.addColorStop(1, '#100906');

  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Subtle organic radial iris fibers for lifelike depth in close-ups
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, irisR - 2, 0, Math.PI * 2);
  ctx.clip();
  const rng = seededRand(9041);
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const r0 = pupilR + 1.5;
    const r1 = irisR - 4;
    ctx.strokeStyle =
      i % 2 === 0 ? 'rgba(218, 165, 108, 0.16)' : 'rgba(20, 10, 6, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.restore();

  // Soft golden-brown peripupillary ring
  ctx.strokeStyle = 'rgba(182, 128, 72, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR + 3, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Deep black crisp pupil
  ctx.fillStyle = '#090707';
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // 4. Crisp specular catchlights (brings life to eyes at both close-up and distance)
  ctx.fillStyle = 'rgba(255, 253, 245, 0.94)';
  ctx.beginPath();
  ctx.arc(cx + 11, cy - 11, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 250, 238, 0.55)';
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 9, 2.3, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = cachedMaxAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  eyeTextureCache.set(key, texture);
  return texture;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian2D(
  x: number,
  y: number,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy));
}

/**
 * Sculpts a natural human cranium, eye sockets, brow ridge, cheekbones,
 * jaw taper, and chin while keeping the top/back scalp compatible with all hairstyles.
 */
export function buildSculptedHeadGeometry(
  profile: CharacterFaceProfile,
): THREE.BufferGeometry {
  const radius = 0.195;
  const geo = new THREE.SphereGeometry(
    radius,
    36,
    28,
    -Math.PI / 2,
    Math.PI * 2,
    0,
    Math.PI,
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / radius;
    const ny = y / radius;
    const nz = z / radius;

    // Subtle human oval vertical elongation on face & chin without shifting crown height noticeably
    if (ny < 0) {
      y *= 1.045;
    }

    if (nz > -0.05) {
      const frontMask = smoothstep(-0.05, 0.25, nz);

      // 1. Jawline taper & natural chin contour
      if (ny < -0.1) {
        const jawFactor = smoothstep(-0.1, -0.82, ny);
        x *= 1 - profile.jawTaper * jawFactor * frontMask;
        // Chin gently projects forward at lower center
        const chinSpot = gaussian2D(nx, ny, 0, -0.72, 0.28, 0.24);
        z += profile.chinLength * chinSpot * frontMask;
      }

      // 2. Sculpted eye socket recesses (allows eyeballs to nest naturally inside sockets)
      const leftSocket = gaussian2D(nx, ny, -0.33, 0.06, 0.18, 0.15);
      const rightSocket = gaussian2D(nx, ny, 0.33, 0.06, 0.18, 0.15);
      const socketRecess = (leftSocket + rightSocket) * 0.013 * frontMask;
      z -= socketRecess;

      // 3. Soft brow ridge above sockets
      const leftBrow = gaussian2D(nx, ny, -0.32, 0.26, 0.2, 0.1);
      const rightBrow = gaussian2D(nx, ny, 0.32, 0.26, 0.2, 0.1);
      z += (leftBrow + rightBrow) * 0.0045 * frontMask;

      // 4. Cheekbone fullness
      const leftCheek = gaussian2D(nx, ny, -0.46, -0.14, 0.22, 0.16);
      const rightCheek = gaussian2D(nx, ny, 0.46, -0.14, 0.22, 0.16);
      z += (leftCheek + rightCheek) * profile.cheekFullness * frontMask;

      // 5. Subtle nasal bridge root & mouth plane support
      const bridgeRoot = gaussian2D(nx, ny, 0, 0.06, 0.1, 0.16);
      const mouthMound = gaussian2D(nx, ny, 0, -0.38, 0.26, 0.16);
      z += (bridgeRoot * 0.0045 + mouthMound * 0.0045) * frontMask;
    }

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export interface FacialExpressionRig {
  updateExpression: (input: {
    dt: number;
    state: CharacterAnimState;
    expression?: FacialExpression;
    lookAroundPhase?: number;
    caughtElapsed?: number;
    eyeLookX?: number;
    eyeLookY?: number;
    idlePhase: number;
  }) => void;
}

interface ExpressionTargets {
  upperLidRot: number; // negative = open wide, positive = closed
  lowerLidRot: number; // smaller = squinted/closed, larger = open wide
  browYOffset: number;
  browTilt: number; // positive = cheerful arch, negative = worried/sad inner lift or determined V
  mouthOpen: number; // 0 = closed, 1 = wide open
  mouthSmile: number; // -1 = frown, 0 = neutral, +1 = big smile
  mouthWidthScale: number;
  eyeScale: number;
}

function resolveExpressionTargets(
  expr: FacialExpression,
  state: CharacterAnimState,
  idlePhase: number,
  caughtElapsed: number,
): ExpressionTargets {
  switch (expr) {
    case 'counting':
      return {
        upperLidRot: 0.26,
        lowerLidRot: 0.02,
        browYOffset: -0.003,
        browTilt: -0.04,
        mouthOpen: 0.04,
        mouthSmile: 0.0,
        mouthWidthScale: 0.96,
        eyeScale: 1.0,
      };
    case 'surprise':
      return {
        upperLidRot: -0.64,
        lowerLidRot: 0.46,
        browYOffset: 0.011,
        browTilt: 0.08,
        mouthOpen: 0.88,
        mouthSmile: -0.1,
        mouthWidthScale: 0.78,
        eyeScale: 1.06,
      };
    case 'fear':
      return {
        upperLidRot: -0.6,
        lowerLidRot: 0.44,
        browYOffset: 0.008,
        browTilt: -0.22, // raised inner eyebrows (classic fear/worry)
        mouthOpen: 0.42,
        mouthSmile: -0.45,
        mouthWidthScale: 1.08,
        eyeScale: 1.05,
      };
    case 'sad': {
      const quiver = state === 'emote_cry' ? Math.sin(idlePhase * 12) * 0.08 : 0;
      const slump = state === 'caught_funny' && caughtElapsed > 1.35 ? 0.1 : 0;
      return {
        upperLidRot: -0.2 + slump * 0.4,
        lowerLidRot: 0.22,
        browYOffset: 0.002,
        browTilt: -0.28,
        mouthOpen: state === 'emote_cry' ? 0.36 + quiver : 0.1,
        mouthSmile: -0.78,
        mouthWidthScale: 0.92,
        eyeScale: 0.98,
      };
    }
    case 'excited': {
      const laughPulse =
        state === 'emote_laugh' ? Math.abs(Math.sin(idlePhase * 13)) * 0.25 : 0;
      return {
        upperLidRot: state === 'emote_laugh' ? -0.28 : -0.48,
        lowerLidRot: state === 'emote_laugh' ? 0.1 : 0.2,
        browYOffset: 0.007,
        browTilt: 0.14,
        mouthOpen: 0.56 + laughPulse,
        mouthSmile: 0.95,
        mouthWidthScale: 1.14,
        eyeScale: 1.02,
      };
    }
    case 'happy':
      return {
        upperLidRot: -0.4,
        lowerLidRot: 0.2,
        browYOffset: 0.0035,
        browTilt: 0.09,
        mouthOpen: 0.08,
        mouthSmile: 0.72,
        mouthWidthScale: 1.12,
        eyeScale: 1.0,
      };
    case 'determined':
      return {
        upperLidRot: -0.36,
        lowerLidRot: 0.28,
        browYOffset: -0.004,
        browTilt: 0.16, // outer brow raised slightly (focused)
        mouthOpen: 0.0,
        mouthSmile: 0.08,
        mouthWidthScale: 0.98,
        eyeScale: 1.0,
      };
    case 'neutral':
    default:
      return {
        upperLidRot: -0.41,
        lowerLidRot: 0.33,
        browYOffset: 0.0,
        browTilt: 0.03,
        mouthOpen: 0.0,
        mouthSmile: 0.22,
        mouthWidthScale: 1.0,
        eyeScale: 1.0,
      };
  }
}

export function deriveAutoExpression(
  state: CharacterAnimState,
  defaultExpr: FacialExpression,
  idlePhase: number,
  caughtElapsed = 0,
): FacialExpression {
  if (state === 'counting_eyes_closed') return 'counting';
  if (state === 'caught_funny') {
    if (caughtElapsed < 0.55) return 'surprise';
    if (caughtElapsed < 1.35) return 'fear';
    return 'sad';
  }
  if (state === 'jump') return 'excited';
  if (state === 'emote_laugh' || state === 'emote_dance' || state === 'tag_lunge') {
    return 'excited';
  }
  if (state === 'emote_wave' || state === 'emote_clap') {
    return 'happy';
  }
  if (state === 'emote_cry') {
    return 'sad';
  }
  if (state === 'showcase') {
    const waveWindow = idlePhase % 4.6;
    if (waveWindow > 0.6 && waveWindow < 2.2) return 'happy';
    return defaultExpr;
  }
  if (state === 'sneak' || state === 'hide_cover') {
    return defaultExpr === 'determined' ? 'determined' : 'neutral';
  }
  return defaultExpr;
}

/**
 * Builds and attaches the complete high-detail sculpted human face onto `head`,
 * including skin-textured head, sculpted ears, eyes with irises & catchlights,
 * smoothly animated eyelids & blinking, curved eyebrows, shaped nose, and expressive lips.
 */
export function buildDetailedCharacterFace(
  head: THREE.Group,
  preset: CharacterPreset,
  bodySkinMat: THREE.MeshStandardMaterial,
  hairColor: number,
): FacialExpressionRig {
  const profile = getFaceProfile(preset.id);

  // 1. Sculpted head mesh with high-res procedural skin texture
  const faceTexture = getOrCreateFaceSkinTexture(preset, profile);
  const headSkinMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: faceTexture,
    roughness: 0.58,
    metalness: 0.0,
    sheen: 0.2,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(preset.skinColor).lerp(
      new THREE.Color(0xffe6d4),
      0.45,
    ),
  });

  const skullGeo = buildSculptedHeadGeometry(profile);
  const skull = new THREE.Mesh(skullGeo, headSkinMat);
  skull.position.y = 0.16;
  skull.castShadow = true;
  head.add(skull);

  // Subtle sculpted neck bridging head & torso collar so tilted poses look seamless
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.078, 0.085, 14),
    bodySkinMat,
  );
  neck.position.set(0, 0.005, -0.005);
  head.add(neck);

  // 2. Sculpted multi-part Ears (helix rim + inner bowl + lobe + optional ear studs)
  const innerEarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.skinColor).offsetHSL(-0.01, 0.05, -0.09),
    roughness: 0.68,
  });
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xe6be5a,
    roughness: 0.22,
    metalness: 0.85,
  });

  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * 0.186, 0.155, -0.012);
    earGroup.rotation.y = side * -0.18;
    earGroup.rotation.z = side * -0.06;

    const helix = new THREE.Mesh(
      new THREE.TorusGeometry(0.023, 0.0072, 8, 16, Math.PI * 1.45),
      bodySkinMat,
    );
    helix.rotation.y = Math.PI / 2;
    helix.rotation.x = -0.35;
    earGroup.add(helix);

    const concha = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 10, 8),
      innerEarMat,
    );
    concha.scale.set(0.45, 1.0, 0.78);
    concha.position.set(-side * 0.002, 0, 0.002);
    earGroup.add(concha);

    const lobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 8),
      bodySkinMat,
    );
    lobe.scale.set(0.75, 1.05, 0.88);
    lobe.position.set(0, -0.021, 0.003);
    earGroup.add(lobe);

    if (profile.earStuds) {
      const stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.0046, 8, 6),
        studMat,
      );
      stud.position.set(side * 0.007, -0.023, 0.005);
      earGroup.add(stud);
    }

    head.add(earGroup);
  }

  // 3. Natural Eyes (socket -> eyeball with iris/pupil texture -> cornea gloss -> upper & lower eyelids -> eyelash line)
  const eyeTexture = getOrCreateEyeTexture(profile);
  const eyeballMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: eyeTexture,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.08,
  });
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const eyelidSkinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.skinColor).lerp(new THREE.Color(0x8c5c44), 0.08),
    roughness: 0.6,
  });
  const lashColor = profile.kajalLiner ? 0x110c0a : 0x1e1511;
  const lashMat = new THREE.MeshStandardMaterial({
    color: lashColor,
    roughness: 0.45,
  });
  const browMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hairColor).lerp(new THREE.Color(0x140f0c), 0.25),
    roughness: 0.78,
  });

  const eyeRadius = 0.0278;
  const upperLids: THREE.Group[] = [];
  const lowerLids: THREE.Group[] = [];
  const eyeLookGroups: THREE.Group[] = [];
  const eyeSockets: THREE.Group[] = [];
  const browGroups: Array<{ group: THREE.Group; side: number; baseY: number }> = [];

  for (const side of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(side * profile.eyeSpacing, 0.173, 0.162);
    socket.rotation.y = side * 0.1;
    socket.scale.set(profile.eyeScaleX, profile.eyeScaleY, 1.0);
    head.add(socket);
    eyeSockets.push(socket);

    const lookGroup = new THREE.Group();
    socket.add(lookGroup);
    eyeLookGroups.push(lookGroup);

    const eyeball = new THREE.Mesh(
      new THREE.SphereGeometry(
        eyeRadius,
        24,
        20,
        -Math.PI / 2,
        Math.PI * 2,
        0,
        Math.PI,
      ),
      eyeballMat,
    );
    lookGroup.add(eyeball);

    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius + 0.0009, 18, 14),
      corneaMat,
    );
    lookGroup.add(cornea);

    // Upper eyelid shell pivoted at exact eyeball center
    const upperLidPivot = new THREE.Group();
    upperLidPivot.rotation.x = -0.41;
    socket.add(upperLidPivot);
    upperLids.push(upperLidPivot);

    const upperLidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        eyeRadius + 0.0022,
        20,
        10,
        -Math.PI * 0.08,
        Math.PI * 1.16,
        0,
        Math.PI * 0.52,
      ),
      eyelidSkinMat,
    );
    upperLidPivot.add(upperLidMesh);

    const upperLashRim = new THREE.Mesh(
      new THREE.TorusGeometry(
        eyeRadius + 0.0025,
        profile.kajalLiner ? 0.0024 : 0.0018,
        6,
        18,
        Math.PI * 0.72,
      ),
      lashMat,
    );
    upperLashRim.rotation.x = Math.PI / 2;
    upperLashRim.rotation.z = Math.PI * 0.14;
    upperLidPivot.add(upperLashRim);

    // Lower eyelid shell pivoted at exact eyeball center
    const lowerLidPivot = new THREE.Group();
    lowerLidPivot.rotation.x = 0.33;
    socket.add(lowerLidPivot);
    lowerLids.push(lowerLidPivot);

    const lowerLidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        eyeRadius + 0.002,
        20,
        10,
        -Math.PI * 0.06,
        Math.PI * 1.12,
        Math.PI * 0.5,
        Math.PI * 0.5,
      ),
      eyelidSkinMat,
    );
    lowerLidPivot.add(lowerLidMesh);

    if (profile.kajalLiner) {
      const lowerKajal = new THREE.Mesh(
        new THREE.TorusGeometry(eyeRadius + 0.0022, 0.0013, 5, 16, Math.PI * 0.64),
        lashMat,
      );
      lowerKajal.rotation.x = Math.PI / 2;
      lowerKajal.rotation.z = Math.PI * 0.18;
      lowerLidPivot.add(lowerKajal);
    }

    // Sculpted arched eyebrow (smooth tapered curve hugging the forehead brow ridge)
    const browGroup = new THREE.Group();
    const browBaseY = 0.21;
    browGroup.position.set(side * profile.eyeSpacing, browBaseY, 0.176);
    head.add(browGroup);

    const arch = profile.browArch;
    const innerX = -side * 0.025;
    const midX = 0;
    const outerX = side * 0.027;
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(innerX, -0.002, 0.005),
      new THREE.Vector3(innerX * 0.45, arch * 0.75, 0.006),
      new THREE.Vector3(midX, arch, 0.004),
      new THREE.Vector3(outerX * 0.55, arch * 0.55, 0.0005),
      new THREE.Vector3(outerX, -0.0045, -0.006),
    ]);
    const browGeo = new THREE.TubeGeometry(
      browCurve,
      14,
      profile.browThickness,
      7,
      false,
    );
    // Taper eyebrow ends organically
    const bPos = browGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < bPos.count; v++) {
      const vx = bPos.getX(v);
      const t = Math.abs(vx) / 0.028;
      if (t > 0.72) {
        const taper = 1 - (t - 0.72) * 1.1;
        bPos.setY(v, bPos.getY(v) * Math.max(0.45, taper));
      }
    }
    bPos.needsUpdate = true;
    browGeo.computeVertexNormals();

    const browMesh = new THREE.Mesh(browGeo, browMat);
    browGroup.add(browMesh);

    if (profile.browNick && side === 1) {
      // Tiny skin-toned nick accent in right brow for playful character
      const nick = new THREE.Mesh(
        new THREE.BoxGeometry(0.0032, 0.011, 0.011),
        eyelidSkinMat,
      );
      nick.position.set(0.014, arch * 0.45, 0.001);
      nick.rotation.z = -0.25;
      browGroup.add(nick);
    }

    browGroups.push({ group: browGroup, side, baseY: browBaseY });
  }

  // 4. Properly shaped multi-part Nose (nasal bridge + rounded tip + alae wings + nostril shading)
  const noseGroup = new THREE.Group();
  noseGroup.position.set(0, 0.146, 0.184);
  head.add(noseGroup);

  const bridgeLen = 0.04 * profile.noseLength;
  const bridge = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.0075 * profile.noseBridgeWidth,
      0.0115 * profile.noseBridgeWidth,
      bridgeLen,
      12,
    ),
    bodySkinMat,
  );
  bridge.position.set(0, 0.004, 0.006);
  bridge.rotation.x = -0.34;
  noseGroup.add(bridge);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.0135 * profile.noseTipScale, 14, 10),
    bodySkinMat,
  );
  tip.scale.set(1.05, 0.9, 1.0);
  tip.position.set(0, -0.013 * profile.noseLength, 0.016);
  noseGroup.add(tip);

  const nostrilShadowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.skinColor).offsetHSL(0, 0.04, -0.22),
    roughness: 0.78,
  });

  for (const side of [-1, 1]) {
    const ala = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085 * profile.noseTipScale, 10, 8),
      bodySkinMat,
    );
    ala.scale.set(0.95, 0.82, 0.95);
    ala.position.set(
      side * 0.0125 * profile.noseTipScale,
      -0.0165 * profile.noseLength,
      0.011,
    );
    noseGroup.add(ala);

    const nostril = new THREE.Mesh(
      new THREE.SphereGeometry(0.0038, 8, 6),
      nostrilShadowMat,
    );
    nostril.scale.set(1.0, 0.48, 0.9);
    nostril.position.set(
      side * 0.0085 * profile.noseTipScale,
      -0.02 * profile.noseLength,
      0.0115,
    );
    noseGroup.add(nostril);
  }

  // 5. Expressive Sculpted Lips, Mouth Interior & Teeth
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.091, 0.172);
  head.add(mouthGroup);

  const skinBaseCol = new THREE.Color(preset.skinColor);
  const naturalLipBase = skinBaseCol
    .clone()
    .lerp(new THREE.Color(profile.lipColorHex), 0.52);
  const upperLipMat = new THREE.MeshStandardMaterial({
    color: naturalLipBase.clone().multiplyScalar(0.92),
    roughness: 0.58,
  });
  const lowerLipMat = new THREE.MeshStandardMaterial({
    color: naturalLipBase,
    roughness: 0.5,
  });
  const mouthInnerMat = new THREE.MeshStandardMaterial({
    color: 0x3b1315,
    roughness: 0.85,
  });
  const teethMat = new THREE.MeshStandardMaterial({
    color: 0xf1e8d8,
    roughness: 0.28,
  });

  const mw = 0.027 * profile.mouthWidth;
  const lipTubeR = 0.0044 * profile.lipFullness;

  const mouthCavity = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 8),
    mouthInnerMat,
  );
  mouthCavity.scale.set(profile.mouthWidth * 0.95, 0.18, 0.35);
  mouthCavity.position.set(0, -0.001, -0.002);
  mouthCavity.visible = false;
  mouthGroup.add(mouthCavity);

  const upperTeeth = new THREE.Mesh(
    new THREE.BoxGeometry(mw * 1.28, 0.0065, 0.008),
    teethMat,
  );
  upperTeeth.position.set(0, 0.0015, 0.0005);
  upperTeeth.visible = false;
  mouthGroup.add(upperTeeth);

  // Upper lip with Cupid's bow contour
  const upperLipGroup = new THREE.Group();
  mouthGroup.add(upperLipGroup);

  const upperLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-mw, -0.001, -0.008),
    new THREE.Vector3(-mw * 0.36, 0.0042, 0.003),
    new THREE.Vector3(0, 0.0024, 0.0045),
    new THREE.Vector3(mw * 0.36, 0.0042, 0.003),
    new THREE.Vector3(mw, -0.001, -0.008),
  ]);
  const upperLipMesh = new THREE.Mesh(
    new THREE.TubeGeometry(upperLipCurve, 18, lipTubeR * 0.88, 8, false),
    upperLipMat,
  );
  upperLipGroup.add(upperLipMesh);

  // Lower lip (fuller gentle curve)
  const lowerLipGroup = new THREE.Group();
  mouthGroup.add(lowerLipGroup);

  const lowerLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-mw * 0.92, -0.002, -0.007),
    new THREE.Vector3(-mw * 0.42, -0.0052, 0.0025),
    new THREE.Vector3(0, -0.0062, 0.0048),
    new THREE.Vector3(mw * 0.42, -0.0052, 0.0025),
    new THREE.Vector3(mw * 0.92, -0.002, -0.007),
  ]);
  const lowerLipMesh = new THREE.Mesh(
    new THREE.TubeGeometry(lowerLipCurve, 16, lipTubeR * 1.08, 8, false),
    lowerLipMat,
  );
  lowerLipGroup.add(lowerLipMesh);

  // Natural blinking & smooth expression interpolation state
  let blinkTimer = 1.6 + Math.random() * 2.8;
  let blinkProgress = 0; // 0 = not blinking, 0..1 = blink cycle
  let isDoubleBlink = false;

  let curUpperLid = -0.41;
  let curLowerLid = 0.33;
  let curBrowY = 0;
  let curBrowTilt = 0.03;
  let curMouthOpen = 0;
  let curMouthSmile = 0.22;
  let curMouthWidth = 1;
  let curEyeScale = 1;
  let curEyeLookX = 0;
  let curEyeLookY = 0;

  return {
    updateExpression({
      dt,
      state,
      expression,
      lookAroundPhase = 0,
      caughtElapsed = 0,
      eyeLookX,
      eyeLookY,
      idlePhase,
    }) {
      const resolvedExpr =
        expression ??
        deriveAutoExpression(state, profile.defaultExpression, idlePhase, caughtElapsed);
      const targets = resolveExpressionTargets(
        resolvedExpr,
        state,
        idlePhase,
        caughtElapsed,
      );

      // Realistic randomized blinking (suppressed when eyes tightly shut for counting)
      let blinkFactor = 0;
      if (resolvedExpr !== 'counting') {
        if (blinkProgress > 0) {
          blinkProgress += dt / 0.19;
          if (blinkProgress >= 1) {
            if (isDoubleBlink) {
              isDoubleBlink = false;
              blinkProgress = 0.001;
            } else {
              blinkProgress = 0;
              blinkTimer = 2.3 + Math.random() * 3.4;
            }
          } else {
            // Asymmetric fast-close / smooth-open curve
            blinkFactor =
              blinkProgress < 0.42
                ? blinkProgress / 0.42
                : 1 - (blinkProgress - 0.42) / 0.58;
          }
        } else {
          blinkTimer -= dt;
          if (blinkTimer <= 0) {
            blinkProgress = 0.001;
            isDoubleBlink = Math.random() < 0.18;
          }
        }
      } else {
        blinkFactor = 1;
      }

      const k = 14;
      const targetUpperWithBlink = THREE.MathUtils.lerp(
        targets.upperLidRot,
        0.26,
        blinkFactor,
      );
      const targetLowerWithBlink = THREE.MathUtils.lerp(
        targets.lowerLidRot,
        0.02,
        blinkFactor,
      );

      curUpperLid = THREE.MathUtils.damp(curUpperLid, targetUpperWithBlink, 24, dt);
      curLowerLid = THREE.MathUtils.damp(curLowerLid, targetLowerWithBlink, 24, dt);
      curBrowY = THREE.MathUtils.damp(curBrowY, targets.browYOffset, k, dt);
      curBrowTilt = THREE.MathUtils.damp(curBrowTilt, targets.browTilt, k, dt);
      curMouthOpen = THREE.MathUtils.damp(curMouthOpen, targets.mouthOpen, k, dt);
      curMouthSmile = THREE.MathUtils.damp(curMouthSmile, targets.mouthSmile, k, dt);
      curMouthWidth = THREE.MathUtils.damp(curMouthWidth, targets.mouthWidthScale, k, dt);
      curEyeScale = THREE.MathUtils.damp(curEyeScale, targets.eyeScale, k, dt);

      // Subtle natural eye glances
      let targetLookX = eyeLookX ?? 0;
      let targetLookY = eyeLookY ?? 0;
      if (eyeLookX === undefined && eyeLookY === undefined) {
        if (lookAroundPhase) {
          targetLookX = Math.sin(lookAroundPhase) * 0.2;
        } else if (state === 'showcase') {
          targetLookX = Math.sin(idlePhase * 0.85) * 0.08;
          targetLookY = Math.sin(idlePhase * 1.15) * 0.04;
        } else if (state === 'hide_cover') {
          targetLookX = Math.sin(idlePhase * 1.7) * 0.18;
        }
      }
      curEyeLookX = THREE.MathUtils.damp(curEyeLookX, targetLookX, 12, dt);
      curEyeLookY = THREE.MathUtils.damp(curEyeLookY, targetLookY, 12, dt);

      // Apply to eye sockets & lids
      for (let i = 0; i < 2; i++) {
        upperLids[i].rotation.x = curUpperLid;
        lowerLids[i].rotation.x = curLowerLid;
        eyeLookGroups[i].rotation.y = curEyeLookX;
        eyeLookGroups[i].rotation.x = curEyeLookY;
        eyeSockets[i].scale.set(
          profile.eyeScaleX * curEyeScale,
          profile.eyeScaleY * curEyeScale,
          1.0,
        );

        const bg = browGroups[i];
        bg.group.position.y = bg.baseY + curBrowY;
        bg.group.rotation.z = bg.side * curBrowTilt;
      }

      // Apply to mouth, lips, teeth & cavity
      mouthGroup.scale.x = curMouthWidth;

      // Upper lip curves gently without curling into an 'o' on smiles
      upperLipGroup.position.y = curMouthSmile * 0.0014 + curMouthOpen * 0.0024;
      upperLipGroup.rotation.x = -curMouthSmile * 0.06;

      // Lower lip drops downward when open & stays wide/smiling rather than puckered
      lowerLipGroup.position.y = -curMouthOpen * 0.0105 + curMouthSmile * 0.0008;
      lowerLipGroup.rotation.x = curMouthOpen * 0.14 - curMouthSmile * 0.1;

      // Smile/frown curvature
      mouthGroup.rotation.x = -curMouthSmile * 0.12;

      if (curMouthOpen > 0.11) {
        mouthCavity.visible = true;
        mouthCavity.scale.set(
          profile.mouthWidth * (curMouthOpen > 0.7 ? 0.72 : 1.02),
          THREE.MathUtils.clamp(curMouthOpen * 0.44, 0.05, 0.52),
          0.3,
        );
        mouthCavity.position.y = -curMouthOpen * 0.004;

        const showTeeth = curMouthOpen > 0.14 && curMouthSmile >= -0.35;
        upperTeeth.visible = showTeeth;
        if (showTeeth) {
          upperTeeth.position.y = 0.001 + curMouthSmile * 0.0012;
          upperTeeth.scale.y = THREE.MathUtils.clamp(curMouthOpen * 1.1, 0.45, 0.95);
        }
      } else {
        mouthCavity.visible = false;
        upperTeeth.visible = false;
      }
    },
  };
}

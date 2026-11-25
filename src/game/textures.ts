import * as THREE from 'three';

export interface VillageTextureSet {
  ground: THREE.CanvasTexture;
  courtyard: THREE.CanvasTexture;
  street: THREE.CanvasTexture;
  mudWall: THREE.CanvasTexture;
  mudWallOchre: THREE.CanvasTexture;
  schoolWall: THREE.CanvasTexture;
  schoolSign: THREE.CanvasTexture;
  blackboard: THREE.CanvasTexture;
  templeStone: THREE.CanvasTexture;
  awning: THREE.CanvasTexture;
  charpaiWeave: THREE.CanvasTexture;
  radioFace: THREE.CanvasTexture;
  farmSoil: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  thatchRoof: THREE.CanvasTexture;
  wellBrick: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  surfaceBump: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  cloud: THREE.CanvasTexture;
  sunHalo: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  setAnisotropy: (anisotropy: number) => void;
  dispose: () => void;
}

function makeCanvas(
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for procedural textures');
  }
  return [canvas, ctx];
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  if (isColor) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createGroundTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(1995);

  ctx.fillStyle = '#c49862';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 460; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 8 + rand() * 34;
    const shade = rand();
    ctx.fillStyle =
      shade < 0.35
        ? 'rgba(156, 110, 62, 0.16)'
        : shade < 0.68
          ? 'rgba(216, 178, 122, 0.15)'
          : 'rgba(116, 124, 64, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const size = 1 + rand() * 2.5;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(105, 72, 40, 0.28)' : 'rgba(242, 214, 168, 0.24)';
    ctx.fillRect(x, y, size, size);
  }

  // Subtle dry grass tufts and village earth grain
  ctx.strokeStyle = 'rgba(102, 120, 56, 0.24)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 180; i++) {
    const gx = rand() * 512;
    const gy = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 2 + rand() * 4, gy - 4 - rand() * 4);
    ctx.stroke();
  }

  return configureTexture(canvas, anisotropy, 28, 28, true);
}

function createCourtyardTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(9511);

  ctx.fillStyle = '#d7b07b';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(176, 128, 76, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const radius = 26 + rand() * 48;
    const start = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + 1.1);
    ctx.stroke();
  }

  for (let i = 0; i < 1600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.fillStyle =
      rand() > 0.45 ? 'rgba(246, 226, 188, 0.2)' : 'rgba(145, 98, 56, 0.18)';
    ctx.fillRect(x, y, 2, 2);
  }

  return configureTexture(canvas, anisotropy, 4, 4, true);
}

function createStreetTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  const rand = seededRand(7741);

  ctx.fillStyle = '#cfab78';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle dusty edges
  const edgeGrad = ctx.createLinearGradient(0, 0, 256, 0);
  edgeGrad.addColorStop(0, 'rgba(138, 102, 58, 0.35)');
  edgeGrad.addColorStop(0.14, 'rgba(138, 102, 58, 0)');
  edgeGrad.addColorStop(0.86, 'rgba(138, 102, 58, 0)');
  edgeGrad.addColorStop(1, 'rgba(138, 102, 58, 0.35)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, 256, 512);

  // Faint bullock-cart wheel ruts running along street
  ctx.fillStyle = 'rgba(144, 100, 56, 0.22)';
  ctx.fillRect(62, 0, 18, 512);
  ctx.fillRect(176, 0, 18, 512);

  // Fine grit and pebbles
  for (let i = 0; i < 1200; i++) {
    const x = rand() * 256;
    const y = rand() * 512;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(246, 226, 188, 0.24)' : 'rgba(116, 78, 44, 0.22)';
    ctx.fillRect(x, y, 2, 2);
  }

  return configureTexture(canvas, anisotropy, 1, 6, true);
}

function createMudWallTexture(
  anisotropy: number,
  baseHex: string,
  bandHex: string,
  seed: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(seed);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 280; i++) {
    const x = rand() * 512;
    const y = rand() * 420;
    const w = 18 + rand() * 52;
    const h = 6 + rand() * 14;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(255, 244, 224, 0.08)' : 'rgba(98, 66, 38, 0.08)';
    ctx.fillRect(x, y, w, h);
  }

  ctx.strokeStyle = 'rgba(222, 194, 134, 0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 240; i++) {
    const x = rand() * 512;
    const y = rand() * 420;
    const len = 5 + rand() * 9;
    const ang = (rand() - 0.5) * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  ctx.fillStyle = bandHex;
  ctx.fillRect(0, 412, 512, 100);

  ctx.strokeStyle = 'rgba(248, 241, 226, 0.78)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.lineTo(512, 410);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 241, 226, 0.72)';
  for (let x = 16; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 388);
    ctx.lineTo(x + 10, 404);
    ctx.lineTo(x - 10, 404);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, 378, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureTexture(canvas, anisotropy, 1, 1, true);
}

function createSchoolWallTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(6195);

  // Classic 1990s Indian rural government school pale yellow-cream limewash
  ctx.fillStyle = '#efe2b8';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 260; i++) {
    const x = rand() * 512;
    const y = rand() * 400;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(255, 250, 232, 0.14)' : 'rgba(176, 152, 98, 0.1)';
    ctx.fillRect(x, y, 22 + rand() * 40, 12 + rand() * 24);
  }

  // Deep brick-red / ochre lower dado trim
  ctx.fillStyle = '#9c4e35';
  ctx.fillRect(0, 404, 512, 108);

  // Crisp white & navy school border stripes
  ctx.fillStyle = '#f8f2e2';
  ctx.fillRect(0, 396, 512, 8);
  ctx.fillStyle = '#2d4b6e';
  ctx.fillRect(0, 388, 512, 8);

  return configureTexture(canvas, anisotropy, 1, 1, true);
}

function createSchoolSignTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);

  ctx.fillStyle = '#224163';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#f2d084';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.fillStyle = '#fdf4dc';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRATHMIK VIDYALAYA', 256, 50);

  ctx.fillStyle = '#f4c76b';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('VILLAGE SCHOOL · EST. 1982', 256, 92);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createBlackboardTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  const rand = seededRand(19953);

  ctx.fillStyle = '#1f2b26';
  ctx.fillRect(0, 0, 512, 256);

  // Dusty chalk smudges
  for (let i = 0; i < 65; i++) {
    ctx.fillStyle = 'rgba(235, 240, 234, 0.04)';
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 256, 12 + rand() * 28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(244, 246, 240, 0.78)';
  ctx.font = '24px Georgia, serif';
  ctx.fillText('Date: 14 Nov 1995', 26, 46);
  ctx.fillText('2 + 3 = 5     4 x 6 = 24', 26, 108);
  ctx.fillText('A  B  C  D  E  F', 26, 168);

  ctx.strokeStyle = '#6f482b';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 242);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createTempleStoneTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(1089);

  // Warm sandstone & marigold-ochre lime wash
  ctx.fillStyle = '#ebd0a2';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle carved sandstone blocks
  const rows = 8;
  const cols = 4;
  const bw = 512 / cols;
  const bh = 512 / rows;
  ctx.strokeStyle = 'rgba(138, 92, 48, 0.25)';
  ctx.lineWidth = 2;

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle =
        rand() > 0.5 ? 'rgba(255, 238, 200, 0.12)' : 'rgba(196, 122, 62, 0.1)';
      ctx.fillRect(c * bw + off, r * bh, bw, bh);
      ctx.strokeRect(c * bw + off, r * bh, bw, bh);
    }
  }

  // Saffron decorative band
  ctx.fillStyle = '#c85a27';
  ctx.fillRect(0, 424, 512, 88);
  ctx.fillStyle = '#f6dfad';
  ctx.fillRect(0, 412, 512, 12);

  return configureTexture(canvas, anisotropy, 1, 1, true);
}

function createAwningTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);

  const stripes = 8;
  const sw = 256 / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#b93f28' : '#f2dfc1';
    ctx.fillRect(i * sw, 0, sw, 256);
  }

  // Subtle sun-faded cloth grain
  ctx.fillStyle = 'rgba(72, 44, 24, 0.08)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 256, 1);
  }

  return configureTexture(canvas, anisotropy, 2, 1, true);
}

function createCharpaiWeaveTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);

  // Warm woven jute / coir rope charpai pattern
  ctx.fillStyle = '#6e4e2d';
  ctx.fillRect(0, 0, 256, 256);

  const step = 16;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const even = ((x / step) + (y / step)) % 2 === 0;
      ctx.fillStyle = even ? '#d1ad72' : '#b78d4e';
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);

      ctx.strokeStyle = 'rgba(84, 56, 28, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (even) {
        ctx.moveTo(x + 2, y + step / 2);
        ctx.lineTo(x + step - 2, y + step / 2);
      } else {
        ctx.moveTo(x + step / 2, y + 2);
        ctx.lineTo(x + step / 2, y + step - 2);
      }
      ctx.stroke();
    }
  }

  return configureTexture(canvas, anisotropy, 2, 3, true);
}

function createRadioFaceTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);

  ctx.fillStyle = '#241c17';
  ctx.fillRect(0, 0, 256, 128);

  // Left speaker mesh grille
  ctx.fillStyle = '#c8b48c';
  ctx.fillRect(14, 18, 120, 92);
  ctx.fillStyle = '#332820';
  for (let y = 24; y < 106; y += 8) {
    for (let x = 20; x < 130; x += 8) {
      ctx.fillRect(x, y, 4, 4);
    }
  }

  // Right illuminated warm amber tuning dial (Vividh Bharati 1995!)
  ctx.fillStyle = '#e7c67b';
  ctx.fillRect(146, 20, 96, 36);
  ctx.strokeStyle = '#2e2217';
  ctx.lineWidth = 1.5;
  for (let x = 154; x < 236; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 26);
    ctx.lineTo(x, 48);
    ctx.stroke();
  }
  // Red frequency needle
  ctx.fillStyle = '#c93322';
  ctx.fillRect(194, 22, 3, 32);

  // Knobs
  ctx.fillStyle = '#b4b8bc';
  ctx.beginPath();
  ctx.arc(172, 86, 14, 0, Math.PI * 2);
  ctx.arc(216, 86, 14, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createFarmSoilTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rand = seededRand(8432);

  ctx.fillStyle = '#755336';
  ctx.fillRect(0, 0, 256, 256);

  // Plowed irrigation furrows
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = 'rgba(46, 30, 18, 0.38)';
    ctx.fillRect(0, y, 256, 6);
    ctx.fillStyle = 'rgba(154, 114, 74, 0.24)';
    ctx.fillRect(0, y + 6, 256, 5);
  }

  for (let i = 0; i < 650; i++) {
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(54, 34, 18, 0.3)' : 'rgba(164, 128, 86, 0.22)';
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }

  return configureTexture(canvas, anisotropy, 4, 4, true);
}

function createRoofTileTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(4419);

  ctx.fillStyle = '#9e472b';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const cols = 10;
  const tileW = 512 / cols;
  const tileH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW;
      const y = r * tileH;
      const tone = Math.floor((rand() - 0.5) * 28);
      const red = Math.min(220, Math.max(115, 168 + tone));
      const green = Math.min(130, Math.max(55, 76 + Math.floor(tone * 0.6)));
      const blue = Math.min(85, Math.max(32, 46 + Math.floor(tone * 0.4)));

      const grad = ctx.createLinearGradient(x, y, x + tileW, y);
      grad.addColorStop(0, `rgb(${red - 24}, ${green - 14}, ${blue - 10})`);
      grad.addColorStop(0.45, `rgb(${red + 14}, ${green + 10}, ${blue + 6})`);
      grad.addColorStop(1, `rgb(${red - 28}, ${green - 18}, ${blue - 12})`);

      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 3);

      ctx.fillStyle = 'rgba(46, 18, 10, 0.42)';
      ctx.fillRect(x, y + tileH - 4, tileW, 4);
    }
  }

  return configureTexture(canvas, anisotropy, 2, 2, true);
}

function createThatchRoofTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(8821);

  ctx.fillStyle = '#a78649';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1800; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const h = 18 + rand() * 44;
    const w = 1.5 + rand() * 2.5;
    const pick = rand();
    ctx.fillStyle =
      pick < 0.35
        ? 'rgba(132, 102, 50, 0.55)'
        : pick < 0.72
          ? 'rgba(196, 162, 92, 0.5)'
          : 'rgba(84, 62, 30, 0.45)';
    ctx.fillRect(x, y, w, h);
  }

  for (let y = 64; y < 512; y += 64) {
    ctx.fillStyle = 'rgba(65, 45, 20, 0.28)';
    ctx.fillRect(0, y, 512, 5);
  }

  return configureTexture(canvas, anisotropy, 2, 2, true);
}

function createWellBrickTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = seededRand(3319);

  ctx.fillStyle = '#b4a38d';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const cols = 6;
  const bw = 512 / cols;
  const bh = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset;
      const y = r * bh;
      const shift = Math.floor((rand() - 0.5) * 32);
      const rr = Math.min(200, Math.max(105, 148 + shift));
      const gg = Math.min(130, Math.max(66, 86 + Math.floor(shift * 0.6)));
      const bb = Math.min(95, Math.max(48, 64 + Math.floor(shift * 0.5)));

      ctx.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
      ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);

      if (r > 7 && rand() > 0.4) {
        ctx.fillStyle = 'rgba(62, 82, 48, 0.24)';
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      }
    }
  }

  return configureTexture(canvas, anisotropy, 3, 1.5, true);
}

function createWoodTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rand = seededRand(7123);

  ctx.fillStyle = '#6f482b';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 90; i++) {
    const x = rand() * 256;
    const w = 1 + rand() * 4;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(48, 28, 14, 0.28)' : 'rgba(136, 94, 58, 0.22)';
    ctx.fillRect(x, 0, w, 256);
  }

  ctx.fillStyle = 'rgba(34, 18, 8, 0.55)';
  for (let x = 64; x < 256; x += 64) {
    ctx.fillRect(x, 0, 3, 256);
  }

  return configureTexture(canvas, anisotropy, 1, 1, true);
}

function createBarkTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rand = seededRand(5209);

  ctx.fillStyle = '#5c4330';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 310; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 1.5 + rand() * 4.5;
    const h = 16 + rand() * 44;
    const p = rand();
    ctx.fillStyle =
      p < 0.48
        ? 'rgba(34, 21, 13, 0.46)'
        : p < 0.88
          ? 'rgba(122, 96, 68, 0.32)'
          : 'rgba(84, 98, 56, 0.2)';
    ctx.fillRect(x, y, w, h);
  }

  return configureTexture(canvas, anisotropy, 2, 3, true);
}

/**
 * Seamless tileable organic plaster / soil / stone heightfield bump texture.
 */
function createSurfaceBumpTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const rand = seededRand(9907);

  // Tileable multi-frequency height noise
  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const macro =
        Math.sin(u * 2 + Math.cos(v * 2)) * 18 +
        Math.cos(v * 3 - Math.sin(u * 3)) * 14 +
        Math.sin(u * 5 + v * 5) * 9;
      const grain = (rand() - 0.5) * 28;
      const val = Math.max(0, Math.min(255, Math.round(128 + macro + grain)));
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return configureTexture(canvas, anisotropy, 2, 2, false);
}

/**
 * Seamless periodic tangent-space water ripple normal map for pond, river & wells.
 */
function createWaterNormalTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const tau = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const v = (y / size) * tau;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * tau;
      // Analytic derivatives of periodic ripple waves for seamless tiling
      const dhdx =
        2 * Math.cos(2 * u + Math.sin(v)) * 0.24 +
        4 * Math.cos(4 * u - 3 * v) * 0.14 +
        6 * Math.cos(6 * u + 5 * v) * 0.08 +
        3 * Math.cos(3 * u + 7 * v) * 0.09;
      const dhdy =
        Math.cos(2 * u + Math.sin(v)) * Math.cos(v) * 0.24 -
        3 * Math.cos(4 * u - 3 * v) * 0.14 +
        5 * Math.cos(6 * u + 5 * v) * 0.08 +
        7 * Math.cos(3 * u + 7 * v) * 0.09;

      const nx = -dhdx;
      const ny = -dhdy;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return configureTexture(canvas, anisotropy, 4, 4, false);
}

/**
 * Soft drifting cumulus cloud texture for natural Indian sky horizon depth.
 */
function createCloudTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);

  const puffs: Array<[number, number, number, number]> = [
    [68, 72, 42, 0.34],
    [110, 56, 52, 0.45],
    [152, 60, 48, 0.42],
    [190, 74, 38, 0.32],
    [130, 76, 46, 0.38],
  ];

  for (const [cx, cy, r, alpha] of puffs) {
    const grad = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy, r);
    grad.addColorStop(0, `rgba(255, 251, 242, ${alpha})`);
    grad.addColorStop(0.55, `rgba(255, 246, 232, ${alpha * 0.55})`);
    grad.addColorStop(1, 'rgba(255, 242, 224, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Warm atmospheric radial sun glow halo texture.
 */
function createSunHaloTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 248, 220, 0.92)');
  grad.addColorStop(0.28, 'rgba(255, 226, 165, 0.48)');
  grad.addColorStop(0.65, 'rgba(255, 200, 125, 0.14)');
  grad.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(38, 24, 14, 0.58)');
  grad.addColorStop(0.55, 'rgba(38, 24, 14, 0.24)');
  grad.addColorStop(1, 'rgba(38, 24, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createVillageTextures(
  renderer: THREE.WebGLRenderer,
): VillageTextureSet {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const ground = createGroundTexture(anisotropy);
  const courtyard = createCourtyardTexture(anisotropy);
  const street = createStreetTexture(anisotropy);
  const mudWall = createMudWallTexture(anisotropy, '#e4cfad', '#9b4d31', 19951);
  const mudWallOchre = createMudWallTexture(
    anisotropy,
    '#dfb87f',
    '#89442a',
    19952,
  );
  const schoolWall = createSchoolWallTexture(anisotropy);
  const schoolSign = createSchoolSignTexture(anisotropy);
  const blackboard = createBlackboardTexture(anisotropy);
  const templeStone = createTempleStoneTexture(anisotropy);
  const awning = createAwningTexture(anisotropy);
  const charpaiWeave = createCharpaiWeaveTexture(anisotropy);
  const radioFace = createRadioFaceTexture(anisotropy);
  const farmSoil = createFarmSoilTexture(anisotropy);
  const roofTile = createRoofTileTexture(anisotropy);
  const thatchRoof = createThatchRoofTexture(anisotropy);
  const wellBrick = createWellBrickTexture(anisotropy);
  const wood = createWoodTexture(anisotropy);
  const bark = createBarkTexture(anisotropy);
  const surfaceBump = createSurfaceBumpTexture(anisotropy);
  const waterNormal = createWaterNormalTexture(anisotropy);
  const cloud = createCloudTexture();
  const sunHalo = createSunHaloTexture();
  const contactShadow = createContactShadowTexture();

  const mipmapped = [
    ground,
    courtyard,
    street,
    mudWall,
    mudWallOchre,
    schoolWall,
    schoolSign,
    blackboard,
    templeStone,
    awning,
    charpaiWeave,
    radioFace,
    farmSoil,
    roofTile,
    thatchRoof,
    wellBrick,
    wood,
    bark,
    surfaceBump,
    waterNormal,
  ];

  const all = [...mipmapped, cloud, sunHalo, contactShadow];

  return {
    ground,
    courtyard,
    street,
    mudWall,
    mudWallOchre,
    schoolWall,
    schoolSign,
    blackboard,
    templeStone,
    awning,
    charpaiWeave,
    radioFace,
    farmSoil,
    roofTile,
    thatchRoof,
    wellBrick,
    wood,
    bark,
    surfaceBump,
    waterNormal,
    cloud,
    sunHalo,
    contactShadow,
    setAnisotropy: (target: number) => {
      const clamped = Math.max(1, Math.min(renderer.capabilities.getMaxAnisotropy(), target));
      for (const tex of mipmapped) {
        if (tex.anisotropy !== clamped) {
          tex.anisotropy = clamped;
          tex.needsUpdate = true;
        }
      }
    },
    dispose: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}

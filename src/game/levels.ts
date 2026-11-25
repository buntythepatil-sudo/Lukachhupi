import { LevelConfig } from './types';

export const TOTAL_LEVELS = 8;
const UNLOCKED_LEVEL_STORAGE_KEY = 'gully_chhupan_chhupai_1995_unlocked_level';

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 1,
    name: 'Traditional Village',
    shortName: 'Village',
    description:
      'Small 1995 Indian village with mud houses, narrow gullies, a temple, and a grand banyan tree.',
    hidingFeatures: 'Mud houses, banyan roots, village well & back gullies',
    difficultyLabel: 'Easy',
    seekerSpeedMultiplier: 1.0,
    seekerSightBonus: 0,
    searchPauseFactor: 1.0,
    aiHiderSpeedMultiplier: 1.0,
    atmosphere: {
      skyTop: '#6a97c7',
      skyMid: '#a5c2d9',
      skyHorizon: '#e8c79b',
      skyBottom: '#d8a974',
      fogColor: 0xeac494,
      fogDensity: 0.0082,
      sunColor: 0xffdca2,
      sunIntensity: 2.05,
      sunPos: [28, 34, 20],
      sunDiscColor: 0xfff1c9,
      hemiSky: 0xc2dcf8,
      hemiGround: 0xa87143,
      hemiIntensity: 0.85,
      rimColor: 0xc8dcf7,
      rimIntensity: 0.48,
      exposure: 1.06,
      moteColor: 0xfff0c8,
      moteOpacity: 0.45,
    },
  },
  {
    id: 2,
    name: 'School Campus',
    shortName: 'School',
    description:
      'Old village Prathmik Vidyalaya with classrooms, pillared corridors, playground, and a garden.',
    hidingFeatures: 'Classrooms, veranda pillars, assembly stage & hedged garden',
    difficultyLabel: 'Easy+',
    seekerSpeedMultiplier: 1.06,
    seekerSightBonus: 0.9,
    searchPauseFactor: 0.94,
    aiHiderSpeedMultiplier: 1.03,
    atmosphere: {
      skyTop: '#5693d1',
      skyMid: '#9bc5e8',
      skyHorizon: '#f2e0ba',
      skyBottom: '#dec293',
      fogColor: 0xeed9b4,
      fogDensity: 0.0074,
      sunColor: 0xfff0c8,
      sunIntensity: 2.15,
      sunPos: [32, 40, 18],
      sunDiscColor: 0xfff9e2,
      hemiSky: 0xd0e7ff,
      hemiGround: 0xa88255,
      hemiIntensity: 0.92,
      rimColor: 0xcce2fa,
      rimIntensity: 0.5,
      exposure: 1.08,
      moteColor: 0xfff6dc,
      moteOpacity: 0.32,
    },
  },
  {
    id: 3,
    name: 'Mango Farm',
    shortName: 'Orchard',
    description:
      'Expansive mango orchard lined with fruiting trees, brick tool sheds, stone wells, and crop fields.',
    hidingFeatures: 'Orchard trees, tool sheds, stone wells & tall haystacks',
    difficultyLabel: 'Medium',
    seekerSpeedMultiplier: 1.11,
    seekerSightBonus: 1.7,
    searchPauseFactor: 0.88,
    aiHiderSpeedMultiplier: 1.06,
    atmosphere: {
      skyTop: '#5e96bd',
      skyMid: '#9bc4c8',
      skyHorizon: '#ead49d',
      skyBottom: '#d0b06e',
      fogColor: 0xe6cf9a,
      fogDensity: 0.0085,
      sunColor: 0xffe4a8,
      sunIntensity: 2.1,
      sunPos: [26, 32, 24],
      sunDiscColor: 0xfff3cc,
      hemiSky: 0xcce6da,
      hemiGround: 0x86703c,
      hemiIntensity: 0.88,
      rimColor: 0xd2ecd8,
      rimIntensity: 0.45,
      exposure: 1.06,
      moteColor: 0xf8f0b8,
      moteOpacity: 0.42,
    },
  },
  {
    id: 4,
    name: 'Old Market',
    shortName: 'Bazaar',
    description:
      'Busy 1990s bazaar with awninged shops, back storage rooms, rooftop alleys, and narrow lanes.',
    hidingFeatures: 'Godown storage rooms, bazaar crates, thelas & tight lanes',
    difficultyLabel: 'Medium+',
    seekerSpeedMultiplier: 1.16,
    seekerSightBonus: 2.4,
    searchPauseFactor: 0.82,
    aiHiderSpeedMultiplier: 1.09,
    atmosphere: {
      skyTop: '#6c8ab8',
      skyMid: '#b5b5c2',
      skyHorizon: '#ebc08f',
      skyBottom: '#d29c6a',
      fogColor: 0xe7bd8d,
      fogDensity: 0.0088,
      sunColor: 0xffd194,
      sunIntensity: 2.05,
      sunPos: [-28, 30, 22],
      sunDiscColor: 0xffe6b8,
      hemiSky: 0xd4d9ec,
      hemiGround: 0x9b6b43,
      hemiIntensity: 0.85,
      rimColor: 0xf2cfa2,
      rimIntensity: 0.5,
      exposure: 1.05,
      moteColor: 0xffe7ba,
      moteOpacity: 0.5,
    },
  },
  {
    id: 5,
    name: 'Railway Colony',
    shortName: 'Railway',
    description:
      'Vintage Indian railway quarters, tin-canopy station platforms, rail tracks, and colony gardens.',
    hidingFeatures: 'Red-brick quarters, station canopy, rail coach & signal yard',
    difficultyLabel: 'Challenging',
    seekerSpeedMultiplier: 1.21,
    seekerSightBonus: 3.1,
    searchPauseFactor: 0.76,
    aiHiderSpeedMultiplier: 1.12,
    atmosphere: {
      skyTop: '#5b82b0',
      skyMid: '#9eb6cc',
      skyHorizon: '#e6c8a6',
      skyBottom: '#c9a684',
      fogColor: 0xdfc2a2,
      fogDensity: 0.008,
      sunColor: 0xffdfa8,
      sunIntensity: 2.0,
      sunPos: [34, 30, -16],
      sunDiscColor: 0xfff0cc,
      hemiSky: 0xc2d4ea,
      hemiGround: 0x876850,
      hemiIntensity: 0.84,
      rimColor: 0xc8daf0,
      rimIntensity: 0.48,
      exposure: 1.04,
      moteColor: 0xf8e5c4,
      moteOpacity: 0.36,
    },
  },
  {
    id: 6,
    name: 'Haunted Haveli',
    shortName: 'Haveli',
    description:
      'Mysterious old sandstone mansion with echoing rooms, pillared courtyards, grand stairs, and secret alcoves.',
    hidingFeatures: 'Secret wall alcoves, shadowed halls, stairs & courtyard pillars',
    difficultyLabel: 'Hard',
    seekerSpeedMultiplier: 1.27,
    seekerSightBonus: 3.8,
    searchPauseFactor: 0.7,
    aiHiderSpeedMultiplier: 1.15,
    atmosphere: {
      skyTop: '#1c2440',
      skyMid: '#2e385c',
      skyHorizon: '#4e5578',
      skyBottom: '#34364a',
      fogColor: 0x3b4260,
      fogDensity: 0.0115,
      sunColor: 0xb8cef5,
      sunIntensity: 1.45,
      sunPos: [-24, 36, 22],
      sunDiscColor: 0xe6f0ff,
      hemiSky: 0x6f84b8,
      hemiGround: 0x42383a,
      hemiIntensity: 0.85,
      rimColor: 0xf0a860,
      rimIntensity: 0.55,
      exposure: 1.08,
      moteColor: 0xc8dcff,
      moteOpacity: 0.45,
    },
  },
  {
    id: 7,
    name: 'River Village',
    shortName: 'Riverbank',
    description:
      'Scenic riverbank hamlet with arched wooden bridges, moored boats, thatch huts, and swaying tall grass.',
    hidingFeatures: 'Tall river grass, riverbank huts, moored boats & bridge ghats',
    difficultyLabel: 'Hard+',
    seekerSpeedMultiplier: 1.33,
    seekerSightBonus: 4.5,
    searchPauseFactor: 0.64,
    aiHiderSpeedMultiplier: 1.18,
    atmosphere: {
      skyTop: '#4e8cc2',
      skyMid: '#8fc0dc',
      skyHorizon: '#e5d4b0',
      skyBottom: '#c9b489',
      fogColor: 0xdccfa9,
      fogDensity: 0.0078,
      sunColor: 0xffe6b2,
      sunIntensity: 2.1,
      sunPos: [30, 35, 22],
      sunDiscColor: 0xfff5d4,
      hemiSky: 0xbce2f8,
      hemiGround: 0x7b784e,
      hemiIntensity: 0.9,
      rimColor: 0xaadcf2,
      rimIntensity: 0.52,
      exposure: 1.06,
      moteColor: 0xf4f0d0,
      moteOpacity: 0.35,
    },
  },
  {
    id: 8,
    name: 'Festival Village',
    shortName: 'Festival',
    description:
      'Glowing Diwali & Mela night streets with colorful marigold lights, food stalls, pandal stage, and lively lanes.',
    hidingFeatures: 'Mela food stalls, pandal backstage, festive houses & lamp alleys',
    difficultyLabel: 'Master',
    seekerSpeedMultiplier: 1.38,
    seekerSightBonus: 5.2,
    searchPauseFactor: 0.58,
    aiHiderSpeedMultiplier: 1.21,
    atmosphere: {
      skyTop: '#1f1838',
      skyMid: '#482752',
      skyHorizon: '#9c4e4a',
      skyBottom: '#5a312c',
      fogColor: 0x4b2a34,
      fogDensity: 0.0096,
      sunColor: 0xffb36b,
      sunIntensity: 1.65,
      sunPos: [22, 26, 26],
      sunDiscColor: 0xffc97a,
      hemiSky: 0x8e6fa8,
      hemiGround: 0x6e442a,
      hemiIntensity: 0.92,
      rimColor: 0xffa652,
      rimIntensity: 0.72,
      exposure: 1.12,
      moteColor: 0xffd278,
      moteOpacity: 0.62,
    },
  },
];

export function getLevelConfig(levelId: number): LevelConfig {
  return (
    LEVEL_CONFIGS.find((lvl) => lvl.id === levelId) ?? LEVEL_CONFIGS[0]
  );
}

export function loadUnlockedLevel(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 1;
    const raw = window.localStorage.getItem(UNLOCKED_LEVEL_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 1;
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(TOTAL_LEVELS, parsed));
  } catch {
    return 1;
  }
}

export function saveUnlockedLevel(level: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clamped = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(level)));
    window.localStorage.setItem(UNLOCKED_LEVEL_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

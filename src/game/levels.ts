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
      'Sprawling 1990s Indian village mango orchard with rows of fruiting trees, an old farmhouse courtyard, packing sheds, irrigation channels, stone well, hand pump, haystacks, and tall grass.',
    hidingFeatures:
      'Orchard mango trees, tall grass & bushes, packing sheds, old farmhouse, haystacks & wooden farm carts',
    difficultyLabel: 'Medium',
    seekerSpeedMultiplier: 1.11,
    seekerSightBonus: 1.7,
    searchPauseFactor: 0.88,
    aiHiderSpeedMultiplier: 1.06,
    atmosphere: {
      skyTop: '#538ec2',
      skyMid: '#92c2c9',
      skyHorizon: '#eed79d',
      skyBottom: '#d6b66f',
      fogColor: 0xe9d39c,
      fogDensity: 0.0066,
      sunColor: 0xffe6a6,
      sunIntensity: 2.35,
      sunPos: [30, 35, 22],
      sunDiscColor: 0xfff4cc,
      hemiSky: 0xd4ece0,
      hemiGround: 0x7e6d3b,
      hemiIntensity: 0.94,
      rimColor: 0xd8f0dc,
      rimIntensity: 0.48,
      exposure: 1.08,
      moteColor: 0xfaefc0,
      moteOpacity: 0.44,
    },
  },
  {
    id: 4,
    name: 'Old Market',
    shortName: 'Bazaar',
    description:
      'Lively 1990s Indian village bazaar with kirana stores, mithai shops, sabzi mandi stalls, narrow back alleys, connected rooftops, balconies, and bustling market courtyards.',
    hidingFeatures:
      'Shop counters, stocked shelves, back storage rooms, vegetable stalls, crates & connected rooftops',
    difficultyLabel: 'Medium+',
    seekerSpeedMultiplier: 1.16,
    seekerSightBonus: 2.4,
    searchPauseFactor: 0.82,
    aiHiderSpeedMultiplier: 1.09,
    atmosphere: {
      skyTop: '#6485b5',
      skyMid: '#b5b8c7',
      skyHorizon: '#edc494',
      skyBottom: '#d49f6c',
      fogColor: 0xe9c090,
      fogDensity: 0.0072,
      sunColor: 0xffd599,
      sunIntensity: 2.15,
      sunPos: [-32, 34, 24],
      sunDiscColor: 0xffe8bd,
      hemiSky: 0xd8dff2,
      hemiGround: 0x9e6e46,
      hemiIntensity: 0.88,
      rimColor: 0xf4d2a6,
      rimIntensity: 0.52,
      exposure: 1.06,
      moteColor: 0xffe8bc,
      moteOpacity: 0.45,
    },
  },
  {
    id: 5,
    name: 'Railway Colony',
    shortName: 'Railway',
    description:
      'Authentic 1990s Indian railway residential colony with red-brick staff quarters, front yards and balconies, narrow alleys, a railway station with ticket windows and waiting hall, platform benches, clocks, overhead water tanks, and colony gardens.',
    hidingFeatures:
      'Staff quarter bedrooms, kitchens & storage rooms, ticket counter, waiting hall, alley walls, garden hedges & water towers',
    difficultyLabel: 'Challenging',
    seekerSpeedMultiplier: 1.21,
    seekerSightBonus: 3.1,
    searchPauseFactor: 0.76,
    aiHiderSpeedMultiplier: 1.12,
    atmosphere: {
      skyTop: '#527cb0',
      skyMid: '#96b4cc',
      skyHorizon: '#edd0a4',
      skyBottom: '#d0ac84',
      fogColor: 0xe3c6a0,
      fogDensity: 0.0068,
      sunColor: 0xffe2a4,
      sunIntensity: 2.28,
      sunPos: [36, 33, -18],
      sunDiscColor: 0xfff2cc,
      hemiSky: 0xc8daf0,
      hemiGround: 0x846850,
      hemiIntensity: 0.9,
      rimColor: 0xcce0f4,
      rimIntensity: 0.5,
      exposure: 1.07,
      moteColor: 0xf9e8c6,
      moteOpacity: 0.38,
    },
  },
  {
    id: 6,
    name: 'Haunted Haveli',
    shortName: 'Haveli',
    description:
      'Expansive abandoned 1990s Indian mansion with a grand gatehouse, overgrown garden, central courtyard, interconnected halls, wooden balconies, rooftop chhatris, and secret underground cellar.',
    hidingFeatures:
      'Cupboards, hanging curtains, four-poster beds, secret passages, underground cellar & rooftop chhatris',
    difficultyLabel: 'Hard',
    seekerSpeedMultiplier: 1.27,
    seekerSightBonus: 3.8,
    searchPauseFactor: 0.7,
    aiHiderSpeedMultiplier: 1.15,
    atmosphere: {
      skyTop: '#161e38',
      skyMid: '#263154',
      skyHorizon: '#434c6e',
      skyBottom: '#2d3145',
      fogColor: 0x333c59,
      fogDensity: 0.0086,
      sunColor: 0xc2d8ff,
      sunIntensity: 1.55,
      sunPos: [-28, 42, 24],
      sunDiscColor: 0xebf3ff,
      hemiSky: 0x768cc2,
      hemiGround: 0x3e3534,
      hemiIntensity: 0.88,
      rimColor: 0xe6a15c,
      rimIntensity: 0.52,
      exposure: 1.06,
      moteColor: 0xcce0ff,
      moteOpacity: 0.42,
    },
  },
  {
    id: 7,
    name: 'River Village',
    shortName: 'Riverbank',
    description:
      'Scenic 1990s Indian riverside village with stone ghat steps, arched wooden bridges, moored rowboats, thatch huts, courtyard homes with balconies and climbable rooftops, bamboo groves, farms, wells, and swaying tall river grass.',
    hidingFeatures:
      'Bamboo groves, tall river grass, courtyard houses & rooftops, village ghats, thatch huts, sheds & haystacks',
    difficultyLabel: 'Hard+',
    seekerSpeedMultiplier: 1.33,
    seekerSightBonus: 4.5,
    searchPauseFactor: 0.64,
    aiHiderSpeedMultiplier: 1.18,
    atmosphere: {
      skyTop: '#4588c4',
      skyMid: '#8bc0de',
      skyHorizon: '#ebd7ae',
      skyBottom: '#ceb88c',
      fogColor: 0xe0d2aa,
      fogDensity: 0.0064,
      sunColor: 0xffe8b2,
      sunIntensity: 2.32,
      sunPos: [32, 36, 22],
      sunDiscColor: 0xfff6d4,
      hemiSky: 0xc2e6fa,
      hemiGround: 0x767a4d,
      hemiIntensity: 0.94,
      rimColor: 0xb0e2f6,
      rimIntensity: 0.54,
      exposure: 1.08,
      moteColor: 0xf6f2d4,
      moteOpacity: 0.36,
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

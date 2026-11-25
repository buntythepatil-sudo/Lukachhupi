export type TeamRole = 'hider' | 'seeker';

export type GamePhase = 'start' | 'playing' | 'ended';

export type MatchWinner = 'hiders' | 'seekers' | null;

export type SeekerMode = 'counting' | 'searching' | 'chasing';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type AgeGroup = 'child' | 'teen';

export type OutfitStyle =
  | 'shirt_shorts'
  | 'kurta_pyjama'
  | 'frock'
  | 'school_uniform';

export type HairStyle =
  | 'short_part'
  | 'twin_braids'
  | 'curly'
  | 'long_braid'
  | 'swept_back'
  | 'buzz'
  | 'high_bun'
  | 'spiky'
  | 'bob_band'
  | 'wavy';

export type FaceStyle =
  | 'cheerful'
  | 'mischievous'
  | 'calm'
  | 'bright_bindi'
  | 'determined';

export type AccessoryType =
  | 'none'
  | 'gamcha'
  | 'cap'
  | 'spectacles'
  | 'satchel'
  | 'bangles'
  | 'wristwatch';

export type FacialExpression =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'fear'
  | 'surprise'
  | 'sad'
  | 'determined'
  | 'counting';

export type CharacterAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'crouch'
  | 'sneak'
  | 'hide_cover'
  | 'counting_eyes_closed'
  | 'tag_lunge'
  | 'caught_funny'
  | 'showcase'
  | 'emote_laugh'
  | 'emote_wave'
  | 'emote_dance'
  | 'emote_clap'
  | 'emote_cry';

export interface CharacterPreset {
  id: string;
  defaultName: string;
  ageGroup: AgeGroup;
  ageLabel: string;
  heightScale: number;
  skinColor: number;
  skinHex: string;
  hairColor: number;
  hairStyle: HairStyle;
  faceStyle: FaceStyle;
  outfitStyle: OutfitStyle;
  outfitColor: number;
  outfitColorHex: string;
  secondaryColor: number;
  sandalColor: number;
  accessory: AccessoryType;
  tagline: string;
}

export interface CharacterCustomization {
  presetId: string;
  name: string;
  outfitStyle: OutfitStyle;
  outfitColor: number;
  accessory: AccessoryType;
}

export interface ParticipantSummary {
  id: string;
  name: string;
  role: TeamRole;
  isPlayer: boolean;
  caught: boolean;
  caughtAtSeconds: number | null;
}

export interface CameraSettings {
  sensitivity: number;
  zoomDistance: number;
  zoomSpeed: number;
  autoFollow: boolean;
}

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface LevelAtmosphere {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  skyBottom: string;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  sunDiscColor: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  exposure: number;
  moteColor: number;
  moteOpacity: number;
}

export interface LevelSpawnPoints {
  previewPos: [number, number, number];
  previewCamPos: [number, number, number];
  previewLookAt: [number, number, number];
  hiders: Array<[number, number, number]>;
  seeker: [number, number, number];
}

export interface LevelConfig {
  id: number;
  name: string;
  shortName: string;
  description: string;
  hidingFeatures: string;
  difficultyLabel: string;
  seekerSpeedMultiplier: number;
  seekerSightBonus: number;
  searchPauseFactor: number;
  aiHiderSpeedMultiplier: number;
  atmosphere: LevelAtmosphere;
}

export interface HudMatchResult {
  matchId: number;
  levelId: number;
  playerRole: TeamRole;
  playerWon: boolean;
  playerCaught: boolean;
  timeRemaining: number;
  remainingHiders: number;
  totalHiders: number;
  caughtCount: number;
  isOnline: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  playerRole: TeamRole;
  playerName: string;
  winner: MatchWinner;
  timeRemaining: number;
  countdownSeconds: number;
  isHiding: boolean;
  playerCaught: boolean;
  spectatingName: string | null;
  spectatingRole: TeamRole | null;
  spectatingCanCycle: boolean;
  canTag: boolean;
  tagTargetName: string | null;
  nearestDistance: number;
  seekerMode: SeekerMode;
  hidingSpotLabel: string | null;
  remainingHiders: number;
  totalHiders: number;
  caughtCount: number;
  participants: ParticipantSummary[];
  eventBanner: string | null;
  cameraSettings: CameraSettings;
  audioSettings: AudioSettings;
  graphicsQuality: GraphicsQuality;
  currentLevelId: number;
  unlockedLevel: number;
  newlyUnlockedLevel: number | null;
  levelName: string;
  difficultyLabel: string;
  webglError: string | null;
  matchResult: HudMatchResult | null;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  blocksSight: boolean;
  topY?: number;
  climbable?: boolean;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  blocksSight: boolean;
  topY?: number;
  climbable?: boolean;
}

export interface HouseInterior {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  doorX: number;
  doorZ: number;
  insideX: number;
  insideZ: number;
  roofMeshes: import('three').Mesh[];
}

export interface HidingSpot {
  x: number;
  z: number;
  label: string;
  kind: 'house' | 'tree' | 'well' | 'pump' | 'gully' | 'vehicle' | 'wall';
}

export interface VillageColliders {
  boxes: BoxCollider[];
  circles: CircleCollider[];
  worldRadius: number;
}

export interface MinimapRoad {
  x: number;
  z: number;
  width: number;
  length: number;
  rotY: number;
}

export interface MinimapBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotY: number;
  kind:
    | 'house'
    | 'school'
    | 'temple'
    | 'market'
    | 'shed'
    | 'railway'
    | 'haveli'
    | 'hut'
    | 'stall'
    | 'bridge'
    | 'platform';
}

export interface MinimapLandmark {
  x: number;
  z: number;
  radius: number;
  kind:
    | 'courtyard'
    | 'banyan'
    | 'pond'
    | 'farm'
    | 'well'
    | 'tree'
    | 'garden'
    | 'grass'
    | 'stage';
}

export interface MinimapWaterRect {
  x: number;
  z: number;
  width: number;
  length: number;
  rotY: number;
}

export interface VillageMinimapLayout {
  worldRadius: number;
  groundTint?: string;
  roads: MinimapRoad[];
  waterRects?: MinimapWaterRect[];
  buildings: MinimapBuilding[];
  landmarks: MinimapLandmark[];
}

export interface MinimapActorDot {
  id: string;
  role: TeamRole;
  approxX: number;
  approxZ: number;
  approxRadius: number;
}

export interface MinimapFrame {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  cameraYaw: number;
  playerRole: TeamRole;
  isSpectating: boolean;
  layout: VillageMinimapLayout;
  others: MinimapActorDot[];
}

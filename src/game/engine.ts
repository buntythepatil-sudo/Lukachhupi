import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createDefaultAudioSettings,
  VillageAudioEngine,
} from './audioEngine';
import {
  createDefaultCameraSettings,
  ThirdPersonCameraController,
} from './cameraController';
import {
  createCustomizationFromPreset,
  VILLAGE_CHARACTER_PRESETS,
} from './characterPresets';
import {
  CharacterRig,
  createCharacterFromCustomization,
  createCustomizedCharacter,
  disposeCharacterRig,
} from './characters';
import { setFaceTextureAnisotropy } from './characterFaces';
import { buildLevelMap } from './levelBuilder';
import { SkeletonVampireController } from './skeletonVampireNpc';
import {
  getLevelConfig,
  isLevelUnlocked,
  loadUnlockedLevel,
  saveUnlockedLevel,
  TOTAL_LEVELS,
} from './levels';
import { createVillageTextures, VillageTextureSet } from './textures';
import { EmoteType } from './chatFilter';
import {
  MultiplayerRoomSnapshot,
  PlayerTransformPayload,
  ServerToClientMessage,
} from './multiplayerTypes';
import {
  AudioSettings,
  CameraSettings,
  CharacterAnimState,
  CharacterCustomization,
  FacialExpression,
  GamePhase,
  GraphicsQuality,
  HidingSpot,
  HouseInterior,
  HudSnapshot,
  LevelConfig,
  LevelSpawnPoints,
  MatchWinner,
  MinimapActorDot,
  MinimapFrame,
  ParticipantSummary,
  SeatSpot,
  SeekerMode,
  SpectateCameraMode,
  SpectateTargetInfo,
  TeamRole,
  TempleBellInteractive,
  VillageColliders,
  VillageMinimapLayout,
} from './types';
import { VILLAGE_MINIMAP_LAYOUT, VillageBuildResult } from './village';
import { VillageNpcSystem } from './villageNpcSystem';

const MATCH_DURATION_SECONDS = 180; // 3-minute match
const HEADSTART_SECONDS = 12.0; // Head-start while seeker counts with eyes closed
const CAUGHT_ANIM_DURATION = 2.3; // Duration of funny caught animation
const FINAL_TAG_DELAY = 1.75; // Brief comedic beat before end screen when last hider is caught

const CHAR_RADIUS = 0.42;
const HIDER_RUN_SPEED = 5.35;
const HIDER_CROUCH_SPEED = 2.8;
const AI_HIDER_SPEED = 4.25;
const SEEKER_PLAYER_SPEED = 5.65;
const SEEKER_PATROL_SPEED = 2.95;
const SEEKER_CHASE_SPEED = 4.35;

const TAG_RANGE = 3.25;
const SLAP_RANGE = 2.75;
const HIDER_SLAP_COOLDOWN = 1.6;
const HANDSHAKE_RANGE = 3.2;
const HANDSHAKE_DURATION = 1.75;
const HANDSHAKE_COOLDOWN = 2.0;
const SIT_RANGE = 2.45;
const SIT_DOWN_DURATION = 0.45;
const STAND_UP_DURATION = 0.42;
const AI_CATCH_RANGE = 1.3;
const SIGHT_RANGE_STANDING = 14.5;
const SIGHT_RANGE_HIDING = 4.6;
const AI_HIDER_FLEE_RANGE = 6.2;
const JUMP_VELOCITY = 7.9;
const GRAVITY = 21.5;
const GRAPHICS_STORAGE_KEY = 'gcc95_graphics_quality_v1';

function loadInitialGraphicsQuality(): GraphicsQuality {
  try {
    const saved = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (saved === 'low' || saved === 'medium' || saved === 'high') {
      return saved;
    }
  } catch {
    // Ignore storage restriction
  }
  if (typeof window !== 'undefined') {
    const isCoarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    const isMobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isCoarse || isMobileUa || window.innerWidth < 768) {
      return 'medium';
    }
  }
  return 'high';
}

// Reusable math helpers outside the tick loop (zero GC per frame)
const _moveDir = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _currentLook = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _probePos = new THREE.Vector3();
const _freeCamPos = new THREE.Vector3();
const _rayStart = new THREE.Vector2();
const _rayEnd = new THREE.Vector2();

interface ParticipantActor {
  id: string;
  name: string;
  role: TeamRole;
  isPlayer: boolean;
  isRemote?: boolean;
  rig: CharacterRig;
  caught: boolean;
  caughtAtSeconds: number | null;
  caughtAnimElapsed: number;
  isHiding: boolean;
  lastMoveSpeed: number;
  vy: number;
  grounded: boolean;
  radarSeed: number;
  targetSpotIndex: number;
  waypoints: Array<{ x: number; z: number }>;
  retargetCooldown: number;
  remoteTargetX?: number;
  remoteTargetY?: number;
  remoteTargetZ?: number;
  remoteTargetRotY?: number;
  remoteAnimState?: CharacterAnimState;
  remoteExpression?: FacialExpression;
  remoteAnimElapsed?: number;
  nameplateSprite?: THREE.Sprite | null;
  chatBubbleSprite?: THREE.Sprite | null;
  chatBubbleTimer?: number;
  activeEmote?: EmoteType | null;
  emoteTimer?: number;
  tagLungeTimer?: number;
  slapFlinchTimer?: number;
  slapKnockVx?: number;
  slapKnockVz?: number;
  handshakeTimer?: number;
  handshakePartnerId?: string | null;
  sitPhase?: 'none' | 'sit_down' | 'sitting' | 'stand_up';
  sitTimer?: number;
  activeSeat?: SeatSpot | null;
  preSitPos?: { x: number; z: number } | null;
  expressionOverride?: FacialExpression | null;
  expressionOverrideTimer?: number;
}

function emoteToAnimState(emote: EmoteType): CharacterAnimState {
  switch (emote) {
    case 'laugh':
      return 'emote_laugh';
    case 'surprise':
      return 'emote_surprise';
    case 'wave':
      return 'emote_wave';
    case 'dance':
      return 'emote_dance';
    case 'clap':
      return 'emote_clap';
    case 'cry':
      return 'emote_cry';
  }
}

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) ?? '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function segmentIntersectsBox(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < 1e-6) {
    if (ax < minX || ax > maxX) return false;
  } else {
    let t1 = (minX - ax) / dx;
    let t2 = (maxX - ax) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-6) {
    if (az < minZ || az > maxZ) return false;
  } else {
    let t1 = (minZ - az) / dz;
    let t2 = (maxZ - az) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

function segmentIntersectsCircle(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) {
    return (ax - cx) * (ax - cx) + (az - cz) * (az - cz) < radius * radius;
  }
  const t = THREE.MathUtils.clamp(
    ((cx - ax) * dx + (cz - az) * dz) / lenSq,
    0,
    1,
  );
  const px = ax + t * dx;
  const pz = az + t * dz;
  const distSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
  return distSq < radius * radius;
}

export class ChhupanChhupaiEngine {
  private container: HTMLElement;
  private onHudChange: (snapshot: HudSnapshot) => void;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: VillageTextureSet | null = null;
  private envTexture: THREE.Texture | null = null;
  private isSoftwareGl = false;

  private colliders!: VillageColliders;
  private worldGroup: THREE.Group | null = null;
  private activeMinimapLayout: VillageMinimapLayout = VILLAGE_MINIMAP_LAYOUT;
  private activeSpawnPoints: LevelSpawnPoints | null = null;
  private swayFoliage: THREE.Object3D[] = [];
  private patrolPoints: THREE.Vector3[] = [];
  private hidingSpots: HidingSpot[] = [];
  private houseInteriors: HouseInterior[] = [];
  private pondWater: THREE.Mesh | null = null;
  private skyDomeMesh: THREE.Mesh | null = null;
  private sunDiscMesh: THREE.Mesh | null = null;
  private sunHaloSprite: THREE.Sprite | null = null;
  private cloudsGroup: THREE.Group | null = null;
  private cloudSprites: Array<{
    sprite: THREE.Sprite;
    angle: number;
    radius: number;
    y: number;
    speed: number;
  }> = [];
  private hemiLight: THREE.HemisphereLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private faceFillLight: THREE.DirectionalLight | null = null;
  private dustMotes: THREE.Points | null = null;
  private cameraController: ThirdPersonCameraController | null = null;
  private audio: VillageAudioEngine;
  private minimapListener: ((frame: MinimapFrame) => void) | null = null;

  private graphicsQuality: GraphicsQuality = loadInitialGraphicsQuality();
  private levelCache = new Map<number, VillageBuildResult>();
  private npcCache = new Map<number, VillageNpcSystem>();
  private activeNpcSystem: VillageNpcSystem | null = null;
  private activeMapAnimate: ((elapsed: number, dt: number) => void) | null = null;
  private skeletonVampire: SkeletonVampireController | null = null;
  private templeBells: TempleBellInteractive[] = [];
  private mapSeats: SeatSpot[] = [];
  private currentLevelId = 1;
  private unlockedLevel = loadUnlockedLevel();
  private newlyUnlockedLevel: number | null = null;
  private activeLevelConfig: LevelConfig = getLevelConfig(1);

  private previewRig: CharacterRig | null = null;
  private backgroundCastRigs: Array<{
    rig: CharacterRig;
    baseRotY: number;
    phaseOffset: number;
    animMode: 'wave' | 'clap' | 'laugh' | 'showcase';
  }> = [];
  private startShowcaseMode: 'menu' | 'panel' = 'menu';
  private actors: ParticipantActor[] = [];
  private playerActor: ParticipantActor | null = null;
  private seekerActor: ParticipantActor | null = null;

  private phase: GamePhase = 'start';
  private exploreMode = false;
  private levelBeforeExplore: number | null = null;
  private selectedRole: TeamRole = 'hider';
  private currentCustomization: CharacterCustomization =
    createCustomizationFromPreset(VILLAGE_CHARACTER_PRESETS[0]);
  private winner: MatchWinner = null;
  private matchSequenceId = 0;
  private pendingWinner: MatchWinner = null;
  private pendingEndTimer = 0;
  private timeRemaining = MATCH_DURATION_SECONDS;
  private countdownTimer = 0;
  private lastCountdownCeil = 0;

  private seekerMode: SeekerMode = 'searching';
  private prevSeekerMode: SeekerMode = 'counting';
  private patrolIndex = 0;
  private seekerSearchQueue: Array<{ x: number; z: number; pauseFactor: number }> =
    [];
  private lastSeenPos = new THREE.Vector3(0, 0, 7.5);
  private investigatingLastPos = false;
  private searchPauseTimer = 0;
  private seekerLookPhase = 0;
  private seekerProgressPos = new THREE.Vector3();
  private seekerStuckTimer = 0;
  private spectateTargetId: string | null = null;
  private spectateCameraMode: SpectateCameraMode = 'follow';
  private freeCamVerticalInput = 0;
  private lastPlayerAnimState: CharacterAnimState = 'idle';
  private lastPlayerExpression: FacialExpression | undefined = undefined;

  private eventBanner: string | null = null;
  private eventBannerTimer = 0;

  private keysPressed = new Set<string>();
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private lastForwardInput = 0;
  private lastRightInput = 0;

  private frameId = 0;
  private lastTimestamp = 0;
  private elapsed = 0;
  private disposed = false;
  private contextLost = false;
  private lastHudKey = '';

  // Real-time online multiplayer state (strictly real players, zero bots)
  private onlineMode = false;
  private onlineLocalPlayerId: string | null = null;
  private currentOnlineRound = 0;
  private onlineSendAccum = 0;
  private onOnlineLocalState: ((state: PlayerTransformPayload) => void) | null =
    null;
  private onOnlineTagRequest: ((targetPlayerId: string) => void) | null = null;
  private onOnlineSlapRequest: ((targetPlayerId: string) => void) | null = null;
  private onOnlineHandshakeRequest: ((targetPlayerId: string) => void) | null =
    null;
  private playerSlapCooldown = 0;
  private playerHandshakeCooldown = 0;
  private npcSlapCooldown = 0;
  private templeBellCooldown = 0;
  private mutedPlayerIds = new Set<string>();
  private previewEmote: EmoteType | null = null;
  private previewEmoteTimer = 0;
  private previewChatBubble: THREE.Sprite | null = null;
  private previewChatBubbleTimer = 0;

  constructor(
    container: HTMLElement,
    onHudChange: (snapshot: HudSnapshot) => void,
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.audio = new VillageAudioEngine(() => {
      this.emitHud();
    });

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xeac494);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xeac494, 0.0082);

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 240);
    this.camera.position.set(1.2, 2.0, 11.4);

    try {
      this.initRenderer(width, height);
    } catch {
      this.emitHud('WebGL graphics could not be initialized on this browser.');
      return;
    }

    this.setupLighting();
    this.setupWorld();
    this.rebuildPreviewCharacter();
    this.bindEvents();

    if (this.renderer && !this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.emitHud();
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private getTargetPixelRatio(quality: GraphicsQuality): number {
    if (this.isSoftwareGl) return 1;
    const dpr = window.devicePixelRatio || 1;
    if (quality === 'low') return 1;
    if (quality === 'medium') return Math.min(dpr, 1.5);
    return Math.min(dpr, 2);
  }

  private initRenderer(width: number, height: number): void {
    this.isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(this.getTargetPixelRatio(this.graphicsQuality));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled =
      !this.isSoftwareGl && this.graphicsQuality !== 'low';
    renderer.shadowMap.type =
      this.graphicsQuality === 'medium'
        ? THREE.PCFShadowMap
        : THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.textures = createVillageTextures(renderer);
    setFaceTextureAnisotropy(
      Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        this.graphicsQuality === 'low'
          ? 4
          : this.graphicsQuality === 'medium'
            ? 6
            : 8,
      ),
    );

    this.cameraController = new ThirdPersonCameraController(
      renderer.domElement,
      () => {
        this.emitHud();
      },
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();
  }

  private buildSkyGradientTexture(config: LevelConfig): THREE.CanvasTexture {
    const atm = config.atmosphere;
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, atm.skyTop);
      grad.addColorStop(0.36, atm.skyMid);
      grad.addColorStop(0.6, atm.skyHorizon);
      grad.addColorStop(1.0, atm.skyBottom);
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 16, 256);
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    return skyTex;
  }

  private setupLighting(): void {
    const skyTex = this.buildSkyGradientTexture(this.activeLevelConfig);
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(185, 24, 16),
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
    this.scene.add(skyDome);
    this.skyDomeMesh = skyDome;

    // Glowing sun / moon disc + soft atmospheric halo
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }),
    );
    sunDisc.position.set(95, 58, 65);
    this.scene.add(sunDisc);
    this.sunDiscMesh = sunDisc;

    if (this.textures) {
      const haloMat = new THREE.SpriteMaterial({
        map: this.textures.sunHalo,
        color: 0xfff1c9,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const sunHalo = new THREE.Sprite(haloMat);
      sunHalo.scale.set(48, 48, 1);
      sunDisc.add(sunHalo);
      this.sunHaloSprite = sunHalo;

      const cloudsGroup = new THREE.Group();
      this.cloudSprites = [];
      const cloudCount = 8;
      for (let i = 0; i < cloudCount; i++) {
        const cMat = new THREE.SpriteMaterial({
          map: this.textures.cloud,
          color: 0xfff8ec,
          transparent: true,
          opacity: 0.56 + (i % 3) * 0.08,
          depthWrite: false,
          fog: false,
        });
        const sprite = new THREE.Sprite(cMat);
        const angle = (i / cloudCount) * Math.PI * 2 + (i % 2) * 0.25;
        const radius = 84 + (i % 3) * 18;
        const y = 34 + (i % 4) * 5.2;
        const scaleW = 28 + (i % 3) * 9;
        const scaleH = 12 + (i % 2) * 4;
        sprite.scale.set(scaleW, scaleH, 1);
        sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        cloudsGroup.add(sprite);
        this.cloudSprites.push({
          sprite,
          angle,
          radius,
          y,
          speed: 0.008 + (i % 3) * 0.003,
        });
      }
      this.scene.add(cloudsGroup);
      this.cloudsGroup = cloudsGroup;
    }

    const hemiLight = new THREE.HemisphereLight(0xc2dcf8, 0xa87143, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xffdca2, 2.05);
    sunLight.position.set(28, 34, 20);
    sunLight.castShadow = !this.isSoftwareGl && this.graphicsQuality !== 'low';
    const shadowSize = this.graphicsQuality === 'medium' ? 1024 : 2048;
    sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 96;
    const d = 26;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.00045;
    sunLight.shadow.normalBias = 0.025;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;

    const rimLight = new THREE.DirectionalLight(0xc8dcf7, 0.48);
    rimLight.position.set(-24, 16, -24);
    this.scene.add(rimLight);
    this.rimLight = rimLight;

    const faceFillLight = new THREE.DirectionalLight(0xfff2e0, 0.36);
    faceFillLight.position.set(2.2, 2.8, 12.2);
    faceFillLight.castShadow = false;
    this.scene.add(faceFillLight);
    this.scene.add(faceFillLight.target);
    this.faceFillLight = faceFillLight;

    const moteCount = 160;
    const motePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePositions[i * 3] = ((i * 73) % 86) - 43;
      motePositions[i * 3 + 1] = 0.8 + ((i * 29) % 75) / 10;
      motePositions[i * 3 + 2] = ((i * 97) % 86) - 43;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xfff0c8,
      size: 0.14,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.dustMotes = new THREE.Points(moteGeo, moteMat);
    this.scene.add(this.dustMotes);

    this.applyGraphicsQuality();
  }

  private applyLevelAtmosphere(config: LevelConfig): void {
    const atm = config.atmosphere;
    this.scene.background = new THREE.Color(atm.fogColor);
    this.scene.fog = new THREE.FogExp2(atm.fogColor, atm.fogDensity);

    if (this.skyDomeMesh) {
      const mat = this.skyDomeMesh.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.map = this.buildSkyGradientTexture(config);
      mat.needsUpdate = true;
    }
    if (this.sunDiscMesh) {
      const mat = this.sunDiscMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(atm.sunDiscColor);
      this.sunDiscMesh.position.set(
        atm.sunPos[0] * 3.1,
        atm.sunPos[1] * 1.75,
        atm.sunPos[2] * 3.1,
      );
    }
    if (this.sunHaloSprite) {
      this.sunHaloSprite.material.color.setHex(atm.sunDiscColor);
      this.sunHaloSprite.material.opacity = atm.exposure < 0.98 ? 0.5 : 0.72;
    }
    for (let i = 0; i < this.cloudSprites.length; i++) {
      const cMat = this.cloudSprites[i].sprite.material;
      cMat.color.setHex(
        atm.exposure < 0.95 ? 0x6c7696 : atm.exposure < 1.02 ? 0xffdfb8 : 0xfff8ec,
      );
      cMat.opacity =
        (atm.exposure < 0.95 ? 0.34 : 0.56) + (i % 3) * 0.06;
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(atm.hemiSky);
      this.hemiLight.groundColor.setHex(atm.hemiGround);
      this.hemiLight.intensity = atm.hemiIntensity;
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(atm.sunColor);
      this.sunLight.intensity = atm.sunIntensity;
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(atm.rimColor);
      this.rimLight.intensity = atm.rimIntensity;
    }
    if (this.faceFillLight) {
      this.faceFillLight.intensity = atm.exposure < 0.98 ? 0.45 : 0.34;
    }
    if (this.renderer) {
      this.renderer.toneMappingExposure = atm.exposure;
    }
    if (this.dustMotes) {
      const mat = this.dustMotes.material as THREE.PointsMaterial;
      mat.color.setHex(atm.moteColor);
      mat.opacity = atm.moteOpacity;
    }
  }

  private applyGraphicsQualityToGroup(group: THREE.Group | null): void {
    if (!group) return;
    const showPointLights = this.graphicsQuality !== 'low';
    group.traverse((obj) => {
      if (obj.userData.optionalPointLight) {
        obj.visible = showPointLights;
      }
    });
  }

  private applyGraphicsQuality(): void {
    const q = this.graphicsQuality;
    if (this.renderer) {
      this.renderer.setPixelRatio(this.getTargetPixelRatio(q));
      const enableShadows = !this.isSoftwareGl && q !== 'low';
      this.renderer.shadowMap.enabled = enableShadows;
      this.renderer.shadowMap.type =
        q === 'medium' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

      if (this.sunLight) {
        this.sunLight.castShadow = enableShadows;
        const targetShadowSize = q === 'medium' ? 1024 : 2048;
        if (this.sunLight.shadow.mapSize.x !== targetShadowSize) {
          this.sunLight.shadow.map?.dispose();
          this.sunLight.shadow.map = null;
          this.sunLight.shadow.mapSize.set(targetShadowSize, targetShadowSize);
        }
      }
      this.renderer.shadowMap.needsUpdate = true;

      const maxSupported = this.renderer.capabilities.getMaxAnisotropy();
      const faceAniso = q === 'low' ? 4 : q === 'medium' ? 6 : 8;
      setFaceTextureAnisotropy(Math.min(maxSupported, faceAniso));
    }

    const texAniso = q === 'low' ? 2 : q === 'medium' ? 4 : 8;
    this.textures?.setAnisotropy(texAniso);

    if (this.rimLight) this.rimLight.visible = q !== 'low';
    if (this.dustMotes) this.dustMotes.visible = q !== 'low';
    if (this.faceFillLight) this.faceFillLight.visible = true;
    this.applyGraphicsQualityToGroup(this.worldGroup);
    this.activeNpcSystem?.setGraphicsQuality(this.graphicsQuality);
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    if (this.graphicsQuality === quality) return;
    this.graphicsQuality = quality;
    try {
      window.localStorage.setItem(GRAPHICS_STORAGE_KEY, quality);
    } catch {
      // Ignore storage error
    }
    this.applyGraphicsQuality();
    this.emitHud();
  }

  private detachWorldGroup(): void {
    if (this.activeNpcSystem) {
      this.scene.remove(this.activeNpcSystem.group);
      this.activeNpcSystem = null;
    }
    if (this.skeletonVampire) {
      this.scene.remove(this.skeletonVampire.group);
      this.skeletonVampire.reset();
    }
    this.templeBells = [];
    this.templeBellCooldown = 0;
    this.npcSlapCooldown = 0;
    this.activeMapAnimate = null;
    if (!this.worldGroup) return;
    this.updateHouseRoofVisibility(null);
    this.scene.remove(this.worldGroup);
    this.worldGroup = null;
  }

  private setupWorld(): void {
    if (!this.renderer) return;
    if (!this.textures) {
      this.textures = createVillageTextures(this.renderer);
    }
    this.loadLevelWorld(this.currentLevelId);
  }

  private loadLevelWorld(levelId: number): void {
    if (!this.textures) return;
    this.detachWorldGroup();

    this.currentLevelId = levelId;
    this.audio.setActiveLevel(levelId);
    this.activeLevelConfig = getLevelConfig(levelId);
    this.applyLevelAtmosphere(this.activeLevelConfig);

    let built = this.levelCache.get(levelId);
    if (!built) {
      built = buildLevelMap(levelId, this.textures);
      this.levelCache.set(levelId, built);
    }
    this.worldGroup = built.group;
    this.scene.add(built.group);
    this.applyGraphicsQualityToGroup(built.group);
    this.colliders = built.colliders;
    this.swayFoliage = built.swayFoliage;
    this.patrolPoints = built.patrolPoints;
    this.hidingSpots = built.hidingSpots;
    this.houseInteriors = built.houseInteriors;
    this.pondWater = built.pondWater;
    this.templeBells = built.templeBells ?? [];
    this.mapSeats = built.seats ?? [];
    this.activeMapAnimate = built.animate ?? null;
    this.activeMinimapLayout = built.minimapLayout;
    this.activeSpawnPoints = built.spawnPoints ?? null;

    // Attach ambient village NPCs & animals outside built.group so they never
    // interfere with gameplay colliders, hiding spots, or camera wall raycasts.
    let npcSys = this.npcCache.get(levelId);
    if (!npcSys) {
      npcSys = new VillageNpcSystem(
        levelId,
        this.textures,
        built.colliders,
        built.minimapLayout,
        this.graphicsQuality,
      );
      this.npcCache.set(levelId, npcSys);
    } else {
      npcSys.setGraphicsQuality(this.graphicsQuality);
    }
    this.activeNpcSystem = npcSys;
    this.scene.add(npcSys.group);

    // Bhutiya Haveli (Level 6) exclusive atmospheric Skeleton Vampire apparition
    if (levelId === 6) {
      if (!this.skeletonVampire) {
        this.skeletonVampire = new SkeletonVampireController({
          onAppear: (dist) => this.audio.playVampireAppearSound(dist),
          onDisappear: (dist) => this.audio.playVampireDisappearSound(dist),
        });
      }
      this.skeletonVampire.reset();
      this.scene.add(this.skeletonVampire.group);
    }

    // Collect solid walls, buildings, trunks & large props for 3D camera wall avoidance
    built.group.updateMatrixWorld(true);
    const foliageSet = new Set<THREE.Object3D>();
    for (const f of built.swayFoliage) {
      f.traverse((child) => foliageSet.add(child));
    }

    const occluders: THREE.Mesh[] = [];
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();

    built.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj === built.pondWater) return;
      if (foliageSet.has(obj)) return;

      const mat = obj.material as THREE.MeshStandardMaterial | undefined;
      if (mat && mat.transparent && mat.opacity < 0.85) return;

      bounds.setFromObject(obj);
      bounds.getSize(size);

      // Skip flat ground/roads/plinths/crops and giant outer terrain surfaces
      if (size.y < 0.65) return;
      if (size.x > 35 || size.z > 35) return;

      occluders.push(obj);
    });

    this.cameraController?.setWorldCollisionData(occluders, this.colliders);
  }

  public selectLevel(levelId: number): boolean {
    if (levelId < 1 || levelId > TOTAL_LEVELS) return false;
    if (!isLevelUnlocked(levelId, this.unlockedLevel)) return false;
    this.audio.unlock();
    if (levelId === this.currentLevelId) return true;

    this.newlyUnlockedLevel = null;
    this.loadLevelWorld(levelId);
    if (this.phase === 'start') {
      this.rebuildPreviewCharacter();
      const sp = this.activeSpawnPoints;
      if (sp) {
        this.camera.position.set(
          sp.previewCamPos[0],
          sp.previewCamPos[1],
          sp.previewCamPos[2],
        );
      }
    }
    this.emitHud();
    return true;
  }

  public advanceToNextLevel(): void {
    const nextId = Math.min(TOTAL_LEVELS, this.currentLevelId + 1);
    if (!isLevelUnlocked(nextId, this.unlockedLevel)) return;
    this.newlyUnlockedLevel = null;
    this.loadLevelWorld(nextId);
    this.startMatch(this.selectedRole, this.currentCustomization);
  }

  public setUnlockedLevel(level: number): void {
    const clamped = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(level)));
    if (clamped === this.unlockedLevel) return;
    this.unlockedLevel = clamped;
    saveUnlockedLevel(clamped);
    this.emitHud();
  }

  public updateAudioSettings(partial: Partial<AudioSettings>): void {
    this.audio.unlock();
    this.audio.updateSettings(partial);
    this.emitHud();
  }

  public toggleMute(): void {
    this.audio.toggleMute();
    this.emitHud();
  }

  private createNameplateSprite(name: string, role: TeamRole): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64);
      const isSeeker = role === 'seeker';
      const padX = 16;
      const boxY = 10;
      const boxH = 44;
      const boxW = 256 - padX * 2;
      const radius = 14;

      ctx.fillStyle = isSeeker
        ? 'rgba(138, 48, 12, 0.90)'
        : 'rgba(26, 17, 12, 0.86)';
      ctx.strokeStyle = isSeeker
        ? 'rgba(255, 206, 92, 0.95)'
        : 'rgba(245, 224, 192, 0.55)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(padX + radius, boxY);
      ctx.lineTo(padX + boxW - radius, boxY);
      ctx.quadraticCurveTo(padX + boxW, boxY, padX + boxW, boxY + radius);
      ctx.lineTo(padX + boxW, boxY + boxH - radius);
      ctx.quadraticCurveTo(
        padX + boxW,
        boxY + boxH,
        padX + boxW - radius,
        boxY + boxH,
      );
      ctx.lineTo(padX + radius, boxY + boxH);
      ctx.quadraticCurveTo(padX, boxY + boxH, padX, boxY + boxH - radius);
      ctx.lineTo(padX, boxY + radius);
      ctx.quadraticCurveTo(padX, boxY, padX + radius, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const label = isSeeker ? `★ ${name}` : name;
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSeeker ? '#ffe39a' : '#fff5e4';
      ctx.fillText(label.slice(0, 18), 128, 33);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 2.08, 0);
    sprite.scale.set(1.52, 0.38, 1);
    return sprite;
  }

  private createChatBubbleSprite(text: string, isEmote = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 124;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 420, 124);

      const safeText = text.replace(/[\r\n\t]/g, ' ').trim().slice(0, 84);
      ctx.font = isEmote
        ? 'bold 30px system-ui, -apple-system, sans-serif'
        : 'bold 24px system-ui, -apple-system, sans-serif';

      // Wrap into up to 2 crisp lines
      const maxLineWidth = 356;
      const words = safeText.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxLineWidth) {
          currentLine = candidate;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
          if (lines.length >= 1) {
            break;
          }
        }
      }
      if (currentLine && lines.length < 2) {
        lines.push(currentLine);
      }
      if (lines.length === 0) lines.push(safeText.slice(0, 22));
      if (lines.length === 2 && ctx.measureText(lines[1]).width > maxLineWidth) {
        let trimmed = lines[1];
        while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxLineWidth) {
          trimmed = trimmed.slice(0, -1);
        }
        lines[1] = `${trimmed}…`;
      }

      const lineWidths = lines.map((l) => ctx.measureText(l).width);
      const textWidth = Math.max(...lineWidths, 84);
      const boxW = Math.min(400, Math.max(146, textWidth + 44));
      const boxH = lines.length === 1 ? 64 : 92;
      const boxX = (420 - boxW) / 2;
      const boxY = 104 - boxH;
      const radius = 18;

      ctx.fillStyle = isEmote
        ? 'rgba(255, 241, 204, 0.97)'
        : 'rgba(255, 250, 238, 0.96)';
      ctx.strokeStyle = isEmote
        ? 'rgba(217, 107, 39, 0.95)'
        : 'rgba(128, 76, 36, 0.82)';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxW - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
      ctx.lineTo(boxX + boxW, boxY + boxH - radius);
      ctx.quadraticCurveTo(
        boxX + boxW,
        boxY + boxH,
        boxX + boxW - radius,
        boxY + boxH,
      );
      ctx.lineTo(222, boxY + boxH);
      ctx.lineTo(210, boxY + boxH + 16);
      ctx.lineTo(198, boxY + boxH);
      ctx.lineTo(boxX + radius, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#23140b';
      if (lines.length === 1) {
        ctx.fillText(lines[0], 210, boxY + boxH / 2 + 1);
      } else {
        ctx.fillText(lines[0], 210, boxY + 30);
        ctx.fillText(lines[1], 210, boxY + 62);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 2.72, 0);
    sprite.scale.set(2.25, 0.66, 1);
    return sprite;
  }

  private disposeSprite(
    parent: THREE.Object3D,
    sprite: THREE.Sprite | null | undefined,
  ): void {
    if (!sprite) return;
    parent.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  private clearActors(): void {
    for (const actor of this.actors) {
      this.disposeSprite(actor.rig.root, actor.nameplateSprite);
      actor.nameplateSprite = null;
      this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
      actor.chatBubbleSprite = null;
      this.scene.remove(actor.rig.root);
      disposeCharacterRig(actor.rig);
    }
    this.actors = [];
    this.playerActor = null;
    this.seekerActor = null;
  }

  private clearPreviewRig(): void {
    if (this.previewRig) {
      this.disposeSprite(this.previewRig.root, this.previewChatBubble);
      this.previewChatBubble = null;
      this.previewChatBubbleTimer = 0;
      this.previewEmote = null;
      this.previewEmoteTimer = 0;
      this.scene.remove(this.previewRig.root);
      disposeCharacterRig(this.previewRig);
      this.previewRig = null;
    }
    for (let i = 0; i < this.backgroundCastRigs.length; i++) {
      const bg = this.backgroundCastRigs[i];
      this.scene.remove(bg.rig.root);
      disposeCharacterRig(bg.rig);
    }
    this.backgroundCastRigs = [];
  }

  /**
   * Builds/updates the live 3D showcase character plus animated village friends
   * standing in the active level courtyard on the start / main menu screen.
   */
  private rebuildPreviewCharacter(): void {
    if (!this.textures || this.phase !== 'start') return;
    this.clearPreviewRig();

    const rig = createCharacterFromCustomization(
      this.currentCustomization,
      this.selectedRole === 'seeker',
      this.textures.contactShadow,
    );
    const previewPos = this.activeSpawnPoints?.previewPos ?? [0.2, 0, 7.6];
    rig.root.position.set(previewPos[0], previewPos[1], previewPos[2]);
    rig.root.rotation.y = 0.24;
    this.scene.add(rig.root);
    this.previewRig = rig;

    // Add 4 animated village companions standing in the courtyard background
    const companions = VILLAGE_CHARACTER_PRESETS.filter(
      (p) => p.id !== this.currentCustomization.presetId,
    );
    const companionSlots: Array<{
      dx: number;
      dz: number;
      rotY: number;
      animMode: 'wave' | 'clap' | 'laugh' | 'showcase';
      isSeekerLook: boolean;
    }> = [
      { dx: -1.42, dz: -2.05, rotY: 0.34, animMode: 'wave', isSeekerLook: false },
      { dx: -0.58, dz: -3.05, rotY: 0.14, animMode: 'clap', isSeekerLook: false },
      {
        dx: 0.65,
        dz: -2.95,
        rotY: -0.18,
        animMode: 'laugh',
        isSeekerLook: this.selectedRole !== 'seeker',
      },
      { dx: 1.46, dz: -2.0, rotY: -0.36, animMode: 'showcase', isSeekerLook: false },
    ];

    for (let i = 0; i < companionSlots.length; i++) {
      const slot = companionSlots[i];
      const preset = companions[i % companions.length];
      if (!preset) continue;

      const bgRig = createCustomizedCharacter(
        {
          preset,
          outfitStyle: preset.outfitStyle,
          outfitColor: preset.outfitColor,
          accessory: preset.accessory,
          isSeeker: slot.isSeekerLook,
          includeTagRing: false,
        },
        this.textures.contactShadow,
      );

      _probePos.set(
        previewPos[0] + slot.dx,
        previewPos[1],
        previewPos[2] + slot.dz,
      );
      this.resolveCollisions(_probePos, CHAR_RADIUS * 1.15);

      const dHero = Math.hypot(
        _probePos.x - previewPos[0],
        _probePos.z - previewPos[2],
      );
      if (dHero < 1.15) {
        _probePos.z = previewPos[2] - 1.5;
        _probePos.x = previewPos[0] + (slot.dx < 0 ? -1.1 : 1.1);
        this.resolveCollisions(_probePos, CHAR_RADIUS * 1.1);
      }

      bgRig.root.position.set(_probePos.x, previewPos[1], _probePos.z);
      bgRig.root.rotation.y = slot.rotY;
      this.scene.add(bgRig.root);
      this.backgroundCastRigs.push({
        rig: bgRig,
        baseRotY: slot.rotY,
        phaseOffset: i * 1.45,
        animMode: slot.animMode,
      });
    }
  }

  public setStartShowcaseMode(mode: 'menu' | 'panel'): void {
    this.startShowcaseMode = mode;
  }

  public playUiClick(): void {
    this.audio.playUiClick();
  }

  public updateStartPreview(
    customization: CharacterCustomization,
    role: TeamRole,
  ): void {
    this.currentCustomization = { ...customization };
    this.selectedRole = role;
    if (this.phase === 'start') {
      this.rebuildPreviewCharacter();
      this.emitHud();
    }
  }

  private setupMatchRoster(
    role: TeamRole,
    customization: CharacterCustomization,
  ): void {
    if (!this.textures) return;

    this.clearPreviewRig();
    this.clearActors();

    this.selectedRole = role;
    this.currentCustomization = { ...customization };
    const cleanPlayerName =
      customization.name.trim() ||
      VILLAGE_CHARACTER_PRESETS.find((p) => p.id === customization.presetId)
        ?.defaultName ||
      'Player';

    this.winner = null;
    this.pendingWinner = null;
    this.newlyUnlockedLevel = null;
    this.pendingEndTimer = 0;
    this.timeRemaining = MATCH_DURATION_SECONDS;
    this.countdownTimer = HEADSTART_SECONDS;
    this.lastCountdownCeil = Math.ceil(HEADSTART_SECONDS);
    this.seekerMode = 'counting';
    this.prevSeekerMode = 'counting';
    this.lastPlayerAnimState = 'counting_eyes_closed';
    this.spectateTargetId = null;
    this.spectateCameraMode = 'follow';
    this.freeCamVerticalInput = 0;
    this.cameraController?.exitFreeCamera();
    this.cameraController?.setFullScreenTouchLook(false);
    this.seekerSearchQueue = this.buildSeekerSearchQueue();
    this.patrolIndex = Math.floor(
      Math.random() * Math.max(1, this.seekerSearchQueue.length),
    );
    this.investigatingLastPos = false;
    this.searchPauseTimer = 0;
    this.seekerLookPhase = 0;
    this.seekerStuckTimer = 0;
    const seekerSpawnPos = this.activeSpawnPoints?.seeker ?? [2.8, 2.2, 0];
    this.seekerProgressPos.set(seekerSpawnPos[0], 0, seekerSpawnPos[1]);
    this.eventBanner = null;
    this.eventBannerTimer = 0;

    // Pick 4 distinct village kids/teens from the 10-character roster for bots
    const otherPresets = VILLAGE_CHARACTER_PRESETS.filter(
      (p) => p.id !== customization.presetId,
    );
    for (let i = otherPresets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherPresets[i], otherPresets[j]] = [otherPresets[j], otherPresets[i]];
    }

    const hiderSpawns: Array<[number, number, number]> =
      this.activeSpawnPoints?.hiders ?? [
        [-1.8, 7.2, Math.PI],
        [-6.8, -5.4, 0.8],
        [5.4, 5.4, -0.7],
        [2.6, -7.8, 2.5],
      ];

    const spotIndices = this.hidingSpots.map((_, i) => i);
    for (let i = spotIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spotIndices[i], spotIndices[j]] = [spotIndices[j], spotIndices[i]];
    }

    const actors: ParticipantActor[] = [];
    let botCursor = 0;

    // Build 4 Hiders
    for (let i = 0; i < 4; i++) {
      const isPlayer = role === 'hider' && i === 0;
      const [sx, sz, rot] = hiderSpawns[i];

      let rig: CharacterRig;
      let name: string;

      if (isPlayer) {
        rig = createCharacterFromCustomization(
          customization,
          false,
          this.textures.contactShadow,
        );
        name = cleanPlayerName;
      } else {
        const botPreset = otherPresets[botCursor++ % otherPresets.length];
        rig = createCustomizedCharacter(
          {
            preset: botPreset,
            outfitStyle: botPreset.outfitStyle,
            outfitColor: botPreset.outfitColor,
            accessory: botPreset.accessory,
            isSeeker: false,
            includeTagRing: true,
          },
          this.textures.contactShadow,
        );
        name = botPreset.defaultName;
      }

      rig.root.position.set(sx, 0, sz);
      rig.root.rotation.y = rot;
      const nameplateSprite = this.createNameplateSprite(name, 'hider');
      rig.root.add(nameplateSprite);
      this.scene.add(rig.root);

      const actor: ParticipantActor = {
        id: `hider-${i}`,
        name,
        role: 'hider',
        isPlayer,
        rig,
        caught: false,
        caughtAtSeconds: null,
        caughtAnimElapsed: 0,
        isHiding: false,
        lastMoveSpeed: 0,
        vy: 0,
        grounded: true,
        radarSeed: (i + 1) * 1.93 + Math.random() * 6.28,
        targetSpotIndex: spotIndices[i % spotIndices.length],
        waypoints: [],
        retargetCooldown: 0,
        nameplateSprite,
      };

      if (!isPlayer) {
        this.planPathToHidingSpot(actor, actor.targetSpotIndex);
      }

      actors.push(actor);
    }

    // Build 1 Seeker (either customized Player or an AI village teenager with saffron headband)
    let seekerRig: CharacterRig;
    let seekerName: string;

    if (role === 'seeker') {
      seekerRig = createCharacterFromCustomization(
        customization,
        true,
        this.textures.contactShadow,
      );
      seekerName = cleanPlayerName;
    } else {
      const seekerPreset =
        otherPresets.find((p) => p.id === 'bhola') ??
        otherPresets[botCursor % otherPresets.length];
      seekerRig = createCustomizedCharacter(
        {
          preset: seekerPreset,
          outfitStyle: seekerPreset.outfitStyle,
          outfitColor: seekerPreset.outfitColor,
          accessory: seekerPreset.accessory,
          isSeeker: true,
          includeTagRing: false,
        },
        this.textures.contactShadow,
      );
      seekerName = seekerPreset.defaultName;
    }

    const seekerSpawn = this.activeSpawnPoints?.seeker ?? [2.8, 2.2, 0];
    seekerRig.root.position.set(seekerSpawn[0], 0, seekerSpawn[1]);
    seekerRig.root.rotation.y = seekerSpawn[2];
    const seekerNameplate = this.createNameplateSprite(seekerName, 'seeker');
    seekerRig.root.add(seekerNameplate);
    this.scene.add(seekerRig.root);

    const seekerActor: ParticipantActor = {
      id: 'seeker-0',
      name: seekerName,
      role: 'seeker',
      isPlayer: role === 'seeker',
      rig: seekerRig,
      caught: false,
      caughtAtSeconds: null,
      caughtAnimElapsed: 0,
      isHiding: false,
      lastMoveSpeed: 0,
      vy: 0,
      grounded: true,
      radarSeed: 0.77 + Math.random() * 6.28,
      targetSpotIndex: -1,
      waypoints: [],
      retargetCooldown: 0,
      nameplateSprite: seekerNameplate,
    };

    actors.push(seekerActor);
    this.actors = actors;
    this.seekerActor = seekerActor;
    this.playerActor = actors.find((a) => a.isPlayer) ?? actors[0];

    this.updateHouseRoofVisibility(null);

    const p = this.playerActor.rig.root.position;
    _currentLook.set(p.x, 1.1, p.z);
    if (this.phase === 'playing') {
      this.cameraController?.setEnabled(true);
      this.cameraController?.snapBehind(
        p,
        this.playerActor.rig.root.rotation.y,
        this.camera,
      );
    }
  }

  public startMatch(
    role: TeamRole,
    customization: CharacterCustomization,
  ): void {
    this.exploreMode = false;
    this.levelBeforeExplore = null;
    this.onlineMode = false;
    this.onlineLocalPlayerId = null;
    this.currentOnlineRound = 0;
    this.matchSequenceId += 1;
    this.audio.unlock();
    this.phase = 'playing';
    this.keysPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.playerSlapCooldown = 0;
    this.setupMatchRoster(role, customization);
    this.audio.playCountdownTick(Math.ceil(HEADSTART_SECONDS));
    const seekerLabel = this.seekerActor?.name ?? 'The Seeker';
    const secs = Math.ceil(HEADSTART_SECONDS);
    this.showBanner(
      role === 'hider'
        ? `Hide! ${seekerLabel} has eyes closed counting (${secs}s)...`
        : `Eyes closed! Counting to ${secs} before searching...`,
      3.5,
    );
    this.emitHud();
  }

  public startExploreSchool(customization: CharacterCustomization): void {
    if (!this.textures) return;
    if (!this.exploreMode) {
      this.levelBeforeExplore = this.currentLevelId;
    }
    if (this.currentLevelId !== 2) {
      this.loadLevelWorld(2);
    }

    this.onlineMode = false;
    this.onlineLocalPlayerId = null;
    this.currentOnlineRound = 0;
    this.exploreMode = true;
    this.selectedRole = 'hider';
    this.currentCustomization = { ...customization };
    this.audio.unlock();
    this.phase = 'playing';
    this.winner = null;
    this.pendingWinner = null;
    this.newlyUnlockedLevel = null;
    this.pendingEndTimer = 0;
    this.countdownTimer = 0;
    this.lastCountdownCeil = 0;
    this.timeRemaining = MATCH_DURATION_SECONDS;
    this.keysPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.playerSlapCooldown = 0;
    this.templeBellCooldown = 0;
    this.npcSlapCooldown = 0;
    this.spectateTargetId = null;
    this.spectateCameraMode = 'follow';
    this.freeCamVerticalInput = 0;

    this.clearPreviewRig();
    this.clearActors();

    const cleanPlayerName = customization.name.trim() || 'Player';
    const rig = createCharacterFromCustomization(
      customization,
      false,
      this.textures.contactShadow,
    );
    // Spawn in the front school courtyard looking straight at the 1995 Prathmik Vidyalaya
    rig.root.position.set(0, 0, 15.5);
    rig.root.rotation.y = Math.PI;
    const nameplateSprite = this.createNameplateSprite(cleanPlayerName, 'hider');
    rig.root.add(nameplateSprite);
    this.scene.add(rig.root);

    const playerActor: ParticipantActor = {
      id: 'explore-player',
      name: cleanPlayerName,
      role: 'hider',
      isPlayer: true,
      rig,
      caught: false,
      caughtAtSeconds: null,
      caughtAnimElapsed: 0,
      isHiding: false,
      lastMoveSpeed: 0,
      vy: 0,
      grounded: true,
      radarSeed: 1.25,
      targetSpotIndex: -1,
      waypoints: [],
      retargetCooldown: 0,
      nameplateSprite,
    };

    this.actors = [playerActor];
    this.playerActor = playerActor;
    this.seekerActor = null;
    this.cameraController?.exitFreeCamera();
    this.cameraController?.setFullScreenTouchLook(false);
    this.cameraController?.setEnabled(true);
    this.cameraController?.snapBehind(
      playerActor.rig.root.position,
      playerActor.rig.root.rotation.y,
      this.camera,
    );

    this.showBanner(
      'Exploring 1995 Village School — Visit classrooms, stairs, hand pump & bell!',
      4.0,
    );
    this.emitHud();
  }

  public exitExploreMode(): void {
    this.returnToStart();
  }

  public setOnlineCallbacks(
    onLocalState: ((state: PlayerTransformPayload) => void) | null,
    onTagRequest: ((targetPlayerId: string) => void) | null,
    onSlapRequest?: ((targetPlayerId: string) => void) | null,
    onHandshakeRequest?: ((targetPlayerId: string) => void) | null,
  ): void {
    this.onOnlineLocalState = onLocalState;
    this.onOnlineTagRequest = onTagRequest;
    this.onOnlineSlapRequest = onSlapRequest ?? null;
    this.onOnlineHandshakeRequest = onHandshakeRequest ?? null;
  }

  public previewOnlineLobbyMap(levelId: number): void {
    if (levelId < 1 || levelId > TOTAL_LEVELS) return;
    if (levelId === this.currentLevelId && this.phase === 'start') return;

    this.newlyUnlockedLevel = null;
    this.loadLevelWorld(levelId);
    if (this.phase === 'start') {
      this.rebuildPreviewCharacter();
      const sp = this.activeSpawnPoints;
      if (sp) {
        this.camera.position.set(
          sp.previewCamPos[0],
          sp.previewCamPos[1],
          sp.previewCamPos[2],
        );
      }
    }
    this.emitHud();
  }

  private setupOnlineMatch(
    room: MultiplayerRoomSnapshot,
    localPlayerId: string,
  ): void {
    if (!this.textures) return;
    this.audio.unlock();

    if (this.currentLevelId !== room.levelId) {
      this.loadLevelWorld(room.levelId);
    }

    this.exploreMode = false;
    this.levelBeforeExplore = null;
    this.onlineMode = true;
    this.onlineLocalPlayerId = localPlayerId;
    this.currentOnlineRound = room.roundNumber;
    this.matchSequenceId += 1;
    this.onlineSendAccum = 0;
    this.phase = 'playing';
    this.keysPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.playerSlapCooldown = 0;

    this.clearPreviewRig();
    this.clearActors();

    const localPlayer = room.players.find((p) => p.id === localPlayerId);
    this.selectedRole = localPlayer?.role ?? 'hider';
    if (localPlayer) {
      this.currentCustomization = { ...localPlayer.customization };
    }

    this.winner = null;
    this.pendingWinner = null;
    this.newlyUnlockedLevel = null;
    this.pendingEndTimer = 0;
    this.timeRemaining = room.timeRemaining;
    this.countdownTimer = room.countdownSeconds;
    this.lastCountdownCeil = Math.ceil(room.countdownSeconds);
    this.seekerMode = room.countdownSeconds > 0 ? 'counting' : 'searching';
    this.prevSeekerMode = this.seekerMode;
    this.spectateTargetId = null;
    this.spectateCameraMode = 'follow';
    this.freeCamVerticalInput = 0;
    this.cameraController?.exitFreeCamera();
    this.cameraController?.setFullScreenTouchLook(false);
    this.lastPlayerAnimState =
      this.selectedRole === 'seeker' && room.countdownSeconds > 0
        ? 'counting_eyes_closed'
        : 'idle';
    this.eventBanner = room.banner;
    this.eventBannerTimer = room.banner ? 3.2 : 0;

    const actors: ParticipantActor[] = [];
    let seekerActor: ParticipantActor | null = null;
    let playerActor: ParticipantActor | null = null;

    for (let i = 0; i < room.players.length; i++) {
      const p = room.players[i];
      const isLocal = p.id === localPlayerId;
      const rig = createCharacterFromCustomization(
        p.customization,
        p.role === 'seeker',
        this.textures.contactShadow,
      );
      rig.root.position.set(p.x, p.y ?? 0, p.z);
      rig.root.rotation.y = p.rotY;

      // Show player name above every character (both local & remote players)
      const nameplateSprite = this.createNameplateSprite(p.name, p.role);
      rig.root.add(nameplateSprite);

      if (p.caught) {
        rig.root.visible = false;
      }

      this.scene.add(rig.root);

      const actor: ParticipantActor = {
        id: p.id,
        name: p.name,
        role: p.role,
        isPlayer: isLocal,
        isRemote: !isLocal,
        rig,
        caught: p.caught,
        caughtAtSeconds: p.caughtAtSeconds,
        caughtAnimElapsed: p.caught ? CAUGHT_ANIM_DURATION : 0,
        isHiding: p.isHiding,
        lastMoveSpeed: p.moveSpeed,
        vy: 0,
        grounded: (p.y ?? 0) <= 0.05,
        radarSeed: (i + 1) * 1.73 + 0.5,
        targetSpotIndex: -1,
        waypoints: [],
        retargetCooldown: 0,
        remoteTargetX: p.x,
        remoteTargetY: p.y ?? 0,
        remoteTargetZ: p.z,
        remoteTargetRotY: p.rotY,
        remoteAnimState: p.animState,
        nameplateSprite,
      };

      actors.push(actor);
      if (p.role === 'seeker') seekerActor = actor;
      if (isLocal) playerActor = actor;
    }

    this.actors = actors;
    this.seekerActor = seekerActor;
    this.playerActor = playerActor ?? actors[0] ?? null;

    this.updateHouseRoofVisibility(null);

    if (this.playerActor) {
      const pos = this.playerActor.rig.root.position;
      _currentLook.set(pos.x, 1.1, pos.z);
      this.cameraController?.setEnabled(true);
      this.cameraController?.snapBehind(
        pos,
        this.playerActor.rig.root.rotation.y,
        this.camera,
      );
    }

    this.emitHud();
  }

  public syncOnlineRoom(
    room: MultiplayerRoomSnapshot,
    localPlayerId: string,
  ): void {
    this.onlineLocalPlayerId = localPlayerId;

    if (room.phase === 'lobby') {
      if (this.onlineMode || this.phase !== 'start') {
        this.onlineMode = false;
        this.currentOnlineRound = 0;
        this.phase = 'start';
        this.winner = null;
        this.pendingWinner = null;
        this.eventBanner = null;
        this.keysPressed.clear();
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
        this.freeCamVerticalInput = 0;
        this.spectateTargetId = null;
        this.spectateCameraMode = 'follow';
        this.cameraController?.exitFreeCamera();
        this.cameraController?.setFullScreenTouchLook(false);
        this.cameraController?.setEnabled(false);
        this.clearActors();
        this.updateHouseRoofVisibility(null);
      }
      if (this.currentLevelId !== room.levelId) {
        this.previewOnlineLobbyMap(room.levelId);
      } else if (!this.previewRig) {
        this.rebuildPreviewCharacter();
      }
      this.emitHud();
      return;
    }

    if (room.phase === 'playing') {
      const needsInit =
        !this.onlineMode ||
        this.phase !== 'playing' ||
        this.currentOnlineRound !== room.roundNumber ||
        this.currentLevelId !== room.levelId;

      if (needsInit) {
        this.setupOnlineMatch(room, localPlayerId);
        return;
      }

      this.timeRemaining = room.timeRemaining;
      this.countdownTimer = room.countdownSeconds;
      this.seekerMode = room.countdownSeconds > 0 ? 'counting' : 'searching';
      if (room.banner && room.banner !== this.eventBanner) {
        this.showBanner(room.banner, 3.0);
      }

      this.reconcileOnlineActors(room);
      this.emitHud();
      return;
    }

    if (room.phase === 'ended') {
      if (!this.onlineMode) {
        this.setupOnlineMatch(room, localPlayerId);
      } else {
        this.reconcileOnlineActors(room);
      }

      this.timeRemaining = room.timeRemaining;
      this.countdownTimer = 0;

      if (this.phase !== 'ended') {
        this.phase = 'ended';
        this.winner = room.winner;
        this.pendingWinner = null;
        this.eventBanner = null;
        this.spectateCameraMode = 'follow';
        this.freeCamVerticalInput = 0;
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
        this.cameraController?.exitFreeCamera();
        this.cameraController?.setFullScreenTouchLook(false);

        const playerWon =
          room.winner !== null &&
          ((room.winner === 'hiders' && this.selectedRole === 'hider') ||
            (room.winner === 'seekers' && this.selectedRole === 'seeker'));

        if (
          playerWon &&
          this.currentLevelId === this.unlockedLevel &&
          this.unlockedLevel < TOTAL_LEVELS
        ) {
          this.unlockedLevel = this.currentLevelId + 1;
          this.newlyUnlockedLevel = this.unlockedLevel;
          saveUnlockedLevel(this.unlockedLevel);
        } else {
          this.newlyUnlockedLevel = null;
        }

        this.audio.playMatchEnd(playerWon);
      }
      this.emitHud();
    }
  }

  private reconcileOnlineActors(room: MultiplayerRoomSnapshot): void {
    const incomingIds = new Set(room.players.map((p) => p.id));

    // Remove actors who disconnected mid-match
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const actor = this.actors[i];
      if (!incomingIds.has(actor.id)) {
        this.disposeSprite(actor.rig.root, actor.nameplateSprite);
        actor.nameplateSprite = null;
        this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
        actor.chatBubbleSprite = null;
        this.scene.remove(actor.rig.root);
        disposeCharacterRig(actor.rig);
        this.actors.splice(i, 1);
      }
    }

    // Update live caught / hiding state
    for (const p of room.players) {
      const actor = this.actors.find((a) => a.id === p.id);
      if (!actor) continue;

      if (!actor.caught && p.caught) {
        actor.caught = true;
        actor.isHiding = false;
        this.clearSeatedStateImmediate(actor);
        actor.handshakeTimer = 0;
        actor.handshakePartnerId = null;
        actor.caughtAtSeconds = p.caughtAtSeconds;
        actor.caughtAnimElapsed = 0.001;
        if (actor.rig.tagRing) {
          (actor.rig.tagRing.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        if (actor.nameplateSprite) {
          actor.nameplateSprite.visible = false;
        }
        if (this.seekerActor) {
          const sPos = this.seekerActor.rig.root.position;
          const hPos = actor.rig.root.position;
          actor.rig.root.rotation.y = Math.atan2(
            sPos.x - hPos.x,
            sPos.z - hPos.z,
          );
        }
        if (actor.isPlayer) {
          this.spectateTargetId = null;
          this.spectateCameraMode = 'follow';
          this.freeCamVerticalInput = 0;
          this.touchMoveX = 0;
          this.touchMoveZ = 0;
          this.cameraController?.exitFreeCamera();
        }
      } else if (actor.isRemote) {
        actor.isHiding = p.isHiding;
        actor.caughtAtSeconds = p.caughtAtSeconds;
      }
    }

    this.seekerActor = this.actors.find((a) => a.role === 'seeker') ?? null;
    if (this.onlineLocalPlayerId) {
      this.playerActor =
        this.actors.find((a) => a.id === this.onlineLocalPlayerId) ??
        this.playerActor;
    }
  }

  public applyOnlinePositions(
    positions: NonNullable<ServerToClientMessage['positions']>,
  ): void {
    if (!this.onlineMode || this.phase !== 'playing') return;
    for (const pos of positions) {
      const actor = this.actors.find((a) => a.id === pos.id);
      if (!actor || actor.isPlayer) continue;
      actor.remoteTargetX = pos.x;
      actor.remoteTargetY = pos.y ?? 0;
      actor.remoteTargetZ = pos.z;
      actor.remoteTargetRotY = pos.rotY;
      actor.lastMoveSpeed = pos.moveSpeed;
      actor.isHiding = pos.isHiding;
      if (actor.remoteAnimState !== pos.animState) {
        actor.remoteAnimState = pos.animState;
        actor.remoteAnimElapsed = 0;
      }
      actor.remoteExpression = pos.expression;
    }
  }

  public handleOnlineMatchEvent(event: ServerToClientMessage): void {
    if (!this.onlineMode) return;
    switch (event.eventKind) {
      case 'countdown_tick':
        this.audio.playCountdownTick(event.secondsLeft ?? 1);
        break;
      case 'seek_start':
        this.audio.playSeekStart();
        if (event.message) this.showBanner(event.message, 2.8);
        this.emitHud();
        break;
      case 'tag_caught':
        this.audio.playTagCaught();
        if (this.seekerActor) {
          this.seekerActor.tagLungeTimer = 0.48;
        }
        if (event.message) this.showBanner(event.message, 3.0);
        this.emitHud();
        break;
      case 'hider_slap': {
        const slapper = event.slapperPlayerId
          ? this.actors.find((a) => a.id === event.slapperPlayerId)
          : null;
        const target = event.targetPlayerId
          ? this.actors.find((a) => a.id === event.targetPlayerId)
          : null;
        if (slapper && target) {
          this.applyHiderSlapEffect(slapper, target, event.message);
        } else {
          this.audio.playHiderSlap();
          if (event.message) this.showBanner(event.message, 2.2);
          this.emitHud();
        }
        break;
      }
      case 'player_handshake': {
        const actorA = event.actorPlayerId
          ? this.actors.find((a) => a.id === event.actorPlayerId)
          : null;
        const actorB = event.targetPlayerId
          ? this.actors.find((a) => a.id === event.targetPlayerId)
          : null;
        if (actorA && actorB) {
          this.applyHandshakeEffect(actorA, actorB, event.message);
        } else {
          if (event.message) this.showBanner(event.message, 2.4);
          this.emitHud();
        }
        break;
      }
      case 'banner':
        if (event.message) this.showBanner(event.message, 3.0);
        this.emitHud();
        break;
      default:
        break;
    }
  }

  public exitOnlineMode(): void {
    this.onlineMode = false;
    this.onlineLocalPlayerId = null;
    this.currentOnlineRound = 0;
    if (!isLevelUnlocked(this.currentLevelId, this.unlockedLevel)) {
      this.loadLevelWorld(this.unlockedLevel);
    }
    this.returnToStart();
  }

  private emitOnlineLocalState(): void {
    if (
      !this.onlineMode ||
      !this.playerActor ||
      this.playerActor.caught ||
      !this.onOnlineLocalState
    ) {
      return;
    }
    const pos = this.playerActor.rig.root.position;
    this.onOnlineLocalState({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rotY: this.playerActor.rig.root.rotation.y,
      moveSpeed: this.playerActor.lastMoveSpeed,
      isHiding: this.playerActor.isHiding,
      animState: this.lastPlayerAnimState,
      expression: this.lastPlayerExpression,
    });
  }

  public setMutedPlayerIds(mutedIds: Set<string>): void {
    this.mutedPlayerIds = new Set(mutedIds);
    for (const actor of this.actors) {
      if (this.mutedPlayerIds.has(actor.id) && actor.chatBubbleSprite) {
        this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
        actor.chatBubbleSprite = null;
        actor.chatBubbleTimer = 0;
      }
    }
  }

  public showCharacterChatBubble(
    playerId: string,
    text: string,
    isEmote = false,
  ): void {
    if (this.mutedPlayerIds.has(playerId)) return;

    // Also display overhead speech bubble on the start/lobby preview character for the local player
    if (
      this.phase === 'start' &&
      this.previewRig &&
      (!this.onlineLocalPlayerId || playerId === this.onlineLocalPlayerId)
    ) {
      this.disposeSprite(this.previewRig.root, this.previewChatBubble);
      this.previewChatBubble = this.createChatBubbleSprite(text, isEmote);
      this.previewRig.root.add(this.previewChatBubble);
      this.previewChatBubbleTimer = 4.5;
      return;
    }

    const actor = this.actors.find((a) => a.id === playerId);
    if (!actor || actor.caught) return;
    this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
    const bubble = this.createChatBubbleSprite(text, isEmote);
    actor.rig.root.add(bubble);
    actor.chatBubbleSprite = bubble;
    actor.chatBubbleTimer = 4.5;
  }

  public triggerLocalEmote(emote: EmoteType, bubbleText: string): void {
    if (this.phase === 'playing' && this.playerActor && !this.playerActor.caught) {
      this.audio.unlock();
      this.triggerCharacterEmote(this.playerActor.id, emote, bubbleText);
    } else if (this.phase === 'start') {
      this.audio.unlock();
      this.triggerCharacterEmote(
        this.onlineLocalPlayerId ?? 'player',
        emote,
        bubbleText,
      );
    }
  }

  public triggerCharacterEmote(
    playerId: string,
    emote: EmoteType,
    bubbleText: string,
  ): void {
    if (this.mutedPlayerIds.has(playerId)) return;

    if (
      this.phase === 'start' &&
      this.previewRig &&
      (!this.onlineLocalPlayerId || playerId === this.onlineLocalPlayerId)
    ) {
      this.previewEmote = emote;
      this.previewEmoteTimer = 3.2;
      this.showCharacterChatBubble(playerId, bubbleText, true);
      return;
    }

    const actor = this.actors.find((a) => a.id === playerId);
    if (!actor || actor.caught) return;

    actor.activeEmote = emote;
    actor.emoteTimer = 3.2;
    this.showCharacterChatBubble(playerId, bubbleText, true);

    if (actor.isPlayer && this.onlineMode) {
      this.lastPlayerAnimState = emoteToAnimState(emote);
      this.emitOnlineLocalState();
    }
  }

  private updateNameplatesAndChatBubbles(dt: number): void {
    const localSeekerPos =
      this.playerActor?.role === 'seeker'
        ? this.playerActor.rig.root.position
        : null;

    for (const actor of this.actors) {
      // Tick active emote timer
      if (actor.emoteTimer && actor.emoteTimer > 0) {
        actor.emoteTimer = Math.max(0, actor.emoteTimer - dt);
        if (actor.emoteTimer === 0) {
          actor.activeEmote = null;
        }
      }

      // Fair floating 3D nameplate visibility across both solo & online modes
      if (actor.nameplateSprite) {
        if (actor.caught) {
          actor.nameplateSprite.visible = false;
        } else if (!actor.isPlayer && localSeekerPos && actor.role === 'hider') {
          const pos = actor.rig.root.position;
          const dist = localSeekerPos.distanceTo(pos);
          const canSee =
            this.hasLineOfSight(localSeekerPos, pos) &&
            (!actor.isHiding || dist <= 6.2);
          actor.nameplateSprite.visible = canSee;
        } else if (
          this.isActivelySpectating() &&
          this.spectateCameraMode === 'free' &&
          actor.role === 'hider'
        ) {
          // Prevent X-ray nameplate leaks through walls while flying Free Camera
          const pos = actor.rig.root.position;
          const dist = this.camera.position.distanceTo(pos);
          actor.nameplateSprite.visible =
            dist <= 15.0 && this.hasLineOfSight(this.camera.position, pos);
        } else {
          actor.nameplateSprite.visible = true;
        }
      }

      // Tick and fade overhead 3D speech bubbles
      if (actor.chatBubbleSprite) {
        if (this.mutedPlayerIds.has(actor.id) || actor.caught) {
          this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
          actor.chatBubbleSprite = null;
          actor.chatBubbleTimer = 0;
          continue;
        }

        const nextTimer = Math.max(0, (actor.chatBubbleTimer ?? 0) - dt);
        actor.chatBubbleTimer = nextTimer;
        if (nextTimer <= 0) {
          this.disposeSprite(actor.rig.root, actor.chatBubbleSprite);
          actor.chatBubbleSprite = null;
          continue;
        }

        const mat = actor.chatBubbleSprite.material;
        mat.opacity = nextTimer < 0.7 ? Math.max(0, nextTimer / 0.7) : 1;

        // Keep hiding fair for Seeker while allowing nearby taunts within 10m or LOS
        if (!actor.isPlayer && localSeekerPos && actor.role === 'hider') {
          const pos = actor.rig.root.position;
          const dist = localSeekerPos.distanceTo(pos);
          actor.chatBubbleSprite.visible =
            this.hasLineOfSight(localSeekerPos, pos) || dist <= 10.5;
        } else {
          actor.chatBubbleSprite.visible = true;
        }
      }
    }
  }

  private updateRemotePlayers(dt: number): void {
    for (const actor of this.actors) {
      if (!actor.isRemote || actor.caught) continue;

      const pos = actor.rig.root.position;
      const targetX = actor.remoteTargetX ?? pos.x;
      const targetY = actor.remoteTargetY ?? 0;
      const targetZ = actor.remoteTargetZ ?? pos.z;
      const distJump = Math.hypot(targetX - pos.x, targetZ - pos.z);

      if (distJump > 10) {
        pos.x = targetX;
        pos.y = targetY;
        pos.z = targetZ;
      } else {
        pos.x = THREE.MathUtils.damp(pos.x, targetX, 14, dt);
        pos.y = THREE.MathUtils.damp(pos.y, targetY, 18, dt);
        pos.z = THREE.MathUtils.damp(pos.z, targetZ, 14, dt);
      }

      if (actor.remoteTargetRotY !== undefined) {
        const curYaw = actor.rig.root.rotation.y;
        let diff = actor.remoteTargetRotY - curYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.rig.root.rotation.y = curYaw + diff * (1 - Math.exp(-14 * dt));
      }

      // Cancel emote visually if remote player starts moving briskly
      if (actor.lastMoveSpeed > 0.35 && actor.activeEmote) {
        actor.activeEmote = null;
        actor.emoteTimer = 0;
      }

      if (actor.tagLungeTimer && actor.tagLungeTimer > 0) {
        actor.tagLungeTimer = Math.max(0, actor.tagLungeTimer - dt);
      }
      if (actor.slapFlinchTimer && actor.slapFlinchTimer > 0) {
        actor.slapFlinchTimer = Math.max(0, actor.slapFlinchTimer - dt);
      }
      if (actor.handshakeTimer && actor.handshakeTimer > 0) {
        actor.handshakeTimer = Math.max(0, actor.handshakeTimer - dt);
        if (actor.handshakeTimer === 0) {
          actor.handshakePartnerId = null;
        }
      }
      if (actor.expressionOverrideTimer && actor.expressionOverrideTimer > 0) {
        actor.expressionOverrideTimer = Math.max(
          0,
          actor.expressionOverrideTimer - dt,
        );
        if (actor.expressionOverrideTimer === 0) {
          actor.expressionOverride = null;
        }
      }
      actor.remoteAnimElapsed = (actor.remoteAnimElapsed ?? 0) + dt;

      const animState: CharacterAnimState =
        actor.tagLungeTimer && actor.tagLungeTimer > 0
          ? 'tag_lunge'
          : actor.handshakeTimer && actor.handshakeTimer > 0
            ? 'handshake'
            : actor.role === 'seeker' &&
                this.countdownTimer > 0 &&
                actor.lastMoveSpeed <= 0.15
              ? (actor.remoteAnimState ?? 'counting_eyes_closed')
              : actor.activeEmote && actor.emoteTimer && actor.emoteTimer > 0
                ? emoteToAnimState(actor.activeEmote)
                : (actor.remoteAnimState ??
                  this.resolveMovementAnimState(
                    pos,
                    actor.lastMoveSpeed,
                    actor.isHiding,
                  ));

      let interactionProgress = 0;
      if (animState === 'handshake') {
        interactionProgress =
          actor.handshakeTimer && actor.handshakeTimer > 0
            ? 1 - actor.handshakeTimer / HANDSHAKE_DURATION
            : Math.min(1, (actor.remoteAnimElapsed ?? 0) / HANDSHAKE_DURATION);
      } else if (animState === 'sit_down') {
        interactionProgress = Math.min(
          1,
          (actor.remoteAnimElapsed ?? 0) / SIT_DOWN_DURATION,
        );
      } else if (animState === 'stand_up') {
        interactionProgress = Math.min(
          1,
          (actor.remoteAnimElapsed ?? 0) / STAND_UP_DURATION,
        );
      }

      const gaze = this.computeConversationLook(actor);
      const expr =
        actor.remoteExpression ??
        this.resolveActorFacialExpression(actor, animState);

      actor.rig.updateAnimation({
        dt,
        moveSpeed: actor.lastMoveSpeed,
        state: animState,
        lookAroundPhase: 0,
        expression: expr,
        eyeLookX: gaze.eyeLookX,
        eyeLookY: gaze.eyeLookY,
        headLookYaw: gaze.headLookYaw,
        headLookPitch: gaze.headLookPitch,
        isConversing: gaze.isConversing,
        isSpeaking: gaze.isSpeaking,
        interactionProgress,
        airHeight: animState === 'jump' ? Math.max(0, pos.y) : 0,
      });
    }
  }

  public restartMatch(): void {
    this.startMatch(this.selectedRole, this.currentCustomization);
  }

  public returnToStart(): void {
    const restoreLevel = this.exploreMode ? this.levelBeforeExplore : null;
    this.exploreMode = false;
    this.levelBeforeExplore = null;
    this.phase = 'start';
    this.keysPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.freeCamVerticalInput = 0;
    this.spectateTargetId = null;
    this.spectateCameraMode = 'follow';
    this.cameraController?.exitFreeCamera();
    this.cameraController?.setFullScreenTouchLook(false);
    this.cameraController?.setEnabled(false);
    this.clearActors();
    this.updateHouseRoofVisibility(null);
    if (restoreLevel !== null && restoreLevel !== this.currentLevelId) {
      this.loadLevelWorld(restoreLevel);
    }
    this.rebuildPreviewCharacter();
    this.emitHud();
  }

  public recenterCamera(): void {
    if (this.phase === 'start') return;
    if (this.isActivelySpectating() && this.spectateCameraMode === 'free') {
      this.setSpectateCameraMode('follow');
      return;
    }
    const focusActor = this.getCameraFocusActor();
    if (!focusActor) return;
    this.cameraController?.recenterBehind(focusActor.rig.root.rotation.y);
  }

  public updateCameraSettings(partial: Partial<CameraSettings>): void {
    this.cameraController?.updateSettings(partial);
    this.emitHud();
  }

  public resetCameraSettings(): void {
    const focusActor = this.getCameraFocusActor();
    this.cameraController?.resetSettings(
      focusActor ? focusActor.rig.root.rotation.y : undefined,
    );
    this.emitHud();
  }

  public setMinimapListener(
    listener: ((frame: MinimapFrame) => void) | null,
  ): void {
    this.minimapListener = listener;
    if (listener && this.phase === 'playing') {
      this.emitMinimapFrame();
    }
  }

  private emitMinimapFrame(): void {
    if (!this.minimapListener || this.phase !== 'playing') return;
    const isSpectating = this.isActivelySpectating();
    const isFreeCam = isSpectating && this.spectateCameraMode === 'free';
    const focusActor = this.getCameraFocusActor();
    if (!isFreeCam && !focusActor) return;

    let centerX: number;
    let centerZ: number;
    let headingYaw: number;
    const camYaw = this.cameraController?.getCameraYaw() ?? 0;

    if (isFreeCam && this.cameraController) {
      this.cameraController.getFreeCameraPosition(_freeCamPos);
      centerX = _freeCamPos.x;
      centerZ = _freeCamPos.z;
      // Forward heading matches camera look direction (-sin(camYaw), -cos(camYaw)) -> yaw = camYaw + PI
      headingYaw = camYaw + Math.PI;
    } else {
      const focusPos = focusActor!.rig.root.position;
      centerX = focusPos.x;
      centerZ = focusPos.z;
      headingYaw = focusActor!.rig.root.rotation.y;
    }

    const others: MinimapActorDot[] = [];

    for (const actor of this.actors) {
      if (!isFreeCam && actor === focusActor) continue;
      if (actor.role === 'hider' && actor.caught) continue;
      // Fair-play protection: spectators never get radar dots for hidden hiders on the minimap
      // (only the Seeker's approximate zone is shown so spectators cannot call out hiding spots).
      if (isSpectating && actor.role === 'hider') continue;

      const pos = actor.rig.root.position;
      // Smoothly drifting approximate offset so the minimap shows each other player's
      // approximate neighborhood without exposing pinpoint exact hiding spots.
      const driftAngle = actor.radarSeed + this.elapsed * 0.18;
      const offsetDist = actor.isHiding ? 2.85 : 1.95;
      const approxRadius =
        actor.role === 'seeker' ? 3.8 : actor.isHiding ? 4.6 : 3.6;

      others.push({
        id: actor.id,
        role: actor.role,
        approxX: pos.x + Math.cos(driftAngle) * offsetDist,
        approxZ: pos.z + Math.sin(driftAngle) * offsetDist,
        approxRadius,
      });
    }

    this.minimapListener({
      playerX: centerX,
      playerZ: centerZ,
      playerYaw: headingYaw,
      cameraYaw: camYaw,
      playerRole: this.selectedRole,
      isSpectating,
      layout: this.activeMinimapLayout,
      others,
    });
  }

  public toggleHide(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      this.playerActor.caught
    ) {
      return;
    }
    this.audio.unlock();
    if (this.playerActor.sitPhase && this.playerActor.sitPhase !== 'none') {
      this.clearSeatedStateImmediate(this.playerActor);
    }
    if (this.playerActor.handshakeTimer && this.playerActor.handshakeTimer > 0) {
      this.playerActor.handshakeTimer = 0;
      this.playerActor.handshakePartnerId = null;
    }
    this.playerActor.isHiding = !this.playerActor.isHiding;
    this.audio.playHide(this.playerActor.isHiding);
    if (this.onlineMode) {
      this.emitOnlineLocalState();
    }
    this.emitHud();
  }

  public triggerJump(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.caught ||
      (this.playerActor.role === 'seeker' && this.countdownTimer > 0)
    ) {
      return;
    }
    if (this.playerActor.sitPhase && this.playerActor.sitPhase !== 'none') {
      this.clearSeatedStateImmediate(this.playerActor);
    }
    if (this.playerActor.handshakeTimer && this.playerActor.handshakeTimer > 0) {
      this.playerActor.handshakeTimer = 0;
      this.playerActor.handshakePartnerId = null;
    }
    if (!this.playerActor.grounded) return;
    this.audio.unlock();
    if (this.playerActor.isHiding) {
      this.playerActor.isHiding = false;
    }
    if (this.playerActor.activeEmote) {
      this.playerActor.activeEmote = null;
      this.playerActor.emoteTimer = 0;
    }
    this.playerActor.vy = JUMP_VELOCITY;
    this.playerActor.grounded = false;
    if (this.onlineMode) {
      this.lastPlayerAnimState = 'jump';
      this.emitOnlineLocalState();
    }
  }

  public tryTag(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'seeker' ||
      this.countdownTimer > 0 ||
      this.pendingWinner !== null
    ) {
      return;
    }
    this.audio.unlock();
    if (this.playerActor.sitPhase && this.playerActor.sitPhase !== 'none') {
      this.clearSeatedStateImmediate(this.playerActor);
    }
    const target = this.findNearestTagTarget();
    if (target) {
      if (this.onlineMode) {
        if (this.seekerActor) {
          this.seekerActor.tagLungeTimer = 0.48;
          const sPos = this.seekerActor.rig.root.position;
          const hPos = target.rig.root.position;
          this.seekerActor.rig.root.rotation.y = Math.atan2(
            hPos.x - sPos.x,
            hPos.z - sPos.z,
          );
        }
        this.onOnlineTagRequest?.(target.id);
      } else {
        this.catchHider(target);
      }
    }
  }

  private findNearestSlapTarget(): ParticipantActor | null {
    if (
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      this.playerActor.caught
    ) {
      return null;
    }
    const playerPos = this.playerActor.rig.root.position;
    let best: ParticipantActor | null = null;
    let bestDist = SLAP_RANGE;

    for (const hider of this.getActiveHiders()) {
      if (hider.id === this.playerActor.id) continue;
      const hPos = hider.rig.root.position;
      const d = playerPos.distanceTo(hPos);
      if (d <= bestDist && this.canSeeForTag(playerPos, hPos)) {
        bestDist = d;
        best = hider;
      }
    }
    return best;
  }

  public trySlapHider(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      this.playerActor.caught ||
      this.pendingWinner !== null ||
      this.playerSlapCooldown > 0
    ) {
      return;
    }
    this.audio.unlock();
    const target = this.findNearestSlapTarget();
    if (!target) return;

    this.playerSlapCooldown = HIDER_SLAP_COOLDOWN;
    if (this.playerActor.isHiding) {
      this.playerActor.isHiding = false;
    }
    this.playerActor.tagLungeTimer = 0.36;

    const pPos = this.playerActor.rig.root.position;
    const tPos = target.rig.root.position;
    this.playerActor.rig.root.rotation.y = Math.atan2(
      tPos.x - pPos.x,
      tPos.z - pPos.z,
    );

    if (this.onlineMode) {
      this.onOnlineSlapRequest?.(target.id);
    } else {
      this.applyHiderSlapEffect(this.playerActor, target);
    }
    this.emitHud();
  }

  private applyHiderSlapEffect(
    slapper: ParticipantActor,
    target: ParticipantActor,
    customMessage?: string,
  ): void {
    if (target.caught) return;
    this.audio.playHiderSlap();

    slapper.tagLungeTimer = 0.36;
    const sPos = slapper.rig.root.position;
    const tPos = target.rig.root.position;
    const dx = tPos.x - sPos.x;
    const dz = tPos.z - sPos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    slapper.rig.root.rotation.y = Math.atan2(dx, dz);
    target.rig.root.rotation.y = Math.atan2(-dx, -dz);
    this.clearSeatedStateImmediate(slapper);
    this.clearSeatedStateImmediate(target);
    slapper.handshakeTimer = 0;
    target.handshakeTimer = 0;
    target.isHiding = false;
    target.slapFlinchTimer = 0.72;
    target.expressionOverride = 'surprise';
    target.expressionOverrideTimer = 1.1;
    target.slapKnockVx = nx * 4.4;
    target.slapKnockVz = nz * 4.4;

    if (target.grounded) {
      target.vy = 2.6;
      target.grounded = false;
    }

    const reactions = ['Ouch! 👋', 'Arre! 👋', 'Hey! 👋', 'Oye! 👋'];
    const bubble =
      reactions[Math.floor(Math.random() * reactions.length)] ?? 'Ouch! 👋';
    this.showCharacterChatBubble(target.id, bubble, true);

    const bannerText =
      customMessage ?? `${slapper.name} playfully slapped ${target.name}!`;
    this.showBanner(bannerText, 2.2);
    this.emitHud();
  }

  private findNearestHandshakeTarget(
    maxRange = HANDSHAKE_RANGE,
  ): ParticipantActor | null {
    if (
      !this.playerActor ||
      this.playerActor.caught ||
      this.phase !== 'playing'
    ) {
      return null;
    }
    const pPos = this.playerActor.rig.root.position;
    let best: ParticipantActor | null = null;
    let bestDistSq = maxRange * maxRange;

    for (const candidate of this.actors) {
      if (
        candidate === this.playerActor ||
        candidate.caught ||
        candidate.role !== this.playerActor.role
      ) {
        continue;
      }
      const cPos = candidate.rig.root.position;
      const dx = cPos.x - pPos.x;
      const dz = cPos.z - pPos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        best = candidate;
      }
    }
    return best;
  }

  public tryHandshake(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.caught ||
      this.pendingWinner !== null ||
      (this.countdownTimer > 0 && this.playerActor.role === 'seeker') ||
      this.playerHandshakeCooldown > 0
    ) {
      return;
    }

    const target = this.findNearestHandshakeTarget(HANDSHAKE_RANGE);
    if (!target) return;

    this.audio.unlock();
    this.playerHandshakeCooldown = HANDSHAKE_COOLDOWN;

    if (this.onlineMode) {
      this.onOnlineHandshakeRequest?.(target.id);
    } else {
      this.applyHandshakeEffect(this.playerActor, target);
    }
  }

  private applyHandshakeEffect(
    actorA: ParticipantActor,
    actorB: ParticipantActor,
    customMessage?: string,
  ): void {
    if (actorA.caught || actorB.caught) return;

    this.clearSeatedStateImmediate(actorA);
    this.clearSeatedStateImmediate(actorB);

    actorA.isHiding = false;
    actorB.isHiding = false;
    actorA.activeEmote = null;
    actorA.emoteTimer = 0;
    actorB.activeEmote = null;
    actorB.emoteTimer = 0;

    const posA = actorA.rig.root.position;
    const posB = actorB.rig.root.position;
    const dx = posB.x - posA.x;
    const dz = posB.z - posA.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist;
    const nz = dz / dist;

    // Face each other naturally for the handshake
    actorA.rig.root.rotation.y = Math.atan2(dx, dz);
    actorB.rig.root.rotation.y = Math.atan2(-dx, -dz);

    // Gently step slightly closer if standing far apart (~1.05m ideal hand clasp distance)
    if (dist > 1.35 && !actorA.isRemote && !actorB.isRemote) {
      const pull = Math.min(0.45, (dist - 1.05) * 0.45);
      posA.x += nx * pull;
      posA.z += nz * pull;
      posB.x -= nx * pull;
      posB.z -= nz * pull;
      this.resolveCollisions(posA, CHAR_RADIUS);
      this.resolveCollisions(posB, CHAR_RADIUS);
    }

    actorA.handshakeTimer = HANDSHAKE_DURATION;
    actorB.handshakeTimer = HANDSHAKE_DURATION;
    actorA.handshakePartnerId = actorB.id;
    actorB.handshakePartnerId = actorA.id;
    actorA.expressionOverride = 'laughing';
    actorA.expressionOverrideTimer = HANDSHAKE_DURATION + 0.35;
    actorB.expressionOverride = 'laughing';
    actorB.expressionOverrideTimer = HANDSHAKE_DURATION + 0.35;

    this.audio.playHide(false);

    const greetings = ['🤝 Namaste!', '🤝 Dost!', '🤝 Hello ji!', '🤝 Milte hain!'];
    const bubbleA =
      greetings[Math.floor(Math.random() * greetings.length)] ?? '🤝 Namaste!';
    const bubbleB =
      greetings[(Math.floor(Math.random() * greetings.length) + 1) % greetings.length] ??
      '🤝 Dost!';
    this.showCharacterChatBubble(actorA.id, bubbleA, true);
    this.showCharacterChatBubble(actorB.id, bubbleB, true);

    if (this.onlineMode && (actorA.isPlayer || actorB.isPlayer)) {
      this.lastPlayerAnimState = 'handshake';
      this.lastPlayerExpression = 'laughing';
      this.emitOnlineLocalState();
    }

    const bannerText =
      customMessage ?? `🤝 ${actorA.name} and ${actorB.name} shook hands!`;
    this.showBanner(bannerText, 2.3);
    this.emitHud();
  }

  private getAllAvailableSeats(): SeatSpot[] {
    const ambient = this.activeNpcSystem?.getAvailableSeats() ?? [];
    if (ambient.length === 0) return this.mapSeats;
    if (this.mapSeats.length === 0) return ambient;
    return [...this.mapSeats, ...ambient];
  }

  private isSeatOccupied(seat: SeatSpot, ignoreActorId?: string): boolean {
    if (this.activeNpcSystem?.isSpotOccupiedByNpc(seat.x, seat.z, 0.52)) {
      return true;
    }
    for (const a of this.actors) {
      if (a.id === ignoreActorId || a.caught) continue;
      if (a.activeSeat?.id === seat.id) return true;
      const dx = a.rig.root.position.x - seat.x;
      const dz = a.rig.root.position.z - seat.z;
      if (dx * dx + dz * dz < 0.32) return true;
    }
    return false;
  }

  private findNearestAvailableSeat(maxRange = SIT_RANGE): SeatSpot | null {
    if (
      !this.playerActor ||
      this.playerActor.caught ||
      this.phase !== 'playing'
    ) {
      return null;
    }
    const pPos = this.playerActor.rig.root.position;
    const seats = this.getAllAvailableSeats();
    let best: SeatSpot | null = null;
    let bestDistSq = maxRange * maxRange;

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const dx = seat.x - pPos.x;
      const dz = seat.z - pPos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > bestDistSq) continue;
      if (this.isSeatOccupied(seat, this.playerActor.id)) continue;
      bestDistSq = dSq;
      best = seat;
    }
    return best;
  }

  private clearSeatedStateImmediate(actor: ParticipantActor): void {
    if (!actor.sitPhase || actor.sitPhase === 'none') return;
    const seat = actor.activeSeat;
    const pre = actor.preSitPos;
    actor.sitPhase = 'none';
    actor.sitTimer = 0;
    actor.activeSeat = null;
    actor.preSitPos = null;

    const pos = actor.rig.root.position;
    if (pre) {
      pos.x = pre.x;
      pos.z = pre.z;
    } else if (seat) {
      pos.x = seat.x + Math.sin(seat.rotY) * 0.85;
      pos.z = seat.z + Math.cos(seat.rotY) * 0.85;
    }
    pos.y = 0;
    this.resolveCollisions(pos, CHAR_RADIUS);
  }

  private beginStandUp(actor: ParticipantActor): void {
    if (!actor.sitPhase || actor.sitPhase === 'none' || actor.sitPhase === 'stand_up') {
      return;
    }
    actor.sitPhase = 'stand_up';
    actor.sitTimer = 0;
    if (actor.isPlayer && this.onlineMode) {
      this.lastPlayerAnimState = 'stand_up';
      this.emitOnlineLocalState();
    }
    this.emitHud();
  }

  public tryToggleSit(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.caught ||
      this.pendingWinner !== null ||
      (this.countdownTimer > 0 && this.playerActor.role === 'seeker')
    ) {
      return;
    }

    this.audio.unlock();
    const actor = this.playerActor;

    if (actor.sitPhase === 'sitting' || actor.sitPhase === 'sit_down') {
      this.beginStandUp(actor);
      return;
    }
    if (actor.sitPhase === 'stand_up') return;

    const seat = this.findNearestAvailableSeat(SIT_RANGE);
    if (!seat) return;

    actor.isHiding = false;
    actor.activeEmote = null;
    actor.emoteTimer = 0;
    actor.handshakeTimer = 0;
    actor.handshakePartnerId = null;

    const pos = actor.rig.root.position;
    actor.preSitPos = { x: pos.x, z: pos.z };
    actor.activeSeat = seat;
    actor.sitPhase = 'sit_down';
    actor.sitTimer = 0;
    actor.vy = 0;
    actor.grounded = true;
    actor.lastMoveSpeed = 0;

    if (this.onlineMode) {
      this.lastPlayerAnimState = 'sit_down';
      this.emitOnlineLocalState();
    }
    this.emitHud();
  }

  private computeConversationLook(actor: ParticipantActor): {
    headLookYaw: number;
    headLookPitch: number;
    eyeLookX: number;
    eyeLookY: number;
    isConversing: boolean;
    isSpeaking: boolean;
  } {
    const isSpeaking = (actor.chatBubbleTimer ?? 0) > 0;
    const pos = actor.rig.root.position;
    const isSeated =
      actor.sitPhase === 'sitting' ||
      actor.remoteAnimState === 'sitting';
    const myEyeY = pos.y + (isSeated ? 1.15 : 1.48);

    let targetX: number | null = null;
    let targetY = myEyeY;
    let targetZ: number | null = null;
    let strongConv = isSpeaking;

    // 1. Active handshake partner takes highest gaze priority
    if (actor.handshakePartnerId && (actor.handshakeTimer ?? 0) > 0) {
      const partner = this.actors.find(
        (a) => a.id === actor.handshakePartnerId && !a.caught,
      );
      if (partner) {
        const pPos = partner.rig.root.position;
        targetX = pPos.x;
        targetY = pPos.y + 1.48;
        targetZ = pPos.z;
        strongConv = true;
      }
    }

    // 2. Nearby friendly/chatting players within conversation distance (5.5m)
    if (targetX === null) {
      let bestScore = Infinity;
      for (const other of this.actors) {
        if (other === actor || other.caught) continue;
        const oPos = other.rig.root.position;
        const dx = oPos.x - pos.x;
        const dz = oPos.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 5.5 || dist < 0.25) continue;

        const otherSpeaking = (other.chatBubbleTimer ?? 0) > 0;
        const isFriendly = other.role === actor.role;
        // Prioritize speaking partners & friendly teammates
        const score = dist - (otherSpeaking ? 2.5 : 0) - (isFriendly ? 0.6 : 0);
        if (score < bestScore) {
          bestScore = score;
          targetX = oPos.x;
          const otherSeated =
            other.sitPhase === 'sitting' || other.remoteAnimState === 'sitting';
          targetY = oPos.y + (otherSeated ? 1.15 : 1.48);
          targetZ = oPos.z;
          if (otherSpeaking || dist < 3.6) {
            strongConv = true;
          }
        }
      }
    }

    // 3. When seated or standing idle, gently look toward nearby villagers/NPCs
    if (
      targetX === null &&
      actor.lastMoveSpeed <= 0.2 &&
      this.activeNpcSystem
    ) {
      const npcHead = this.activeNpcSystem.getNearestHumanNpcHead(
        pos.x,
        pos.z,
        3.8,
      );
      if (npcHead) {
        targetX = npcHead.x;
        targetY = npcHead.y;
        targetZ = npcHead.z;
        strongConv = true;
      }
    }

    if (targetX === null || targetZ === null) {
      return {
        headLookYaw: 0,
        headLookPitch: 0,
        eyeLookX: 0,
        eyeLookY: 0,
        isConversing: isSpeaking,
        isSpeaking,
      };
    }

    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const horizDist = Math.hypot(dx, dz) || 0.01;
    const worldAngle = Math.atan2(dx, dz);
    let relYaw = worldAngle - actor.rig.root.rotation.y;
    while (relYaw > Math.PI) relYaw -= Math.PI * 2;
    while (relYaw < -Math.PI) relYaw += Math.PI * 2;

    // Only turn head/eyes if partner is within natural front/side field of view
    if (Math.abs(relYaw) > Math.PI * 0.72) {
      return {
        headLookYaw: 0,
        headLookPitch: 0,
        eyeLookX: 0,
        eyeLookY: 0,
        isConversing: isSpeaking,
        isSpeaking,
      };
    }

    const relPitch = THREE.MathUtils.clamp(
      -Math.atan2(targetY - myEyeY, horizDist),
      -0.32,
      0.32,
    );
    const headLookYaw = THREE.MathUtils.clamp(relYaw * 0.72, -0.66, 0.66);
    const headLookPitch = THREE.MathUtils.clamp(relPitch * 0.75, -0.28, 0.28);
    const eyeLookX = THREE.MathUtils.clamp(
      (relYaw - headLookYaw) * 0.85 + relYaw * 0.14,
      -0.32,
      0.32,
    );
    const eyeLookY = THREE.MathUtils.clamp(relPitch * 0.45, -0.18, 0.18);

    return {
      headLookYaw,
      headLookPitch,
      eyeLookX,
      eyeLookY,
      isConversing: strongConv,
      isSpeaking,
    };
  }

  private findNearestTempleBell(maxRange = 4.6): TempleBellInteractive | null {
    if (!this.playerActor || this.templeBells.length === 0) return null;
    const pPos = this.playerActor.rig.root.position;
    let best: TempleBellInteractive | null = null;
    let bestDistSq = maxRange * maxRange;

    for (let i = 0; i < this.templeBells.length; i++) {
      const bell = this.templeBells[i];
      const dx = bell.worldX - pPos.x;
      const dz = bell.worldZ - pPos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        best = bell;
      }
    }
    return best;
  }

  public tryRingTempleBell(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.caught ||
      this.pendingWinner !== null ||
      (this.countdownTimer > 0 && this.playerActor.role === 'seeker') ||
      this.templeBellCooldown > 0
    ) {
      return;
    }

    const bell = this.findNearestTempleBell(4.6);
    if (!bell) return;

    this.audio.unlock();
    if (this.playerActor.sitPhase && this.playerActor.sitPhase !== 'none') {
      this.clearSeatedStateImmediate(this.playerActor);
    }
    if (bell.label === 'School Bell') {
      this.audio.playSchoolBellRing();
    } else {
      this.audio.playTempleBellRing();
    }
    this.templeBellCooldown = 0.7;

    bell.swingDir *= -1;
    bell.swingVel = 5.4 * bell.swingDir;
    bell.waveProgress = 0.001;
    bell.ringWave.visible = true;

    if (this.playerActor.isHiding) {
      this.playerActor.isHiding = false;
    }
    this.playerActor.tagLungeTimer = 0.36;

    const pPos = this.playerActor.rig.root.position;
    this.playerActor.rig.root.rotation.y = Math.atan2(
      bell.worldX - pPos.x,
      bell.worldZ - pPos.z,
    );

    this.showBanner(
      bell.label === 'School Bell'
        ? '🔔 School Bell rung!'
        : '🔔 Mandir Ghanta rung!',
      2.0,
    );
    this.emitHud();
  }

  public trySlapNpc(): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.caught ||
      this.pendingWinner !== null ||
      (this.countdownTimer > 0 && this.playerActor.role === 'seeker') ||
      this.npcSlapCooldown > 0 ||
      !this.activeNpcSystem
    ) {
      return;
    }

    const pPos = this.playerActor.rig.root.position;
    const target = this.activeNpcSystem.findNearestSlappableHuman(
      pPos.x,
      pPos.z,
      2.9,
    );
    if (!target) return;

    this.audio.unlock();
    this.audio.playHiderSlap();
    this.npcSlapCooldown = 0.85;

    if (this.playerActor.isHiding) {
      this.playerActor.isHiding = false;
    }
    this.playerActor.tagLungeTimer = 0.36;
    this.playerActor.rig.root.rotation.y = Math.atan2(
      target.x - pPos.x,
      target.z - pPos.z,
    );

    const result = this.activeNpcSystem.slapHumanNpc(
      target.id,
      pPos.x,
      pPos.z,
    );
    this.showBanner(
      result ? `👋 Slapped ${result.label}!` : '👋 Slapped Villager!',
      1.7,
    );
    this.emitHud();
  }

  public setTouchInput(x: number, y: number): void {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveZ = THREE.MathUtils.clamp(y, -1, 1);
  }

  private showBanner(message: string, duration = 2.8): void {
    this.eventBanner = message;
    this.eventBannerTimer = duration;
  }

  private getActiveHiders(): ParticipantActor[] {
    return this.actors.filter((a) => a.role === 'hider' && !a.caught);
  }

  private canSeeForTag(seekerPos: THREE.Vector3, hiderPos: THREE.Vector3): boolean {
    if (this.hasLineOfSight(seekerPos, hiderPos)) return true;
    const seekerHouse = this.findHouseContaining(seekerPos.x, seekerPos.z, seekerPos.y);
    const hiderHouse = this.findHouseContaining(hiderPos.x, hiderPos.z, hiderPos.y);
    return (
      seekerHouse !== null &&
      seekerHouse === hiderHouse &&
      seekerPos.distanceTo(hiderPos) <= 2.2
    );
  }

  private findNearestTagTarget(): ParticipantActor | null {
    if (!this.seekerActor) return null;
    const seekerPos = this.seekerActor.rig.root.position;
    let best: ParticipantActor | null = null;
    let bestDist = TAG_RANGE;

    for (const hider of this.getActiveHiders()) {
      const hPos = hider.rig.root.position;
      const d = seekerPos.distanceTo(hPos);
      if (d <= bestDist && this.canSeeForTag(seekerPos, hPos)) {
        bestDist = d;
        best = hider;
      }
    }
    return best;
  }

  private catchHider(hider: ParticipantActor): void {
    if (hider.caught || this.phase !== 'playing' || !this.seekerActor) return;

    hider.caught = true;
    hider.isHiding = false;
    hider.caughtAtSeconds = Math.max(0, Math.ceil(this.timeRemaining));
    hider.caughtAnimElapsed = 0.001; // Trigger funny caught animation visibly before retiring!
    this.seekerActor.tagLungeTimer = 0.48;
    this.audio.playTagCaught();
    if (hider.rig.tagRing) {
      (hider.rig.tagRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Face seeker and tagged hider toward each other cleanly for the tag tap
    const sPos = this.seekerActor.rig.root.position;
    const hPos = hider.rig.root.position;
    this.seekerActor.rig.root.rotation.y = Math.atan2(
      hPos.x - sPos.x,
      hPos.z - sPos.z,
    );
    hider.rig.root.rotation.y = Math.atan2(sPos.x - hPos.x, sPos.z - hPos.z);

    if (hider.isPlayer) {
      this.clearSeatedStateImmediate(hider);
      hider.handshakeTimer = 0;
      hider.handshakePartnerId = null;
      this.spectateTargetId = null;
      this.spectateCameraMode = 'follow';
      this.freeCamVerticalInput = 0;
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      this.cameraController?.exitFreeCamera();
    } else {
      this.clearSeatedStateImmediate(hider);
      hider.handshakeTimer = 0;
      hider.handshakePartnerId = null;
    }

    const remaining = this.getActiveHiders().length;
    if (remaining === 0) {
      // Let the final hider's funny caught animation play briefly before showing victory scoreboard
      this.pendingWinner = 'seekers';
      this.pendingEndTimer = FINAL_TAG_DELAY;
      this.showBanner(`Dhappa! Caught ${hider.name}! All hiders caught!`, 2.0);
      this.emitHud();
      return;
    }

    if (this.playerActor?.role === 'seeker') {
      this.showBanner(
        `Dhappa! Tagged ${hider.name}! ${remaining} ${remaining === 1 ? 'hider' : 'hiders'} left.`,
      );
    } else if (hider.isPlayer) {
      this.showBanner(
        `Dhappa! ${this.seekerActor.name} caught you! ${remaining} ${remaining === 1 ? 'hider' : 'hiders'} still hiding.`,
        3.5,
      );
    } else {
      this.showBanner(
        `${this.seekerActor.name} caught ${hider.name}! ${remaining} left.`,
      );
    }

    this.emitHud();
  }

  private findHouseContaining(
    x: number,
    z: number,
    y?: number,
  ): HouseInterior | null {
    for (const h of this.houseInteriors) {
      if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) {
        if (y !== undefined) {
          if (h.minY !== undefined && y < h.minY) continue;
          if (h.maxY !== undefined && y > h.maxY) continue;
        }
        return h;
      }
    }
    return null;
  }

  /**
   * Detects if a crouching hider is tucked close to a wall, house interior,
   * tree trunk, well, haystack, market stall, or bullock cart so they play
   * the realistic cover-hiding & cautious peeking animation.
   */
  private isNearCover(pos: THREE.Vector3): boolean {
    if (this.findHouseContaining(pos.x, pos.z, pos.y) !== null) return true;

    const wallPad = 1.25;
    for (const box of this.colliders.boxes) {
      if (!box.blocksSight) continue;
      if (
        pos.x >= box.minX - wallPad &&
        pos.x <= box.maxX + wallPad &&
        pos.z >= box.minZ - wallPad &&
        pos.z <= box.maxZ + wallPad
      ) {
        return true;
      }
    }

    for (const c of this.colliders.circles) {
      if (!c.blocksSight) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const r = c.radius + 1.35;
      if (dx * dx + dz * dz <= r * r) {
        return true;
      }
    }

    return false;
  }

  private resolveMovementAnimState(
    pos: THREE.Vector3,
    moveSpeed: number,
    isHiding: boolean,
  ): CharacterAnimState {
    if (isHiding) {
      if (moveSpeed > 0.15) return 'sneak';
      return this.isNearCover(pos) ? 'hide_cover' : 'crouch';
    }
    if (moveSpeed > 3.6) return 'run';
    if (moveSpeed > 0.15) return 'walk';
    return 'idle';
  }

  private updateHouseRoofVisibility(activeHouse: HouseInterior | null): void {
    for (const house of this.houseInteriors) {
      const isInside = activeHouse !== null && house.id === activeHouse.id;
      for (const mesh of house.roofMeshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const targetTransparent = isInside;
        const targetOpacity = isInside ? 0.14 : 1.0;

        if (
          mat.transparent !== targetTransparent ||
          mat.opacity !== targetOpacity
        ) {
          mat.transparent = targetTransparent;
          mat.opacity = targetOpacity;
          mat.depthWrite = !isInside;
          mat.needsUpdate = true;
        }
      }
    }
  }

  private getHidingSpotLabel(
    pos: THREE.Vector3,
    isHiding: boolean,
  ): string | null {
    const insideHouse = this.findHouseContaining(pos.x, pos.z, pos.y);
    if (insideHouse) {
      return isHiding
        ? `Hiding inside ${insideHouse.label}`
        : `Inside ${insideHouse.label}`;
    }
    if (!isHiding) return null;

    let nearestLabel = this.isNearCover(pos)
      ? 'Hiding behind cover'
      : 'Crouching';
    let bestDist = 3.2;
    for (const spot of this.hidingSpots) {
      if (spot.kind === 'house') continue;
      const d = Math.hypot(pos.x - spot.x, pos.z - spot.z);
      if (d < bestDist) {
        bestDist = d;
        nearestLabel = `Hiding ${spot.label.toLowerCase()}`;
      }
    }
    return nearestLabel;
  }

  private planPathToHidingSpot(
    actor: ParticipantActor,
    spotIndex: number,
  ): void {
    actor.targetSpotIndex = spotIndex;
    const spot = this.hidingSpots[spotIndex];
    const waypoints: Array<{ x: number; z: number }> = [];

    const currentPos = actor.rig.root.position;
    const currentHouse = this.findHouseContaining(
      currentPos.x,
      currentPos.z,
      currentPos.y,
    );
    if (currentHouse) {
      waypoints.push({ x: currentHouse.doorX, z: currentHouse.doorZ });
    }

    const destHouse = this.findHouseContaining(spot.x, spot.z, 0);
    if (destHouse && (!currentHouse || currentHouse.id !== destHouse.id)) {
      waypoints.push({ x: destHouse.doorX, z: destHouse.doorZ });
    }

    waypoints.push({ x: spot.x, z: spot.z });
    actor.waypoints = waypoints;
  }

  /**
   * Builds a comprehensive full-map patrol route for the AI Seeker that groups
   * cover spots and enterable buildings around their nearest district patrol lane
   * so the Seeker searches every accessible area without snagging across walls.
   */
  private buildSeekerSearchQueue(): Array<{
    x: number;
    z: number;
    pauseFactor: number;
  }> {
    const tour: Array<{ x: number; z: number; pauseFactor: number }> = [];

    if (this.patrolPoints.length === 0) {
      return [{ x: 0, z: 6, pauseFactor: 0.65 }];
    }

    const districtHouses: HouseInterior[][] = this.patrolPoints.map(() => []);
    for (const h of this.houseInteriors) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this.patrolPoints.length; i++) {
        const p = this.patrolPoints[i];
        const d = Math.hypot(h.doorX - p.x, h.doorZ - p.z);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      districtHouses[bestIdx].push(h);
    }

    const districtCovers: HidingSpot[][] = this.patrolPoints.map(() => []);
    for (const s of this.hidingSpots) {
      if (s.kind === 'house') continue;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this.patrolPoints.length; i++) {
        const p = this.patrolPoints[i];
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      districtCovers[bestIdx].push(s);
    }

    // Order patrol points in a smooth loop with a randomized starting offset
    const startOffset = Math.floor(Math.random() * this.patrolPoints.length);
    const reverse = Math.random() < 0.5;

    for (let step = 0; step < this.patrolPoints.length; step++) {
      const i = reverse
        ? (startOffset - step + this.patrolPoints.length) %
          this.patrolPoints.length
        : (startOffset + step) % this.patrolPoints.length;
      const p = this.patrolPoints[i];
      tour.push({ x: p.x, z: p.z, pauseFactor: 0.55 });

      // Check nearby cover spots (vehicles, walls, trees, wells) in this district
      const covers = districtCovers[i];
      for (let cIdx = 0; cIdx < covers.length; cIdx++) {
        if (cIdx >= 2) break; // Check up to 2 local covers per district stop before advancing
        const c = covers[(cIdx + step) % covers.length];
        tour.push({ x: c.x, z: c.z, pauseFactor: 0.5 });
      }

      // Sweep enterable buildings belonging to this district via doorway -> inside -> doorway
      for (const h of districtHouses[i]) {
        const dx = h.doorX - h.insideX;
        const dz = h.doorZ - h.insideZ;
        const len = Math.max(0.01, Math.hypot(dx, dz));
        const outsideX = h.doorX + (dx / len) * 1.45;
        const outsideZ = h.doorZ + (dz / len) * 1.45;
        tour.push({ x: outsideX, z: outsideZ, pauseFactor: 0.12 });
        tour.push({ x: h.doorX, z: h.doorZ, pauseFactor: 0.08 });
        tour.push({ x: h.insideX, z: h.insideZ, pauseFactor: 0.8 });
        tour.push({ x: h.doorX, z: h.doorZ, pauseFactor: 0.08 });
        tour.push({ x: outsideX, z: outsideZ, pauseFactor: 0.12 });
      }
    }

    return tour.length > 0 ? tour : [{ x: 0, z: 6, pauseFactor: 0.65 }];
  }

  private resolveCollisions(pos: THREE.Vector3, radius: number): number {
    let supportY = 0;
    const distSq = pos.x * pos.x + pos.z * pos.z;
    const maxR = this.colliders.worldRadius - radius;
    if (distSq > maxR * maxR) {
      const dist = Math.sqrt(distSq);
      pos.x = (pos.x / dist) * maxR;
      pos.z = (pos.z / dist) * maxR;
    }

    for (const box of this.colliders.boxes) {
      if (box.minY !== undefined && pos.y + 1.5 < box.minY) {
        continue;
      }
      if (!box.climbable && box.topY !== undefined && pos.y >= box.topY - 0.08) {
        continue;
      }
      if (
        box.climbable &&
        box.topY !== undefined &&
        pos.y >= box.topY - 0.28
      ) {
        const tol = radius * 0.58;
        if (
          pos.x > box.minX - tol &&
          pos.x < box.maxX + tol &&
          pos.z > box.minZ - tol &&
          pos.z < box.maxZ + tol
        ) {
          supportY = Math.max(supportY, box.topY);
        }
        continue;
      }

      const closestX = THREE.MathUtils.clamp(pos.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(pos.z, box.minZ, box.maxZ);
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const dSq = dx * dx + dz * dz;

      if (dSq < radius * radius) {
        if (dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          const overlap = radius - d;
          pos.x += (dx / d) * overlap;
          pos.z += (dz / d) * overlap;
        } else {
          const left = Math.abs(pos.x - box.minX);
          const right = Math.abs(box.maxX - pos.x);
          const top = Math.abs(pos.z - box.minZ);
          const bottom = Math.abs(box.maxZ - pos.z);
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = box.minX - radius;
          else if (m === right) pos.x = box.maxX + radius;
          else if (m === top) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
      }
    }

    for (const c of this.colliders.circles) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      if (c.climbable && c.topY !== undefined && pos.y >= c.topY - 0.28) {
        const climbR = c.radius + radius * 0.58;
        if (dx * dx + dz * dz < climbR * climbR) {
          supportY = Math.max(supportY, c.topY);
        }
        continue;
      }

      const minDist = radius + c.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const overlap = minDist - d;
        pos.x += (dx / d) * overlap;
        pos.z += (dz / d) * overlap;
      }
    }

    // Dynamic 3D oriented-capsule collisions against village cows & buffaloes on all maps
    if (this.activeNpcSystem?.resolveLargeAnimalCollisions(pos, radius)) {
      // Safety re-clamp against solid world boxes & perimeter so animals never push a player into a wall
      for (const box of this.colliders.boxes) {
        if (box.minY !== undefined && pos.y + 1.5 < box.minY) continue;
        if (box.topY !== undefined && pos.y >= box.topY - (box.climbable ? 0.28 : 0.08)) {
          continue;
        }
        const closestX = THREE.MathUtils.clamp(pos.x, box.minX, box.maxX);
        const closestZ = THREE.MathUtils.clamp(pos.z, box.minZ, box.maxZ);
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const dSq = dx * dx + dz * dz;
        if (dSq < radius * radius && dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          const overlap = radius - d;
          pos.x += (dx / d) * overlap;
          pos.z += (dz / d) * overlap;
        }
      }
      const postDistSq = pos.x * pos.x + pos.z * pos.z;
      if (postDistSq > maxR * maxR) {
        const postDist = Math.sqrt(postDistSq);
        pos.x = (pos.x / postDist) * maxR;
        pos.z = (pos.z / postDist) * maxR;
      }
    }

    return supportY;
  }

  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    _rayStart.set(from.x, from.z);
    _rayEnd.set(to.x, to.z);
    const rayMinY = Math.min(from.y, to.y) + 0.9;
    const rayMaxY = Math.max(from.y, to.y) + 1.25;

    for (const box of this.colliders.boxes) {
      if (!box.blocksSight) continue;
      if (box.minY !== undefined && rayMaxY < box.minY) continue;
      if (box.topY !== undefined && rayMinY > box.topY) continue;
      if (
        segmentIntersectsBox(
          _rayStart.x,
          _rayStart.y,
          _rayEnd.x,
          _rayEnd.y,
          box.minX,
          box.maxX,
          box.minZ,
          box.maxZ,
        )
      ) {
        return false;
      }
    }

    for (const c of this.colliders.circles) {
      if (!c.blocksSight) continue;
      if (
        segmentIntersectsCircle(
          _rayStart.x,
          _rayStart.y,
          _rayEnd.x,
          _rayEnd.y,
          c.x,
          c.z,
          c.radius * 0.85,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private isPositionBlocked(
    x: number,
    z: number,
    pad: number,
    currentY = 0,
  ): boolean {
    for (const box of this.colliders.boxes) {
      if (box.minY !== undefined && currentY + 1.5 < box.minY) continue;
      if (box.climbable && box.topY !== undefined && currentY >= box.topY - 0.28) {
        continue;
      }
      if (!box.climbable && box.topY !== undefined && currentY >= box.topY - 0.08) {
        continue;
      }
      if (
        x > box.minX - pad &&
        x < box.maxX + pad &&
        z > box.minZ - pad &&
        z < box.maxZ + pad
      ) {
        return true;
      }
    }
    for (const c of this.colliders.circles) {
      if (c.climbable && c.topY !== undefined && currentY >= c.topY - 0.28) {
        continue;
      }
      const dx = x - c.x;
      const dz = z - c.z;
      const r = c.radius + pad;
      if (dx * dx + dz * dz < r * r) {
        return true;
      }
    }
    return false;
  }

  private moveAiToward(
    rig: CharacterRig,
    targetX: number,
    targetZ: number,
    speed: number,
    dt: number,
  ): number {
    const pos = rig.root.position;
    _toTarget.set(targetX - pos.x, 0, targetZ - pos.z);
    const len = _toTarget.length();
    if (len < 0.08) return 0;

    _toTarget.divideScalar(len);
    const baseAngle = Math.atan2(_toTarget.x, _toTarget.z);
    let chosenAngle = baseAngle;
    const probeDist = 1.25;
    const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.85, -1.85];

    for (const offset of offsets) {
      const testAngle = baseAngle + offset;
      _probePos.set(
        pos.x + Math.sin(testAngle) * probeDist,
        pos.y,
        pos.z + Math.cos(testAngle) * probeDist,
      );
      if (!this.isPositionBlocked(_probePos.x, _probePos.z, CHAR_RADIUS, pos.y)) {
        chosenAngle = testAngle;
        break;
      }
    }

    const dirX = Math.sin(chosenAngle);
    const dirZ = Math.cos(chosenAngle);
    pos.x += dirX * speed * dt;
    pos.z += dirZ * speed * dt;
    const supportY = this.resolveCollisions(pos, CHAR_RADIUS);
    if (Math.abs(supportY - pos.y) <= 0.34) {
      pos.y = THREE.MathUtils.damp(pos.y, supportY, 22, dt);
      if (Math.abs(supportY - pos.y) < 0.012) pos.y = supportY;
    } else if (pos.y > supportY) {
      pos.y = Math.max(supportY, pos.y - 4.5 * dt);
    }

    const currentYaw = rig.root.rotation.y;
    let diff = chosenAngle - currentYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rig.root.rotation.y = currentYaw + diff * (1 - Math.exp(-9 * dt));

    return speed;
  }

  private updatePlayer(dt: number): void {
    const actor = this.playerActor;
    if (!actor || actor.caught) return;

    if (this.playerSlapCooldown > 0) {
      this.playerSlapCooldown = Math.max(0, this.playerSlapCooldown - dt);
    }
    if (this.playerHandshakeCooldown > 0) {
      this.playerHandshakeCooldown = Math.max(
        0,
        this.playerHandshakeCooldown - dt,
      );
    }

    if (actor.tagLungeTimer && actor.tagLungeTimer > 0) {
      actor.tagLungeTimer = Math.max(0, actor.tagLungeTimer - dt);
    }

    if (actor.slapFlinchTimer && actor.slapFlinchTimer > 0) {
      actor.slapFlinchTimer = Math.max(0, actor.slapFlinchTimer - dt);
    }

    if (actor.handshakeTimer && actor.handshakeTimer > 0) {
      actor.handshakeTimer = Math.max(0, actor.handshakeTimer - dt);
      if (actor.handshakeTimer === 0) {
        actor.handshakePartnerId = null;
      }
    }

    if (actor.expressionOverrideTimer && actor.expressionOverrideTimer > 0) {
      actor.expressionOverrideTimer = Math.max(
        0,
        actor.expressionOverrideTimer - dt,
      );
      if (actor.expressionOverrideTimer === 0) {
        actor.expressionOverride = null;
      }
    }

    if (actor.slapKnockVx || actor.slapKnockVz) {
      const decay = Math.exp(-8.5 * dt);
      actor.rig.root.position.x += (actor.slapKnockVx ?? 0) * dt;
      actor.rig.root.position.z += (actor.slapKnockVz ?? 0) * dt;
      actor.slapKnockVx = (actor.slapKnockVx ?? 0) * decay;
      actor.slapKnockVz = (actor.slapKnockVz ?? 0) * decay;
      if (
        Math.abs(actor.slapKnockVx) < 0.08 &&
        Math.abs(actor.slapKnockVz) < 0.08
      ) {
        actor.slapKnockVx = 0;
        actor.slapKnockVz = 0;
      }
      this.resolveCollisions(actor.rig.root.position, CHAR_RADIUS);
    }

    if (actor.role === 'seeker' && this.countdownTimer > 0) {
      actor.lastMoveSpeed = 0;
      this.lastForwardInput = 0;
      this.lastRightInput = 0;
      this.lastPlayerAnimState = 'counting_eyes_closed';
      this.lastPlayerExpression = 'counting';
      actor.rig.updateAnimation({
        dt,
        moveSpeed: 0,
        state: 'counting_eyes_closed',
        lookAroundPhase: 0,
      });
      return;
    }

    let ix = this.touchMoveX;
    let iz = this.touchMoveZ;

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) iz -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) iz += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) ix -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) ix += 1;

    // PUBG-style camera-relative movement:
    // W / Up always runs straight where the camera looks; A/D strafe relative to camera; S runs toward camera.
    const rawMag = Math.hypot(ix, iz);
    const inputMag = Math.min(1, rawMag);
    const forwardInput = rawMag > 0.05 ? -iz / Math.max(1, rawMag) : 0;
    const rightInput = rawMag > 0.05 ? ix / Math.max(1, rawMag) : 0;
    this.lastForwardInput = forwardInput;
    this.lastRightInput = rightInput;

    // Handle smooth sitting-down / seated / getting-up states on charpais & benches
    if (actor.sitPhase && actor.sitPhase !== 'none' && actor.activeSeat) {
      const seat = actor.activeSeat;
      const pos = actor.rig.root.position;

      // Moving joystick or WASD while seated smoothly triggers standing up!
      if (inputMag > 0.14 && actor.sitPhase !== 'stand_up') {
        this.beginStandUp(actor);
      }

      actor.sitTimer = (actor.sitTimer ?? 0) + dt;
      actor.lastMoveSpeed = 0;

      if (actor.sitPhase === 'sit_down') {
        const progress = Math.min(1, actor.sitTimer / SIT_DOWN_DURATION);
        pos.x = THREE.MathUtils.damp(pos.x, seat.x, 12, dt);
        pos.z = THREE.MathUtils.damp(pos.z, seat.z, 12, dt);
        pos.y = THREE.MathUtils.damp(pos.y, 0, 14, dt);
        let diff = seat.rotY - actor.rig.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.rig.root.rotation.y += diff * (1 - Math.exp(-12 * dt));

        if (progress >= 1) {
          actor.sitPhase = 'sitting';
          actor.sitTimer = 0;
          pos.x = seat.x;
          pos.z = seat.z;
          actor.rig.root.rotation.y = seat.rotY;
        }

        const gaze = this.computeConversationLook(actor);
        const expr = this.resolveActorFacialExpression(actor, 'sit_down');
        this.lastPlayerAnimState = 'sit_down';
        this.lastPlayerExpression = expr;
        actor.rig.updateAnimation({
          dt,
          moveSpeed: 0,
          state: 'sit_down',
          expression: expr,
          eyeLookX: gaze.eyeLookX,
          eyeLookY: gaze.eyeLookY,
          headLookYaw: gaze.headLookYaw,
          headLookPitch: gaze.headLookPitch,
          isConversing: gaze.isConversing,
          isSpeaking: gaze.isSpeaking,
          interactionProgress: progress,
          seatY: seat.seatY,
          airHeight: 0,
        });
        return;
      }

      if (actor.sitPhase === 'sitting') {
        pos.x = THREE.MathUtils.damp(pos.x, seat.x, 14, dt);
        pos.z = THREE.MathUtils.damp(pos.z, seat.z, 14, dt);
        pos.y = 0;
        let diff = seat.rotY - actor.rig.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.rig.root.rotation.y += diff * (1 - Math.exp(-12 * dt));

        const gaze = this.computeConversationLook(actor);
        const sittingState: CharacterAnimState =
          actor.activeEmote && actor.emoteTimer && actor.emoteTimer > 0
            ? actor.activeEmote === 'laugh' || actor.activeEmote === 'surprise'
              ? 'sitting'
              : emoteToAnimState(actor.activeEmote)
            : 'sitting';
        const expr =
          actor.activeEmote === 'laugh' && (actor.emoteTimer ?? 0) > 0
            ? 'laughing'
            : actor.activeEmote === 'surprise' && (actor.emoteTimer ?? 0) > 0
              ? 'surprise'
              : this.resolveActorFacialExpression(actor, sittingState);
        this.lastPlayerAnimState = sittingState;
        this.lastPlayerExpression = expr;
        actor.rig.updateAnimation({
          dt,
          moveSpeed: 0,
          state: sittingState,
          expression: expr,
          eyeLookX: gaze.eyeLookX,
          eyeLookY: gaze.eyeLookY,
          headLookYaw: gaze.headLookYaw,
          headLookPitch: gaze.headLookPitch,
          isConversing: gaze.isConversing,
          isSpeaking: gaze.isSpeaking,
          interactionProgress: 1,
          seatY: seat.seatY,
          airHeight: 0,
        });
        return;
      }

      if (actor.sitPhase === 'stand_up') {
        const progress = Math.min(1, actor.sitTimer / STAND_UP_DURATION);
        const standTargetX =
          actor.preSitPos?.x ?? seat.x + Math.sin(seat.rotY) * 0.85;
        const standTargetZ =
          actor.preSitPos?.z ?? seat.z + Math.cos(seat.rotY) * 0.85;
        pos.x = THREE.MathUtils.damp(pos.x, standTargetX, 10, dt);
        pos.z = THREE.MathUtils.damp(pos.z, standTargetZ, 10, dt);
        pos.y = 0;

        if (progress >= 1 || (inputMag > 0.25 && progress >= 0.45)) {
          actor.sitPhase = 'none';
          actor.sitTimer = 0;
          actor.activeSeat = null;
          actor.preSitPos = null;
          this.resolveCollisions(pos, CHAR_RADIUS);
          this.emitHud();
        } else {
          const gaze = this.computeConversationLook(actor);
          const expr = this.resolveActorFacialExpression(actor, 'stand_up');
          this.lastPlayerAnimState = 'stand_up';
          this.lastPlayerExpression = expr;
          actor.rig.updateAnimation({
            dt,
            moveSpeed: 0,
            state: 'stand_up',
            expression: expr,
            eyeLookX: gaze.eyeLookX,
            eyeLookY: gaze.eyeLookY,
            headLookYaw: gaze.headLookYaw,
            headLookPitch: gaze.headLookPitch,
            isConversing: gaze.isConversing,
            isSpeaking: gaze.isSpeaking,
            interactionProgress: progress,
            seatY: seat.seatY,
            airHeight: 0,
          });
          return;
        }
      }
    }

    let actualSpeed = 0;

    if (inputMag > 0.05) {
      // Cancel local emote & handshake cleanly as soon as the player starts walking/running
      if (actor.activeEmote) {
        actor.activeEmote = null;
        actor.emoteTimer = 0;
      }
      if (actor.handshakeTimer && actor.handshakeTimer > 0) {
        actor.handshakeTimer = 0;
        actor.handshakePartnerId = null;
      }
      const camYaw = this.cameraController?.getCameraYaw() ?? 0;
      const forwardX = -Math.sin(camYaw);
      const forwardZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);

      _moveDir.set(
        forwardX * forwardInput + rightX * rightInput,
        0,
        forwardZ * forwardInput + rightZ * rightInput,
      );
      _moveDir.normalize();

      const maxSpeed =
        actor.role === 'seeker'
          ? SEEKER_PLAYER_SPEED
          : actor.isHiding
            ? HIDER_CROUCH_SPEED
            : HIDER_RUN_SPEED;
      actualSpeed = maxSpeed * inputMag;

      actor.rig.root.position.x += _moveDir.x * actualSpeed * dt;
      actor.rig.root.position.z += _moveDir.z * actualSpeed * dt;
      this.resolveCollisions(actor.rig.root.position, CHAR_RADIUS);

      const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
      const currentYaw = actor.rig.root.rotation.y;
      let diff = targetYaw - currentYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      actor.rig.root.rotation.y = currentYaw + diff * (1 - Math.exp(-15 * dt));
    }

    actor.lastMoveSpeed = actualSpeed;

    const pos = actor.rig.root.position;
    let supportY = this.resolveCollisions(pos, CHAR_RADIUS);

    if (actor.grounded && supportY > pos.y && supportY <= pos.y + 0.28) {
      pos.y = THREE.MathUtils.damp(pos.y, supportY, 24, dt);
      if (supportY - pos.y < 0.012) pos.y = supportY;
    } else if (actor.grounded && pos.y > supportY && pos.y - supportY <= 0.28) {
      // Smooth grounded step-down when walking down temple steps or staircases
      pos.y = THREE.MathUtils.damp(pos.y, supportY, 24, dt);
      if (pos.y - supportY < 0.012) pos.y = supportY;
    }

    if (actor.grounded && pos.y > supportY + 0.28) {
      actor.grounded = false;
      actor.vy = 0;
    }

    if (!actor.grounded || pos.y > supportY) {
      actor.vy -= GRAVITY * dt;
      pos.y += actor.vy * dt;
      supportY = this.resolveCollisions(pos, CHAR_RADIUS);
      if (pos.y <= supportY) {
        pos.y = supportY;
        actor.vy = 0;
        actor.grounded = true;
      }
    }

    const airHeight = Math.max(0, pos.y - supportY);

    const animState: CharacterAnimState =
      actor.tagLungeTimer && actor.tagLungeTimer > 0
        ? 'tag_lunge'
        : actor.handshakeTimer && actor.handshakeTimer > 0 && actualSpeed <= 0.15
          ? 'handshake'
          : !actor.grounded
            ? 'jump'
            : actor.activeEmote &&
                actor.emoteTimer &&
                actor.emoteTimer > 0 &&
                actualSpeed <= 0.15
              ? emoteToAnimState(actor.activeEmote)
              : this.resolveMovementAnimState(
                  pos,
                  actualSpeed,
                  actor.isHiding,
                );

    const interactionProgress =
      animState === 'handshake' && actor.handshakeTimer
        ? 1 - actor.handshakeTimer / HANDSHAKE_DURATION
        : 0;
    const gaze = this.computeConversationLook(actor);
    const expr = this.resolveActorFacialExpression(actor, animState);

    this.lastPlayerAnimState = animState;
    this.lastPlayerExpression = expr;
    actor.rig.updateAnimation({
      dt,
      moveSpeed: actualSpeed,
      state: animState,
      expression: expr,
      eyeLookX: gaze.eyeLookX,
      eyeLookY: gaze.eyeLookY,
      headLookYaw: gaze.headLookYaw,
      headLookPitch: gaze.headLookPitch,
      isConversing: gaze.isConversing,
      isSpeaking: gaze.isSpeaking,
      interactionProgress,
      airHeight,
    });
  }

  private updateAiHiders(dt: number): void {
    if (!this.seekerActor) return;
    const seekerPos = this.seekerActor.rig.root.position;

    for (const hider of this.actors) {
      if (hider.role !== 'hider' || hider.isPlayer || hider.caught) continue;

      hider.retargetCooldown = Math.max(0, hider.retargetCooldown - dt);
      const pos = hider.rig.root.position;
      if (hider.slapFlinchTimer && hider.slapFlinchTimer > 0) {
        hider.slapFlinchTimer = Math.max(0, hider.slapFlinchTimer - dt);
      }
      if (hider.handshakeTimer && hider.handshakeTimer > 0) {
        hider.handshakeTimer = Math.max(0, hider.handshakeTimer - dt);
        if (hider.handshakeTimer === 0) {
          hider.handshakePartnerId = null;
        }
      }
      if (hider.expressionOverrideTimer && hider.expressionOverrideTimer > 0) {
        hider.expressionOverrideTimer = Math.max(
          0,
          hider.expressionOverrideTimer - dt,
        );
        if (hider.expressionOverrideTimer === 0) {
          hider.expressionOverride = null;
        }
      }
      if (hider.slapKnockVx || hider.slapKnockVz) {
        const decay = Math.exp(-8.5 * dt);
        pos.x += (hider.slapKnockVx ?? 0) * dt;
        pos.z += (hider.slapKnockVz ?? 0) * dt;
        hider.slapKnockVx = (hider.slapKnockVx ?? 0) * decay;
        hider.slapKnockVz = (hider.slapKnockVz ?? 0) * decay;
        if (
          Math.abs(hider.slapKnockVx) < 0.08 &&
          Math.abs(hider.slapKnockVz) < 0.08
        ) {
          hider.slapKnockVx = 0;
          hider.slapKnockVz = 0;
        }
        this.resolveCollisions(pos, CHAR_RADIUS);
      }
      const hiderSupportY = this.resolveCollisions(pos, CHAR_RADIUS);
      if (!hider.grounded || pos.y > hiderSupportY + 0.02) {
        hider.vy -= GRAVITY * dt;
        pos.y += hider.vy * dt;
        if (pos.y <= hiderSupportY) {
          pos.y = hiderSupportY;
          hider.vy = 0;
          hider.grounded = true;
        }
      }

      const distToSeeker = pos.distanceTo(seekerPos);

      if (
        this.countdownTimer <= 0 &&
        hider.retargetCooldown <= 0 &&
        distToSeeker < AI_HIDER_FLEE_RANGE &&
        this.hasLineOfSight(seekerPos, pos)
      ) {
        hider.handshakeTimer = 0;
        hider.handshakePartnerId = null;
        let bestIdx = hider.targetSpotIndex;
        let bestScore = -1;
        for (let i = 0; i < this.hidingSpots.length; i++) {
          if (i === hider.targetSpotIndex) continue;
          const s = this.hidingSpots[i];
          const dSeeker = Math.hypot(s.x - seekerPos.x, s.z - seekerPos.z);
          if (dSeeker > bestScore) {
            bestScore = dSeeker;
            bestIdx = i;
          }
        }
        this.planPathToHidingSpot(hider, bestIdx);
        hider.isHiding = false;
        hider.retargetCooldown = 4.5;
      }

      let movedSpeed = 0;
      if (
        (hider.slapFlinchTimer && hider.slapFlinchTimer > 0.25) ||
        (hider.handshakeTimer && hider.handshakeTimer > 0)
      ) {
        movedSpeed = 0;
      } else if (hider.waypoints.length > 0) {
        const next = hider.waypoints[0];
        const dNext = Math.hypot(next.x - pos.x, next.z - pos.z);
        if (dNext < 0.7) {
          hider.waypoints.shift();
        } else {
          hider.isHiding = false;
          movedSpeed = this.moveAiToward(
            hider.rig,
            next.x,
            next.z,
            AI_HIDER_SPEED * this.activeLevelConfig.aiHiderSpeedMultiplier,
            dt,
          );
        }
      } else {
        hider.isHiding = !(hider.slapFlinchTimer && hider.slapFlinchTimer > 0);
      }

      hider.lastMoveSpeed = movedSpeed;

      const animState: CharacterAnimState = !hider.grounded
        ? 'jump'
        : hider.handshakeTimer && hider.handshakeTimer > 0
          ? 'handshake'
          : this.resolveMovementAnimState(pos, movedSpeed, hider.isHiding);
      const interactionProgress =
        animState === 'handshake' && hider.handshakeTimer
          ? 1 - hider.handshakeTimer / HANDSHAKE_DURATION
          : 0;
      const gaze = this.computeConversationLook(hider);
      hider.rig.updateAnimation({
        dt,
        moveSpeed: movedSpeed,
        state: animState,
        expression: this.resolveActorFacialExpression(hider, animState),
        eyeLookX: gaze.eyeLookX,
        eyeLookY: gaze.eyeLookY,
        headLookYaw: gaze.headLookYaw,
        headLookPitch: gaze.headLookPitch,
        isConversing: gaze.isConversing,
        isSpeaking: gaze.isSpeaking,
        interactionProgress,
        airHeight: Math.max(0, pos.y),
      });
    }
  }

  private updateCaughtAnimations(dt: number): void {
    for (const actor of this.actors) {
      if (!actor.caught || !actor.rig.root.visible) continue;
      actor.caughtAnimElapsed += dt;
      actor.rig.updateAnimation({
        dt,
        moveSpeed: 0,
        state: 'caught_funny',
        caughtElapsed: actor.caughtAnimElapsed,
      });
      if (actor.caughtAnimElapsed >= CAUGHT_ANIM_DURATION) {
        actor.rig.root.visible = false;
      }
    }
  }

  private updateAiSeeker(dt: number): void {
    const seeker = this.seekerActor;
    if (!seeker || seeker.isPlayer) return;

    if (seeker.tagLungeTimer && seeker.tagLungeTimer > 0) {
      seeker.tagLungeTimer = Math.max(0, seeker.tagLungeTimer - dt);
    }

    if (this.countdownTimer > 0) {
      this.seekerMode = 'counting';
      this.seekerLookPhase = 0;
      seeker.rig.updateAnimation({
        dt,
        moveSpeed: 0,
        state: 'counting_eyes_closed',
        lookAroundPhase: 0,
      });
      return;
    }

    const seekerPos = seeker.rig.root.position;
    const activeHiders = this.getActiveHiders();

    let visibleTarget: ParticipantActor | null = null;
    let visibleDist = Infinity;

    const lvl = this.activeLevelConfig;
    const sightBonus = lvl.seekerSightBonus;
    const chaseSpeed = SEEKER_CHASE_SPEED * lvl.seekerSpeedMultiplier;
    const patrolSpeed = SEEKER_PATROL_SPEED * lvl.seekerSpeedMultiplier;

    for (const hider of activeHiders) {
      const hPos = hider.rig.root.position;
      const dist = seekerPos.distanceTo(hPos);
      const insideHouse = this.findHouseContaining(hPos.x, hPos.z, hPos.y) !== null;
      const maxSight = hider.isHiding
        ? (insideHouse ? 4.2 : SIGHT_RANGE_HIDING) + sightBonus * 0.32
        : SIGHT_RANGE_STANDING + sightBonus;

      if (dist <= maxSight && this.hasLineOfSight(seekerPos, hPos)) {
        if (dist < visibleDist) {
          visibleDist = dist;
          visibleTarget = hider;
        }
      }
    }

    if (visibleTarget) {
      this.seekerMode = 'chasing';
      if (this.prevSeekerMode !== 'chasing') {
        this.audio.playSeekerAlert();
      }
      this.lastSeenPos.copy(visibleTarget.rig.root.position);
      this.investigatingLastPos = true;
      this.searchPauseTimer = 0;
    } else {
      this.seekerMode = 'searching';
    }
    this.prevSeekerMode = this.seekerMode;

    let moveSpeed = 0;
    let targetX = seekerPos.x;
    let targetZ = seekerPos.z;
    let lookingAround = false;

    if (visibleTarget) {
      targetX = visibleTarget.rig.root.position.x;
      targetZ = visibleTarget.rig.root.position.z;
      moveSpeed = chaseSpeed;
    } else if (this.investigatingLastPos) {
      const distLast = seekerPos.distanceTo(this.lastSeenPos);
      if (distLast < 1.15) {
        this.investigatingLastPos = false;
        this.searchPauseTimer = 0.9 * lvl.searchPauseFactor;
      } else {
        targetX = this.lastSeenPos.x;
        targetZ = this.lastSeenPos.z;
        moveSpeed = patrolSpeed * 1.1;
      }
    } else if (this.searchPauseTimer > 0) {
      this.searchPauseTimer -= dt;
      lookingAround = true;
    } else {
      const tour = this.seekerSearchQueue;
      const idx =
        tour.length > 0 ? this.patrolIndex % tour.length : 0;
      const wp =
        tour.length > 0
          ? tour[idx]
          : {
              x: this.patrolPoints[this.patrolIndex % this.patrolPoints.length]?.x ?? 0,
              z: this.patrolPoints[this.patrolIndex % this.patrolPoints.length]?.z ?? 0,
              pauseFactor: 0.65,
            };
      const distWp = Math.hypot(wp.x - seekerPos.x, wp.z - seekerPos.z);
      if (distWp < 1.15) {
        if (tour.length > 0) {
          this.patrolIndex = (this.patrolIndex + 1) % tour.length;
        } else if (this.patrolPoints.length > 0) {
          this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
        }
        this.searchPauseTimer = wp.pauseFactor * lvl.searchPauseFactor;
      } else {
        targetX = wp.x;
        targetZ = wp.z;
        moveSpeed = patrolSpeed;
      }
    }

    const actualSpeed =
      moveSpeed > 0
        ? this.moveAiToward(seeker.rig, targetX, targetZ, moveSpeed, dt)
        : 0;
    seeker.lastMoveSpeed = actualSpeed;

    // Stuck recovery so AI Seeker never stalls against walls or door jambs
    if (moveSpeed > 0) {
      this.seekerStuckTimer += dt;
      if (this.seekerStuckTimer >= 1.35) {
        const progressed = seekerPos.distanceTo(this.seekerProgressPos);
        this.seekerProgressPos.copy(seekerPos);
        this.seekerStuckTimer = 0;
        if (progressed < 0.38) {
          if (this.investigatingLastPos) {
            this.investigatingLastPos = false;
            this.searchPauseTimer = 0.45;
          } else if (this.seekerSearchQueue.length > 0) {
            this.patrolIndex =
              (this.patrolIndex + 1) % this.seekerSearchQueue.length;
          } else if (this.patrolPoints.length > 0) {
            this.patrolIndex =
              (this.patrolIndex + 1) % this.patrolPoints.length;
          }
        }
      }
    } else {
      this.seekerStuckTimer = 0;
      this.seekerProgressPos.copy(seekerPos);
    }

    if (lookingAround) {
      this.seekerLookPhase += dt * 3.8;
    } else {
      this.seekerLookPhase = 0;
    }

    const seekerAnimState: CharacterAnimState =
      seeker.tagLungeTimer && seeker.tagLungeTimer > 0
        ? 'tag_lunge'
        : actualSpeed > 3.6
          ? 'run'
          : actualSpeed > 0.15
            ? 'walk'
            : 'idle';

    seeker.rig.updateAnimation({
      dt,
      moveSpeed: actualSpeed,
      state: seekerAnimState,
      lookAroundPhase: lookingAround ? this.seekerLookPhase : 0,
      expression: this.resolveActorFacialExpression(seeker, seekerAnimState),
    });

    if (visibleTarget && !visibleTarget.caught) {
      const updatedDist = seekerPos.distanceTo(visibleTarget.rig.root.position);
      if (updatedDist <= AI_CATCH_RANGE) {
        this.catchHider(visibleTarget);
      }
    }
  }

  private updateTagRings(dt: number): void {
    if (!this.playerActor || !this.seekerActor) return;
    const isHumanSeeker =
      this.phase === 'playing' &&
      this.playerActor.role === 'seeker' &&
      this.countdownTimer <= 0 &&
      this.pendingWinner === null;
    const seekerPos = this.seekerActor.rig.root.position;

    for (const hider of this.actors) {
      if (hider.role !== 'hider' || !hider.rig.tagRing) continue;
      const mat = hider.rig.tagRing.material as THREE.MeshBasicMaterial;
      const hPos = hider.rig.root.position;
      const inRange =
        isHumanSeeker &&
        !hider.caught &&
        seekerPos.distanceTo(hPos) <= TAG_RANGE &&
        this.canSeeForTag(seekerPos, hPos);

      mat.opacity = THREE.MathUtils.damp(
        mat.opacity,
        inRange ? 0.88 : 0.0,
        12,
        dt,
      );
      if (inRange) {
        hider.rig.tagRing.rotation.z += dt * 1.25;
      }
    }
  }

  private isActivelySpectating(): boolean {
    return Boolean(
      this.phase === 'playing' &&
        this.playerActor &&
        this.playerActor.role === 'hider' &&
        this.playerActor.caught &&
        this.playerActor.caughtAnimElapsed >= CAUGHT_ANIM_DURATION &&
        this.getSpectateTargets().length > 0,
    );
  }

  private getSpectateTargets(): ParticipantActor[] {
    const candidates: ParticipantActor[] = [...this.getActiveHiders()];
    if (this.seekerActor && this.seekerActor !== this.playerActor) {
      candidates.push(this.seekerActor);
    }
    return candidates;
  }

  public setFreeCamVerticalInput(dir: number): void {
    this.freeCamVerticalInput = THREE.MathUtils.clamp(dir, -1, 1);
  }

  public setSpectateCameraMode(mode: SpectateCameraMode): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      !this.playerActor.caught
    ) {
      return;
    }
    if (this.spectateCameraMode === mode) return;

    this.spectateCameraMode = mode;
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.freeCamVerticalInput = 0;

    if (mode === 'free') {
      this.cameraController?.setFullScreenTouchLook(false);
      this.cameraController?.enterFreeCamera(
        this.camera,
        this.colliders.worldRadius,
      );
    } else {
      this.cameraController?.exitFreeCamera();
      this.cameraController?.setFullScreenTouchLook(true);
      const focus = this.getCameraFocusActor();
      if (focus) {
        this.cameraController?.recenterBehind(focus.rig.root.rotation.y);
      }
    }
    this.emitHud();
  }

  public toggleSpectateCameraMode(): void {
    this.setSpectateCameraMode(
      this.spectateCameraMode === 'free' ? 'follow' : 'free',
    );
  }

  public setSpectateTarget(actorId: string): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      !this.playerActor.caught
    ) {
      return;
    }
    const candidates = this.getSpectateTargets();
    const target = candidates.find((a) => a.id === actorId);
    if (!target) return;

    this.spectateTargetId = target.id;
    if (this.spectateCameraMode === 'free') {
      this.spectateCameraMode = 'follow';
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      this.freeCamVerticalInput = 0;
      this.cameraController?.exitFreeCamera();
      this.cameraController?.setFullScreenTouchLook(true);
    }
    this.cameraController?.recenterBehind(target.rig.root.rotation.y);
    this.emitHud();
  }

  public cycleSpectateTarget(delta: number): void {
    if (
      this.phase !== 'playing' ||
      !this.playerActor ||
      this.playerActor.role !== 'hider' ||
      !this.playerActor.caught
    ) {
      return;
    }
    const candidates = this.getSpectateTargets();
    if (candidates.length === 0) return;

    const currentIdx = candidates.findIndex(
      (a) => a.id === this.spectateTargetId,
    );
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx =
      (baseIdx + delta + candidates.length * 4) % candidates.length;
    const nextActor = candidates[nextIdx];
    this.spectateTargetId = nextActor.id;
    if (this.spectateCameraMode === 'free') {
      this.spectateCameraMode = 'follow';
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      this.freeCamVerticalInput = 0;
      this.cameraController?.exitFreeCamera();
      this.cameraController?.setFullScreenTouchLook(true);
    }
    this.cameraController?.recenterBehind(nextActor.rig.root.rotation.y);
    this.emitHud();
  }

  private getCameraFocusActor(): ParticipantActor | null {
    if (!this.playerActor) return null;
    if (
      this.playerActor.role === 'hider' &&
      this.playerActor.caught &&
      this.playerActor.caughtAnimElapsed >= CAUGHT_ANIM_DURATION
    ) {
      const candidates = this.getSpectateTargets();
      if (candidates.length > 0) {
        const chosen = candidates.find((a) => a.id === this.spectateTargetId);
        if (chosen) return chosen;
        this.spectateTargetId = candidates[0].id;
        return candidates[0];
      }
    }
    return this.playerActor;
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'start') {
      const sp = this.activeSpawnPoints;
      const previewPos = sp?.previewPos ?? [0.2, 0, 7.6];

      let camBaseX: number;
      let camBaseY: number;
      let camBaseZ: number;
      let lookX: number;
      let lookY: number;
      let lookZ: number;
      let swayX: number;

      if (this.startShowcaseMode === 'menu') {
        // Centered 9:16 portrait main menu framing: player hero + animated village cast
        // stand cleanly in the open courtyard between the top title and bottom menu buttons.
        camBaseX = previewPos[0];
        camBaseY = previewPos[1] + 2.02;
        camBaseZ = previewPos[2] + 5.35;
        lookX = previewPos[0];
        lookY = previewPos[1] + 0.56;
        lookZ = previewPos[2] - 1.25;
        swayX = Math.sin(this.elapsed * 0.34) * 0.52;
      } else {
        camBaseX = sp ? sp.previewCamPos[0] : 1.25;
        camBaseY = sp ? sp.previewCamPos[1] : 1.85;
        camBaseZ = sp ? sp.previewCamPos[2] : 11.45;
        lookX = sp ? sp.previewLookAt[0] : 1.15;
        lookY = sp ? sp.previewLookAt[1] : 1.05;
        lookZ = sp ? sp.previewLookAt[2] : 7.2;
        swayX = Math.sin(this.elapsed * 0.45) * 0.25;
      }

      _camGoal.set(camBaseX + swayX, camBaseY, camBaseZ);
      _lookGoal.set(lookX, lookY, lookZ);

      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        _camGoal.x,
        5,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        _camGoal.y,
        5,
        dt,
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        _camGoal.z,
        5,
        dt,
      );
      this.camera.lookAt(_lookGoal);
      this.updateHouseRoofVisibility(null);

      if (this.sunLight) {
        const atmSun = this.activeLevelConfig.atmosphere.sunPos;
        this.sunLight.target.position.set(lookX, 0, lookZ);
        this.sunLight.position.set(lookX + atmSun[0] * 0.8, atmSun[1] * 0.85, lookZ + atmSun[2] * 0.8);
      }
      if (this.faceFillLight) {
        this.faceFillLight.target.position.set(lookX, previewPos[1] + 1.15, previewPos[2] - 0.8);
        this.faceFillLight.position.set(
          _camGoal.x + 1.1,
          _camGoal.y + 0.65,
          _camGoal.z + 0.8,
        );
      }
      return;
    }

    const activelySpectating = this.isActivelySpectating();

    if (
      activelySpectating &&
      this.spectateCameraMode === 'free' &&
      this.cameraController
    ) {
      if (!this.cameraController.isFreeCameraActive()) {
        this.cameraController.setFullScreenTouchLook(false);
        this.cameraController.enterFreeCamera(
          this.camera,
          this.colliders.worldRadius,
        );
      }

      let fx = this.touchMoveX;
      let fz = this.touchMoveZ;
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) fz -= 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) fz += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) fx -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) fx += 1;

      let fy = this.freeCamVerticalInput;
      if (this.keysPressed.has('Space') || this.keysPressed.has('KeyQ')) fy += 1;
      if (
        this.keysPressed.has('ShiftLeft') ||
        this.keysPressed.has('ShiftRight') ||
        this.keysPressed.has('KeyC')
      ) {
        fy -= 1;
      }

      this.cameraController.updateFreeCamera(
        this.camera,
        {
          forward: -fz,
          right: fx,
          vertical: fy,
          worldRadius: this.colliders.worldRadius,
        },
        dt,
      );

      this.cameraController.getFreeCameraPosition(_freeCamPos);
      if (this.sunLight) {
        this.sunLight.target.position.set(_freeCamPos.x, 0, _freeCamPos.z);
        this.sunLight.position.set(_freeCamPos.x + 26, 34, _freeCamPos.z + 18);
      }
      if (this.faceFillLight) {
        this.faceFillLight.target.position.set(_freeCamPos.x, 1.0, _freeCamPos.z);
        this.faceFillLight.position.set(
          _freeCamPos.x + 2.5,
          Math.max(4.0, _freeCamPos.y + 1.5),
          _freeCamPos.z + 2.5,
        );
      }
      const hoveredHouse =
        _freeCamPos.y < 14
          ? this.findHouseContaining(
              _freeCamPos.x,
              _freeCamPos.z,
              Math.max(0, _freeCamPos.y - 2.4),
            )
          : null;
      this.updateHouseRoofVisibility(hoveredHouse);
      return;
    }

    if (this.cameraController) {
      if (this.cameraController.isFreeCameraActive()) {
        this.cameraController.exitFreeCamera();
      }
      this.cameraController.setFullScreenTouchLook(activelySpectating);
    }

    const focusActor = this.getCameraFocusActor();
    if (!focusActor) return;
    const p = focusActor.rig.root.position;
    const c = focusActor.rig.crouchBlend;

    if (this.sunLight) {
      this.sunLight.target.position.set(p.x, 0, p.z);
      this.sunLight.position.set(p.x + 26, 34, p.z + 18);
    }
    if (this.faceFillLight) {
      const toCamX = this.camera.position.x - p.x;
      const toCamZ = this.camera.position.z - p.z;
      const camLen = Math.hypot(toCamX, toCamZ) || 1;
      this.faceFillLight.target.position.set(p.x, p.y + 1.05, p.z);
      this.faceFillLight.position.set(
        p.x + (toCamX / camLen) * 5.0 + 1.6,
        p.y + 3.4,
        p.z + (toCamZ / camLen) * 5.0,
      );
    }

    const activeHouse = this.findHouseContaining(p.x, p.z, p.y);
    this.updateHouseRoofVisibility(activeHouse);

    if (this.cameraController) {
      const isPlayerControlled = focusActor.isPlayer && !focusActor.caught;
      this.cameraController.update(
        this.camera,
        {
          position: p,
          facingYaw: focusActor.rig.root.rotation.y,
          moveSpeed: focusActor.lastMoveSpeed,
          crouchBlend: c,
          insideHouse: activeHouse !== null,
          isPlayerControlled,
          forwardInput: isPlayerControlled ? this.lastForwardInput : 0,
          rightInput: isPlayerControlled ? this.lastRightInput : 0,
        },
        dt,
      );
      return;
    }

    const camHeight = activeHouse ? 5.6 : THREE.MathUtils.lerp(6.4, 4.9, c);
    const camBack = activeHouse ? 6.8 : THREE.MathUtils.lerp(8.6, 6.7, c);

    _camGoal.set(p.x, camHeight, p.z + camBack);
    _lookGoal.set(p.x, THREE.MathUtils.lerp(1.15, 0.78, c), p.z - 0.4);

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _camGoal.x,
      7.5,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _camGoal.y,
      7.5,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camGoal.z,
      7.5,
      dt,
    );

    _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _lookGoal.x, 10, dt);
    _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _lookGoal.y, 10, dt);
    _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _lookGoal.z, 10, dt);

    this.camera.lookAt(_currentLook);
  }

  private updateAmbientMotion(dt: number): void {
    this.elapsed += dt;
    for (let i = 0; i < this.swayFoliage.length; i++) {
      const f = this.swayFoliage[i];
      f.rotation.z = Math.sin(this.elapsed * 1.15 + i * 1.3) * 0.025;
      f.rotation.x = Math.cos(this.elapsed * 0.9 + i * 0.9) * 0.018;
    }

    if (this.dustMotes && this.dustMotes.visible) {
      this.dustMotes.position.x = Math.sin(this.elapsed * 0.25) * 1.4;
      this.dustMotes.position.y = Math.sin(this.elapsed * 0.4) * 0.25;
    }

    if (this.cloudsGroup && this.cloudsGroup.visible) {
      for (let i = 0; i < this.cloudSprites.length; i++) {
        const c = this.cloudSprites[i];
        c.angle += c.speed * dt;
        c.sprite.position.set(
          Math.cos(c.angle) * c.radius,
          c.y,
          Math.sin(c.angle) * c.radius,
        );
      }
    }

    if (this.textures && this.graphicsQuality !== 'low') {
      this.textures.waterNormal.offset.x = (this.elapsed * 0.036) % 1;
      this.textures.waterNormal.offset.y = (this.elapsed * 0.024) % 1;
    }

    if (this.pondWater) {
      const mat = this.pondWater.material as THREE.MeshPhysicalMaterial;
      mat.roughness = 0.13 + Math.sin(this.elapsed * 1.8) * 0.03;
    }

    this.templeBellCooldown = Math.max(0, this.templeBellCooldown - dt);
    this.npcSlapCooldown = Math.max(0, this.npcSlapCooldown - dt);

    for (let i = 0; i < this.templeBells.length; i++) {
      const bell = this.templeBells[i];
      if (
        Math.abs(bell.swingAngle) > 0.0008 ||
        Math.abs(bell.swingVel) > 0.0008
      ) {
        const accel = -18.5 * bell.swingAngle - 1.65 * bell.swingVel;
        bell.swingVel += accel * dt;
        bell.swingAngle += bell.swingVel * dt;
        bell.pivot.rotation.x = bell.swingAngle;
        bell.clapper.rotation.x =
          bell.swingAngle * 0.45 - bell.swingVel * 0.045;
      } else if (bell.pivot.rotation.x !== 0 || bell.clapper.rotation.x !== 0) {
        bell.swingAngle = 0;
        bell.swingVel = 0;
        bell.pivot.rotation.x = 0;
        bell.clapper.rotation.x = 0;
      }

      if (bell.waveProgress < 1) {
        bell.waveProgress = Math.min(1, bell.waveProgress + dt * 1.45);
        const s = 1 + bell.waveProgress * 3.2;
        bell.ringWave.scale.set(s, s, 1);
        const waveMat = bell.ringWave.material as THREE.MeshBasicMaterial;
        waveMat.opacity = (1 - bell.waveProgress) * 0.72;
        bell.ringWave.visible = bell.waveProgress < 1;
      }
    }

    if (this.activeNpcSystem) {
      const activePlayerPos =
        this.playerActor && !this.playerActor.caught
          ? this.playerActor.rig.root.position
          : null;
      this.activeNpcSystem.update(dt, this.camera.position, activePlayerPos);
    }

    if (this.currentLevelId === 6 && this.skeletonVampire) {
      this.skeletonVampire.update(dt, this.camera.position);
    }

    if (this.activeMapAnimate) {
      this.activeMapAnimate(this.elapsed, dt);
    }
  }

  private emitHud(webglError: string | null = null): void {
    const hiders = this.actors.filter((a) => a.role === 'hider');
    const remainingHiders = hiders.filter((h) => !h.caught).length;
    const caughtCount = hiders.length - remainingHiders;

    let nearestDistance = 99;
    let canTag = false;
    let tagTargetName: string | null = null;
    let canSlapHider = false;
    let slapTargetName: string | null = null;
    let canSlapNpc = false;
    let slapNpcLabel: string | null = null;
    let canRingTempleBell = false;
    let templeBellLabel: string | null = null;
    let canHandshake = false;
    let handshakeTargetName: string | null = null;
    let canSit = false;
    let isSitting = false;
    let seatLabel: string | null = null;

    if (this.playerActor && this.seekerActor) {
      if (this.playerActor.role === 'seeker') {
        const seekerPos = this.seekerActor.rig.root.position;
        for (const h of hiders) {
          if (h.caught) continue;
          const hPos = h.rig.root.position;
          const d = seekerPos.distanceTo(hPos);
          if (d < nearestDistance) {
            nearestDistance = d;
          }
          if (
            this.phase === 'playing' &&
            this.countdownTimer <= 0 &&
            this.pendingWinner === null &&
            d <= TAG_RANGE &&
            this.canSeeForTag(seekerPos, hPos)
          ) {
            if (!canTag) {
              canTag = true;
              tagTargetName = h.name;
            }
          }
        }
      } else {
        const focus = this.getCameraFocusActor();
        if (focus) {
          nearestDistance = focus.rig.root.position.distanceTo(
            this.seekerActor.rig.root.position,
          );
        }
        if (
          this.phase === 'playing' &&
          !this.playerActor.caught &&
          this.pendingWinner === null &&
          this.playerSlapCooldown <= 0
        ) {
          const slapTarget = this.findNearestSlapTarget();
          if (slapTarget) {
            canSlapHider = true;
            slapTargetName = slapTarget.name;
          }
        }
      }
    }

    if (
      this.playerActor &&
      this.phase === 'playing' &&
      !this.playerActor.caught &&
      this.pendingWinner === null &&
      !(this.countdownTimer > 0 && this.playerActor.role === 'seeker')
    ) {
      if (this.templeBellCooldown <= 0) {
        const bell = this.findNearestTempleBell(4.6);
        if (bell) {
          canRingTempleBell = true;
          templeBellLabel = bell.label;
        }
      }
      if (this.npcSlapCooldown <= 0 && this.activeNpcSystem) {
        const pPos = this.playerActor.rig.root.position;
        const npcTarget = this.activeNpcSystem.findNearestSlappableHuman(
          pPos.x,
          pPos.z,
          2.9,
        );
        if (npcTarget) {
          canSlapNpc = true;
          slapNpcLabel = npcTarget.label;
        }
      }
      if (this.playerHandshakeCooldown <= 0) {
        const hsTarget = this.findNearestHandshakeTarget(HANDSHAKE_RANGE);
        if (hsTarget) {
          canHandshake = true;
          handshakeTargetName = hsTarget.name;
        }
      }
      if (
        this.playerActor.sitPhase === 'sitting' ||
        this.playerActor.sitPhase === 'sit_down'
      ) {
        isSitting = true;
        seatLabel = this.playerActor.activeSeat?.label ?? 'Seat';
      } else if (this.playerActor.sitPhase !== 'stand_up') {
        const seat = this.findNearestAvailableSeat(SIT_RANGE);
        if (seat) {
          canSit = true;
          seatLabel = seat.label;
        }
      }
    }

    const roundedDist = Math.round(nearestDistance * 2) / 2;
    const roundedTime = Math.max(0, Math.ceil(this.timeRemaining));
    const countdownSeconds = Math.max(0, Math.ceil(this.countdownTimer));

    const focusActor = this.getCameraFocusActor();
    const isSpectating = this.isActivelySpectating();
    const spectateCandidates = isSpectating ? this.getSpectateTargets() : [];
    const spectateTargets: SpectateTargetInfo[] = spectateCandidates.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
    }));
    const spectatingTargetId =
      isSpectating && focusActor && focusActor !== this.playerActor
        ? focusActor.id
        : null;
    const spectatingName =
      isSpectating && focusActor && focusActor !== this.playerActor
        ? focusActor.name
        : null;
    const spectatingRole =
      isSpectating && focusActor && focusActor !== this.playerActor
        ? focusActor.role
        : null;
    const spectatingCanCycle = isSpectating && spectateTargets.length > 1;
    const spectateCameraMode: SpectateCameraMode = isSpectating
      ? this.spectateCameraMode
      : 'follow';

    const hidingSpotLabel =
      this.playerActor?.role === 'hider' && !this.playerActor.caught
        ? this.getHidingSpotLabel(
            this.playerActor.rig.root.position,
            this.playerActor.isHiding,
          )
        : null;

    const participants: ParticipantSummary[] = this.actors.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      isPlayer: a.isPlayer,
      caught: a.caught,
      caughtAtSeconds: a.caughtAtSeconds,
    }));

    const playerName =
      this.playerActor?.name ?? this.currentCustomization.name.trim() ?? 'Player';
    const cameraSettings =
      this.cameraController?.getSettings() ?? createDefaultCameraSettings();
    const audioSettings =
      this.audio?.getSettings() ?? createDefaultAudioSettings();

    const matchEndedResult =
      this.phase === 'ended' && this.winner !== null
        ? {
            matchId: this.matchSequenceId,
            levelId: this.currentLevelId,
            playerRole: this.selectedRole,
            playerWon:
              (this.winner === 'hiders' && this.selectedRole === 'hider') ||
              (this.winner === 'seekers' && this.selectedRole === 'seeker'),
            playerCaught: this.playerActor?.caught ?? false,
            timeRemaining: roundedTime,
            remainingHiders,
            totalHiders: hiders.length || 4,
            caughtCount,
            isOnline: this.onlineMode,
          }
        : null;

    const spectateTargetsKey = spectateTargets
      .map((t) => `${t.id}:${t.role}:${t.name}`)
      .join(',');

    const key = [
      this.phase,
      this.selectedRole,
      playerName,
      this.winner ?? '',
      this.matchSequenceId,
      roundedTime,
      countdownSeconds,
      this.playerActor?.isHiding ?? false,
      this.playerActor?.caught ?? false,
      this.exploreMode,
      isSpectating,
      spectatingTargetId ?? '',
      spectatingName ?? '',
      spectatingRole ?? '',
      spectatingCanCycle,
      spectateCameraMode,
      spectateTargetsKey,
      canTag,
      tagTargetName ?? '',
      canSlapHider,
      slapTargetName ?? '',
      canSlapNpc,
      slapNpcLabel ?? '',
      canRingTempleBell,
      templeBellLabel ?? '',
      canHandshake,
      handshakeTargetName ?? '',
      canSit,
      isSitting,
      seatLabel ?? '',
      roundedDist,
      this.seekerMode,
      hidingSpotLabel ?? '',
      remainingHiders,
      caughtCount,
      this.eventBanner ?? '',
      cameraSettings.sensitivity,
      cameraSettings.zoomDistance,
      cameraSettings.zoomSpeed,
      cameraSettings.autoFollow,
      audioSettings.musicVolume,
      audioSettings.sfxVolume,
      audioSettings.muted,
      this.graphicsQuality,
      this.currentLevelId,
      this.unlockedLevel,
      this.newlyUnlockedLevel ?? '',
      webglError ?? '',
    ].join('|');

    if (key === this.lastHudKey) return;
    this.lastHudKey = key;

    this.onHudChange({
      phase: this.phase,
      playerRole: this.selectedRole,
      playerName,
      winner: this.winner,
      timeRemaining: roundedTime,
      countdownSeconds,
      isHiding: this.playerActor?.isHiding ?? false,
      playerCaught: this.playerActor?.caught ?? false,
      isExploringSchool: this.exploreMode,
      isSpectating,
      spectatingTargetId,
      spectatingName,
      spectatingRole,
      spectatingCanCycle,
      spectateCameraMode,
      spectateTargets,
      canTag,
      tagTargetName,
      canSlapHider,
      slapTargetName,
      canSlapNpc,
      slapNpcLabel,
      canRingTempleBell,
      templeBellLabel,
      canHandshake,
      handshakeTargetName,
      canSit,
      isSitting,
      seatLabel,
      nearestDistance: roundedDist,
      seekerMode: this.seekerMode,
      hidingSpotLabel,
      remainingHiders,
      totalHiders: hiders.length || 4,
      caughtCount,
      participants,
      eventBanner: this.eventBanner,
      cameraSettings,
      audioSettings,
      graphicsQuality: this.graphicsQuality,
      currentLevelId: this.currentLevelId,
      unlockedLevel: this.unlockedLevel,
      newlyUnlockedLevel: this.newlyUnlockedLevel,
      levelName: this.activeLevelConfig.name,
      difficultyLabel: this.activeLevelConfig.difficultyLabel,
      webglError,
      matchResult: matchEndedResult,
    });
  }

  private completeMatch(winner: MatchWinner): void {
    this.phase = 'ended';
    this.winner = winner;
    this.pendingWinner = null;
    this.eventBanner = null;
    this.spectateCameraMode = 'follow';
    this.freeCamVerticalInput = 0;
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.cameraController?.exitFreeCamera();
    this.cameraController?.setFullScreenTouchLook(false);

    const playerWon =
      winner !== null &&
      ((winner === 'hiders' && this.selectedRole === 'hider') ||
        (winner === 'seekers' && this.selectedRole === 'seeker'));

    if (
      playerWon &&
      this.currentLevelId === this.unlockedLevel &&
      this.unlockedLevel < TOTAL_LEVELS
    ) {
      this.unlockedLevel = this.currentLevelId + 1;
      this.newlyUnlockedLevel = this.unlockedLevel;
      saveUnlockedLevel(this.unlockedLevel);
    } else {
      this.newlyUnlockedLevel = null;
    }

    this.audio.playMatchEnd(playerWon);
    this.emitHud();
  }

  private resolveActorFacialExpression(
    actor: ParticipantActor,
    animState: CharacterAnimState,
  ): FacialExpression | undefined {
    if (
      (actor.activeEmote && actor.emoteTimer && actor.emoteTimer > 0) ||
      animState === 'tag_lunge' ||
      animState === 'counting_eyes_closed' ||
      animState === 'caught_funny'
    ) {
      return undefined;
    }

    if (
      actor.expressionOverride &&
      actor.expressionOverrideTimer &&
      actor.expressionOverrideTimer > 0
    ) {
      return actor.expressionOverride;
    }

    if (actor.slapFlinchTimer && actor.slapFlinchTimer > 0) {
      return 'surprise';
    }

    if (this.phase === 'ended' && this.winner !== null) {
      const won =
        (this.winner === 'hiders' && actor.role === 'hider') ||
        (this.winner === 'seekers' && actor.role === 'seeker');
      return won ? 'happy' : 'sad';
    }

    if (this.phase === 'playing' && this.countdownTimer <= 0) {
      if (actor.role === 'hider' && this.seekerActor) {
        const seekerPos = this.seekerActor.rig.root.position;
        const dist = actor.rig.root.position.distanceTo(seekerPos);
        if (
          dist < 3.6 &&
          this.hasLineOfSight(seekerPos, actor.rig.root.position)
        ) {
          return 'surprise';
        }
        if (dist < 6.8) {
          return 'fear';
        }
      } else if (actor.role === 'seeker') {
        if (!actor.isPlayer && this.seekerMode === 'chasing') {
          return 'excited';
        }
        const seekerPos = actor.rig.root.position;
        for (const candidate of this.actors) {
          if (candidate.role !== 'hider' || candidate.caught) continue;
          const dist = seekerPos.distanceTo(candidate.rig.root.position);
          if (dist < 5.5 && this.hasLineOfSight(seekerPos, candidate.rig.root.position)) {
            return 'excited';
          }
        }
        return 'determined';
      }
    }

    return undefined;
  }

  private tick = (): void => {
    if (this.disposed || !this.renderer) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;

    if (!this.contextLost) {
      this.updateAmbientMotion(dt);

      if (this.eventBannerTimer > 0) {
        this.eventBannerTimer = Math.max(0, this.eventBannerTimer - dt);
        if (this.eventBannerTimer === 0) {
          this.eventBanner = null;
        }
      }

      if (this.phase === 'start') {
        if (this.previewRig) {
          if (this.previewEmoteTimer > 0) {
            this.previewEmoteTimer = Math.max(0, this.previewEmoteTimer - dt);
            if (this.previewEmoteTimer === 0) {
              this.previewEmote = null;
            }
          }
          if (this.previewChatBubble) {
            this.previewChatBubbleTimer = Math.max(
              0,
              this.previewChatBubbleTimer - dt,
            );
            if (this.previewChatBubbleTimer <= 0) {
              this.disposeSprite(this.previewRig.root, this.previewChatBubble);
              this.previewChatBubble = null;
            } else {
              this.previewChatBubble.material.opacity =
                this.previewChatBubbleTimer < 0.7
                  ? Math.max(0, this.previewChatBubbleTimer / 0.7)
                  : 1;
            }
          }

          // Showcase selected 3D character (or active waiting-lobby emote!)
          this.previewRig.root.rotation.y =
            (this.startShowcaseMode === 'menu' ? 0.08 : 0.24) +
            Math.sin(this.elapsed * 0.55) * 0.2;
          this.previewRig.updateAnimation({
            dt,
            moveSpeed: 0,
            state: this.previewEmote
              ? emoteToAnimState(this.previewEmote)
              : 'showcase',
            expression: this.previewEmote ? undefined : 'happy',
          });
        }

        // Animate companion village characters standing in the background courtyard
        for (let i = 0; i < this.backgroundCastRigs.length; i++) {
          const bg = this.backgroundCastRigs[i];
          const tCycle = (this.elapsed + bg.phaseOffset) % 6.4;
          let state: CharacterAnimState = 'showcase';
          let expression: FacialExpression = 'happy';

          if (bg.animMode === 'wave' && tCycle < 2.5) {
            state = 'emote_wave';
            expression = 'excited';
          } else if (bg.animMode === 'clap' && tCycle >= 1.2 && tCycle < 3.4) {
            state = 'emote_clap';
            expression = 'happy';
          } else if (bg.animMode === 'laugh' && tCycle >= 2.2 && tCycle < 4.5) {
            state = 'emote_laugh';
            expression = 'excited';
          }

          bg.rig.root.rotation.y =
            bg.baseRotY +
            Math.sin(this.elapsed * 0.42 + bg.phaseOffset) * 0.15;
          bg.rig.updateAnimation({
            dt,
            moveSpeed: 0,
            state,
            lookAroundPhase: this.elapsed * 0.6 + bg.phaseOffset,
            expression,
          });
        }
      } else if (this.phase === 'playing') {
        if (this.onlineMode) {
          if (this.countdownTimer > 0) {
            this.countdownTimer = Math.max(0, this.countdownTimer - dt);
          }
          this.updatePlayer(dt);
          this.updateRemotePlayers(dt);
          this.updateNameplatesAndChatBubbles(dt);
          this.updateCaughtAnimations(dt);
          this.updateTagRings(dt);

          this.onlineSendAccum += dt;
          if (this.onlineSendAccum >= 0.05) {
            this.onlineSendAccum = 0;
            this.emitOnlineLocalState();
          }
          this.emitHud();
        } else if (this.exploreMode) {
          this.updatePlayer(dt);
          this.updateNameplatesAndChatBubbles(dt);
          this.updateTagRings(dt);
          this.emitHud();
        } else if (this.pendingWinner !== null) {
          // Play out final hider's funny caught animation before ending screen
          this.pendingEndTimer = Math.max(0, this.pendingEndTimer - dt);
          this.updateNameplatesAndChatBubbles(dt);
          this.updateCaughtAnimations(dt);
          if (this.seekerActor) {
            if (
              this.seekerActor.tagLungeTimer &&
              this.seekerActor.tagLungeTimer > 0
            ) {
              this.seekerActor.tagLungeTimer = Math.max(
                0,
                this.seekerActor.tagLungeTimer - dt,
              );
            }
            this.seekerActor.rig.updateAnimation({
              dt,
              moveSpeed: 0,
              state:
                this.seekerActor.tagLungeTimer &&
                this.seekerActor.tagLungeTimer > 0
                  ? 'tag_lunge'
                  : 'idle',
            });
          }
          if (this.pendingEndTimer <= 0) {
            this.completeMatch(this.pendingWinner);
          }
        } else {
          if (this.countdownTimer > 0) {
            this.countdownTimer = Math.max(0, this.countdownTimer - dt);
            const nextCeil = Math.ceil(this.countdownTimer);
            if (nextCeil > 0 && nextCeil < this.lastCountdownCeil) {
              this.audio.playCountdownTick(nextCeil);
            } else if (nextCeil === 0 && this.lastCountdownCeil > 0) {
              this.audio.playSeekStart();
            }
            this.lastCountdownCeil = nextCeil;
          } else {
            this.timeRemaining = Math.max(0, this.timeRemaining - dt);
          }

          if (this.timeRemaining <= 0) {
            if (this.getActiveHiders().length > 0) {
              this.completeMatch('hiders');
            }
          } else {
            this.updatePlayer(dt);
            this.updateAiHiders(dt);
            this.updateAiSeeker(dt);
            this.updateNameplatesAndChatBubbles(dt);
            this.updateCaughtAnimations(dt);
            this.updateTagRings(dt);
            this.emitHud();
          }
        }
      } else {
        this.updateNameplatesAndChatBubbles(dt);
        this.updateCaughtAnimations(dt);
        for (const actor of this.actors) {
          if (!actor.caught) {
            const endAnimState: CharacterAnimState = actor.activeEmote
              ? emoteToAnimState(actor.activeEmote)
              : actor.isHiding
                ? 'crouch'
                : 'idle';
            actor.rig.updateAnimation({
              dt,
              moveSpeed: 0,
              state: endAnimState,
              expression: this.resolveActorFacialExpression(actor, endAnimState),
            });
          }
        }
      }

      // Per-frame 1990s village ambience, nostalgic music & dynamic footsteps
      const focusActor = this.getCameraFocusActor();
      const listenerX = focusActor
        ? focusActor.rig.root.position.x
        : this.camera.position.x;
      const listenerZ = focusActor
        ? focusActor.rig.root.position.z
        : this.camera.position.z;
      const activeMoveSpeed =
        this.playerActor && !this.playerActor.caught
          ? this.playerActor.lastMoveSpeed
          : 0;
      const activeAnimState: CharacterAnimState =
        this.playerActor && !this.playerActor.caught
          ? this.lastPlayerAnimState
          : 'idle';
      const listenerY = this.playerActor
        ? this.playerActor.rig.root.position.y
        : this.camera.position.y;
      this.audio.update(
        dt,
        this.phase,
        listenerX,
        listenerZ,
        activeAnimState,
        activeMoveSpeed,
        listenerY,
      );

      this.updateCamera(dt);
      if (this.phase === 'playing') {
        this.emitMinimapFrame();
      }
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.disposed || !this.renderer) return;

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    if (!this.renderer || this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Do not intercept typing inside chat, report, or character name fields
    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return;
    }

    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyQ',
        'KeyC',
        'Space',
        'ShiftLeft',
        'ShiftRight',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.code)
    ) {
      this.keysPressed.add(e.code);
    }

    if (this.phase !== 'playing') return;

    if (this.playerActor?.role === 'hider' && this.playerActor.caught) {
      if (!e.repeat) {
        if (e.code === 'KeyF' || e.code === 'KeyV') {
          e.preventDefault();
          this.toggleSpectateCameraMode();
          return;
        }
        if (e.code === 'BracketLeft') {
          this.cycleSpectateTarget(-1);
          return;
        }
        if (e.code === 'BracketRight') {
          this.cycleSpectateTarget(1);
          return;
        }
        if (this.spectateCameraMode === 'follow') {
          if (e.code === 'ArrowLeft') {
            this.cycleSpectateTarget(-1);
            return;
          }
          if (e.code === 'ArrowRight') {
            this.cycleSpectateTarget(1);
            return;
          }
        }
        if (e.code === 'KeyR') {
          this.recenterCamera();
          return;
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
      }
      // Strictly block hide, jump, tag, and slap actions for spectators
      return;
    }

    if (
      (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') &&
      !e.repeat
    ) {
      this.toggleHide();
    } else if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.triggerJump();
    } else if (e.code === 'KeyB' && !e.repeat) {
      e.preventDefault();
      this.tryRingTempleBell();
    } else if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      if (this.playerActor?.role === 'seeker') {
        if (this.findNearestTagTarget()) {
          this.tryTag();
        } else if (this.findNearestTempleBell()) {
          this.tryRingTempleBell();
        } else {
          this.trySlapNpc();
        }
      } else if (this.playerActor?.role === 'hider') {
        if (this.findNearestSlapTarget()) {
          this.trySlapHider();
        } else if (this.findNearestTempleBell()) {
          this.tryRingTempleBell();
        } else {
          this.trySlapNpc();
        }
      }
    } else if (e.code === 'KeyF' && !e.repeat) {
      e.preventDefault();
      this.tryHandshake();
    } else if (e.code === 'KeyG' && !e.repeat) {
      e.preventDefault();
      this.tryToggleSit();
    } else if (e.code === 'KeyR' && !e.repeat) {
      this.recenterCamera();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keysPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.freeCamVerticalInput = 0;
    this.cameraController?.resetPointerState();
  };

  private handleResize = (): void => {
    if (!this.renderer) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.getTargetPixelRatio(this.graphicsQuality));
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.emitHud('Graphics context was paused. Waiting to restore...');
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.emitHud(null);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
    if (this.renderer) {
      this.renderer.domElement.addEventListener(
        'webglcontextlost',
        this.handleContextLost,
        false,
      );
      this.renderer.domElement.addEventListener(
        'webglcontextrestored',
        this.handleContextRestored,
        false,
      );
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    if (this.renderer) {
      this.renderer.domElement.removeEventListener(
        'webglcontextlost',
        this.handleContextLost,
      );
      this.renderer.domElement.removeEventListener(
        'webglcontextrestored',
        this.handleContextRestored,
      );
    }

    if (this.cameraController) {
      this.cameraController.dispose();
      this.cameraController = null;
    }

    this.audio.dispose();

    this.clearPreviewRig();
    this.clearActors();
    this.detachWorldGroup();

    const geoSet = new Set<THREE.BufferGeometry>();
    const matSet = new Set<THREE.Material>();
    const collectDisposable = (root: THREE.Object3D) => {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          geoSet.add(obj.geometry);
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => matSet.add(m));
          } else {
            matSet.add(obj.material);
          }
        } else if (obj instanceof THREE.Sprite) {
          matSet.add(obj.material);
        }
      });
    };

    collectDisposable(this.scene);
    for (const npcSys of this.npcCache.values()) {
      npcSys.dispose();
    }
    this.npcCache.clear();
    this.activeNpcSystem = null;
    if (this.skeletonVampire) {
      this.scene.remove(this.skeletonVampire.group);
      this.skeletonVampire.dispose();
      this.skeletonVampire = null;
    }

    for (const cached of this.levelCache.values()) {
      collectDisposable(cached.group);
    }
    this.levelCache.clear();
    this.cloudSprites = [];

    if (this.skyDomeMesh) {
      const mat = this.skyDomeMesh.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
    }

    geoSet.forEach((g) => g.dispose());
    matSet.forEach((m) => m.dispose());

    this.textures?.dispose();
    this.envTexture?.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }
}

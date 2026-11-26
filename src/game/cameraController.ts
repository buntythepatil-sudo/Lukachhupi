import * as THREE from 'three';
import { CameraSettings, VillageColliders } from './types';

export const CAMERA_MIN_ZOOM = 2.6;
export const CAMERA_MAX_ZOOM = 15.0;
export const CAMERA_DEFAULT_ZOOM = 8.4;

export const CAMERA_MIN_SENSITIVITY = 0.3;
export const CAMERA_MAX_SENSITIVITY = 2.5;
export const CAMERA_DEFAULT_SENSITIVITY = 1.0;

export const CAMERA_MIN_ZOOM_SPEED = 0.4;
export const CAMERA_MAX_ZOOM_SPEED = 2.2;
export const CAMERA_DEFAULT_ZOOM_SPEED = 1.0;

const MIN_PITCH = -0.22; // Look up toward rooftops, banyan canopy, and sky
const MAX_PITCH = 1.18; // Look down from a high courtyard overview
const DEFAULT_PITCH = 0.44;
const FREE_MIN_PITCH = -0.72;
const FREE_MAX_PITCH = 1.32;
const FREE_MIN_Y = 1.45;
const FREE_MAX_Y = 26.0;
const FREE_HORIZONTAL_SPEED = 12.5;
const FREE_VERTICAL_SPEED = 8.5;

const MIN_GROUND_Y = 0.44;
const WALL_BUFFER = 0.38;
const MIN_SAFE_DIST = 1.18; // Never clip inside character head/torso
const MANUAL_FOLLOW_COOLDOWN = 2.4;

const BASE_MOUSE_YAW_SENS = 0.0062;
const BASE_MOUSE_PITCH_SENS = 0.0052;
const BASE_TOUCH_YAW_SENS = 0.0076;
const BASE_TOUCH_PITCH_SENS = 0.0064;
const BASE_WHEEL_ZOOM_SENS = 0.011;
const BASE_PINCH_ZOOM_SENS = 0.032;

// Reusable scratch math objects (zero GC per frame)
const _pivotGoal = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _candCamPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _freeForward = new THREE.Vector3();
const _freeRight = new THREE.Vector3();
const _freeDesiredVel = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _hitBuffer: THREE.Intersection[] = [];

function wrapAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createDefaultCameraSettings(): CameraSettings {
  return {
    sensitivity: CAMERA_DEFAULT_SENSITIVITY,
    zoomDistance: CAMERA_DEFAULT_ZOOM,
    zoomSpeed: CAMERA_DEFAULT_ZOOM_SPEED,
    autoFollow: true,
  };
}

interface TouchPoint {
  x: number;
  y: number;
  startedRightSide: boolean;
}

export interface CameraFollowTarget {
  position: THREE.Vector3;
  facingYaw: number;
  moveSpeed: number;
  crouchBlend: number;
  insideHouse: boolean;
  isPlayerControlled?: boolean;
  forwardInput?: number;
  rightInput?: number;
}

export interface FreeCameraInput {
  forward: number;
  right: number;
  vertical: number;
  worldRadius: number;
}

export class ThirdPersonCameraController {
  private domElement: HTMLElement;
  private occluders: THREE.Mesh[] = [];
  private colliders: VillageColliders | null = null;
  private onSettingsChanged?: (settings: CameraSettings) => void;

  private enabled = false;
  private freeMode = false;
  private fullScreenTouchLook = false;
  private settings: CameraSettings = createDefaultCameraSettings();

  // Target & smoothly damped spherical orbit parameters
  private targetYaw = 0;
  private currentYaw = 0;
  private targetPitch = DEFAULT_PITCH;
  private currentPitch = DEFAULT_PITCH;
  private targetZoom = CAMERA_DEFAULT_ZOOM;
  private currentZoom = CAMERA_DEFAULT_ZOOM;
  private resolvedDistance = CAMERA_DEFAULT_ZOOM;

  private smoothedPivot = new THREE.Vector3(0, 1.25, 0);
  private smoothedLook = new THREE.Vector3(0, 1.25, 0);
  private initializedPivot = false;

  // Spectator Free Camera state
  private freePosition = new THREE.Vector3(0, 8, 12);
  private freeVelocity = new THREE.Vector3();
  private freeDollyImpulse = 0;

  // Cooldown & recenter state
  private manualCooldown = 0;
  private recentering = false;

  // Pointer & multi-touch state
  private mousePointerId: number | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private activeTouches = new Map<number, TouchPoint>();
  private touchLookId: number | null = null;
  private lastPinchDist: number | null = null;

  constructor(
    domElement: HTMLElement,
    onSettingsChanged?: (settings: CameraSettings) => void,
  ) {
    this.domElement = domElement;
    this.onSettingsChanged = onSettingsChanged;
    this.domElement.style.touchAction = 'none';
    this.bindEvents();
  }

  public setWorldCollisionData(
    occluders: THREE.Mesh[],
    colliders: VillageColliders,
  ): void {
    this.occluders = occluders;
    this.colliders = colliders;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.freeMode = false;
      this.fullScreenTouchLook = false;
      this.freeVelocity.set(0, 0, 0);
      this.freeDollyImpulse = 0;
      this.resetPointerState();
      this.domElement.style.cursor = 'default';
    } else {
      this.domElement.style.cursor = 'grab';
    }
  }

  public setFullScreenTouchLook(enabled: boolean): void {
    this.fullScreenTouchLook = enabled;
  }

  public enterFreeCamera(
    camera: THREE.PerspectiveCamera,
    worldRadius: number,
  ): void {
    this.freeMode = true;
    this.freeVelocity.set(0, 0, 0);
    this.freeDollyImpulse = 0;
    this.recentering = false;
    this.manualCooldown = 0;

    this.freePosition.copy(camera.position);
    this.freePosition.y = THREE.MathUtils.clamp(
      Math.max(this.freePosition.y, 2.8),
      FREE_MIN_Y,
      FREE_MAX_Y,
    );
    const maxR = Math.max(10, worldRadius + 4);
    const r = Math.hypot(this.freePosition.x, this.freePosition.z);
    if (r > maxR) {
      this.freePosition.x = (this.freePosition.x / r) * maxR;
      this.freePosition.z = (this.freePosition.z / r) * maxR;
    }

    this.targetPitch = THREE.MathUtils.clamp(
      this.currentPitch,
      FREE_MIN_PITCH,
      FREE_MAX_PITCH,
    );
    this.currentPitch = this.targetPitch;
    this.targetYaw = this.currentYaw;
  }

  public exitFreeCamera(): void {
    if (!this.freeMode) return;
    this.freeMode = false;
    this.freeVelocity.set(0, 0, 0);
    this.freeDollyImpulse = 0;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch,
      MIN_PITCH,
      MAX_PITCH,
    );
    this.currentPitch = THREE.MathUtils.clamp(
      this.currentPitch,
      MIN_PITCH,
      MAX_PITCH,
    );
  }

  public isFreeCameraActive(): boolean {
    return this.freeMode;
  }

  public getFreeCameraPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.freePosition);
  }

  public updateFreeCamera(
    camera: THREE.PerspectiveCamera,
    input: FreeCameraInput,
    dt: number,
  ): void {
    const yawStep = wrapAngleDelta(this.targetYaw - this.currentYaw);
    this.currentYaw += yawStep * (1 - Math.exp(-15 * dt));
    this.currentPitch = THREE.MathUtils.damp(
      this.currentPitch,
      this.targetPitch,
      15,
      dt,
    );

    const cosPitch = Math.cos(this.currentPitch);
    const sinPitch = Math.sin(this.currentPitch);
    const sinYaw = Math.sin(this.currentYaw);
    const cosYaw = Math.cos(this.currentYaw);

    // Horizontal forward/right basis aligned with camera view
    _freeForward.set(-sinYaw, 0, -cosYaw).normalize();
    _freeRight.set(cosYaw, 0, -sinYaw).normalize();

    const horizMag = Math.hypot(input.forward, input.right);
    const normFwd = horizMag > 1 ? input.forward / horizMag : input.forward;
    const normRgt = horizMag > 1 ? input.right / horizMag : input.right;

    _freeDesiredVel.set(
      (_freeForward.x * normFwd + _freeRight.x * normRgt) * FREE_HORIZONTAL_SPEED,
      THREE.MathUtils.clamp(input.vertical, -1, 1) * FREE_VERTICAL_SPEED,
      (_freeForward.z * normFwd + _freeRight.z * normRgt) * FREE_HORIZONTAL_SPEED,
    );

    if (Math.abs(this.freeDollyImpulse) > 0.01) {
      const dollyDirX = -sinYaw * cosPitch;
      const dollyDirY = -sinPitch;
      const dollyDirZ = -cosYaw * cosPitch;
      _freeDesiredVel.x += dollyDirX * this.freeDollyImpulse;
      _freeDesiredVel.y += dollyDirY * this.freeDollyImpulse;
      _freeDesiredVel.z += dollyDirZ * this.freeDollyImpulse;
      this.freeDollyImpulse *= Math.exp(-10 * dt);
    } else {
      this.freeDollyImpulse = 0;
    }

    this.freeVelocity.x = THREE.MathUtils.damp(
      this.freeVelocity.x,
      _freeDesiredVel.x,
      9.5,
      dt,
    );
    this.freeVelocity.y = THREE.MathUtils.damp(
      this.freeVelocity.y,
      _freeDesiredVel.y,
      9.5,
      dt,
    );
    this.freeVelocity.z = THREE.MathUtils.damp(
      this.freeVelocity.z,
      _freeDesiredVel.z,
      9.5,
      dt,
    );

    this.freePosition.addScaledVector(this.freeVelocity, dt);
    this.freePosition.y = THREE.MathUtils.clamp(
      this.freePosition.y,
      FREE_MIN_Y,
      FREE_MAX_Y,
    );

    const maxR = Math.max(10, input.worldRadius + 4);
    const r = Math.hypot(this.freePosition.x, this.freePosition.z);
    if (r > maxR) {
      this.freePosition.x = (this.freePosition.x / r) * maxR;
      this.freePosition.z = (this.freePosition.z / r) * maxR;
    }

    // Prevent free camera from clipping inside ground-floor solid walls
    this.keepCameraOutsideSolidWalls(this.freePosition);

    camera.position.copy(this.freePosition);
    _lookTarget.set(
      this.freePosition.x - sinYaw * cosPitch * 8,
      this.freePosition.y - sinPitch * 8,
      this.freePosition.z - cosYaw * cosPitch * 8,
    );
    camera.lookAt(_lookTarget);
  }

  public getSettings(): CameraSettings {
    return { ...this.settings };
  }

  /**
   * Returns the live rendered camera azimuth angle (radians) so PUBG-style
   * camera-relative movement always matches what is on screen.
   */
  public getCameraYaw(): number {
    return this.currentYaw;
  }

  public updateSettings(partial: Partial<CameraSettings>): void {
    let changed = false;

    if (typeof partial.sensitivity === 'number') {
      const next = THREE.MathUtils.clamp(
        partial.sensitivity,
        CAMERA_MIN_SENSITIVITY,
        CAMERA_MAX_SENSITIVITY,
      );
      if (Math.abs(next - this.settings.sensitivity) > 1e-4) {
        this.settings.sensitivity = Math.round(next * 20) / 20;
        changed = true;
      }
    }

    if (typeof partial.zoomDistance === 'number') {
      const next = THREE.MathUtils.clamp(
        partial.zoomDistance,
        CAMERA_MIN_ZOOM,
        CAMERA_MAX_ZOOM,
      );
      if (Math.abs(next - this.settings.zoomDistance) > 1e-4) {
        this.settings.zoomDistance = Math.round(next * 10) / 10;
        this.targetZoom = this.settings.zoomDistance;
        changed = true;
      }
    }

    if (typeof partial.zoomSpeed === 'number') {
      const next = THREE.MathUtils.clamp(
        partial.zoomSpeed,
        CAMERA_MIN_ZOOM_SPEED,
        CAMERA_MAX_ZOOM_SPEED,
      );
      if (Math.abs(next - this.settings.zoomSpeed) > 1e-4) {
        this.settings.zoomSpeed = Math.round(next * 20) / 20;
        changed = true;
      }
    }

    if (typeof partial.autoFollow === 'boolean') {
      if (partial.autoFollow !== this.settings.autoFollow) {
        this.settings.autoFollow = partial.autoFollow;
        changed = true;
      }
    }

    if (changed) {
      this.onSettingsChanged?.(this.getSettings());
    }
  }

  public resetSettings(facingYaw?: number): void {
    this.settings = createDefaultCameraSettings();
    this.targetZoom = this.settings.zoomDistance;
    if (typeof facingYaw === 'number') {
      this.recenterBehind(facingYaw);
    }
    this.onSettingsChanged?.(this.getSettings());
  }

  /**
   * Immediately snaps the camera cleanly behind the character at match start
   * so there is no dizzying swoop from the start-screen preview camera.
   */
  public snapBehind(
    position: THREE.Vector3,
    facingYaw: number,
    camera: THREE.PerspectiveCamera,
  ): void {
    const behindYaw = facingYaw + Math.PI;
    this.targetYaw = behindYaw;
    this.currentYaw = behindYaw;
    this.targetPitch = DEFAULT_PITCH;
    this.currentPitch = DEFAULT_PITCH;
    this.targetZoom = this.settings.zoomDistance;
    this.currentZoom = this.settings.zoomDistance;
    this.resolvedDistance = this.settings.zoomDistance;
    this.manualCooldown = 0;
    this.recentering = false;

    this.smoothedPivot.set(position.x, position.y + 1.28, position.z);
    this.smoothedLook.copy(this.smoothedPivot);
    this.initializedPivot = true;

    this.applyToCamera(camera, {
      position,
      facingYaw,
      moveSpeed: 0,
      crouchBlend: 0,
      insideHouse: false,
    }, 0.016, true);
  }

  /**
   * Smoothly returns the camera directly behind the character's back.
   */
  public recenterBehind(facingYaw: number): void {
    const behindYaw = facingYaw + Math.PI;
    const delta = wrapAngleDelta(behindYaw - this.targetYaw);
    this.targetYaw += delta;
    this.targetPitch = DEFAULT_PITCH;
    this.manualCooldown = 0;
    this.recentering = true;
  }

  public isDragging(): boolean {
    return (
      this.mousePointerId !== null ||
      this.touchLookId !== null ||
      this.activeTouches.size >= 2
    );
  }

  public update(
    camera: THREE.PerspectiveCamera,
    target: CameraFollowTarget,
    dt: number,
  ): void {
    if (!this.initializedPivot) {
      this.snapBehind(target.position, target.facingYaw, camera);
      return;
    }

    const dragging = this.isDragging();

    if (dragging) {
      this.manualCooldown = MANUAL_FOLLOW_COOLDOWN;
      this.recentering = false;
    } else if (this.manualCooldown > 0) {
      this.manualCooldown = Math.max(0, this.manualCooldown - dt);
    }

    // PUBG-style camera follow:
    // - Recenter button smoothly aligns camera behind the character.
    // - While player runs backward (S) or pure strafe (A/D), never spin camera to fight input.
    // - When steering forward-diagonally (W+A / W+D or angled joystick) with autoFollow on,
    //   gently drift behind the turn; when spectating an AI teammate, follow smoothly behind them.
    const behindYaw = target.facingYaw + Math.PI;
    if (this.recentering) {
      const yawDiff = wrapAngleDelta(behindYaw - this.targetYaw);
      this.targetYaw += yawDiff * (1 - Math.exp(-12 * dt));
      if (
        Math.abs(wrapAngleDelta(behindYaw - this.currentYaw)) < 0.03 &&
        Math.abs(this.targetPitch - this.currentPitch) < 0.03
      ) {
        this.recentering = false;
      }
    } else if (
      this.settings.autoFollow &&
      !dragging &&
      this.manualCooldown <= 0 &&
      target.moveSpeed > 0.25
    ) {
      if (target.isPlayerControlled) {
        const fwd = target.forwardInput ?? 0;
        const rgt = target.rightInput ?? 0;
        if (fwd > 0.25 && Math.abs(rgt) > 0.2) {
          const yawDiff = wrapAngleDelta(behindYaw - this.targetYaw);
          this.targetYaw += yawDiff * (1 - Math.exp(-1.15 * dt));
        }
      } else {
        const yawDiff = wrapAngleDelta(behindYaw - this.targetYaw);
        const alignRate = THREE.MathUtils.clamp(target.moveSpeed * 0.48, 1.2, 2.8);
        this.targetYaw += yawDiff * (1 - Math.exp(-alignRate * dt));
      }
    }

    // Frame-rate independent smooth damping on spherical orbit coordinates
    const rotLambda = this.recentering ? 9.5 : 14.5;
    const yawStep = wrapAngleDelta(this.targetYaw - this.currentYaw);
    this.currentYaw += yawStep * (1 - Math.exp(-rotLambda * dt));

    this.currentPitch = THREE.MathUtils.damp(
      this.currentPitch,
      this.targetPitch,
      rotLambda,
      dt,
    );
    this.currentZoom = THREE.MathUtils.damp(
      this.currentZoom,
      this.targetZoom,
      11.0,
      dt,
    );

    this.applyToCamera(camera, target, dt, false);
  }

  private applyToCamera(
    camera: THREE.PerspectiveCamera,
    target: CameraFollowTarget,
    dt: number,
    instant: boolean,
  ): void {
    const pivotHeight =
      target.position.y * 0.85 + THREE.MathUtils.lerp(1.28, 0.88, target.crouchBlend);
    _pivotGoal.set(target.position.x, pivotHeight, target.position.z);

    if (instant) {
      this.smoothedPivot.copy(_pivotGoal);
    } else {
      this.smoothedPivot.x = THREE.MathUtils.damp(
        this.smoothedPivot.x,
        _pivotGoal.x,
        14,
        dt,
      );
      this.smoothedPivot.y = THREE.MathUtils.damp(
        this.smoothedPivot.y,
        _pivotGoal.y,
        12,
        dt,
      );
      this.smoothedPivot.z = THREE.MathUtils.damp(
        this.smoothedPivot.z,
        _pivotGoal.z,
        14,
        dt,
      );
    }

    // Compute desired spherical camera position first, clamping cleanly above ground
    const cosPitch = Math.cos(this.currentPitch);
    const baseDist = target.insideHouse
      ? Math.min(this.currentZoom, 7.2)
      : this.currentZoom;

    _candCamPos.set(
      this.smoothedPivot.x + Math.sin(this.currentYaw) * cosPitch * baseDist,
      Math.max(
        MIN_GROUND_Y,
        this.smoothedPivot.y + Math.sin(this.currentPitch) * baseDist,
      ),
      this.smoothedPivot.z + Math.cos(this.currentYaw) * cosPitch * baseDist,
    );

    // Raycast along the exact line from character pivot to desired camera position
    _rayDir.subVectors(_candCamPos, this.smoothedPivot);
    const desiredDist = Math.max(MIN_SAFE_DIST, _rayDir.length());
    _rayDir.divideScalar(desiredDist);

    // 1. Multi-ray wall avoidance against solid village buildings, walls & props
    const safeDist = this.computeWallSafeDistance(
      this.smoothedPivot,
      _rayDir,
      desiredDist,
    );

    // 2. Asymmetric damping: pull in fast when a wall blocks view, glide out smoothly when clear
    if (instant || safeDist < this.resolvedDistance) {
      this.resolvedDistance = instant
        ? safeDist
        : THREE.MathUtils.damp(this.resolvedDistance, safeDist, 28, dt);
      if (this.resolvedDistance > safeDist + 0.05) {
        this.resolvedDistance = safeDist;
      }
    } else {
      this.resolvedDistance = THREE.MathUtils.damp(
        this.resolvedDistance,
        safeDist,
        6.5,
        dt,
      );
    }

    // 3. Position camera strictly on the player's side of any wall (never behind it)
    const alongRayDist = Math.min(this.resolvedDistance, safeDist);
    _candCamPos.copy(this.smoothedPivot).addScaledVector(_rayDir, alongRayDist);

    // 4. If a wall squeezes the camera closer than MIN_SAFE_DIST, lift vertically over
    // the character's shoulder rather than entering the character or crossing the wall
    if (alongRayDist < MIN_SAFE_DIST) {
      const neededLift = Math.sqrt(
        Math.max(0, MIN_SAFE_DIST * MIN_SAFE_DIST - alongRayDist * alongRayDist),
      );
      const maxCeilingLift = this.computeWallSafeDistance(
        _candCamPos,
        _upVec,
        Math.min(1.45, neededLift + 0.25),
      );
      _candCamPos.y += Math.min(neededLift, maxCeilingLift);
    }

    // Keep safely above ground plane
    if (_candCamPos.y < MIN_GROUND_Y) {
      _candCamPos.y = MIN_GROUND_Y;
    }

    // 5. Final collider push-out guard so camera never slips inside solid building walls
    this.keepCameraOutsideSolidWalls(_candCamPos);

    camera.position.copy(_candCamPos);

    // 6. Look target — raises smoothly when pitching upward so looking at rooftops/sky feels natural
    const lookUpLift =
      this.currentPitch < 0 ? Math.abs(this.currentPitch) * 4.4 : 0;
    _lookTarget.set(
      this.smoothedPivot.x,
      this.smoothedPivot.y + 0.08 + lookUpLift,
      this.smoothedPivot.z,
    );

    if (instant) {
      this.smoothedLook.copy(_lookTarget);
    } else {
      this.smoothedLook.x = THREE.MathUtils.damp(
        this.smoothedLook.x,
        _lookTarget.x,
        16,
        dt,
      );
      this.smoothedLook.y = THREE.MathUtils.damp(
        this.smoothedLook.y,
        _lookTarget.y,
        14,
        dt,
      );
      this.smoothedLook.z = THREE.MathUtils.damp(
        this.smoothedLook.z,
        _lookTarget.z,
        16,
        dt,
      );
    }

    camera.lookAt(this.smoothedLook);
  }

  /**
   * Casts a center ray plus horizontal/vertical whisker rays from the character
   * toward the desired camera position to prevent walls, roofs, or corners from
   * blocking the view or clipping the near plane.
   */
  private computeWallSafeDistance(
    pivot: THREE.Vector3,
    dir: THREE.Vector3,
    desiredDist: number,
  ): number {
    if (this.occluders.length === 0) return desiredDist;

    let minDist = desiredDist;

    // Build orthonormal right vector perpendicular to ray direction
    _rightVec.crossVectors(dir, _upVec);
    if (_rightVec.lengthSq() < 1e-4) {
      _rightVec.set(1, 0, 0);
    } else {
      _rightVec.normalize();
    }

    const probeOffsets: Array<[number, number]> = [
      [0, 0],
      [0.24, 0],
      [-0.24, 0],
      [0, 0.2],
    ];

    _raycaster.near = 0.25;
    _raycaster.far = desiredDist + WALL_BUFFER;

    for (let p = 0; p < probeOffsets.length; p++) {
      const [offR, offU] = probeOffsets[p];
      _rayOrigin
        .copy(pivot)
        .addScaledVector(_rightVec, offR);
      _rayOrigin.y += offU;

      _raycaster.set(_rayOrigin, dir);
      _hitBuffer.length = 0;
      _raycaster.intersectObjects(this.occluders, false, _hitBuffer);

      for (let i = 0; i < _hitBuffer.length; i++) {
        const hit = _hitBuffer[i];
        const mesh = hit.object as THREE.Mesh;
        if (!mesh.visible) continue;

        // Ignore faded-out interior roof meshes when the player is inside a house
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mat && mat.transparent && mat.opacity < 0.5) {
          continue;
        }

        const candidate = Math.max(0.45, hit.distance - WALL_BUFFER);
        if (candidate < minDist) {
          minDist = candidate;
        }
        break; // _hitBuffer is sorted nearest-first
      }
    }

    return minDist;
  }

  /**
   * Ensures the camera point never slips inside an opaque wall box collider
   * (e.g. near tight doorway corners or narrow village alleys).
   */
  private keepCameraOutsideSolidWalls(pos: THREE.Vector3): void {
    if (!this.colliders) return;
    // Only test wall-height cameras against wall colliders (above ~3.4m is above standard walls)
    if (pos.y > 3.55) return;

    const pad = 0.32;
    for (let i = 0; i < this.colliders.boxes.length; i++) {
      const box = this.colliders.boxes[i];
      if (!box.blocksSight) continue;
      if (box.climbable && box.topY !== undefined && pos.y >= box.topY) continue;
      if (
        pos.x > box.minX - pad &&
        pos.x < box.maxX + pad &&
        pos.z > box.minZ - pad &&
        pos.z < box.maxZ + pad
      ) {
        const dLeft = Math.abs(pos.x - (box.minX - pad));
        const dRight = Math.abs(box.maxX + pad - pos.x);
        const dTop = Math.abs(pos.z - (box.minZ - pad));
        const dBottom = Math.abs(box.maxZ + pad - pos.z);
        const m = Math.min(dLeft, dRight, dTop, dBottom);
        if (m === dLeft) pos.x = box.minX - pad;
        else if (m === dRight) pos.x = box.maxX + pad;
        else if (m === dTop) pos.z = box.minZ - pad;
        else pos.z = box.maxZ + pad;
      }
    }
  }

  private adjustZoom(delta: number): void {
    if (this.freeMode) {
      this.freeDollyImpulse = THREE.MathUtils.clamp(
        this.freeDollyImpulse - delta * 6.5,
        -22,
        22,
      );
      return;
    }
    const next = THREE.MathUtils.clamp(
      this.targetZoom + delta,
      CAMERA_MIN_ZOOM,
      CAMERA_MAX_ZOOM,
    );
    if (Math.abs(next - this.targetZoom) > 1e-4) {
      this.targetZoom = next;
      const rounded = Math.round(next * 10) / 10;
      if (Math.abs(rounded - this.settings.zoomDistance) >= 0.1) {
        this.settings.zoomDistance = rounded;
        this.onSettingsChanged?.(this.getSettings());
      }
    }
  }

  private applyRotationDelta(
    dx: number,
    dy: number,
    yawScale: number,
    pitchScale: number,
  ): void {
    const sens = this.settings.sensitivity;
    const minPitch = this.freeMode ? FREE_MIN_PITCH : MIN_PITCH;
    const maxPitch = this.freeMode ? FREE_MAX_PITCH : MAX_PITCH;
    this.targetYaw -= dx * yawScale * sens;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch + dy * pitchScale * sens,
      minPitch,
      maxPitch,
    );
    this.manualCooldown = MANUAL_FOLLOW_COOLDOWN;
    this.recentering = false;
  }

  private getPinchDistance(): number | null {
    if (this.activeTouches.size < 2) return null;
    const iter = this.activeTouches.values();
    const first = iter.next().value;
    const second = iter.next().value;
    if (!first || !second) return null;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;

    if (e.pointerType === 'touch') {
      const rect = this.domElement.getBoundingClientRect();
      const startedRightSide =
        this.fullScreenTouchLook || e.clientX >= rect.left + rect.width * 0.5;

      this.activeTouches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startedRightSide,
      });

      try {
        this.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }

      if (this.activeTouches.size === 1) {
        // Single-finger mobile rotation activates on the right half (or full screen in follow spectator mode)
        if (startedRightSide) {
          this.touchLookId = e.pointerId;
        }
      } else if (this.activeTouches.size >= 2) {
        // Two-finger pinch zoom overrides single-finger look
        this.touchLookId = null;
        this.lastPinchDist = this.getPinchDistance();
      }
      return;
    }

    // Desktop mouse / pen drag (left or right button) anywhere on canvas
    if (e.button !== 0 && e.button !== 2) return;
    this.mousePointerId = e.pointerId;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.domElement.style.cursor = 'grabbing';
    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;

    if (e.pointerType === 'touch') {
      const prev = this.activeTouches.get(e.pointerId);
      if (!prev) return;

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;

      if (this.activeTouches.size >= 2) {
        const dist = this.getPinchDistance();
        if (dist !== null && this.lastPinchDist !== null) {
          const deltaDist = dist - this.lastPinchDist;
          this.adjustZoom(
            -deltaDist * BASE_PINCH_ZOOM_SENS * this.settings.zoomSpeed,
          );
        }
        this.lastPinchDist = dist;
        return;
      }

      if (e.pointerId === this.touchLookId) {
        this.applyRotationDelta(
          dx,
          dy,
          BASE_TOUCH_YAW_SENS,
          BASE_TOUCH_PITCH_SENS,
        );
      }
      return;
    }

    if (this.mousePointerId !== e.pointerId) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.applyRotationDelta(dx, dy, BASE_MOUSE_YAW_SENS, BASE_MOUSE_PITCH_SENS);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.activeTouches.delete(e.pointerId);
      if (this.touchLookId === e.pointerId) {
        this.touchLookId = null;
      }
      if (this.activeTouches.size < 2) {
        this.lastPinchDist = null;
      }
      if (this.activeTouches.size === 1) {
        const [remainingId, remainingPt] = this.activeTouches.entries().next()
          .value as [number, TouchPoint];
        if (remainingPt.startedRightSide) {
          this.touchLookId = remainingId;
        }
      }
      return;
    }

    if (this.mousePointerId === e.pointerId) {
      this.mousePointerId = null;
      this.domElement.style.cursor = this.enabled ? 'grab' : 'default';
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    const clampedDelta = THREE.MathUtils.clamp(e.deltaY, -180, 180);
    this.adjustZoom(
      clampedDelta * BASE_WHEEL_ZOOM_SENS * this.settings.zoomSpeed,
    );
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.enabled) {
      e.preventDefault();
    }
  };

  public resetPointerState(): void {
    this.mousePointerId = null;
    this.touchLookId = null;
    this.activeTouches.clear();
    this.lastPinchDist = null;
  }

  private bindEvents(): void {
    this.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.domElement.addEventListener('pointercancel', this.handlePointerUp);
    this.domElement.addEventListener('wheel', this.handleWheel, {
      passive: false,
    });
    this.domElement.addEventListener('contextmenu', this.handleContextMenu);
  }

  public dispose(): void {
    this.resetPointerState();
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.domElement.removeEventListener('pointercancel', this.handlePointerUp);
    this.domElement.removeEventListener('wheel', this.handleWheel);
    this.domElement.removeEventListener('contextmenu', this.handleContextMenu);
  }
}

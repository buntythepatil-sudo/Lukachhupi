import type { CharacterAnimState, FacialExpression } from './types';

export interface RemoteMotionSnapshot {
  serverTimeMs: number;
  receivedAtMs: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  moveSpeed: number;
  isHiding: boolean;
  animState: CharacterAnimState;
  expression?: FacialExpression;
}

export interface InterpolatedRemotePose {
  x: number;
  y: number;
  z: number;
  rotY: number;
  moveSpeed: number;
  isHiding: boolean;
  animState: CharacterAnimState;
  expression?: FacialExpression;
  teleported: boolean;
}

const MAX_SNAPSHOTS = 12;
const BASE_INTERP_DELAY_MS = 95;
const MIN_INTERP_DELAY_MS = 70;
const MAX_INTERP_DELAY_MS = 175;
const MAX_EXTRAPOLATION_MS = 140;
const MAX_EXTRAPOLATION_SPEED = 8.5;
const TELEPORT_SNAP_DISTANCE = 9.5;

export function lerpShortestAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * Math.max(0, Math.min(1, t));
}

/**
 * Timestamped snapshot interpolator with adaptive jitter buffer and bounded
 * dead-reckoning for smooth remote player movement over mobile internet.
 */
export class RemotePlayerInterpolator {
  private snapshots: RemoteMotionSnapshot[] = [];
  private clockOffsetMs: number | null = null;
  private jitterMs = 15;
  private lastReceiveGapMs = 50;
  private lastReceivedAtMs = 0;

  private lastOutputX = 0;
  private lastOutputY = 0;
  private lastOutputZ = 0;
  private lastOutputRotY = 0;
  private initialized = false;

  constructor(initial?: {
    x: number;
    y?: number;
    z: number;
    rotY: number;
    moveSpeed?: number;
    isHiding?: boolean;
    animState?: CharacterAnimState;
    expression?: FacialExpression;
  }) {
    if (initial) {
      this.reset(initial);
    }
  }

  public reset(initial: {
    x: number;
    y?: number;
    z: number;
    rotY: number;
    moveSpeed?: number;
    isHiding?: boolean;
    animState?: CharacterAnimState;
    expression?: FacialExpression;
  }): void {
    this.snapshots = [];
    this.clockOffsetMs = null;
    this.jitterMs = 15;
    this.lastReceiveGapMs = 50;
    this.lastReceivedAtMs = 0;
    this.lastOutputX = initial.x;
    this.lastOutputY = initial.y ?? 0;
    this.lastOutputZ = initial.z;
    this.lastOutputRotY = initial.rotY;
    this.initialized = true;
  }

  public pushSnapshot(
    sample: {
      x: number;
      y?: number;
      z: number;
      rotY: number;
      moveSpeed: number;
      isHiding: boolean;
      animState: CharacterAnimState;
      expression?: FacialExpression;
    },
    serverTimeMs: number,
    nowMs: number,
  ): void {
    const safeServerTime = Number.isFinite(serverTimeMs) ? serverTimeMs : nowMs;
    const measuredOffset = nowMs - safeServerTime;

    if (this.clockOffsetMs === null) {
      this.clockOffsetMs = measuredOffset;
    } else {
      // Smoothly track clock offset; jump quickly if a tab resumed from sleep
      const offsetDelta = measuredOffset - this.clockOffsetMs;
      if (Math.abs(offsetDelta) > 1500) {
        this.clockOffsetMs = measuredOffset;
      } else {
        this.clockOffsetMs += offsetDelta * 0.12;
      }
    }

    if (this.lastReceivedAtMs > 0) {
      const gap = Math.max(0, Math.min(400, nowMs - this.lastReceivedAtMs));
      const variation = Math.abs(gap - this.lastReceiveGapMs);
      this.jitterMs = this.jitterMs * 0.82 + variation * 0.18;
      this.lastReceiveGapMs = this.lastReceiveGapMs * 0.8 + gap * 0.2;
    }
    this.lastReceivedAtMs = nowMs;

    const entry: RemoteMotionSnapshot = {
      serverTimeMs: safeServerTime,
      receivedAtMs: nowMs,
      x: sample.x,
      y: sample.y ?? 0,
      z: sample.z,
      rotY: sample.rotY,
      moveSpeed: sample.moveSpeed,
      isHiding: sample.isHiding,
      animState: sample.animState,
      expression: sample.expression,
    };

    const last = this.snapshots[this.snapshots.length - 1];
    if (last && safeServerTime <= last.serverTimeMs) {
      // Replace duplicate/out-of-order same-tick timestamp cleanly
      if (safeServerTime === last.serverTimeMs) {
        this.snapshots[this.snapshots.length - 1] = entry;
      }
      return;
    }

    this.snapshots.push(entry);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.splice(0, this.snapshots.length - MAX_SNAPSHOTS);
    }

    if (!this.initialized) {
      this.lastOutputX = entry.x;
      this.lastOutputY = entry.y;
      this.lastOutputZ = entry.z;
      this.lastOutputRotY = entry.rotY;
      this.initialized = true;
    }
  }

  public getAdaptiveDelayMs(extraNetworkDelayMs = 0): number {
    const dynamicDelay =
      BASE_INTERP_DELAY_MS + this.jitterMs * 1.15 + extraNetworkDelayMs;
    return Math.max(
      MIN_INTERP_DELAY_MS,
      Math.min(MAX_INTERP_DELAY_MS, dynamicDelay),
    );
  }

  public sample(
    nowMs: number,
    dt: number,
    extraNetworkDelayMs = 0,
  ): InterpolatedRemotePose | null {
    const count = this.snapshots.length;
    if (count === 0) return null;

    const latest = this.snapshots[count - 1];
    const estimatedServerNow =
      this.clockOffsetMs !== null ? nowMs - this.clockOffsetMs : latest.serverTimeMs;
    const renderServerTime =
      estimatedServerNow - this.getAdaptiveDelayMs(extraNetworkDelayMs);

    let targetX = latest.x;
    let targetY = latest.y;
    let targetZ = latest.z;
    let targetRotY = latest.rotY;
    let targetSpeed = latest.moveSpeed;
    let isHiding = latest.isHiding;
    let animState = latest.animState;
    let expression = latest.expression;
    let teleported = false;

    if (count === 1 || renderServerTime <= this.snapshots[0].serverTimeMs) {
      const first = this.snapshots[0];
      targetX = first.x;
      targetY = first.y;
      targetZ = first.z;
      targetRotY = first.rotY;
      targetSpeed = first.moveSpeed;
      isHiding = first.isHiding;
      animState = first.animState;
      expression = first.expression;
    } else if (renderServerTime >= latest.serverTimeMs) {
      // Slightly ahead of latest received packet: apply bounded dead reckoning
      const prev = this.snapshots[count - 2];
      const segDtMs = latest.serverTimeMs - prev.serverTimeMs;
      const aheadMs = Math.min(
        MAX_EXTRAPOLATION_MS,
        Math.max(0, renderServerTime - latest.serverTimeMs),
      );
      const jumpDist = Math.hypot(latest.x - prev.x, latest.z - prev.z);

      if (
        segDtMs >= 16 &&
        segDtMs <= 500 &&
        aheadMs > 0 &&
        jumpDist < TELEPORT_SNAP_DISTANCE
      ) {
        const segDtSec = segDtMs / 1000;
        let vx = (latest.x - prev.x) / segDtSec;
        let vy = (latest.y - prev.y) / segDtSec;
        let vz = (latest.z - prev.z) / segDtSec;
        const horizSpeed = Math.hypot(vx, vz);
        if (horizSpeed > MAX_EXTRAPOLATION_SPEED) {
          const scale = MAX_EXTRAPOLATION_SPEED / horizSpeed;
          vx *= scale;
          vz *= scale;
        }
        vy = Math.max(-5, Math.min(5, vy));
        // Gentle velocity decay as extrapolation reaches its cap
        const decay = 1 - 0.35 * (aheadMs / MAX_EXTRAPOLATION_MS);
        const extrapSec = (aheadMs / 1000) * decay;
        targetX = latest.x + vx * extrapSec;
        targetY = Math.max(0, latest.y + vy * extrapSec);
        targetZ = latest.z + vz * extrapSec;
      } else {
        targetX = latest.x;
        targetY = latest.y;
        targetZ = latest.z;
      }
      targetRotY = latest.rotY;
      targetSpeed =
        nowMs - latest.receivedAtMs > 420 ? 0 : latest.moveSpeed;
      isHiding = latest.isHiding;
      animState =
        nowMs - latest.receivedAtMs > 420 &&
        (latest.animState === 'walk' || latest.animState === 'run')
          ? 'idle'
          : latest.animState;
      expression = latest.expression;
    } else {
      // Find bracketing snapshots [a, b] where a.serverTimeMs <= renderServerTime <= b.serverTimeMs
      let idx = count - 2;
      while (idx > 0 && this.snapshots[idx].serverTimeMs > renderServerTime) {
        idx--;
      }
      const a = this.snapshots[idx];
      const b = this.snapshots[idx + 1];
      const span = Math.max(1, b.serverTimeMs - a.serverTimeMs);
      const alpha = Math.max(0, Math.min(1, (renderServerTime - a.serverTimeMs) / span));
      const jumpDist = Math.hypot(b.x - a.x, b.z - a.z);

      if (jumpDist >= TELEPORT_SNAP_DISTANCE) {
        targetX = b.x;
        targetY = b.y;
        targetZ = b.z;
        targetRotY = b.rotY;
        teleported = true;
      } else {
        targetX = a.x + (b.x - a.x) * alpha;
        targetY = a.y + (b.y - a.y) * alpha;
        targetZ = a.z + (b.z - a.z) * alpha;
        targetRotY = lerpShortestAngle(a.rotY, b.rotY, alpha);
      }

      targetSpeed = a.moveSpeed + (b.moveSpeed - a.moveSpeed) * alpha;
      const discrete = alpha >= 0.5 ? b : a;
      isHiding = discrete.isHiding;
      animState = discrete.animState;
      expression = discrete.expression;

      // Trim consumed snapshots older than [idx - 1]
      if (idx > 1) {
        this.snapshots.splice(0, idx - 1);
      }
    }

    const safeDt = Math.max(0.001, Math.min(0.1, dt));
    const outputDist = Math.hypot(
      targetX - this.lastOutputX,
      targetZ - this.lastOutputZ,
    );

    if (teleported || outputDist >= TELEPORT_SNAP_DISTANCE) {
      this.lastOutputX = targetX;
      this.lastOutputY = targetY;
      this.lastOutputZ = targetZ;
      this.lastOutputRotY = targetRotY;
      teleported = true;
    } else {
      // Light smoothing pass eliminates micro-steps if clock offset nudges
      const posBlend = 1 - Math.exp(-22 * safeDt);
      const yBlend = 1 - Math.exp(-24 * safeDt);
      const rotBlend = 1 - Math.exp(-18 * safeDt);
      this.lastOutputX += (targetX - this.lastOutputX) * posBlend;
      this.lastOutputY += (targetY - this.lastOutputY) * yBlend;
      this.lastOutputZ += (targetZ - this.lastOutputZ) * posBlend;
      this.lastOutputRotY = lerpShortestAngle(
        this.lastOutputRotY,
        targetRotY,
        rotBlend,
      );
    }

    return {
      x: this.lastOutputX,
      y: this.lastOutputY,
      z: this.lastOutputZ,
      rotY: this.lastOutputRotY,
      moveSpeed: targetSpeed,
      isHiding,
      animState,
      expression,
      teleported,
    };
  }
}

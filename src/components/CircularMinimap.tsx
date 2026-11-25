import { useEffect, useRef } from 'react';
import { MinimapFrame, TeamRole } from '../game/types';

interface CircularMinimapProps {
  registerListener: (cb: ((frame: MinimapFrame) => void) | null) => void;
  playerRole: TeamRole;
}

const RADAR_VIEW_RADIUS_WORLD = 36; // World meters visible from center to rim

export function CircularMinimap({
  registerListener,
  playerRole,
}: CircularMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const drawFrame = (frame: MinimapFrame) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const layout = frame.layout;
      const cssSize = canvas.clientWidth || 144;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelSize = Math.round(cssSize * dpr);

      if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      const cx = cssSize * 0.5;
      const cy = cssSize * 0.5;
      const radius = cssSize * 0.5 - 2;
      const scale = radius / RADAR_VIEW_RADIUS_WORLD;

      const toMapX = (wx: number) => cx + (wx - frame.playerX) * scale;
      const toMapY = (wz: number) => cy + (wz - frame.playerZ) * scale;

      ctx.clearRect(0, 0, cssSize, cssSize);

      // Clip cleanly to circular radar disc
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // 1. Deep earthy outer terrain background
      ctx.fillStyle = '#241a12';
      ctx.fillRect(0, 0, cssSize, cssSize);

      // 2. Playable level ground circle
      const vCenterX = toMapX(0);
      const vCenterY = toMapY(0);
      const vRadius = layout.worldRadius * scale;
      ctx.beginPath();
      ctx.arc(vCenterX, vCenterY, vRadius, 0, Math.PI * 2);
      ctx.fillStyle = layout.groundTint ?? '#382a1d';
      ctx.fill();
      ctx.strokeStyle = 'rgba(130, 166, 86, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Farm fields, gardens, tall grass & Pond zones (under roads & structures)
      for (const lm of layout.landmarks) {
        const lx = toMapX(lm.x);
        const ly = toMapY(lm.z);
        const lr = lm.radius * scale;
        if (lm.kind === 'farm') {
          ctx.beginPath();
          ctx.roundRect(lx - lr, ly - lr * 0.72, lr * 2, lr * 1.44, 4);
          ctx.fillStyle = 'rgba(104, 134, 58, 0.52)';
          ctx.fill();
        } else if (lm.kind === 'garden') {
          ctx.beginPath();
          ctx.roundRect(lx - lr, ly - lr * 0.85, lr * 2, lr * 1.7, 5);
          ctx.fillStyle = 'rgba(72, 136, 62, 0.58)';
          ctx.fill();
        } else if (lm.kind === 'grass') {
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(96, 154, 62, 0.62)';
          ctx.fill();
        } else if (lm.kind === 'pond') {
          ctx.beginPath();
          ctx.ellipse(lx, ly, lr * 1.05, lr * 0.85, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(54, 136, 168, 0.65)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 206, 224, 0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 3b. River channels (Level 7 River Village)
      if (layout.waterRects) {
        ctx.fillStyle = 'rgba(46, 136, 174, 0.78)';
        for (const wr of layout.waterRects) {
          ctx.save();
          ctx.translate(toMapX(wr.x), toMapY(wr.z));
          ctx.rotate(-wr.rotY);
          const ww = wr.width * scale;
          const wl = wr.length * scale;
          ctx.fillRect(-ww * 0.5, -wl * 0.5, ww, wl);
          ctx.restore();
        }
      }

      // 4. Connected streets, corridors & alleys
      ctx.fillStyle = '#685038';
      for (const road of layout.roads) {
        ctx.save();
        ctx.translate(toMapX(road.x), toMapY(road.z));
        // Match Three.js plane rotation around Y
        ctx.rotate(-road.rotY);
        const rw = road.width * scale;
        const rl = road.length * scale;
        ctx.fillRect(-rw * 0.5, -rl * 0.5, rw, rl);
        ctx.restore();
      }

      // 5. Central courtyard & stage plazas
      for (const lm of layout.landmarks) {
        if (lm.kind === 'courtyard') {
          ctx.beginPath();
          ctx.arc(toMapX(lm.x), toMapY(lm.z), lm.radius * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#7c6246';
          ctx.fill();
        } else if (lm.kind === 'stage') {
          ctx.beginPath();
          ctx.arc(toMapX(lm.x), toMapY(lm.z), lm.radius * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#c4524a';
          ctx.fill();
        }
      }

      // 6. Buildings, bridges, platforms, railway coaches, haveli wings & stalls
      for (const b of layout.buildings) {
        ctx.save();
        ctx.translate(toMapX(b.x), toMapY(b.z));
        ctx.rotate(-b.rotY);
        const bw = b.width * scale;
        const bd = b.depth * scale;

        if (b.kind === 'school') {
          ctx.fillStyle = '#d4b375';
          ctx.strokeStyle = '#5c4422';
        } else if (b.kind === 'temple') {
          ctx.fillStyle = '#e0893e';
          ctx.strokeStyle = '#6e3612';
        } else if (b.kind === 'market' || b.kind === 'stall') {
          ctx.fillStyle = '#d97248';
          ctx.strokeStyle = '#5a2b18';
        } else if (b.kind === 'railway') {
          ctx.fillStyle = '#5c84b0';
          ctx.strokeStyle = '#25394f';
        } else if (b.kind === 'platform') {
          ctx.fillStyle = '#9e978b';
          ctx.strokeStyle = '#4e4942';
        } else if (b.kind === 'haveli') {
          ctx.fillStyle = '#a88c72';
          ctx.strokeStyle = '#47392d';
        } else if (b.kind === 'bridge') {
          ctx.fillStyle = '#b5844e';
          ctx.strokeStyle = '#4f3518';
        } else if (b.kind === 'shed') {
          ctx.fillStyle = '#8b9499';
          ctx.strokeStyle = '#3c4448';
        } else if (b.kind === 'hut') {
          ctx.fillStyle = '#c7a469';
          ctx.strokeStyle = '#54401f';
        } else {
          ctx.fillStyle = '#b9895b';
          ctx.strokeStyle = '#4f3520';
        }

        ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.lineWidth = 1;
        ctx.strokeRect(-bw * 0.5, -bd * 0.5, bw, bd);
        ctx.restore();
      }

      // 7. Banyan tree, village trees & well
      for (const lm of layout.landmarks) {
        const lx = toMapX(lm.x);
        const ly = toMapY(lm.z);
        const lr = Math.max(2.2, lm.radius * scale);

        if (lm.kind === 'banyan') {
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(68, 128, 56, 0.88)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(28, 62, 24, 0.7)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (lm.kind === 'tree') {
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(72, 124, 58, 0.72)';
          ctx.fill();
        } else if (lm.kind === 'well') {
          ctx.beginPath();
          ctx.arc(lx, ly, Math.max(2.6, lr), 0, Math.PI * 2);
          ctx.fillStyle = '#5bb3cc';
          ctx.fill();
          ctx.strokeStyle = '#d6c3a5';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 8. Subtle tactical range ring at half radius
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(253, 230, 180, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 9. Camera viewing cone pointing where the player's camera looks
      // Camera forward on XZ is (-sin(cameraYaw), -cos(cameraYaw))
      const camForwardX = -Math.sin(frame.cameraYaw);
      const camForwardZ = -Math.cos(frame.cameraYaw);
      const camAngle = Math.atan2(camForwardZ, camForwardX);
      const coneSpan = 0.48;
      const coneLen = radius * 0.58;

      const coneGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, coneLen);
      coneGrad.addColorStop(0, 'rgba(255, 232, 182, 0.28)');
      coneGrad.addColorStop(1, 'rgba(255, 232, 182, 0.0)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, coneLen, camAngle - coneSpan, camAngle + coneSpan);
      ctx.closePath();
      ctx.fillStyle = coneGrad;
      ctx.fill();

      // 10. Approximate locations of other active players
      for (const other of frame.others) {
        const dx = (other.approxX - frame.playerX) * scale;
        const dy = (other.approxZ - frame.playerZ) * scale;
        const distPx = Math.hypot(dx, dy);
        const maxInner = radius - 7;

        const isSeeker = other.role === 'seeker';
        const fillZone = isSeeker
          ? 'rgba(239, 90, 60, 0.26)'
          : frame.playerRole === 'seeker'
            ? 'rgba(245, 184, 65, 0.24)'
            : 'rgba(87, 199, 133, 0.24)';
        const strokeColor = isSeeker
          ? 'rgba(255, 124, 96, 0.85)'
          : frame.playerRole === 'seeker'
            ? 'rgba(255, 206, 98, 0.82)'
            : 'rgba(116, 224, 158, 0.82)';
        const coreColor = isSeeker
          ? '#ff6b4a'
          : frame.playerRole === 'seeker'
            ? '#f7c148'
            : '#5fd48e';

        if (distPx <= maxInner) {
          const ox = cx + dx;
          const oy = cy + dy;
          const zoneR = Math.max(6.5, other.approxRadius * scale);

          // Soft approximate search zone circle
          ctx.beginPath();
          ctx.arc(ox, oy, zoneR, 0, Math.PI * 2);
          ctx.fillStyle = fillZone;
          ctx.fill();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.1;
          ctx.setLineDash([3, 2.5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Soft inner approximate blip
          ctx.beginPath();
          ctx.arc(ox, oy, isSeeker ? 3.2 : 2.6, 0, Math.PI * 2);
          ctx.fillStyle = coreColor;
          ctx.fill();
        } else {
          // Distant player indicator along circular radar edge
          const angle = Math.atan2(dy, dx);
          const ex = cx + Math.cos(angle) * (radius - 5);
          const ey = cy + Math.sin(angle) * (radius - 5);

          ctx.beginPath();
          ctx.arc(ex, ey, isSeeker ? 3.4 : 2.7, 0, Math.PI * 2);
          ctx.fillStyle = coreColor;
          ctx.fill();
          ctx.strokeStyle = '#1b130d';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 11. Player position & run-heading directional arrow (always centered)
      // Character facing in world XZ is (sin(playerYaw), cos(playerYaw))
      const charAngle = Math.atan2(
        Math.cos(frame.playerYaw),
        Math.sin(frame.playerYaw),
      );
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(charAngle);

      ctx.beginPath();
      ctx.moveTo(6.5, 0);
      ctx.lineTo(-4.5, -4.4);
      ctx.lineTo(-2.4, 0);
      ctx.lineTo(-4.5, 4.4);
      ctx.closePath();
      ctx.fillStyle = frame.isSpectating ? '#93c5fd' : '#fff8e7';
      ctx.fill();
      ctx.strokeStyle = '#1d140e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 12. Subtle inner rim shadow
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 224, 178, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    };

    registerListener(drawFrame);
    return () => {
      registerListener(null);
    };
  }, [registerListener]);

  return (
    <div
      className="pointer-events-none flex flex-col items-start select-none"
      aria-label="Village minimap"
    >
      <div className="relative w-[72px] h-[72px] sm:w-[144px] sm:h-[144px] rounded-full bg-[#1a120c] border-2 border-amber-200/35 shadow-xl">
        <canvas
          ref={canvasRef}
          className="block w-full h-full rounded-full"
        />

        {/* North compass marker on top rim */}
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-[#1d140e] border border-amber-200/30 px-1 text-[8px] sm:text-[9px] font-bold tracking-wider text-amber-200 leading-[13px]"
        >
          N
        </span>
      </div>

      {/* Quiet unboxed map legend (desktop / wider screens) */}
      <div className="hidden sm:flex mt-1 items-center gap-2 text-[10px] font-medium text-amber-100/85 bg-[#1d140e]/75 px-2 py-0.5 rounded whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block w-2 h-2 rounded-full bg-[#fff8e7] border border-[#1d140e]"
          />
          You
        </span>
        <span aria-hidden="true">·</span>
        {playerRole === 'hider' ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-full bg-[#ff6b4a]"
              />
              Seeker
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-full bg-[#5fd48e]"
              />
              Team
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full bg-[#f7c148]"
            />
            Hider Zones
          </span>
        )}
      </div>
    </div>
  );
}

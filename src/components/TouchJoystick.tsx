import React, { useRef, useState } from 'react';

interface TouchJoystickProps {
  onMove: (x: number, y: number) => void;
}

export function TouchJoystick({ onMove }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromClientPoint = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;

    const maxRadius = rect.width * 0.33 || 34;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnob({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    updateFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    updateFromClientPoint(e.clientX, e.clientY);
  };

  const releaseStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Move joystick"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseStick}
      onPointerCancel={releaseStick}
      className="relative flex items-center justify-center w-[96px] h-[96px] sm:w-[116px] sm:h-[116px] rounded-full bg-[#1f1610]/72 border border-amber-100/25 shadow-lg touch-none cursor-grab active:cursor-grabbing"
    >
      {/* Subtle directional guides */}
      <span className="pointer-events-none absolute top-2 text-[9px] sm:text-[10px] font-semibold text-amber-100/45">
        W
      </span>
      <span className="pointer-events-none absolute bottom-2 text-[9px] sm:text-[10px] font-semibold text-amber-100/45">
        S
      </span>
      <span className="pointer-events-none absolute left-2.5 text-[9px] sm:text-[10px] font-semibold text-amber-100/45">
        A
      </span>
      <span className="pointer-events-none absolute right-2.5 text-[9px] sm:text-[10px] font-semibold text-amber-100/45">
        D
      </span>

      {/* Thumb knob */}
      <div
        className={`pointer-events-none w-10 h-10 sm:w-12 sm:h-12 rounded-full border transition-colors duration-150 ${
          active
            ? 'bg-amber-400 border-amber-100 shadow-md'
            : 'bg-amber-100/85 border-amber-50/60'
        }`}
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
      />
    </div>
  );
}

"use client";

import { motion, useAnimate } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

interface Props {
  size?: number;
  spinTrigger?: number; // increment to trigger an accent sweep
  active?: "USE" | "REFLECT" | "SUBMIT" | "JUDGE" | "EVOLVE" | null;
  className?: string;
  dense?: boolean;
}

const STAGES = ["USE", "REFLECT", "SUBMIT", "JUDGE", "EVOLVE"] as const;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function SkillLoopMotif({ size = 340, spinTrigger = 0, active = null, className, dense = false }: Props) {
  const [scope, animate] = useAnimate();
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter - 18;
  const rLabel = rOuter + 18;

  useEffect(() => {
    if (spinTrigger === 0) return;
    animate(
      scope.current,
      { strokeDashoffset: [Math.PI * 2 * rOuter, 0] },
      { duration: 1.6, ease: "easeInOut" }
    );
  }, [spinTrigger, animate, rOuter, scope]);

  const stageAngles = STAGES.map((_, i) => (i * 360) / STAGES.length);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn("text-ink", className)}
      aria-label="Skill Loop diagram"
    >
      {/* background grid */}
      <defs>
        <pattern id="slp-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#D9D4C7" strokeWidth="0.5" />
        </pattern>
        <pattern id="slp-grid-inner" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill="#D9D4C7" />
        </pattern>
      </defs>
      {!dense && <rect width={size} height={size} fill="url(#slp-grid)" />}

      {/* outer ring */}
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" strokeWidth="1" />
      {/* inner ring */}
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" />

      {/* degree tick marks every 10° */}
      {Array.from({ length: 36 }).map((_, i) => {
        const a = i * 10;
        const p1 = polar(cx, cy, rOuter, a);
        const p2 = polar(cx, cy, rOuter - (a % 90 === 0 ? 10 : a % 30 === 0 ? 6 : 3), a);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="currentColor"
            strokeWidth="0.75"
          />
        );
      })}

      {/* cardinal crosshairs */}
      <line x1={cx} y1={4} x2={cx} y2={size - 4} stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />
      <line x1={4} y1={cy} x2={size - 4} y2={cy} stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 3" />

      {/* stage nodes */}
      {STAGES.map((stage, i) => {
        const p = polar(cx, cy, rOuter, stageAngles[i]);
        const isActive = active === stage;
        return (
          <g key={stage}>
            <circle
              cx={p.x}
              cy={p.y}
              r={isActive ? 8 : 5}
              fill={isActive ? "#FF5B1F" : "#0B0B0B"}
              stroke="#0B0B0B"
              strokeWidth="1"
            />
            <circle cx={p.x} cy={p.y} r={isActive ? 13 : 9} fill="none" stroke="#0B0B0B" strokeWidth="0.5" />
            <StageLabel
              cx={cx}
              cy={cy}
              r={rLabel}
              deg={stageAngles[i]}
              label={`${String(i + 1).padStart(2, "0")} ${stage}`}
              active={isActive}
            />
          </g>
        );
      })}

      {/* arrowed arcs between stages */}
      {STAGES.map((_, i) => {
        const from = stageAngles[i] + 8;
        const to = stageAngles[(i + 1) % STAGES.length] - 8;
        const end = polar(cx, cy, rOuter, to);
        const before = polar(cx, cy, rOuter, to - 2);
        return (
          <g key={i}>
            <path
              d={arcPath(cx, cy, rOuter, from, to)}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* arrowhead */}
            <polygon
              points={`${end.x},${end.y} ${before.x - 2},${before.y - 4} ${before.x + 2},${before.y + 4}`}
              fill="currentColor"
              transform={`rotate(${to} ${end.x} ${end.y})`}
            />
          </g>
        );
      })}

      {/* center plate */}
      <g>
        <rect x={cx - 44} y={cy - 18} width="88" height="36" fill="#F4F1EA" stroke="#0B0B0B" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fontWeight="600"
          letterSpacing="0.16em"
          fill="#0B0B0B"
        >
          SLP LOOP
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="7"
          letterSpacing="0.2em"
          fill="#6B675E"
        >
          v1.0 · Ø {Math.round(rOuter * 2)}
        </text>
      </g>

      {/* accent sweep — animated on spinTrigger change */}
      <motion.circle
        ref={scope}
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        stroke="#FF5B1F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${Math.PI * 2 * rOuter * 0.18} ${Math.PI * 2 * rOuter * 0.82}`}
        strokeDashoffset={Math.PI * 2 * rOuter}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  );
}

function StageLabel({
  cx,
  cy,
  r,
  deg,
  label,
  active,
}: {
  cx: number;
  cy: number;
  r: number;
  deg: number;
  label: string;
  active: boolean;
}) {
  const p = polar(cx, cy, r, deg);
  // Nudge labels for readability
  const yShift = deg === 0 ? -4 : deg === 180 ? 14 : 4;
  const anchor: "start" | "end" | "middle" =
    deg > 0 && deg < 180 ? "start" : deg > 180 && deg < 360 ? "end" : "middle";
  const xShift = anchor === "start" ? 6 : anchor === "end" ? -6 : 0;
  return (
    <text
      x={p.x + xShift}
      y={p.y + yShift}
      textAnchor={anchor}
      fontFamily="var(--font-mono)"
      fontSize="10"
      letterSpacing="0.14em"
      fontWeight={active ? 700 : 400}
      fill={active ? "#FF5B1F" : "#0B0B0B"}
    >
      {label}
    </text>
  );
}

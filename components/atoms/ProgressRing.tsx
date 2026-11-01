// design: Claude-designed (#686)
import { cn } from "@/lib/ui/cn";

/** Atom/ProgressRing: a 20 px SVG ring, `value` 0-100, arc from 12 o'clock. Contract: design/notes/ProgressRing.md. */
const SIZE = 20;
const STROKE = 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_CLASS = {
  blue: "text-text-highlight-blue",
  green: "text-text-highlight-green",
  yellow: "text-text-highlight-yellow",
  neutral: "text-text-secondary",
} as const;

export type ProgressRingTone = keyof typeof TONE_CLASS;

export interface ProgressRingProps {
  /** 0-100; values outside are clamped. */
  value: number;
  /** Accessible name, e.g. "72% afgerond". */
  label: string;
  tone?: ProgressRingTone;
  className?: string;
}

export function ProgressRing({ value, label, tone = "blue", className }: ProgressRingProps) {
  const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const center = SIZE / 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("size-5 shrink-0", TONE_CLASS[tone], className)}
    >
      <circle cx={center} cy={center} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-stroke-primary" />
      {clamped > 0 && (
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
    </svg>
  );
}

"use client";

// design: Claude-designed (#532)
import { useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { AGENDA_COLORS, type AgendaColor } from "@/lib/agenda/colors";
import { cn } from "@/lib/ui/cn";

/**
 * Molecule/ColorSwatches: the palette of ADR-0040 as a WAI-ARIA radio group of round swatches
 * filled with the `event-<colour>-accent` tokens. Arrow keys move and select, Tab leaves the group.
 * Contract and the reason it exists: `design/notes/ColorSwatches.md`.
 */
export interface ColorSwatchesProps {
  value: AgendaColor;
  onChange: (color: AgendaColor) => void;
  /** Accessible name of the group; pass the visible label's text. */
  label: string;
  disabled?: boolean;
  className?: string;
}

// Static class names, so Tailwind sees every token.
const SWATCH_CLASSES: Record<AgendaColor, string> = {
  red: "bg-event-red-accent",
  orange: "bg-event-orange-accent",
  amber: "bg-event-amber-accent",
  green: "bg-event-green-accent",
  teal: "bg-event-teal-accent",
  blue: "bg-event-blue-accent",
  violet: "bg-event-violet-accent",
  pink: "bg-event-pink-accent",
  stone: "bg-event-stone-accent",
};

/** The small round marker of a colour, next to a category name. Decorative: the name carries the meaning. */
export function ColorDot({ color, className }: { color: AgendaColor; className?: string }) {
  return <span aria-hidden="true" className={cn("size-4 shrink-0 rounded-full", SWATCH_CLASSES[color], className)} />;
}

export function ColorSwatches({ value, onChange, label, disabled, className }: ColorSwatchesProps) {
  const t = useTranslations("components.colorSwatches.colors");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = AGENDA_COLORS.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const color = AGENDA_COLORS[next];
    onChange(color);
    refs.current[color]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-inline-sm", className)}>
      {AGENDA_COLORS.map((color, index) => {
        const checked = color === value;
        return (
          <button
            key={color}
            ref={(node) => {
              refs.current[color] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t(color)}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(color)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-transparent transition-colors hover:border-stroke-primary-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-secondary-active",
              checked && "border-stroke-primary-selected hover:border-stroke-primary-selected",
            )}
          >
            <span className={cn("size-6 rounded-full", SWATCH_CLASSES[color])} />
          </button>
        );
      })}
    </div>
  );
}

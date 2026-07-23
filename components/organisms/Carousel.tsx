// figma: node-id=3670:1976
import clsx from "clsx";
import { Children } from "react";
import type { ReactNode } from "react";

/**
 * Organism/Carousel — Figma component "Carousel" (node-id 3670:1976).
 * SLOT "Slot" -> required `children`. No variant axis — no CVA.
 * See design/notes/Carousel.md.
 */
export interface CarouselProps {
  /** Figma SLOT "Slot" — the row's content, typically `CardContainer` instances. */
  children: ReactNode;
  className?: string;
}

export function Carousel({ children, className }: CarouselProps) {
  return (
    <div
      className={clsx(
        // items-start hugs card count; overflow-x-auto is a GAP (no Figma
        // scroll affordance) — see design/notes/Carousel.md.
        "flex w-full items-start gap-4 overflow-x-auto",
        className,
      )}
    >
      {Children.map(children, (child, index) => (
        // 280px fixed width lives HERE (Carousel), not on CardContainer —
        // see design/notes/Carousel.md.
        <div key={index} className="w-70 shrink-0">
          {child}
        </div>
      ))}
    </div>
  );
}

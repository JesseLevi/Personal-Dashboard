// figma: node-id=3670:1976
import { cn } from "@/lib/ui/cn";
import { Children } from "react";
import type { ReactNode } from "react";

/**
 * Organism/Carousel — Figma component "Carousel" (node-id 3670:1976).
 * SLOT "Slot" -> required `children`. No variant axis — no CVA.
 *
 * Hidden scrollbar, the left breakout past a caller's own padding, and the
 * matching end-of-scroll margin (#110) are all codebase calls Figma can't
 * express — see design/notes/Carousel.md.
 */
export interface CarouselProps {
  /** Figma SLOT "Slot" — the row's content, typically `CardContainer` instances. */
  children: ReactNode;
  /** Column width class(es) — differs per composing screen (#90: Recipe fixed 280px vs Te-Doen board's responsive 296/320). Defaults to the originally fetched Recipe width. See design/notes/Carousel.md. */
  columnWidthClassName?: string;
  className?: string;
}

export function Carousel({
  children,
  columnWidthClassName = "w-70",
  className,
}: CarouselProps) {
  return (
    <div
      tabIndex={0}
      className={cn(
        // items-start/overflow-x-auto/no-w-full/-ml-*/scrollbar-hiding: see
        // design/notes/Carousel.md (#90, #110, #205).
        "flex items-start gap-inline-lg overflow-x-auto",
        "-ml-4 pl-page-left pr-page-right-equal md:-ml-32",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {Children.map(children, (child, index) => (
        <div key={index} className={cn(columnWidthClassName, "shrink-0")}>
          {child}
        </div>
      ))}
    </div>
  );
}

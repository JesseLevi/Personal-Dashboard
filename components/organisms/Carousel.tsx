// figma: node-id=3670:1976
import clsx from "clsx";
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
      className={clsx(
        // items-start hugs card count; overflow-x-auto is a GAP (no Figma
        // scroll affordance) — see design/notes/Carousel.md. No `w-full`:
        // the negative margin below needs an `auto` width to expand into
        // (a fixed 100% would just translate the box, not widen it).
        "flex items-start gap-4 overflow-x-auto",
        // Bleeds past whatever left padding the caller's ancestor applies
        // (`-ml-*` cancels it, `pl-*` restores the same visual card
        // position) so this element's own box — the actual clip boundary
        // for scrolled-away columns — reaches the true edge instead of
        // stopping at that padding. `pr-*` is new: the matching end-of-row
        // margin, kept inside the scrolling box so it survives a full
        // scroll instead of only showing at rest.
        "-ml-4 pl-4 pr-4 md:-ml-32 md:pl-32 md:pr-32",
        // Scrollbar hidden, scrolling itself untouched — wheel/trackpad/
        // shift-scroll/touch aren't scrollbar-dependent, and `tabIndex={0}`
        // keeps the row keyboard-focusable so arrow keys still scroll it.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {Children.map(children, (child, index) => (
        <div key={index} className={clsx(columnWidthClassName, "shrink-0")}>
          {child}
        </div>
      ))}
    </div>
  );
}

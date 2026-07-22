// figma: node-id=3670:1976
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Organism/Carousel — Figma component "Carousel" (node-id 3670:1976,
 * Organisms section).
 *
 * Figma structure, mirrored 1:1:
 *   root "Carousel" (row, gap 16px, sizing horizontal=contextual ->
 *   w-full, vertical=hug; the fetched example instance carries a
 *   designedWidth of 644px, an instance-specific measurement, not a fixed
 *   size on the component itself)
 *   └─ SLOT "Slot" (row, gap 16px, sizing horizontal=fill, vertical=hug)
 *      └─ example content: 3x INSTANCE "Card-container" (node-id 3650:1297,
 *         i.e. `components/organisms/CardContainer.tsx`) — confirms
 *         `CardContainer.tsx`'s own doc-comment note that its still-
 *         unbuilt-at-the-time parent frame was named "Carousel details":
 *         this component is that parent, and the ticket's "row of Card
 *         instances" wording undersold it — the row instantiates
 *         `Card-container` (whole kanban columns), not bare `Card`.
 *
 * The root frame and the "Slot" frame share the identical row/gap-16
 * layout — the only difference is Figma's sizing keyword (`contextual` on
 * the root vs `fill` on the slot), which resolve to the same rendered
 * width once nested inside one another (both end up taking whatever width
 * the real parent gives the Carousel). Per the same "no visible effect"
 * precedent `Card.tsx`'s doc comment already used for its non-clipping
 * "Stap + Card" corner radius, the two frames are collapsed into a single
 * wrapping `div` here rather than adding a nested div that would carry no
 * visible effect of its own.
 *
 * SLOT "Slot" -> required `children` per CLAUDE.md's "SLOT nodes ->
 * children/named slots" rule — composer-supplied `CardContainer`
 * instances. Data wiring (which columns, live counts) is explicitly out of
 * scope per the ticket; this stays a presentational organism only.
 *
 * No `componentPropertyDefinitions` and no fill on this node, so no
 * variant/state axis and no colour to model — no CVA, `clsx` merges the
 * caller's `className`, same as `Card`/`CardContainer`.
 */
export interface CarouselProps {
  /** Figma SLOT "Slot" — the row's content, typically `CardContainer` instances. */
  children: ReactNode;
  className?: string;
}

export function Carousel({ children, className }: CarouselProps) {
  return (
    <div className={clsx("flex w-full gap-4", className)}>{children}</div>
  );
}

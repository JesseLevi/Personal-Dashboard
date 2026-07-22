// figma: node-id=3670:1976
import clsx from "clsx";
import { Children } from "react";
import type { ReactNode } from "react";

/**
 * Organism/Carousel — Figma component "Carousel" (node-id 3670:1976,
 * Organisms section).
 *
 * Figma structure, mirrored 1:1:
 *   root "Carousel" (row, gap 16px, sizing horizontal=contextual ->
 *   w-full, vertical=hug; designedWidth 644px)
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
 * COLUMN WIDTH (corrected after the first pass shipped equal-fill columns
 * — see `design/notes/Carousel.md` for the fuller account): all three
 * `Card-container` instances nested in the fetched node share template
 * EL-d47874b2, whose sizing is `{ horizontal: fixed, vertical: fixed }`
 * at `{ width: 280, height: 532 }` — a *fixed* 280px column, not one that
 * fills/shares the row's width. 3 columns x 280px + 2 gaps x 16px = 872px
 * of content against the root's own 644px `designedWidth`: the content is
 * meant to overflow its frame. That overflow is the component's whole
 * reason for being a "Carousel" rather than a plain row — Figma shows
 * ~2.3 columns and expects the rest to sit off-frame.
 *
 * Figma puts the 280px on the *instance inside this node*, not on
 * `Card-container` itself (whose own fetched node — see CardContainer.tsx
 * — has `contextual` sizing, i.e. "whatever width my parent gives me").
 * That is the deliberate argument for `Carousel` owning the column width
 * rather than `CardContainer` gaining a fixed size: this node is the one
 * and only place Figma fixes it. So each child is wrapped here in a
 * `w-70 shrink-0` box (`w-70` = 70 x Tailwind's 0.25rem spacing unit =
 * 17.5rem = 280px at the browser's default 16px root font size, confirmed
 * against Figma's 280px rather than assumed — see the PR for the measured
 * browser numbers) instead of changing `CardContainer.tsx`'s own public
 * shape, which is already merged and depended on elsewhere. `shrink-0`
 * stops the flex row from distributing space evenly across children (the
 * exact "footprint emerges from arithmetic instead of being declared" bug
 * class #69/#75 already fixed at the atom level) — each column now keeps
 * its stated 280px regardless of how many siblings it has or how wide the
 * viewport is, and N columns can overflow the viewport by construction.
 *
 * HORIZONTAL OVERFLOW — FLAGGED, not fully resolved: the fetched node
 * shows no scroll affordance of any kind (no arrows, no dots, no visible
 * scrollbar/track) for the ~228px of content it deliberately pushes off
 * its own 644px frame, so Figma does not answer how a viewer is meant to
 * reach the hidden columns. `overflow-x-auto` is used here as the
 * least-invention choice — it reuses the browser's own native scroll
 * affordance rather than inventing arrow buttons or dot indicators that
 * appear nowhere in the node — but it is this component's own addition,
 * not something read off Figma, and is recorded as an open design
 * question in `design/notes/Carousel.md` pending a real
 * answer (native scrollbar vs. custom nav controls vs. something else).
 *
 * COLUMN HEIGHT — FLAGGED, resolved one way deliberately: a flex row's
 * default `align-items: stretch` was already making each `w-70 shrink-0`
 * wrapper match the tallest sibling's height, but `CardContainer` itself
 * never filled that stretched wrapper (its own root has no height rule,
 * `contextual`/`contextual` sizing, so it hugs its own card count) —
 * columns with fewer cards left dead transparent space below their grey
 * background, an internally inconsistent half-stretched/half-hugged state
 * (the exact "emergent instead of declared" smell #69/#75 already fought,
 * this time at the layout level rather than padding arithmetic). Resolved
 * to EQUAL-HEIGHT columns: the wrapper now also forces its child to fill
 * the stretched height (`[&>*]:h-full`), so every column's grey background
 * extends the full row height regardless of card count, and
 * `CardContainer`'s own Content SLOT — already built with Figma sizing
 * `fill`/`fill` + `justifyContent: center` (see CardContainer.tsx / its
 * fetched node 3650:1297) — absorbs the extra height by centring its cards
 * in it, exactly the layout that slot was already built to do. No change
 * to `CardContainer.tsx` itself; the fill behaviour is imposed purely by
 * this wrapper class, same as the column-width fix above.
 *
 * The underlying design question this doesn't fully settle: *should
 * carousel columns always be equal-height regardless of card count, or
 * hug their own content?* Evidence for equal-height: the fetched node's
 * three `Card-container` instances all carry `vertical: fixed, height:
 * 532` (a real, explicit sizing choice, not a default), and
 * `CardContainer`'s Content SLOT was already built fill/fill +
 * center-justified, i.e. built to receive and centre extra vertical space.
 * Evidence against treating that as conclusive: all three fetched
 * instances also hold identical content (4 Cards each), so the equal
 * height is equally explainable as equal content — Figma never shows a
 * ragged case, so it never actually exercises what should happen when
 * columns hold different card counts, which a real kanban board will do
 * constantly. Recorded in `design/notes/Carousel.md` for a
 * real design answer; equal-height was picked here as the reading with
 * direct, explicit support in the fetched node's own properties.
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
    <div className={clsx("flex w-full gap-4 overflow-x-auto", className)}>
      {Children.map(children, (child, index) => (
        <div key={index} className="w-70 shrink-0 [&>*]:h-full">
          {child}
        </div>
      ))}
    </div>
  );
}

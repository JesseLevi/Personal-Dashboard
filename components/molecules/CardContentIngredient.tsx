"use client";

// figma: node-id=3727:4021
import clsx from "clsx";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
import { Tag } from "../atoms/Tag";

/**
 * Molecule/Card-content/Ingredient — Figma component set "Card-content/Ingredient"
 * (node-id 3727:4021, Molecules section). `Checkbox` -> `checked?: boolean`.
 * `State=Active`'s press fill was removed in #166 (user instruction — no
 * hover/active animation on this row at all now). `State=Delete` (annotation
 * "When sliding") is a real drag gesture behind the opt-in `swipeToDelete`
 * prop, not a CSS pseudo-class or an always-on pill — "use client" follows
 * from that (#160); still unused by any live call site, deferred until the
 * winkelmand (#166, #29). `Tag` bool -> `quantity?: string`. `divider` ->
 * a plain unrounded rule rendered as this row's own sibling, never a
 * `border-b` on the rounded row itself (#166 — see the render's own
 * comment). Full detail: design/notes/CardContentIngredient.md.
 */
export interface CardContentIngredientBaseProps {
  /** Ingredient name (Figma TEXT "Banana"). */
  name: string;
  /** Quantity text, rendered via the neutral Atom/Tag. Omit to hide the Tag. */
  quantity?: string;
  /** Figma `Checkbox` axis. Omit for `Checkbox=None`; `true` also dims content to 40% opacity. */
  checked?: boolean;
  /** Forwarded to the Checkbox atom's `onClick`; ignored when `checked` is omitted. */
  onCheckedToggle?: () => void;
  /** `border-muted` below this row — pass `true` for every row except the list's last (the component can't see its siblings; only the caller knows). */
  divider?: boolean;
  className?: string;
}

/** `swipeToDelete` is an explicit opt-in (#160, user decision) for Figma's
 * `State=Delete`; `onDelete`/`deleteLabel` stay required together, same
 * discriminated-union idiom as `Button`'s icon-only `aria-label`. */
export type CardContentIngredientProps =
  | (CardContentIngredientBaseProps & {
      onDelete?: undefined;
      deleteLabel?: never;
      swipeToDelete?: undefined;
    })
  | (CardContentIngredientBaseProps & {
      onDelete: () => void;
      deleteLabel: string;
      swipeToDelete: true;
    });

// Trash Button footprint (40px, design/notes/Button.md #75) + the fetched
// node's 8px gap — the distance a fully-open swipe must translate.
const REVEAL_PX = 48;
const OPEN_THRESHOLD_PX = REVEAL_PX / 2;
// Pointer movement under this on release is a tap, not a drag.
const TAP_SLOP_PX = 4;

export function CardContentIngredient({
  name,
  quantity,
  checked,
  onCheckedToggle,
  onDelete,
  deleteLabel,
  swipeToDelete,
  divider,
  className,
}: CardContentIngredientProps) {
  const content = (
    <div
      className={clsx(
        "flex w-full items-center justify-between",
        checked && "opacity-40",
      )}
    >
      <p className="text-base font-semibold text-text">{name}</p>
      {quantity !== undefined && <Tag variant="neutral">{quantity}</Tag>}
    </div>
  );

  const checkbox = checked !== undefined && (
    <Checkbox checked={checked} aria-label={name} onClick={onCheckedToggle} />
  );

  // Real drag/gesture state, not a CSS pseudo-class — see
  // design/notes/CardContentIngredient.md for why this is component-owned.
  const [open, setOpen] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const dragStartX = useRef(0);
  // #179: gates handlePointerMove to an actual drag. Touch only ever fires
  // pointermove while a finger is down; a desktop mouse fires it on every
  // hover too, with no button pressed — without this flag, hovering alone
  // computed dragPx from a stale dragStartX and shifted the row. See
  // design/notes/CardContentIngredient.md.
  const dragging = useRef(false);

  if (swipeToDelete) {
    const offset = Math.min(0, Math.max(-REVEAL_PX, (open ? -REVEAL_PX : 0) + dragPx));

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      dragStartX.current = event.clientX;
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (!dragging.current) return;
      setDragPx(event.clientX - dragStartX.current);
    }
    function handlePointerEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      const delta = dragPx;
      setDragPx(0);
      if (Math.abs(delta) < TAP_SLOP_PX) {
        if (open) setOpen(false); // tap-to-close on an already-open row
        return;
      }
      setOpen((open ? -REVEAL_PX : 0) + delta <= -OPEN_THRESHOLD_PX);
    }

    // #166: divider moved off this rounded-3xl/overflow-hidden wrapper for
    // the same reason as the default row below — a lone `border-b` here
    // would curve at the bottom corners to follow `rounded-3xl`.
    return (
      <div className={clsx("flex w-full flex-col", className)}>
        <div className="relative w-full overflow-hidden rounded-3xl">
          {/* Rests just past the right edge (clipped by overflow-hidden above)
              and slides in lockstep with the content div below; `+REVEAL_PX`
              cancels out at full-open. See design/notes/CardContentIngredient.md. */}
          <div
            className="absolute inset-y-0 right-0 flex items-center"
            style={{ transform: `translateX(${offset + REVEAL_PX}px)` }}
          >
            {/* #177: keyboard-focusable unconditionally (no tabIndex/aria-hidden
                gating) -- Tab reveals the row the same way a pointer drag does,
                via the shared `open` state. See design/notes/CardContentIngredient.md. */}
            <Button
              variant="destructive"
              icon="Trash"
              aria-label={deleteLabel}
              onClick={onDelete}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
            />
          </div>
          {/* Inline `transform`: a live drag offset, not a design value —
              Tailwind has no utility for it. See design/notes/CardContentIngredient.md. */}
          <div
            className={clsx(
              "relative flex w-full touch-pan-y items-center gap-5 rounded-3xl py-3 pl-3 transition-transform",
              offset < 0 ? "bg-surface-raised pr-4" : "pr-3",
            )}
            style={{ transform: `translateX(${offset}px)` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {content}
            {checkbox}
          </div>
        </div>
        {divider && <div aria-hidden="true" className="h-px w-full bg-border-muted" />}
      </div>
    );
  }

  // #166: hover/active press animation removed on user instruction (a
  // second request after #67's Hover-only fix) — the row no longer changes
  // fill/padding on `:active`. See design/notes/CardContentIngredient.md.
  // Divider rendered as its own unrounded sibling, not `border-b` on this
  // `rounded-3xl` row: a lone `border-bottom` on a fully-rounded box still
  // curves at both bottom corners to follow `border-radius` (the #166 bug —
  // "de border-bottom loopt rond") even with no fill of its own to round.
  return (
    <div className={clsx("flex w-full flex-col", className)}>
      <div className="flex w-full items-center gap-5 rounded-3xl pl-3 pr-3 py-3">
        {content}
        {checkbox}
      </div>
      {divider && <div aria-hidden="true" className="h-px w-full bg-border-muted" />}
    </div>
  );
}

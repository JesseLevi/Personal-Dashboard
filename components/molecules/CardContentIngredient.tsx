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
 * `State=Active` -> `:active` (no Hover in the node). `State=Delete`
 * (annotation "When sliding") is a real drag gesture behind the opt-in
 * `swipeToDelete` prop, not a CSS pseudo-class or an always-on pill — "use
 * client" follows from that (#160). `Tag` bool -> `quantity?: string`.
 * `divider` -> `border-b`, caller-supplied per row, omitted on the list's
 * last row. Full detail: design/notes/CardContentIngredient.md.
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

  if (swipeToDelete) {
    const offset = Math.min(0, Math.max(-REVEAL_PX, (open ? -REVEAL_PX : 0) + dragPx));

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      dragStartX.current = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      setDragPx(event.clientX - dragStartX.current);
    }
    function handlePointerEnd() {
      const delta = dragPx;
      setDragPx(0);
      if (Math.abs(delta) < TAP_SLOP_PX) {
        if (open) setOpen(false); // tap-to-close on an already-open row
        return;
      }
      setOpen((open ? -REVEAL_PX : 0) + delta <= -OPEN_THRESHOLD_PX);
    }

    return (
      <div
        className={clsx(
          "relative w-full overflow-hidden rounded-3xl",
          divider && "border-b border-border-muted",
          className,
        )}
      >
        {/* Rests just past the right edge (clipped by overflow-hidden above)
            and slides in lockstep with the content div below; `+REVEAL_PX`
            cancels out at full-open. See design/notes/CardContentIngredient.md. */}
        <div
          className="absolute inset-y-0 right-0 flex items-center"
          style={{ transform: `translateX(${offset + REVEAL_PX}px)` }}
        >
          <Button
            variant="destructive"
            icon="Trash"
            aria-label={deleteLabel}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            onClick={onDelete}
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
    );
  }

  // State=Default/Active: the row IS the pill, highlight only on :active
  // (node has no Hover). pl-3/pr-3/py-3 stay split, not px-3 — see notes file.
  return (
    <div
      className={clsx(
        "flex w-full items-center gap-5 rounded-3xl pl-3 pr-3 py-3 transition-colors active:bg-surface-raised active:pr-4",
        divider && "border-b border-border-muted",
        className,
      )}
    >
      {content}
      {checkbox}
    </div>
  );
}

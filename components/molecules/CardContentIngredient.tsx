"use client";

// figma: node-id=3727:4021
import { cn } from "@/lib/ui/cn";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatedAddToBasketButton } from "./AnimatedAddToBasketButton";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
import { Tag } from "../atoms/Tag";
import type { ActionResult } from "@/lib/shopping/types";

/**
 * Molecule/Card-content/Ingredient — Figma component set "Card-content/Ingredient"
 * (node-id 3727:4021, Molecules section). `Checkbox` -> `checked?: boolean`.
 * `State=Active`'s press fill was removed in #166 (user instruction — no
 * hover/active animation on this row at all now). `State=Delete`/`State=Cart`
 * (annotation "When sliding" on both) are the same drag gesture revealing
 * one of two actions, behind the opt-in `swipeAction` prop ("delete" |
 * "cart") — not a CSS pseudo-class or an always-on pill; "use client"
 * follows from that (#160, generalised #179). `Tag` bool -> `quantity?:
 * string`. `divider` -> a plain unrounded rule rendered as this row's own
 * sibling, never a `border-b` on the rounded row itself (#166 — see the
 * render's own comment). Full detail: design/notes/CardContentIngredient.md.
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
  /** `stroke-lines` below this row — pass `true` for every row except the list's last (the component can't see its siblings; only the caller knows). */
  divider?: boolean;
  /** #318 (Claude-designed on request): "controleren" marker under the name of an imported line the importer was unsure about. Omit when the line is fine. */
  reviewLabel?: string;
  /** Makes the marker a button (e.g. opens the edit panel where the ingredient can be fixed). */
  onReviewClick?: () => void;
  className?: string;
}

/** `swipeAction` is an explicit opt-in (#160, generalised #179) for Figma's
 * `State=Delete`/`State=Cart` — one shared drag gesture, two revealed
 * actions. Each action's handler/label stay required together with it, same
 * discriminated-union idiom as `Button`'s icon-only `aria-label`, so a
 * caller cannot ask for a swipe without supplying its handler and
 * accessible label. */
export type CardContentIngredientProps =
  | (CardContentIngredientBaseProps & {
      swipeAction?: undefined;
      onDelete?: undefined;
      deleteLabel?: never;
      onAddToCart?: undefined;
      addToCartLabel?: never;
    })
  | (CardContentIngredientBaseProps & {
      swipeAction: "delete";
      onDelete: () => void;
      deleteLabel: string;
      onAddToCart?: undefined;
      addToCartLabel?: never;
    })
  | (CardContentIngredientBaseProps & {
      swipeAction: "cart";
      onAddToCart: () => Promise<ActionResult>;
      addToCartLabel: string;
      onDelete?: undefined;
      deleteLabel?: never;
    });

// Revealed-button footprint (40px, design/notes/Button.md #75 — both the
// Trash Button and AnimatedAddToBasketButton's icon-only face compute to
// the same 40x40, see design/notes/AnimatedAddToBasketButton.md) + the
// fetched node's 8px gap — the distance a fully-open swipe must translate.
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
  onAddToCart,
  addToCartLabel,
  swipeAction,
  divider,
  reviewLabel,
  onReviewClick,
  className,
}: CardContentIngredientProps) {
  const content = (
    <div
      className={cn(
        "flex w-full items-center justify-between",
        checked && "opacity-40",
      )}
    >
      {/* #222: `min-w-0` + Tag's `shrink-0` — a bare flex row shrinks both
          children by their content basis, so a long name stole width off
          the Tag until its own text wrapped. name absorbs the deficit
          (wraps) instead; Tag stays one line at its natural width. See
          design/notes/CardContentIngredient.md. */}
      {reviewLabel ? (
        // design: Claude-designed on request (#318), design/notes/CardContentIngredient.md.
        <div className="flex min-w-0 flex-col items-start gap-stack-sm">
          <p className="text-base font-semibold text-text-primary">{name}</p>
          {onReviewClick ? (
            <button type="button" onClick={onReviewClick}>
              <Tag variant="highlight">{reviewLabel}</Tag>
            </button>
          ) : (
            <Tag variant="highlight">{reviewLabel}</Tag>
          )}
        </div>
      ) : (
        <p className="min-w-0 text-base font-semibold text-text-primary">{name}</p>
      )}
      {quantity !== undefined && (
        <Tag variant="neutral" className="shrink-0">
          {quantity}
        </Tag>
      )}
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
  // #222: whether setPointerCapture has already been taken for this press —
  // see handlePointerMove below for why capture itself is deferred.
  const captured = useRef(false);

  if (swipeAction) {
    const offset = Math.min(0, Math.max(-REVEAL_PX, (open ? -REVEAL_PX : 0) + dragPx));

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      dragStartX.current = event.clientX;
      dragging.current = true;
    }
    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (!dragging.current) return;
      const dx = event.clientX - dragStartX.current;
      // #222: capture is taken lazily, only once movement actually crosses
      // TAP_SLOP_PX, not unconditionally on pointerdown — capturing eagerly
      // retargeted the browser's subsequent `click` to this row div,
      // silently swallowing every desktop click on the nested
      // Checkbox/Trash-Button. Below the slop (a plain click, or the mouse
      // jitter every real click has) no capture is ever taken and the click
      // reaches its real target natively; touch is unaffected — it already
      // has implicit capture on the real target. Measured, not guessed —
      // see design/notes/CardContentIngredient.md.
      if (!captured.current && Math.abs(dx) >= TAP_SLOP_PX) {
        captured.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setDragPx(dx);
    }
    function handlePointerEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      captured.current = false;
      const delta = dragPx;
      setDragPx(0);
      if (Math.abs(delta) < TAP_SLOP_PX) {
        if (open) setOpen(false); // tap-to-close on an already-open row
        return;
      }
      setOpen((open ? -REVEAL_PX : 0) + delta <= -OPEN_THRESHOLD_PX);
    }

    // #177: keyboard-focusable unconditionally (no tabIndex/aria-hidden
    // gating) -- Tab reveals the row the same way a pointer drag does, via
    // the shared `open` state. Shared by both revealed actions below.
    function handleFocus() {
      setOpen(true);
    }
    function handleBlur() {
      setOpen(false);
    }

    // #166: divider moved off this rounded-3xl/overflow-hidden wrapper for
    // the same reason as the default row below — a lone `border-b` here
    // would curve at the bottom corners to follow `rounded-3xl`.
    return (
      <div className={cn("flex w-full flex-col", className)}>
        <div className="relative w-full overflow-hidden rounded-container">
          {/* Rests just past the right edge (clipped by overflow-hidden above)
              and slides in lockstep with the content div below; `+REVEAL_PX`
              cancels out at full-open. See design/notes/CardContentIngredient.md. */}
          <div
            className="absolute inset-y-0 right-0 flex items-center"
            style={{ transform: `translateX(${offset + REVEAL_PX}px)` }}
          >
            {/* #179: State=Cart's revealed Button is `filled`/basket, NOT
                destructive/Trash -- verified against the fetched node
                (4050:11613), not assumed from State=Delete's sibling. See
                design/notes/CardContentIngredient.md. */}
            {swipeAction === "delete" ? (
              <Button
                variant="destructive"
                icon="Trash"
                aria-label={deleteLabel}
                onClick={onDelete}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            ) : (
              <AnimatedAddToBasketButton
                aria-label={addToCartLabel}
                onAddToBasket={onAddToCart}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            )}
          </div>
          {/* Inline `transform`: a live drag offset, not a design value —
              Tailwind has no utility for it. See design/notes/CardContentIngredient.md. */}
          <div
            className={cn(
              "relative flex w-full touch-pan-y items-center gap-inline-xl rounded-container py-component-md pl-component-md transition-transform",
              offset < 0
                ? "bg-surface-secondary pr-component-lg"
                : "pr-component-md",
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
        {divider && <div aria-hidden="true" className="h-px w-full bg-stroke-lines" />}
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
    <div className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full items-center gap-inline-xl rounded-container pl-component-md pr-component-md py-component-md">
        {content}
        {checkbox}
      </div>
      {divider && <div aria-hidden="true" className="h-px w-full bg-stroke-lines" />}
    </div>
  );
}

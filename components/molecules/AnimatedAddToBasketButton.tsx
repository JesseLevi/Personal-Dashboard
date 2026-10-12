"use client";

// figma: node-id=4051:12960
import { cn } from "@/lib/ui/cn";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Button } from "../atoms/Button";
import { Dropdown } from "../atoms/Dropdown";
import { Icon, type IconName } from "../atoms/Icon";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { playsAddedFace } from "@/lib/ui/add-to-basket";
import { needsBasketChoice, type BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";

/**
 * Molecule/AnimatedAddToBasketButton — Figma frame "AddToBasketAnimation"
 * (node-id 4051:12960, four `Button/Default` instances, not a real
 * component set). Composes `Button` (kept a presentational Server
 * Component) with its own click/timer state, per the annotations: on click,
 * the resting icon+label slides out to the top while the "Toegevoegd"/"Added"
 * icon+label slides in from the bottom, plus a small press-scale. `label`+
 * `addedLabel` together (Figma's labelled cell) or `aria-label` alone
 * (icon-only cell) — same discriminated-union idiom as `Button`'s own
 * icon-only branch. With more than one `baskets` entry the click first opens
 * a basket popover (#429, Claude-designed from existing components; not in
 * Figma). Full reasoning: design/notes/AnimatedAddToBasketButton.md.
 */
const REVERT_MS = 2000;

function Face({ icon, label, hidden }: { icon: IconName; label?: string; hidden: boolean }) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className={cn(
        "col-start-1 row-start-1 flex items-center gap-inline-sm transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        icon === "Check"
          ? hidden
            ? "translate-y-full"
            : "translate-y-0"
          : hidden
            ? "-translate-y-full"
            : "translate-y-0",
      )}
    >
      <Icon name={icon} />
      {label && <span>{label}</span>}
    </span>
  );
}

type AnimatedAddToBasketButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "type"
> & {
  /** Fired on click, or, when `baskets` has more than one entry, on choosing a basket (then with that basket's id). The "added" face plays only once this resolves with `success: true`; a failure leaves the button at rest (#290, design/notes/AnimatedAddToBasketButton.md). */
  onAddToBasket: (listId?: string) => Promise<ActionResult>;
  /** Baskets the click can target (#429). More than one: the click opens a popover and the send follows the choice. Zero or one: sends directly. */
  baskets?: BasketOption[];
  /** Accessible name of the basket popover. */
  chooseBasketLabel?: string;
  /** Story-only: renders with the basket popover already open. */
  defaultChoosing?: boolean;
};

export type AnimatedAddToBasketButtonProps =
  | (AnimatedAddToBasketButtonBaseProps & {
      label: string;
      addedLabel: string;
      "aria-label"?: never;
    })
  | (AnimatedAddToBasketButtonBaseProps & {
      label?: never;
      addedLabel?: never;
      "aria-label": string;
    });

export function AnimatedAddToBasketButton({
  onAddToBasket,
  baskets,
  chooseBasketLabel,
  defaultChoosing = false,
  label,
  addedLabel,
  className,
  ...rest
}: AnimatedAddToBasketButtonProps) {
  const [added, setAdded] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const pending = useRef(false);

  const choosing = needsBasketChoice(baskets);
  const [open, setOpen] = useState(defaultChoosing);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(wrapperRef, popoverRef, {
    open: open && choosing,
    // Icon-only sits at a row's right edge, the labelled button in the header actions.
    anchor: label ? "left" : "right",
    prefer: "below",
    // Portalled out of the swipe row's overflow-hidden (CardContentIngredient).
    strategy: "fixed",
  });

  // Pointer down outside trigger and popover closes it (as Sorteer does). The
  // popover is portalled, so it needs its own containment check.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  async function send(listId?: string) {
    if (pending.current) return;
    pending.current = true;
    const played = await playsAddedFace(() => onAddToBasket(listId));
    pending.current = false;
    if (!played) return;
    setAdded(true);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setAdded(false), REVERT_MS);
  }

  function handleClick() {
    if (choosing) {
      setOpen((current) => !current);
      return;
    }
    void send();
  }

  function handleChoose(listId: string) {
    setOpen(false);
    // The option took focus; hand it back so a swipe row that stays open on
    // focus keeps showing the button while the added face plays.
    wrapperRef.current?.querySelector("button")?.focus();
    void send(listId);
  }

  const button = (
    <Button
      variant="filled"
      aria-expanded={choosing ? open : undefined}
      onClick={handleClick}
      className={cn(
        // `!`: Button's own base class already sets `transition-colors` --
        // two plain `transition-*` utilities both set the single
        // non-additive `transition-property`, so the winner would depend on
        // Tailwind's internal stylesheet order, not source order (same
        // landmine Button.md's own header flags). `!` guarantees this one
        // wins, same technique ButtonToggle.tsx already uses for its own
        // Transparent-fill override.
        "transition-all! duration-[var(--duration-base)] ease-base active:scale-95 motion-reduce:transition-none! motion-reduce:active:scale-100",
        className,
      )}
      {...rest}
    >
      <span className="relative inline-grid h-6 overflow-hidden">
        <Face icon="ShoppingBasket" label={label} hidden={added} />
        <Face icon="Check" label={addedLabel} hidden={!added} />
      </span>
    </Button>
  );

  if (!choosing) return button;

  return (
    <span ref={wrapperRef} className="inline-flex">
      {button}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="group"
            aria-label={chooseBasketLabel}
            className="z-[999] w-[209px]"
            style={popover.style}
            // A portalled press still bubbles through the React tree; keep it away from a swipe row's drag handlers.
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Dropdown className="shadow-sm">
              {(baskets ?? []).map((basket) => (
                <Button
                  key={basket.id}
                  icon={basket.shared ? "Users" : "User"}
                  variant="white"
                  align="left"
                  onClick={() => handleChoose(basket.id)}
                >
                  {basket.name}
                </Button>
              ))}
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}

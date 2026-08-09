"use client";

// figma: node-id=4051:12960
import clsx from "clsx";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { Button } from "../atoms/Button";
import { Icon, type IconName } from "../atoms/Icon";

/**
 * Molecule/AnimatedAddToBasketButton — Figma frame "AddToBasketAnimation"
 * (node-id 4051:12960, four `Button/Default` instances, not a real
 * component set). Composes `Button` (kept a presentational Server
 * Component) with its own click/timer state, per the annotations: on click,
 * the resting icon+label slides out to the top while the "Toegevoegd"
 * icon+label slides in from the bottom, plus a small press-scale. `label`+
 * `addedLabel` together (Figma's labelled cell) or `aria-label` alone
 * (icon-only cell) — same discriminated-union idiom as `Button`'s own
 * icon-only branch. Full reasoning: design/notes/AnimatedAddToBasketButton.md.
 */
const REVERT_MS = 1500;

function Face({ icon, label, hidden }: { icon: IconName; label?: string; hidden: boolean }) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className={clsx(
        "col-start-1 row-start-1 flex items-center gap-2 transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
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
  /** Fired on click, before the "added" face plays -- see the module's own doc comment for why a failed result still plays the animation. */
  onAddToBasket: () => void | Promise<void>;
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

  function handleClick() {
    void onAddToBasket();
    setAdded(true);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setAdded(false), REVERT_MS);
  }

  return (
    <Button
      variant="filled"
      onClick={handleClick}
      className={clsx(
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
}

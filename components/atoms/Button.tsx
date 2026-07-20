// figma: node-id=3623:4346
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Button — Figma component set "Button/Default" (node-id 3623:4346).
 *
 * Figma variant axes:
 * - Style: Filled | White | Transparent | Outline | Distructive (typo corrected
 *   to `destructive` in the code API, per ticket #13).
 * - State: Default | Hover | Active — implemented as CSS pseudo-classes
 *   (`hover:` / `active:`), never as a React prop.
 * - Booleans `With icon` / `With text` — translated to optional props rather
 *   than literal flags: passing `icon` (an `IconName`) renders the leading
 *   icon, passing `children` renders the label. Presence of each prop *is*
 *   the boolean, so callers can't pass a mismatched `withIcon={true}` with no
 *   icon. Root/inner padding below mirrors Figma's nested Icon/Text frames
 *   exactly (root pl-2 pr-1, icon wrapper pr-1, text wrapper pl-1 pr-2) so
 *   icon-only, text-only, and icon+text combinations all reproduce the exact
 *   Figma spacing (icon-only: 8px/8px; text-only: 12px/12px; both: 8px
 *   left / 12px right) without needing a separate CVA prop per combination.
 *
 * Per-state fills/text, read from the fetched node and resolved to primitives
 * via design/tokens.json (exact Figma hex values live in design/figma-map.json,
 * never in component source — check-server-only.sh enforces that):
 * - Filled: bg stone-200 (surface-raised), text stone-500 (text-muted);
 *   hover bg stone-300 (reuses the `border` token's value via `bg-border`,
 *   text unchanged); active bg unchanged, text stone-950 (text).
 * - White: bg white (surface), text text-muted; hover identical to default
 *   (Figma's Hover node resolves to the same fill/text as Default — no
 *   override needed); active text -> text (stone-950).
 * - Transparent: no fill (bg-transparent), text-muted; hover identical to
 *   default; active text -> text.
 * - Outline: bg-transparent, 1px border-border (stone-300), text-muted;
 *   hover border -> stone-500 (reuses the `text-muted` token's value via
 *   `border-text-muted`, since Figma's hover stroke is that same primitive);
 *   active border reverts to border-border, text -> text.
 * - Destructive ("Distructive" in Figma): priority-urgent-bg / priority-urgent
 *   for Default, Hover, and Active alike — Figma defines no state-specific
 *   override for this style.
 *
 * One fetched instance ("Style=Filled, State=Active") shows uniform 8px/8px
 * root padding instead of the 4px/8px asymmetric padding every other sampled
 * variant uses — treated as Figma auto-layout drift on that single instance,
 * not a deliberate active-only padding change, since Filled/Default and
 * Filled/Hover both use the standard padding.
 *
 * TOKEN GAP (flagged, not hardcoded): `hover:bg-border` and
 * `hover:border-text-muted` reuse the *values* of the `border` (stone-300) and
 * `text-muted` (stone-500) tokens for a fill and a stroke respectively. The
 * pixels match Figma exactly, but there is no dedicated semantic token for
 * "hover surface" / "hover border" yet. Per CLAUDE.md the token scale is
 * closed, so this borrows an existing token rather than inventing a hex —
 * needs a token-sync decision (add `surface-hover`/`border-strong`?) before
 * more components repeat the pattern.
 *
 * No "Disabled" state exists in the fetched component set, so none is
 * invented here (native `disabled` attribute still works via the `button`
 * element; add real Disabled styling once Figma defines it).
 */
const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center rounded-lg pl-2 pr-1 text-base font-semibold transition-colors",
  {
    variants: {
      variant: {
        filled:
          "bg-surface-raised text-text-muted hover:bg-border active:bg-surface-raised active:text-text",
        outline:
          "border border-border bg-transparent text-text-muted hover:border-text-muted active:border-border active:text-text",
        white: "bg-surface text-text-muted active:text-text",
        transparent: "bg-transparent text-text-muted active:text-text",
        destructive: "bg-priority-urgent-bg text-priority-urgent",
      },
    },
    defaultVariants: {
      variant: "filled",
    },
  },
);

type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  VariantProps<typeof buttonVariants> & {
    /** Figma "With icon" boolean — pass an IconName to render the leading icon; omit to hide it. */
    icon?: IconName;
  };

/**
 * Figma "With text" is expressed by the presence of `children`. An icon-only
 * button has no visible label and the `Icon` atom renders `aria-hidden`, so
 * TypeScript requires an explicit `aria-label` in that case — otherwise the
 * control would be unnamed for assistive tech (CLAUDE.md: accessibility is
 * part of the atom).
 */
export type ButtonProps =
  | (ButtonBaseProps & { children: ReactNode })
  | (ButtonBaseProps & { children?: never; "aria-label": string });

export function Button({
  variant,
  icon,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, className })}
      {...props}
    >
      {icon && (
        <span className="pr-1">
          <Icon name={icon} />
        </span>
      )}
      {children && <span className="pl-1 pr-2">{children}</span>}
    </button>
  );
}

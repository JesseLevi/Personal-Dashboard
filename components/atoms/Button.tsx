// figma: node-id=3623:4346
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Button — Figma "Button/Default" (node-id 3623:4346). Full history:
 * `design/notes/Button.md`.
 *
 * Style → `variant` (filled|white|transparent|outline|destructive, Figma
 * "Distructive"). State → CSS, never a prop: `hover:`/`active:`; Selected is
 * caller-supplied `aria-pressed` (same idiom as `ButtonToggle`). `With
 * icon`/`With text` → presence of `icon`/`children`; `Trekking icon` (Figma's
 * misnomer for trailing) → `trailingIcon` (#99).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center rounded-lg text-base font-semibold transition-colors",
  {
    variants: {
      // No Figma Size property — compact/iconOnlyDefault are structural
      // (size-N, width=height stated directly). iconOnlyDefault is
      // internal-only; see design/notes/Button.md.
      size: {
        default: "h-10 justify-between px-2",
        compact: "size-8 justify-center",
        iconOnlyDefault: "size-10 justify-center",
      },
      variant: {
        filled:
          "bg-surface-raised text-text-muted hover:bg-surface-raised-hover active:bg-surface-raised-active aria-pressed:text-text",
        // Selected shares `border-color` with Hover/Active here; the aria-pressed:hover:/aria-pressed:active: compound variants are load-bearing (higher specificity) — do not replace with a bare aria-pressed:border-*.
        outline:
          "border border-border bg-transparent text-text-muted hover:border-border-hover active:border-border-active aria-pressed:border-border-selected aria-pressed:hover:border-border-hover aria-pressed:active:border-border-active aria-pressed:text-text",
        white:
          "bg-surface text-text-muted hover:bg-surface-hover active:bg-surface-active aria-pressed:text-text",
        transparent: "bg-transparent text-text-muted aria-pressed:text-text",
        // Known gap: hover/active both resolve to red-950 in dark mode, so this variant has no visible pointer feedback there.
        destructive:
          "bg-priority-urgent-bg text-priority-urgent hover:bg-priority-urgent-bg-hover active:bg-priority-urgent-bg-active",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  },
);

type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  // `size` re-typed: `iconOnlyDefault` is an internal-only cva key the
  // component resolves to itself; callers only choose default/compact.
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    /** Figma "With icon" boolean — pass an IconName to render the leading icon; omit to hide it. */
    icon?: IconName;
    size?: "default" | "compact";
  };

// Icon-only (no `children`) requires `aria-label` (type-enforced) since
// `Icon` renders `aria-hidden`. `size="compact"` is a fixed 32x32 box
// (`size-8`), so it's only representable on the icon-only branch — a label
// would be clipped, and Figma never samples `compact` with text.
//
// `trailingIcon` only exists on the labelled branch: Figma's `Trekking icon`
// is never sampled together with an icon-only instance (compact or
// iconOnlyDefault), so that combination has no defined layout — flagged in
// design/notes/Button.md (#99) rather than invented, and excluded here so
// it's a type error, not a silent guess.
export type ButtonProps =
  | (ButtonBaseProps & {
      children: ReactNode;
      size?: "default";
      trailingIcon?: IconName;
    })
  | (ButtonBaseProps & {
      children?: never;
      "aria-label": string;
      trailingIcon?: never;
    });

export function Button({
  variant,
  size,
  icon,
  trailingIcon,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  // Icon-only + size default/omitted resolves to the internal
  // `iconOnlyDefault` key (structural 40x40) instead of the labelled
  // branch's hug-with-padding sizing; `compact` is untouched (already
  // icon-only-only via the type above).
  const resolvedSize =
    !children && size !== "compact" ? "iconOnlyDefault" : (size ?? "default");
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size: resolvedSize, className })}
      {...props}
    >
      {/* Mirrors Figma's "Leading + Text" frame (row, gap-1) as the root's first justify-between slot. */}
      <span className="flex items-center gap-1">
        {icon && <Icon name={icon} />}
        {children}
      </span>
      {trailingIcon && <Icon name={trailingIcon} />}
    </button>
  );
}

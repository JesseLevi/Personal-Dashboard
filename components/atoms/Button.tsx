// figma: node-id=3623:4346
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Button — Figma "Button/Default" (node-id 3623:4346). Full history:
 * `design/notes/Button.md`.
 *
 * Style → `variant`. State → CSS (`hover:`/`active:`/caller `aria-pressed`),
 * never a prop. `With icon`/`With text`/`Trekking icon` (Figma's misnomer for
 * trailing) → `icon`/`children`/`trailingIcon` (#99). Alignment → `align`,
 * resolved in JS so it never coexists with icon-only's own `justify-center`;
 * root `gap-1` (Figma's stated 4px) is unconditional so left/center only ever
 * differ in `justify-*`, never in spacing (#112).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-lg text-base font-semibold transition-colors",
  {
    variants: {
      // No Figma Size property — compact/iconOnlyDefault are structural
      // (size-N, width=height stated directly). iconOnlyDefault is
      // internal-only; see design/notes/Button.md.
      size: {
        default: "h-10 px-2",
        compact: "size-8 justify-center",
        iconOnlyDefault: "size-10 justify-center",
      },
      // Only resolved for size=default (see resolvedAlign below). Figma's
      // root frame carries no justifyContent on either axis value (#112
      // supersedes #107's misread) — this is this codebase's own mapping of
      // the user's spec, not a Figma-authored layout.
      align: {
        center: "justify-center",
        left: "justify-between",
      },
      variant: {
        filled:
          "bg-surface-raised text-text-muted hover:bg-surface-raised-hover active:bg-surface-raised-active aria-pressed:text-text",
        // Selected shares `border-color` with Hover/Active here; the aria-pressed:hover:/aria-pressed:active: compound variants are load-bearing (higher specificity) — do not replace with a bare aria-pressed:border-*.
        outline:
          "border border-border bg-transparent text-text-muted hover:border-border-hover active:border-border-active aria-pressed:border-border-selected aria-pressed:hover:border-border-hover aria-pressed:active:border-border-active aria-pressed:text-text",
        // Hover/Active moved one step darker in #112's re-fetch; both borrowed pixel-for-pixel from surface-active/surface-raised (no token of their own). See design/notes/Button.md.
        white:
          "bg-surface text-text-muted hover:bg-surface-active active:bg-surface-raised aria-pressed:text-text",
        // Hover/Active likewise moved one step darker in #112; now borrowed from surface-raised/surface-raised-hover. See design/notes/Button.md.
        transparent:
          "bg-transparent text-text-muted hover:bg-surface-raised active:bg-surface-raised-hover aria-pressed:text-text",
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
  // `size`/`align` re-typed below: `iconOnlyDefault` is internal-only, `align` is labelled-branch-only.
  Omit<VariantProps<typeof buttonVariants>, "size" | "align"> & {
    /** Figma "With icon" boolean — pass an IconName to render the leading icon; omit to hide it. */
    icon?: IconName;
    size?: "default" | "compact";
  };

// Icon-only (no `children`) requires `aria-label` (type-enforced, `Icon` is
// aria-hidden). `size="compact"`, `trailingIcon` and `align` are all
// labelled-branch-only — none has a defined icon-only layout in Figma, so
// each is a type error rather than a silent guess. See design/notes/Button.md (#75, #99, #107).
export type ButtonProps =
  | (ButtonBaseProps & {
      children: ReactNode;
      size?: "default";
      trailingIcon?: IconName;
      align?: "center" | "left";
    })
  | (ButtonBaseProps & {
      children?: never;
      "aria-label": string;
      trailingIcon?: never;
      align?: never;
    });

export function Button({
  variant,
  size,
  icon,
  trailingIcon,
  align,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  // Icon-only + default/omitted size resolves to the internal `iconOnlyDefault` key (structural 40x40).
  const resolvedSize =
    !children && size !== "compact" ? "iconOnlyDefault" : (size ?? "default");
  // align only applies to the labelled branch; icon-only keeps size's own justify-center.
  const resolvedAlign =
    resolvedSize === "default" ? (align ?? "center") : undefined;
  return (
    <button
      type={type}
      className={buttonVariants({
        variant,
        size: resolvedSize,
        align: resolvedAlign,
        className,
      })}
      {...props}
    >
      {/* Mirrors Figma's "Leading + Text" frame (row, gap-2 = 8px, #112) as the root's first slot. */}
      <span className="flex items-center gap-2">
        {icon && <Icon name={icon} />}
        {children}
      </span>
      {trailingIcon && <Icon name={trailingIcon} />}
    </button>
  );
}

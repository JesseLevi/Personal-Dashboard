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
  // `chrome-touch` (#172, app/globals.css): every Button is a control, not
  // reading content — no long-press callout/selection on its label, no
  // double-tap-zoom delay. Never applied to actual content text elsewhere.
  // spacing-flag: root `gap-1` is unbound on Alignment=Center, bound on
  // Alignment=Left (Figma is internally inconsistent) — design decision,
  // not a conversion call. design/notes/Button.md,
  // docs/open-questions.md#button-root-gap-binding-split.
  "chrome-touch inline-flex shrink-0 items-center gap-1 rounded-control text-base font-semibold transition-colors",
  {
    variants: {
      // No Figma Size property — compact/iconOnlyDefault are structural
      // (size-N, width=height stated directly). iconOnlyDefault is
      // internal-only; see design/notes/Button.md.
      size: {
        default: "h-10 px-component-sm",
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
          "bg-surface-secondary text-text-secondary hover:bg-surface-secondary-hover active:bg-surface-secondary-active aria-pressed:text-text-primary",
        // Selected shares `border-color` with Hover/Active here; the aria-pressed:hover:/aria-pressed:active: compound variants are load-bearing (higher specificity) — do not replace with a bare aria-pressed:border-*.
        outline:
          "border border-stroke-primary bg-transparent text-text-secondary hover:border-stroke-primary-hover active:border-stroke-secondary-active aria-pressed:border-stroke-primary-selected aria-pressed:hover:border-stroke-primary-hover aria-pressed:active:border-stroke-secondary-active aria-pressed:text-text-primary",
        // #213: corrects #204's regression — White has no Selected fill (Selected's node reads the `default` variable, i.e. bg unchanged). Its Hover/Active nodes bind one ramp-step off their own state name (Hover -> the `selected` step, Active -> the `hover` step); ramp-step name != CSS state name here, see docs/design-tokens.md. Selected therefore no longer shares background-color with Hover/Active, so the aria-pressed:hover:/aria-pressed:active: compound variants #204 added are gone too — they only existed because Selected had a fill.
        white:
          "bg-surface-highlight-white text-text-secondary hover:bg-surface-highlight-white-selected active:bg-surface-highlight-white-hover aria-pressed:text-text-primary",
        // #238: Transparent's Hover/Active fills were rebound in Figma onto surface-secondary-hover/-active — the same variables Filled reads (measured per-node, not assumed) — superseding #204's surface-highlight-white-hover/-active bind. Selected still has no fill in Figma. See design/notes/Button.md.
        transparent:
          "bg-transparent text-text-secondary hover:bg-surface-secondary-hover active:bg-surface-secondary-active aria-pressed:text-text-primary",
        // #213: corrects #204's regression — same ramp-step-vs-state-name offset as White (see above): Selected's node reads `default` (bg unchanged, text never changes on this variant either), Hover reads the `selected` step, Active reads the `hover` step. No aria-pressed:bg-* override, so no compound variants. Known gap unaffected: hover/active collapse toward red-50 in dark mode (Figma's own dark values), deliberately accepted, see docs/design-tokens.md.
        destructive:
          "bg-priority-urgent-bg text-priority-urgent hover:bg-priority-urgent-bg-selected active:bg-priority-urgent-bg-hover",
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
      {/* Mirrors Figma's "Leading + Text" frame (row, gap-inline-sm = 8px, #112) as the root's first slot. */}
      <span className="flex items-center gap-inline-sm">
        {icon && <Icon name={icon} />}
        {children}
      </span>
      {trailingIcon && <Icon name={trailingIcon} />}
    </button>
  );
}

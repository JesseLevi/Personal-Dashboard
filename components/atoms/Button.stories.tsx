// figma: node-id=3623:4346
import { Fragment } from "react";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";

// Dev-only demo copy — not user-facing (component text always comes from
// `children` at call sites).

type Variant = NonNullable<ButtonProps["variant"]>;

const VARIANTS: { variant: Variant; label: string }[] = [
  { variant: "filled", label: "Filled" },
  { variant: "white", label: "White" },
  { variant: "transparent", label: "Transparent" },
  { variant: "outline", label: "Outline" },
  { variant: "destructive", label: "Distructive" },
];

// Full Style x State matrix (Default / Hover / Active / Selected). Hover and
// Active are labelled columns, not faked with a class, since the point is to
// prove the real CSS works. Last column is load-bearing: a selected button
// must still react to hover/active — hover and hold the Outline row to check
// it (see docs/design-tokens.md and design/notes/Button.md for why Outline
// needs the aria-pressed compound variants).
export const StateMatrix = () => (
  <div className="grid grid-cols-[112px_repeat(3,auto)] items-center gap-x-6 gap-y-3">
    <span />
    <span className="text-sm font-semibold text-text-muted">Default</span>
    <span className="text-sm font-semibold text-text-muted">
      Hover / Active (hover and hold)
    </span>
    <span className="text-sm font-semibold text-text-muted">
      Selected (+ hover / hold)
    </span>
    {VARIANTS.map(({ variant, label }) => (
      <Fragment key={variant}>
        <span className="text-sm font-semibold text-text">{label}</span>
        <Button variant={variant}>Categorie</Button>
        <Button variant={variant}>Categorie</Button>
        <Button variant={variant} aria-pressed="true">
          Categorie
        </Button>
      </Fragment>
    ))}
  </div>
);

// Figma "With text" boolean: same icon (so the icon isn't the variable being
// tested), text present vs. absent. The icon-only button has no visible
// label, so the union type requires an explicit `aria-label` — the same rule
// the atom enforces at every call site.
export const WithAndWithoutText = () => (
  <div className="flex items-center gap-4">
    <Button icon="Plus">Categorie</Button>
    <Button icon="Plus" aria-label="Categorie" />
  </div>
);

// Figma "With icon" boolean: text present in both, icon present vs. absent.
export const WithAndWithoutIcon = () => (
  <div className="flex items-center gap-4">
    <Button icon="Plus">Categorie</Button>
    <Button>Categorie</Button>
  </div>
);

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

// Full Style x State matrix for the four-state Figma set (ticket #56:
// Default / Hover / Active / Selected). Default and Selected render
// statically — Selected via the standard `aria-pressed` attribute, never a
// prop. Hover and Active only exist while the pointer is over / holding the
// button, so those columns are labelled rather than faked with a class: the
// point of this story is to prove the real CSS works, and a class that forces
// the look would prove nothing.
//
// The last column is the load-bearing one: a *selected* button must still
// show its hover and active effect. Selected only changes `color` while
// Hover/Active only change `background-color`/`border-color`, so they compose
// instead of overriding each other — hover and hold that column to check.
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

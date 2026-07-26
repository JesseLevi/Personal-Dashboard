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

// Figma "Trekking icon" boolean (#99): leading+label+trailing together, and
// trailing+label with no leading icon.
export const TrailingIcon = () => (
  <div className="flex items-center gap-4">
    <Button icon="Plus" trailingIcon="ChevronDown">
      Categorie
    </Button>
    <Button trailingIcon="ChevronDown">Categorie</Button>
  </div>
);

// Figma "Alignment" property (#107): root primaryAxisAlignItems is
// SPACE_BETWEEN for Center, MIN (packed) for Left — verified against the
// fetched node, not assumed; see design/notes/Button.md. A single child
// (no trailingIcon) makes the two look identical since space-between
// degenerates to flex-start with one item — shown in row 1. Row 2 makes the
// real difference visible: Center pushes the chevron to the far edge, Left
// keeps it 4px after the label.
export const Alignment = () => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <Button align="center" className="w-40">
        Categorie
      </Button>
      <Button align="left" className="w-40">
        Categorie
      </Button>
    </div>
    <div className="flex items-center gap-4">
      <Button align="center" trailingIcon="ChevronDown" className="w-40">
        Categorie
      </Button>
      <Button align="left" trailingIcon="ChevronDown" className="w-40">
        Categorie
      </Button>
    </div>
  </div>
);

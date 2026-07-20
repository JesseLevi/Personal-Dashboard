// figma: node-id=3623:4346
import { Fragment } from "react";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";

// Dev-only demo copy — not user-facing (component text always comes from
// `children` at call sites).
export const AllVariants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="filled">Filled</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="white">White</Button>
    <Button variant="transparent">Transparent</Button>
    <Button variant="destructive">Destructive</Button>
  </div>
);

export const Filled = () => <Button variant="filled">Button</Button>;
export const Outline = () => <Button variant="outline">Button</Button>;
export const White = () => <Button variant="white">Button</Button>;
export const Transparent = () => (
  <Button variant="transparent">Button</Button>
);
export const Destructive = () => (
  <Button variant="destructive">Delete</Button>
);

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="filled" icon="Plus">
      Add
    </Button>
    <Button variant="outline" icon="Pencil">
      Edit
    </Button>
  </div>
);

export const IconOnly = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="filled" icon="Plus" aria-label="Add" />
    <Button variant="transparent" icon="Trash" aria-label="Delete" />
  </div>
);

// Figma "State=Selected" (renamed from "Active" 2026-07-20, ticket #42): the
// persistent chosen state, driven by the standard `aria-pressed` attribute —
// not a component prop, not CSS `:active` (which means "being pressed").
export const Selected = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="filled" aria-pressed="true">
      Filled
    </Button>
    <Button variant="outline" aria-pressed="true">
      Outline
    </Button>
    <Button variant="white" aria-pressed="true">
      White
    </Button>
    <Button variant="transparent" aria-pressed="true">
      Transparent
    </Button>
    <Button variant="destructive" aria-pressed="true">
      Destructive
    </Button>
  </div>
);

// Full Style x State matrix (ticket #52 — Figma reworked every colour role
// to carry a per-state Default/Hover/Selected variation). Default and
// Selected render statically (Selected via `aria-pressed`, per the note
// above); Hover can only be demonstrated by actually hovering the pointer
// over a button, so that column is labelled rather than faked with a class.
const STATE_MATRIX_VARIANTS: { variant: NonNullable<ButtonProps["variant"]>; label: string }[] = [
  { variant: "filled", label: "Filled" },
  { variant: "white", label: "White" },
  { variant: "transparent", label: "Transparent" },
  { variant: "outline", label: "Outline" },
  { variant: "destructive", label: "Distructive" },
];

export const StateMatrix = () => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-[96px_repeat(3,auto)] items-center gap-x-6 gap-y-3">
      <span />
      <span className="text-sm font-semibold text-text-muted">Default</span>
      <span className="text-sm font-semibold text-text-muted">
        Hover (hover the button below to see it)
      </span>
      <span className="text-sm font-semibold text-text-muted">
        Selected (aria-pressed)
      </span>
      {STATE_MATRIX_VARIANTS.map(({ variant, label }) => (
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
  </div>
);

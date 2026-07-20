// figma: node-id=3705:4446
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";

// Dev-only demo copy — not user-facing (real labels/option text come from
// next-intl catalogs at the call site).

// No `label` -> no trigger exists in the fetched node, so this stays the
// static, always-open group it was before ticket #43 (see the doc comment
// in Dropdown.tsx for why this configuration can't be a real disclosure).
export const Plain = () => (
  <Dropdown>
    <Button variant="white">Categorie</Button>
  </Dropdown>
);

// `label` present -> the label is a real disclosure trigger. Defaults open
// (`defaultOpen` defaults to `true`); click the label, or focus it and press
// Enter/Space, to close it, then Escape to close again / re-open.
export const WithLabel = () => (
  <Dropdown id="demo-label" label="Field">
    <Button variant="white">Categorie</Button>
  </Dropdown>
);

// The fetched Figma example: a label plus three stacked options, the first
// shown "selected" via the Button atom's own filled variant (a choice made
// by the composing content, not by the Dropdown atom itself). Left-aligned
// icon + label per the fetched node (ticket #43 — the centring bug lived in
// Button.tsx, not here).
export const FigmaDefault = () => (
  <Dropdown id="demo-figma-default" label="Field">
    <Button variant="filled" icon="Plus">
      Categorie
    </Button>
    <Button variant="white" icon="Plus">
      Categorie
    </Button>
    <Button variant="white" icon="Plus">
      Categorie
    </Button>
  </Dropdown>
);

// Same content as FigmaDefault, but starts collapsed (`defaultOpen={false}`)
// so the closed state — and the open/close animation on click — is directly
// exercisable in Ladle, per ticket #43.
export const ClosedByDefault = () => (
  <Dropdown id="demo-closed" label="Field" defaultOpen={false}>
    <Button variant="filled" icon="Plus">
      Categorie
    </Button>
    <Button variant="white" icon="Plus">
      Categorie
    </Button>
    <Button variant="white" icon="Plus">
      Categorie
    </Button>
  </Dropdown>
);

export const AllVariants = () => (
  <div className="flex w-72 flex-col gap-6">
    <Dropdown>
      <Button variant="white">Categorie</Button>
    </Dropdown>
    <Dropdown id="all-label" label="Field">
      <Button variant="filled" icon="Plus">
        Categorie
      </Button>
      <Button variant="white" icon="Plus">
        Categorie
      </Button>
      <Button variant="white" icon="Plus">
        Categorie
      </Button>
    </Dropdown>
    <Dropdown id="all-label-closed" label="Field (starts closed)" defaultOpen={false}>
      <Button variant="filled" icon="Plus">
        Categorie
      </Button>
      <Button variant="white" icon="Plus">
        Categorie
      </Button>
      <Button variant="white" icon="Plus">
        Categorie
      </Button>
    </Dropdown>
  </div>
);

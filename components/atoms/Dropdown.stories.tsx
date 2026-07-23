// figma: node-id=3705:4446
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";

// Dev-only demo copy — not user-facing (real labels/option text come from
// next-intl catalogs at the call site).

// The fetched Figma example: a label plus three stacked options, the first
// shown "selected" via Button's own filled variant (a choice made by the
// composing content, not by Dropdown itself).

// Closed: the `Field` label plus the bordered container showing only the
// first/selected option. The other two are collapsed, not removed: click
// the label (or focus + Enter/Space) to open them.
export const Closed = () => (
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

// Open: the expanded list — all three options visible. Click the label, or
// focus it and press Enter/Space, to collapse back to the Closed look; then
// Escape re-closes and returns focus to the label.
export const Open = () => (
  <Dropdown id="demo-open" label="Field" defaultOpen>
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

// Animated: starts open so the first interaction is watching the panel
// collapse down to the single selected option (the CSS-grid `0fr`/`1fr`
// transition, disabled under `prefers-reduced-motion`); click again to watch
// it expand back out.
export const Animated = () => (
  <Dropdown id="demo-animated" label="Field" defaultOpen>
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

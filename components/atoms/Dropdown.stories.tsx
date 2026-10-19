// figma: node-id=3705:4446
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import { Tag } from "./Tag";

// Dev-only demo copy — not user-facing (real labels/option text come from
// next-intl catalogs at the call site).

// The fetched Figma example: a label plus three stacked options, the first
// shown "selected" via Button's own filled variant (a choice made by the
// composing content, not by Dropdown itself). The first/selected Button is
// presentational: Dropdown's own single button spans the whole row (label,
// selection and chevron) and is the disclosure trigger.

// Closed: the `Field` label (a native label of the one trigger button) plus the bordered container
// showing the first/selected option hugging its own content, with the
// chevron pinned to the panel's far right edge. The other two are collapsed,
// not removed: click the selected option (or focus + Enter/Space) to open
// them.
export const Closed = () => (
  <Dropdown id="demo-closed" label="Field" defaultOpen={false}>
    <Button presentational variant="filled" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
  </Dropdown>
);

// Open: the expanded list — all three options visible, each filling the
// panel's width. Click the selected option, or focus it and press
// Enter/Space, to collapse back to the Closed look; then Escape re-closes
// and returns focus to it.
export const Open = () => (
  <Dropdown id="demo-open" label="Field" defaultOpen>
    <Button presentational variant="filled" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
  </Dropdown>
);

// Animated: starts open so the first interaction is watching the panel
// collapse down to the single selected option (the CSS-grid `0fr`/`1fr`
// transition, disabled under `prefers-reduced-motion`, plus the chevron's own
// rotation) — click again to watch it expand back out.
export const Animated = () => (
  <Dropdown id="demo-animated" label="Field" defaultOpen>
    <Button presentational variant="filled" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
    <Button variant="white" icon="Plus" align="left">
      Categorie
    </Button>
  </Dropdown>
);

// Tag as the selection (CardDetailPanel's Prioriteit / Grootte): the Tag is
// inert content inside the same single trigger button.
export const WithTagSelection = () => (
  <Dropdown id="demo-tag" label="Prioriteit" defaultOpen={false}>
    <Tag variant="urgent">Urgent</Tag>
    <Tag variant="medium">Gemiddeld</Tag>
    <Tag variant="low">Laag</Tag>
  </Dropdown>
);

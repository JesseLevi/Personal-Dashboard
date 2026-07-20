// figma: node-id=3705:4446
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";

// Dev-only demo copy — not user-facing (real labels/option text come from
// next-intl catalogs at the call site).
export const Plain = () => (
  <Dropdown>
    <Button variant="white">Categorie</Button>
  </Dropdown>
);

export const WithLabel = () => (
  <Dropdown id="demo-label" label="Field">
    <Button variant="white">Categorie</Button>
  </Dropdown>
);

// The fetched Figma example: a label plus three stacked options, the first
// shown "selected" via the Button atom's own filled variant (a choice made
// by the composing content, not by the Dropdown atom itself).
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
  </div>
);

// figma: node-id=3623:4346
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

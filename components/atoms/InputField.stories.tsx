// figma: node-id=3705:4402
import { Button } from "./Button";
import { InputField } from "./InputField";

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).
export const Plain = () => <InputField placeholder="Example" />;

export const WithLabel = () => (
  <InputField id="demo-label" label="Field" placeholder="Example" />
);

export const WithLeadingIcon = () => (
  <InputField leadingIcon="Calendar" placeholder="Example" />
);

export const WithTrailingIcon = () => (
  <InputField trailingIcon="ChevronDown" placeholder="Example" />
);

export const WithButtonSlot = () => (
  <InputField
    id="demo-button"
    label="Field"
    placeholder="Example"
    trailingIcon="ChevronDown"
    button={
      <Button variant="filled" icon="Plus">
        Categorie
      </Button>
    }
  />
);

// The Figma default configuration: Title + Trekking-icon on, Leading-icon off.
export const FigmaDefault = () => (
  <InputField
    id="demo-figma-default"
    label="Field"
    placeholder="Example"
    trailingIcon="ChevronDown"
  />
);

export const AllVariants = () => (
  <div className="flex w-72 flex-col gap-6">
    <InputField placeholder="Example" />
    <InputField id="all-label" label="Field" placeholder="Example" />
    <InputField
      leadingIcon="Calendar"
      trailingIcon="ChevronDown"
      placeholder="Example"
    />
  </div>
);

// Figma's "Active" instance is a filled row with a typed (not placeholder)
// value — the input's own text-text / placeholder:text-placeholder classes
// already reproduce the darker, "typed" copy for free; no separate CSS state.
export const TypedValue = () => (
  <InputField
    id="demo-typed-value"
    label="Field"
    trailingIcon="ChevronDown"
    defaultValue="Example"
  />
);

// #44: the container now draws its own focus-within ring instead of relying
// on the native per-input outline (which was much smaller than the pill and
// looked broken). autoFocus renders this story already focused so the ring
// is visible without needing a real click/tab in the workbench.
export const Focused = () => (
  <InputField
    id="demo-focused"
    label="Field"
    placeholder="Example"
    trailingIcon="ChevronDown"
    autoFocus
  />
);

// Reproduces the three-row Figma reference (Default / Hover / Active) as
// closely as static markup allows — hover the second row to compare against
// the fetched node's Hover state; the third row shows the typed-text look.
export const FigmaThreeRows = () => (
  <div className="flex w-72 flex-col gap-6">
    <InputField id="rows-default" label="Field" placeholder="Example" trailingIcon="ChevronDown" />
    <InputField id="rows-hover" label="Field" placeholder="Example" trailingIcon="ChevronDown" />
    <InputField id="rows-active" label="Field" trailingIcon="ChevronDown" defaultValue="Example" />
  </div>
);

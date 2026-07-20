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

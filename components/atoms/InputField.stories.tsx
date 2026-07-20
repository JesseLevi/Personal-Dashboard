// figma: node-id=3705:4402
import { InputField } from "./InputField";

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).

// Reproduces the Figma state rows (Default / Hover / Active) as closely as
// static markup allows — hover the second row to compare against the fetched
// node's Hover state; the third row shows the typed-text look and doubles as
// this atom's read of Figma's "Active" as the `:focus-within` state (see the
// doc comment in InputField.tsx and design/figma-map.json for why that
// mapping is an assumption, not a labelled Figma state). The fetched node
// also carries a fourth state, Selected — its border/text change without any
// interaction affordance a plain `<input>` has, so it isn't modelled and
// isn't faked here either (flagged in design/figma-map.json).
export const States = () => (
  <div className="flex w-72 flex-col gap-6">
    <InputField
      id="states-default"
      label="Field"
      placeholder="Example"
      trailingIcon="ChevronDown"
    />
    <InputField
      id="states-hover"
      label="Field"
      placeholder="Example"
      trailingIcon="ChevronDown"
    />
    <InputField
      id="states-active"
      label="Field"
      trailingIcon="ChevronDown"
      defaultValue="Example"
    />
  </div>
);

export const WithLeadingIcon = () => (
  <InputField
    id="with-leading-icon"
    label="Field"
    leadingIcon="Calendar"
    placeholder="Example"
  />
);

// Figma's "Trekking-icon" — a misnomer for the trailing icon (see
// InputField.tsx's doc comment).
export const WithTrailingIcon = () => (
  <InputField
    id="with-trailing-icon"
    label="Field"
    placeholder="Example"
    trailingIcon="ChevronDown"
  />
);

export const WithBothIcons = () => (
  <InputField
    id="with-both-icons"
    label="Field"
    leadingIcon="Calendar"
    placeholder="Example"
    trailingIcon="ChevronDown"
  />
);

export const WithoutIcons = () => (
  <InputField id="without-icons" label="Field" placeholder="Example" />
);

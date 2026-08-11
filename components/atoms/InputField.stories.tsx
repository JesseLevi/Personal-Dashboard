// figma: node-id=3705:4402
import { InputField } from "./InputField";

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).

// Reproduces the Figma state rows (Default / Hover / Active) as closely as
// static markup allows — hover the second row; the third row shows the
// typed-text look (the `:focus-within` mapping, see InputField.tsx's doc
// comment). Selected isn't modelled/faked here — see design/notes/InputField.md.
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

// Every row must render the same container height regardless of which
// icon(s) are present — stacking all four here doubles as the visual
// regression check for that. See design/notes/InputField.md.
export const IconCombinations = () => (
  <div className="flex w-72 flex-col gap-6">
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">
        Leading icon only
      </span>
      <InputField
        id="with-leading-icon"
        label="Field"
        leadingIcon="Calendar"
        placeholder="Example"
      />
    </div>
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">
        Trailing icon only
      </span>
      <InputField
        id="with-trailing-icon"
        label="Field"
        placeholder="Example"
        trailingIcon="ChevronDown"
      />
    </div>
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">
        Both icons
      </span>
      <InputField
        id="with-both-icons"
        label="Field"
        leadingIcon="Calendar"
        placeholder="Example"
        trailingIcon="ChevronDown"
      />
    </div>
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">
        No icons
      </span>
      <InputField id="without-icons" label="Field" placeholder="Example" />
    </div>
  </div>
);

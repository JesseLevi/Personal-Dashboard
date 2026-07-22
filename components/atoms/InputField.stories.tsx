// figma: node-id=3705:4402
import { InputField } from "./InputField";

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).

// Reproduces the Figma state rows (Default / Hover / Active) as closely as
// static markup allows — hover the second row to compare against the fetched
// node's Hover state; the third row shows the typed-text look and doubles as
// this atom's read of Figma's "Active" as the `:focus-within` state (see the
// doc comment in InputField.tsx and `design/notes/InputField.md` for why that
// mapping is an assumption, not a labelled Figma state). The fetched node
// also carries a fourth state, Selected — its border/text change without any
// interaction affordance a plain `<input>` has, so it isn't modelled and
// isn't faked here either (flagged in `design/notes/InputField.md`).
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

// Merged for #78 (was 4 separate Ladle entries: WithLeadingIcon /
// WithTrailingIcon / WithBothIcons / WithoutIcons — same consolidation #56
// did for Button's icon/text booleans). Figma's "Trekking-icon" is a
// misnomer for the trailing icon (see InputField.tsx's doc comment). Every
// row must render the same container height — that equal-height guarantee
// (regardless of which icon(s) are present) is exactly the bug #78 fixed, so
// stacking all four here also doubles as the visual regression check for it.
export const IconCombinations = () => (
  <div className="flex w-72 flex-col gap-6">
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-muted">
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
      <span className="text-sm font-semibold text-text-muted">
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
      <span className="text-sm font-semibold text-text-muted">
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
      <span className="text-sm font-semibold text-text-muted">
        No icons
      </span>
      <InputField id="without-icons" label="Field" placeholder="Example" />
    </div>
  </div>
);

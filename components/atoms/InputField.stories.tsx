// figma: node-id=3705:4402
import type { Story } from "@ladle/react";
import { Button } from "./Button";
import { InputField } from "./InputField";

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).

// Reproduces the three-row Figma reference (Default / Hover / Active) as
// closely as static markup allows — hover the second row to compare against
// the fetched node's Hover state; the third row shows the typed-text look and
// doubles as this atom's read of Figma's "Active" as the `:focus-within`
// state (see the doc comment in InputField.tsx and design/figma-map.json for
// why that mapping is an assumption, not a labelled Figma state).
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

type PlaygroundProps = {
  title: boolean;
  text: string;
  leadingIcon: boolean;
  trailingIcon: boolean;
  button: boolean;
  buttonText: boolean;
  value: string;
};

export const Playground: Story<PlaygroundProps> = ({
  title,
  text,
  leadingIcon,
  trailingIcon,
  button,
  buttonText,
  value,
}) => {
  const shared = {
    placeholder: "Example",
    defaultValue: value || undefined,
    ...(leadingIcon ? { leadingIcon: "Calendar" as const } : {}),
    ...(trailingIcon ? { trailingIcon: "ChevronDown" as const } : {}),
    ...(button
      ? {
          button: (
            <Button variant="filled" icon="Plus" aria-label="Categorie">
              {buttonText ? "Categorie" : undefined}
            </Button>
          ),
        }
      : {}),
  };

  return title ? (
    <InputField id="playground" label={text} {...shared} />
  ) : (
    <InputField id="playground" {...shared} />
  );
};

Playground.args = {
  title: true,
  text: "Field",
  leadingIcon: false,
  trailingIcon: true,
  button: false,
  buttonText: true,
  value: "",
};

Playground.argTypes = {
  title: { control: { type: "boolean" } },
  text: { control: { type: "text" } },
  leadingIcon: { control: { type: "boolean" } },
  trailingIcon: { control: { type: "boolean" } },
  button: { control: { type: "boolean" } },
  buttonText: { control: { type: "boolean" } },
  value: { control: { type: "text" } },
};

// Figma `Button/Default` "With text: false" — the slot button rendered
// icon-only, called out by the user specifically.
export const WithIconlessButton = () => (
  <InputField
    id="iconless-button"
    label="Field"
    placeholder="Example"
    trailingIcon="ChevronDown"
    button={
      <Button variant="filled" icon="Plus" aria-label="Categorie" />
    }
  />
);

// Two fields side by side: one with the leading icon, one without.
export const WithAndWithoutIcon = () => (
  <div className="flex gap-6">
    <InputField
      id="with-icon"
      label="Field"
      leadingIcon="Calendar"
      placeholder="Example"
      trailingIcon="ChevronDown"
    />
    <InputField
      id="without-icon"
      label="Field"
      placeholder="Example"
      trailingIcon="ChevronDown"
    />
  </div>
);

// figma: node-id=3727:4021
import type { Story } from "@ladle/react";
import { CardContentIngredient } from "./CardContentIngredient";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Dev-only demo copy ("Banana", "300 gr") — not user-facing UI chrome, same
// convention as the other molecule stories (e.g. Card.stories.tsx's
// "Card content" placeholder). The delete button's aria-label IS user-facing
// chrome text, so it comes from the message catalog rather than being typed
// here directly.
const deleteLabelEn = en.components.cardContentIngredient.deleteLabel;

type PlaygroundProps = {
  name: string;
  quantity: string;
  checkbox: "none" | "unchecked" | "checked";
  deletable: boolean;
};

export const Playground: Story<PlaygroundProps> = ({
  name,
  quantity,
  checkbox,
  deletable,
}) => {
  const checked = checkbox !== "none" ? checkbox === "checked" : undefined;

  return (
    <div className="w-96">
      {deletable ? (
        <CardContentIngredient
          name={name}
          quantity={quantity}
          checked={checked}
          onDelete={() => {}}
          deleteLabel={deleteLabelEn}
        />
      ) : (
        <CardContentIngredient
          name={name}
          quantity={quantity}
          checked={checked}
        />
      )}
    </div>
  );
};

Playground.args = {
  name: "Banana",
  quantity: "300 gr",
  checkbox: "unchecked",
  deletable: false,
};

Playground.argTypes = {
  name: { control: { type: "text" } },
  quantity: { control: { type: "text" } },
  checkbox: {
    control: { type: "select" },
    options: ["none", "unchecked", "checked"],
  },
  deletable: { control: { type: "boolean" } },
};

// The full fetched variant axis side by side: Checkbox=None, Unchecked,
// Checked (dimmed), and the delete affordance. Click-and-hold (":active") the
// Unchecked row to compare the pill highlight against the fetched "Active"
// frame — there is no Hover state to compare (see the class doc comment /
// docs/design-tokens.md open question 5). The Delete row's pill is
// unconditional (matching the fetched "Delete" frame), not a pointer state.
export const AllVariants = () => (
  <div className="flex w-96 flex-col gap-2">
    <CardContentIngredient name="Banana" quantity="300 gr" />
    <CardContentIngredient name="Banana" quantity="300 gr" checked={false} />
    <CardContentIngredient name="Banana" quantity="300 gr" checked />
    <CardContentIngredient
      name="Banana"
      quantity="300 gr"
      checked={false}
      onDelete={() => {}}
      deleteLabel={deleteLabelEn}
    />
  </div>
);

// NL catalog check for the delete label.
export const DeleteLabelNl = () => (
  <div className="w-96">
    <CardContentIngredient
      name="Banaan"
      quantity="300 gr"
      checked={false}
      onDelete={() => {}}
      deleteLabel={nl.components.cardContentIngredient.deleteLabel}
    />
  </div>
);

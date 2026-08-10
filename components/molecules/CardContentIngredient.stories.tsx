// figma: node-id=3727:4021
import type { Story } from "@ladle/react";
import { CardContentIngredient } from "./CardContentIngredient";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// deleteLabel IS user-facing chrome text, so it comes from the message catalog, not a literal.
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
          swipeAction="delete"
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

// Base variant axis side by side (Checkbox None/Unchecked/Checked). Delete
// moved to its own SwipeToDelete story below (#160: it's a gesture, not an
// always-visible row). Click-and-hold (:active) the Unchecked row for the
// Active pill — see design/notes/CardContentIngredient.md (no Hover state).
export const AllVariants = () => (
  <div className="flex w-96 flex-col gap-2">
    <CardContentIngredient name="Banana" quantity="300 gr" />
    <CardContentIngredient name="Banana" quantity="300 gr" checked={false} />
    <CardContentIngredient name="Banana" quantity="300 gr" checked />
  </div>
);

// #131/#160: `Tag=false` (no `quantity`) + `divider` computed per-row as
// "not the last one" — the ingredient-search-panel usage, a name-only pick
// list whose rule sits only BETWEEN rows (none above the first, none below
// the last).
export const NoQuantityWithDivider = () => {
  const rows = [
    { name: "Appel", checked: false },
    { name: "Blauwe bes", checked: false },
    { name: "Havermout", checked: true },
  ];
  return (
    <div className="w-96 rounded-xl border border-border bg-surface p-2">
      {rows.map((row, index) => (
        <CardContentIngredient
          key={row.name}
          name={row.name}
          checked={row.checked}
          divider={index < rows.length - 1}
        />
      ))}
    </div>
  );
};

// #160: State=Delete (node 3727:4378, annotation "When sliding") is a swipe
// reveal, opt-in via `swipeAction="delete"` — the shopping basket (#29,
// Phase 5) is its first live consumer (#177). Renders at rest (closed); the
// open/revealed pill state needs a live drag and isn't captured by the
// static screenshot baseline, same as the Active pill above.
export const SwipeToDelete = () => (
  <div className="w-96">
    <CardContentIngredient
      name="Banana"
      quantity="300 gr"
      checked={false}
      onDelete={() => {}}
      deleteLabel={deleteLabelEn}
      swipeAction="delete"
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
      swipeAction="delete"
    />
  </div>
);

// #179: State=Cart (node 4050:11613, annotation "When sliding" on
// 4050:11614) is the same swipe gesture, revealing a `filled`/basket
// AnimatedAddToBasketButton instead of the destructive Trash Button —
// ReceptDetailPage's ingredient rows are its first live consumer. Renders at
// rest (closed), same reasoning as SwipeToDelete above.
export const SwipeToCart = () => (
  <div className="w-96">
    <CardContentIngredient
      name="Banana"
      quantity="300 gr"
      checked={false}
      onAddToCart={() => {}}
      addToCartLabel={en.components.cardContentIngredient.addToCartLabel}
      swipeAction="cart"
    />
  </div>
);

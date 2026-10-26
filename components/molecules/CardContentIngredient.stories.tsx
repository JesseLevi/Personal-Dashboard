// figma: node-id=3727:4021
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { Story, StoryDefault } from "@ladle/react";
import { CardContentIngredient } from "./CardContentIngredient";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

export default { title: "Basis / Kaarten / Card content ingredient" } satisfies StoryDefault;

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

// Swipe rows render at rest (closed); the revealed pill needs a live drag, so drag them to try.
export const Overview = () => (
  <>
    <StoryIntro what="One ingredient row: name, optional quantity and checkbox, optionally swipeable." note="CardContentIngredient" />
    <Specimens>
      <Specimen label="no checkbox">
        <div className="w-96">
          <CardContentIngredient name="Banana" quantity="300 gr" />
        </div>
      </Specimen>
      <Specimen label="unchecked" hint="checked={false}">
        <div className="w-96">
          <CardContentIngredient name="Banana" quantity="300 gr" checked={false} />
        </div>
      </Specimen>
      <Specimen label="checked">
        <div className="w-96">
          <CardContentIngredient name="Banana" quantity="300 gr" checked />
        </div>
      </Specimen>
      <Specimen label="no quantity, divider between rows" hint="ingredient-search pick list">
        <div className="w-96 rounded-xl border border-stroke-primary bg-surface-highlight-white p-component-xs">
          {[
            { name: "Appel", checked: false },
            { name: "Blauwe bes", checked: false },
            { name: "Havermout", checked: true },
          ].map((row, index, rows) => (
            <CardContentIngredient key={row.name} name={row.name} checked={row.checked} divider={index < rows.length - 1} />
          ))}
        </div>
      </Specimen>
      <Specimen label='swipeAction="delete"' hint="swipe reveals the destructive button (shopping basket)">
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
      </Specimen>
      <Specimen label='swipeAction="cart"' hint="swipe reveals add-to-basket (recipe detail)">
        <div className="w-96">
          <CardContentIngredient
            name="Banana"
            quantity="300 gr"
            checked={false}
            onAddToCart={async () => ({ success: true, data: undefined })}
            addToCartLabel={en.components.cardContentIngredient.addToCartLabel}
            swipeAction="cart"
          />
        </div>
      </Specimen>
      <Specimen label="needs review" hint="importer was unsure; the Tag is the caller's hook">
        <div className="w-96">
          <CardContentIngredient
            name="Knoflook (teentje)"
            quantity="1 stuk"
            reviewLabel={nl.components.recipeDetailPage.needsReviewLabel}
            onReviewClick={() => {}}
          />
        </div>
      </Specimen>
      <Specimen label="not counted" hint="left out of the nutrition totals">
        <div className="w-96">
          <CardContentIngredient
            name="Garnalen"
            quantity="200 g"
            reviewLabel={nl.components.recipeDetailPage.notCountedLabel}
            onReviewClick={() => {}}
          />
        </div>
      </Specimen>
    </Specimens>
  </>
);

// #222: a very long name wraps while the Tag keeps its natural width (design/notes/CardContentIngredient.md).
export const LongText = () => (
  <div className="w-96">
    <CardContentIngredient
      name="Extra fijngesneden biologische roodlof met een vleugje truffelolie"
      quantity="300 gr"
    />
  </div>
);

export const Dutch = () => (
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

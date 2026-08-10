// figma: node-id=4051:12960
import { AnimatedAddToBasketButton } from "./AnimatedAddToBasketButton";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Click any story below to see the slide animation (icon+label out to the
// top, "Toegevoegd"/"Added" in from the bottom, small press-scale) -- it
// reverts after 2s, see design/notes/AnimatedAddToBasketButton.md for that
// judgement call. The static screenshot baseline only ever captures the
// resting (pre-click) frame, same as CardContentIngredient's Active pill.
export const Labelled = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={() => {}}
  />
);

// The swipe-revealed form (CardContentIngredient's `swipeAction="cart"`) --
// icon-only, so `aria-label` is required instead of `label`/`addedLabel`.
export const IconOnly = () => (
  <AnimatedAddToBasketButton
    aria-label={en.components.cardContentIngredient.addToCartLabel}
    onAddToBasket={() => {}}
  />
);

export const NlCatalog = () => (
  <div className="flex items-center gap-4">
    <AnimatedAddToBasketButton
      label={nl.components.recipeDetailPage.addToBasketLabel}
      addedLabel={nl.components.recipeDetailPage.addedToBasketLabel}
      onAddToBasket={() => {}}
    />
    <AnimatedAddToBasketButton
      aria-label={nl.components.cardContentIngredient.addToCartLabel}
      onAddToBasket={() => {}}
    />
  </div>
);

export const Disabled = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={() => {}}
    disabled
  />
);

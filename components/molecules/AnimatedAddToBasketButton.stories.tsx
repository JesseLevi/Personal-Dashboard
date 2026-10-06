// figma: node-id=4051:12960
import { AnimatedAddToBasketButton } from "./AnimatedAddToBasketButton";
import type { ActionResult } from "@/lib/shopping/types";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// #290: the "added" face plays only on `success: true`. `succeeds` resolves
// like a real server action; `fails` resolves `success: false`, so clicking
// `AddFails` leaves the button at rest -- no error UI is designed yet
// (docs/open-questions.md#winkelmand-send-no-success-feedback).
const succeeds = async (): Promise<ActionResult> => ({ success: true, data: undefined });
const fails = async (): Promise<ActionResult> => ({ success: false, error: "generic" });

// Click any story below to see the slide animation (icon+label out to the
// top, "Toegevoegd"/"Added" in from the bottom, small press-scale) -- it
// reverts after 2s, see design/notes/AnimatedAddToBasketButton.md for that
// judgement call. The static screenshot baseline only ever captures the
// resting (pre-click) frame, same as CardContentIngredient's Active pill.
export const Labelled = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={succeeds}
  />
);

// The swipe-revealed form (CardContentIngredient's `swipeAction="cart"`) --
// icon-only, so `aria-label` is required instead of `label`/`addedLabel`.
export const IconOnly = () => (
  <AnimatedAddToBasketButton
    aria-label={en.components.cardContentIngredient.addToCartLabel}
    onAddToBasket={succeeds}
  />
);

export const NlCatalog = () => (
  <div className="flex items-center gap-4">
    <AnimatedAddToBasketButton
      label={nl.components.recipeDetailPage.addToBasketLabel}
      addedLabel={nl.components.recipeDetailPage.addedToBasketLabel}
      onAddToBasket={succeeds}
    />
    <AnimatedAddToBasketButton
      aria-label={nl.components.cardContentIngredient.addToCartLabel}
      onAddToBasket={succeeds}
    />
  </div>
);

export const Disabled = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={succeeds}
    disabled
  />
);

// Click-through paths for #290; both render the same resting frame.
export const AddSucceeds = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={succeeds}
  />
);

export const AddFails = () => (
  <AnimatedAddToBasketButton
    label={en.components.recipeDetailPage.addToBasketLabel}
    addedLabel={en.components.recipeDetailPage.addedToBasketLabel}
    onAddToBasket={fails}
  />
);

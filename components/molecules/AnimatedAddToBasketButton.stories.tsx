// figma: node-id=4051:12960
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Button } from "../atoms/Button";
import { AnimatedAddToBasketButton } from "./AnimatedAddToBasketButton";
import type { ActionResult } from "@/lib/shopping/types";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Animated add to basket button" } satisfies StoryDefault;

// #290: the "added" face plays only on `success: true`. `succeeds` resolves
// like a real server action; `fails` resolves `success: false`, so clicking
// `AddFails` leaves the button at rest -- no error UI is designed yet
// (docs/open-questions.md#winkelmand-send-no-success-feedback).
const succeeds = async (): Promise<ActionResult> => ({ success: true, data: undefined });
const fails = async (): Promise<ActionResult> => ({ success: false, error: "generic" });

const labelProps = {
  label: en.components.recipeDetailPage.addToBasketLabel,
  addedLabel: en.components.recipeDetailPage.addedToBasketLabel,
};
const iconOnlyProps = { "aria-label": en.components.cardContentIngredient.addToCartLabel };

// The static baseline only captures the resting frame; clicking plays the slide
// (design/notes/AnimatedAddToBasketButton.md).
export const Overview = () => (
  <>
    <StoryIntro what="An add-to-basket button that slides to a confirmation once the action succeeds." note="AnimatedAddToBasketButton" />
    <Specimens>
      <Specimen label="labelled" hint="icon + label">
        <AnimatedAddToBasketButton {...labelProps} onAddToBasket={succeeds} />
      </Specimen>
      <Specimen label="icon only" hint="swipe-revealed form, aria-label instead of label">
        <AnimatedAddToBasketButton {...iconOnlyProps} onAddToBasket={succeeds} />
      </Specimen>
      <Specimen label="disabled">
        <AnimatedAddToBasketButton {...labelProps} onAddToBasket={succeeds} disabled />
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { label: string; addedLabel: string; iconOnly: boolean; disabled: boolean; succeeds: boolean };

export const Playground: Story<PlaygroundProps> = ({ label, addedLabel, iconOnly, disabled, succeeds: ok }) =>
  iconOnly ? (
    <AnimatedAddToBasketButton {...iconOnlyProps} onAddToBasket={ok ? succeeds : fails} disabled={disabled} />
  ) : (
    <AnimatedAddToBasketButton label={label} addedLabel={addedLabel} onAddToBasket={ok ? succeeds : fails} disabled={disabled} />
  );
Playground.args = { ...labelProps, iconOnly: false, disabled: false, succeeds: true };
Playground.argTypes = {
  label: { control: { type: "text" } },
  addedLabel: { control: { type: "text" } },
  iconOnly: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
  succeeds: { control: { type: "boolean" } },
};

// Click both: the first resolves success (slides to "Added", reverts after 2s), the second
// resolves failure and stays at rest (no error UI designed yet, docs/open-questions.md#winkelmand-send-no-success-feedback).
export const Interactive = () => (
  <Specimens>
    <Specimen label="action succeeds" hint="plays the added face">
      <AnimatedAddToBasketButton {...labelProps} onAddToBasket={succeeds} />
    </Specimen>
    <Specimen label="action fails" hint="stays at rest">
      <AnimatedAddToBasketButton {...labelProps} onAddToBasket={fails} />
    </Specimen>
  </Specimens>
);

export const Dutch = () => (
  <div className="flex items-center gap-inline-md">
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

// #429: more than one basket -> the click opens a basket popover first. Not
// designed in Figma: existing Dropdown + Buttons, icons User / Users.
const twoBaskets = [
  { id: "own", name: nl.shopping.lists.defaultName, shared: false },
  { id: "samen", name: "Gezin", shared: true },
];
const threeBaskets = [...twoBaskets, { id: "sam", name: "Feestje van Sam", shared: true }];

// Room below the trigger so the portalled popover is captured by the screenshot.
const popoverFrame = "flex min-h-72 items-start justify-end";

export const BasketPopoverTwo = () => (
  <div className={popoverFrame}>
    <AnimatedAddToBasketButton
      label={nl.components.recipeDetailPage.addToBasketLabel}
      addedLabel={nl.components.recipeDetailPage.addedToBasketLabel}
      chooseBasketLabel={nl.components.recipeDetailPage.chooseBasketLabel}
      baskets={twoBaskets}
      defaultChoosing
      onAddToBasket={succeeds}
    />
  </div>
);

export const BasketPopoverThree = () => (
  <div className={popoverFrame}>
    <AnimatedAddToBasketButton
      label={nl.components.recipeDetailPage.addToBasketLabel}
      addedLabel={nl.components.recipeDetailPage.addedToBasketLabel}
      chooseBasketLabel={nl.components.recipeDetailPage.chooseBasketLabel}
      baskets={threeBaskets}
      defaultChoosing
      onAddToBasket={succeeds}
    />
  </div>
);

export const BasketPopoverIconOnly = () => (
  <div className={popoverFrame}>
    <AnimatedAddToBasketButton
      aria-label={nl.components.cardContentIngredient.addToCartLabel}
      chooseBasketLabel={nl.components.recipeDetailPage.chooseBasketLabel}
      baskets={threeBaskets}
      defaultChoosing
      onAddToBasket={succeeds}
    />
  </div>
);

// The recipe header row: short label below `md`, icon only at 400px and
// narrower so the row stays on one line down to 320px (viewport media
// queries, so the static baseline shows the wide frame; the narrow frames
// are checked in the browser).
export const RecipeHeader = () => (
  <div className="flex w-full items-center justify-between gap-4">
    <Button icon="ArrowLeft" aria-label={en.components.recipeDetailPage.backLabel} />
    <div className="flex flex-wrap items-center justify-end gap-4">
      <AnimatedAddToBasketButton
        label={nl.components.recipeDetailPage.addToBasketLabel}
        shortLabel={nl.components.recipeDetailPage.addToBasketShortLabel}
        iconOnlyBelow400
        addedLabel={nl.components.recipeDetailPage.addedToBasketLabel}
        onAddToBasket={succeeds}
      />
      <Button variant="filled" icon="Share" aria-label={en.components.recipeDetailPage.shareLabel}>
        <span className="hidden md:inline">{en.components.recipeDetailPage.shareLabel}</span>
      </Button>
      <Button icon="Ellipsis" aria-label={en.components.recipeDetailPage.overflowMenuLabel} />
    </div>
  </div>
);

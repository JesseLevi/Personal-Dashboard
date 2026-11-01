import { BasketSuggestions } from "./BasketSuggestions";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Winkelmand / Basket suggestions" } satisfies StoryDefault;

const ok = async () => ({ success: true });

export const Overview = () => (
  <div className="flex flex-col gap-stack-lg">
    <StoryIntro
      what="Buy-rhythm suggestions above the basket: add the item to this basket, or say no."
      note="WinkelmandPage"
    />
    <BasketSuggestions
      suggestions={[
        { id: "s1", item: "Pindakaas", median: 30, days: 34 },
        { id: "s2", item: "Koffiebonen", median: 14, days: 15 },
      ]}
      onAdd={ok}
      onDismiss={ok}
    />
  </div>
);

import { useEffect, useRef } from "react";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaMealItem } from "@/lib/agenda/types";
import nl from "@/messages/nl.json";
import { AgendaMealPanel } from "./AgendaMealPanel";
import type { MealPlanDetail } from "./meal-actions";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda meal panel" } satisfies StoryDefault;

// Dev-only mock actions: the panel never imports the real "use server" module.
const detail = (sentToBasket: boolean) => async (): Promise<AgendaActionResult<MealPlanDetail>> => ({
  success: true,
  data: { recipeId: "recipe-1", sentToBasket },
});
async function mockMutate(): Promise<AgendaActionResult> {
  return { success: true, data: undefined };
}

const meal: AgendaMealItem = {
  kind: "meal",
  id: "meal-1",
  title: "Lasagne met spinazie",
  start: "2026-01-02",
  end: null,
  allDay: true,
  linkCount: 0,
  slot: "dinner",
  servings: 4,
  thumbnailPath: null,
  attached: false,
  position: 1000,
};

const baskets = [{ id: "own", name: "Boodschappen", shared: false }];

const panelProps = {
  open: true,
  onClose: () => {},
  item: meal,
  baskets,
  onLoadMeal: detail(false),
  onUpdateMeal: mockMutate,
  onDeleteMeal: mockMutate,
  onSendMeal: mockMutate,
  onOpenRecipe: () => {},
};

// The panel is `position: fixed`; the min-h wrapper gives the screenshot root a height (SidePanel.stories.tsx).
export const PlannedMeal = () => (
  <div className="min-h-screen">
    <AgendaMealPanel {...panelProps} />
  </div>
);

export const AttachedToEvent = () => (
  <div className="min-h-screen">
    <AgendaMealPanel {...panelProps} item={{ ...meal, attached: true, slot: "lunch", servings: 2 }} />
  </div>
);

export const AlreadyInBasket = () => (
  <div className="min-h-screen">
    <AgendaMealPanel {...panelProps} onLoadMeal={detail(true)} />
  </div>
);

const deleteLabel = nl.components.mealPanel.deleteLabel;

// Clicks "Verwijderen" once on mount to show the confirm footer, as AgendaEventPanel's story does.
export const DeleteConfirm = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = Array.from(ref.current?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent?.trim() === deleteLabel,
    );
    button?.click();
  }, []);
  return (
    <div ref={ref} className="min-h-screen">
      <AgendaMealPanel {...panelProps} />
    </div>
  );
};

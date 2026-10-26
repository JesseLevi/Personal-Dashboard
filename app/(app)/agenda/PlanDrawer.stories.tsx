import { useEffect, useRef, type ReactNode } from "react";
import { PlanDrawer } from "@/components/organisms/PlanDrawer";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import nl from "@/messages/nl.json";
import type { PlanCardGroup } from "@/lib/agenda/plan-cards";
import { PlanCardList } from "./PlanCardList";
import { PlanRecipeList } from "./PlanRecipeList";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Plan drawer" } satisfies StoryDefault;

const categories = [
  { id: "breakfast", name: "Ontbijt" },
  { id: "lunch", name: "Lunch" },
  { id: "main", name: "Hoofdgerecht" },
  { id: "dessert", name: "Toetje" },
];

const recipe = (id: string, title: string, categoryId: string, timeMinutes: number | null): PlanRecipe => ({
  id,
  title,
  servings: 4,
  categoryId,
  categoryName: categories.find((category) => category.id === categoryId)?.name ?? "",
  timeMinutes,
  thumbnailUrl: null,
  thumbnailPath: null,
});

const recipes = [
  recipe("r1", "Lasagne met spinazie", "main", 60),
  recipe("r2", "Havermout met appel", "breakfast", 10),
  recipe("r3", "Tosti ham kaas", "lunch", null),
  recipe("r4", "Risotto met paddenstoelen", "main", 45),
  recipe("r5", "Appeltaart", "dessert", 90),
  recipe("r6", "Pasta pesto", "main", 20),
];

const noPlan = async () => ({ success: true as const, data: undefined });

const List = () => (
  <PlanRecipeList recipes={recipes} categories={categories} today="2026-01-01" onPlan={noPlan} onPlanned={() => {}} />
);

const cardGroups: PlanCardGroup[] = [
  {
    boardId: "b1",
    boardName: "Thuis",
    cards: [
      { id: "c1", title: "Tuinmeubels schoonmaken", columnName: "Bezig", plannedFor: "2026-01-03" },
      { id: "c2", title: "Garage opruimen", columnName: "Ideeën", plannedFor: null },
      { id: "c3", title: "Rookmelders vervangen", columnName: "Klaar", plannedFor: null },
    ],
  },
  {
    boardId: "b2",
    boardName: "Werk",
    cards: [
      { id: "c4", title: "Kwartaalrapport afmaken", columnName: "Bezig", plannedFor: null },
      { id: "c5", title: "Offertes opvragen voor het reinigen van de dakgoot", columnName: "Ideeën", plannedFor: null },
    ],
  },
];

const Cards = ({ groups = cardGroups }: { groups?: PlanCardGroup[] }) => (
  <PlanCardList groups={groups} today="2026-01-01" onPlan={noPlan} onPlanned={() => {}} />
);

// Same footprint as the page's drawer column.
const Column = ({ children }: { children: ReactNode }) => <div className="h-[40rem] w-80">{children}</div>;

export const Recipes = () => (
  <Column>
    <PlanDrawer className="h-full" recipes={<List />} />
  </Column>
);

const baskets = [{ id: "own", name: "Boodschappen", shared: false }];

// The footer stays put while the list scrolls.
export const RecipesWithWeekToBasket = () => (
  <Column>
    <PlanDrawer
      className="h-full"
      recipes={
        <PlanRecipeList
          recipes={recipes}
          categories={categories}
          today="2026-01-01"
          onPlan={noPlan}
          onPlanned={() => {}}
          weekToBasket={{ onSend: noPlan, baskets }}
        />
      }
    />
  </Column>
);

export const CardsTabEmpty = () => (
  <Column>
    <PlanDrawer className="h-full" recipes={<List />} cards={<Cards groups={[]} />} defaultTab="cards" />
  </Column>
);

export const CardsTab = () => (
  <Column>
    <PlanDrawer className="h-full" recipes={<List />} cards={<Cards />} defaultTab="cards" />
  </Column>
);

export const NoRecipes = () => (
  <Column>
    <PlanDrawer
      className="h-full"
      recipes={<PlanRecipeList recipes={[]} categories={[]} today="2026-01-01" onPlan={noPlan} onPlanned={() => {}} />}
    />
  </Column>
);

const planLabel = nl.components.planDrawer.planRecipeLabel.replace("{name}", "Lasagne met spinazie");

// Clicks the first recipe's plan button once on mount to show the day and moment choices.
export const PlanMenuOpen = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[role="button"][aria-label="${planLabel}"]`)?.click();
  }, []);
  return (
    <div ref={ref} className="h-[40rem] w-80">
      <PlanDrawer className="h-full" recipes={<List />} />
    </div>
  );
};

const planCardLabel = nl.components.planDrawer.planCardLabel.replace("{name}", "Tuinmeubels schoonmaken");

// Clicks the first card's plan button once on mount: day choices without a moment.
export const CardsPlanMenuOpen = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[role="button"][aria-label="${planCardLabel}"]`)?.click();
  }, []);
  return (
    <div ref={ref} className="h-[40rem] w-80">
      <PlanDrawer className="h-full" recipes={<List />} cards={<Cards />} defaultTab="cards" />
    </div>
  );
};

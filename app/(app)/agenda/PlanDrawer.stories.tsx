import { useEffect, useRef, type ReactNode } from "react";
import { PlanDrawer } from "@/components/organisms/PlanDrawer";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import nl from "@/messages/nl.json";
import { PlanRecipeList } from "./PlanRecipeList";

const recipe = (id: string, title: string, categoryId: string, timeMinutes: number | null): PlanRecipe => ({
  id,
  title,
  servings: 4,
  categoryId,
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

const categories = [
  { id: "breakfast", name: "Ontbijt" },
  { id: "lunch", name: "Lunch" },
  { id: "main", name: "Hoofdgerecht" },
  { id: "dessert", name: "Toetje" },
];

const noPlan = async () => ({ success: true as const, data: undefined });

const List = () => (
  <PlanRecipeList recipes={recipes} categories={categories} today="2026-01-01" onPlan={noPlan} onPlanned={() => {}} />
);

// Same footprint as the page's drawer column.
const Column = ({ children }: { children: ReactNode }) => <div className="h-[40rem] w-80">{children}</div>;

export const Recipes = () => (
  <Column>
    <PlanDrawer className="h-full" recipes={<List />} />
  </Column>
);

export const CardsTabEmpty = () => (
  <Column>
    <PlanDrawer className="h-full" recipes={<List />} defaultTab="cards" />
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
    ref.current?.querySelector<HTMLButtonElement>(`button[aria-label="${planLabel}"]`)?.click();
  }, []);
  return (
    <div ref={ref} className="h-[40rem] w-80">
      <PlanDrawer className="h-full" recipes={<List />} />
    </div>
  );
};

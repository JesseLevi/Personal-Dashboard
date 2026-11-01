// The recipes the plan drawer offers, and how its search and category filter narrow them.

export interface PlanRecipe {
  id: string;
  title: string;
  /** Servings stored on the recipe. */
  servings: number;
  categoryId: string;
  /** Name of that category; the moment a plan starts on follows it. */
  categoryName: string;
  timeMinutes: number | null;
  /** Presigned card thumbnail, if the recipe has a photo. */
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

/** Recipes whose title contains `query` (case and accents ignored) and that are in `categoryId` (empty: any). Order is kept. */
export function filterPlanRecipes(
  recipes: readonly PlanRecipe[],
  filter: { query: string; categoryId: string },
): PlanRecipe[] {
  const needle = fold(filter.query.trim());
  return recipes.filter(
    (recipe) =>
      (filter.categoryId === "" || recipe.categoryId === filter.categoryId) &&
      (needle === "" || fold(recipe.title).includes(needle)),
  );
}

/** Pulls `ids` (in that order) out of `recipes`: the highlighted group first, the rest keeps its order. */
export function splitHighlighted(
  recipes: readonly PlanRecipe[],
  ids: readonly string[],
): { highlighted: PlanRecipe[]; visible: PlanRecipe[] } {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const highlighted = ids.flatMap((id) => byId.get(id) ?? []);
  const taken = new Set(highlighted.map((recipe) => recipe.id));
  return { highlighted, visible: recipes.filter((recipe) => !taken.has(recipe.id)) };
}

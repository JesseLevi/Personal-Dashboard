// The recipes the plan drawer offers, and how its search and category filter narrow them.

export interface PlanRecipe {
  id: string;
  title: string;
  /** Servings stored on the recipe. */
  servings: number;
  categoryId: string;
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

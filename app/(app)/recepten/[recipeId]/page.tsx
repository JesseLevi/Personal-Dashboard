import { notFound } from "next/navigation";
import {
  getRecipeCategoriesWithRecipes,
  getRecipeWithIngredientsAndSteps,
} from "@/lib/recipes/queries";
import { RecipeDetailPage } from "./RecipeDetailPage";

// #127: recipe detail route — Figma "Recept/Mobile" (3778:5427) / "Recept/
// Desktop" (3778:5584). Server Component: fetches the one recipe (#122,
// already RLS-scoped + explicitly user-filtered) and the caller's full
// category list (needed by the "Bewerken" RecipePanel this page reuses, same
// shape ReceptenBoard.tsx already passes it). `notFound()` — this route
// group's first real use of it — covers both "recipe doesn't exist" and "not
// this user's recipe": getRecipeWithIngredientsAndSteps's own doc comment
// already returns `null` for both. Full reasoning: design/notes/
// RecipeDetailPage.md.
export default async function RecipeDetailRoute({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  const [recipe, categories] = await Promise.all([
    getRecipeWithIngredientsAndSteps(recipeId),
    getRecipeCategoriesWithRecipes(),
  ]);

  if (!recipe) notFound();

  // Keyed on recipe.id so navigating straight from one recipe's detail page
  // to another's (no ticketed UI does this today) fully remounts rather than
  // reusing local state (portions, delete-confirm) from the previous recipe.
  return <RecipeDetailPage key={recipe.id} recipe={recipe} categories={categories} />;
}

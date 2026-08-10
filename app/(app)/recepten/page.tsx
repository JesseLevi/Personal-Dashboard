import { getTranslations } from "next-intl/server";
import { getRecipeCategoriesWithRecipes } from "@/lib/recipes/queries";
import { ReceptenBoard } from "./ReceptenBoard";

// #124: real categorie-kanban, replacing the #28 stub. `BoardView`'s
// `renderItem` can't cross the Server->Client boundary, so this stays a thin
// Server Component that fetches `CategoryWithRecipes[]` (lib/recipes/
// queries.ts, #122) and hands it to `ReceptenBoard.tsx` ("use client") — same
// split as app/(app)/te-doen/page.tsx -> TeDoenBoard.tsx. `PageHeader` itself
// now renders inside `ReceptenBoard.tsx` (#125), not here — its "Categorie"
// trigger opens `CategoryPanel`, which shares client state with the board's
// own per-column pencil buttons, so both need one client owner. See
// design/notes/ReceptenBoard.md for why this deviates from Te-Doen's
// Header/Board split.
//
// #171: thumbnails are no longer resolved here. Each card now points at
// `/api/recipe-thumbnail/<recipeId>` (app/api/recipe-thumbnail/[recipeId]/
// route.ts) directly, so the browser caches the bytes under a stable URL
// instead of this page re-minting a signed URL — and re-paying egress for
// the same pixels — on every render. See design/notes/CardContentRecipe.md.
export default async function ReceptenPage() {
  const t = await getTranslations();
  const categories = await getRecipeCategoriesWithRecipes();

  return (
    <ReceptenBoard
      categories={categories}
      title={t("nav.recipes")}
      addCategoryLabel={t("components.pageHeader.recipes.addCategoryLabel")}
    />
  );
}

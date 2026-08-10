import { getTranslations } from "next-intl/server";
import { getRecipeCategoriesWithRecipes } from "@/lib/recipes/queries";
import { getRecipeThumbnailSignedUrls } from "@/lib/recipes/thumbnails";
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
// #149: thumbnails resolved here, not client-side — the bucket is private
// (Architecture.md §7), so every read needs the signed-URL round trip
// `getRecipeThumbnailSignedUrls` already does server-side. A longer
// `expiresInSeconds` (1 hour, vs. that function's own 60s default) is
// passed deliberately: a URL minted for this page render should outlive a
// normal browsing session on the board, not expire mid-scroll — the
// default 60s is right for the upload-preview use case that function's own
// doc comment describes, not a page of already-saved cards.
// #171: the board renders the "card" variant (288x288, matches the h-24
// w-24 slot at 3x DPR) and uses the plural helper — one signed-URL round
// trip for the whole board instead of one per recipe.
export default async function ReceptenPage() {
  const t = await getTranslations();
  const categories = await getRecipeCategoriesWithRecipes();

  const stems = categories
    .flatMap((category) => category.recipes)
    .map((recipe) => recipe.thumbnail_path)
    .filter((path): path is string => path !== null);
  const stemToUrl = await getRecipeThumbnailSignedUrls(stems, "card", 3600);
  const thumbnailUrls = Object.fromEntries(
    categories
      .flatMap((category) => category.recipes)
      .filter((recipe) => recipe.thumbnail_path !== null && stemToUrl[recipe.thumbnail_path!])
      .map((recipe) => [recipe.id, stemToUrl[recipe.thumbnail_path!]] as const),
  );

  return (
    <ReceptenBoard
      categories={categories}
      thumbnailUrls={thumbnailUrls}
      title={t("nav.recipes")}
      addCategoryLabel={t("components.pageHeader.recipes.addCategoryLabel")}
    />
  );
}

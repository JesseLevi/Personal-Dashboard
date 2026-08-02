import { getTranslations } from "next-intl/server";
import { getRecipeCategoriesWithRecipes } from "@/lib/recipes/queries";
import { getRecipeThumbnailSignedUrl } from "@/lib/recipes/thumbnails";
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
// `getRecipeThumbnailSignedUrl` already does server-side. A longer
// `expiresInSeconds` (1 hour, vs. that function's own 60s default) is
// passed deliberately: a URL minted for this page render should outlive a
// normal browsing session on the board, not expire mid-scroll — the
// default 60s is right for the upload-preview use case that function's own
// doc comment describes, not a page of already-saved cards.
export default async function ReceptenPage() {
  const t = await getTranslations();
  const categories = await getRecipeCategoriesWithRecipes();

  const thumbnailEntries = await Promise.all(
    categories
      .flatMap((category) => category.recipes)
      .filter((recipe) => recipe.thumbnail_path !== null)
      .map(async (recipe) => {
        const url = await getRecipeThumbnailSignedUrl(recipe.thumbnail_path!, 3600);
        return [recipe.id, url] as const;
      }),
  );
  const thumbnailUrls = Object.fromEntries(
    thumbnailEntries.filter((entry): entry is [string, string] => entry[1] !== null),
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

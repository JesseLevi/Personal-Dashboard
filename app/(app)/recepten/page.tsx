import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getRecipeCategoriesWithRecipes, getRecipeCategoryRecipeCounts } from "@/lib/recipes/queries";
import { getAuthenticatedUserId, isAdmin } from "@/lib/recipes/session";
import { sweepStuckImports } from "@/lib/recipes/import/sweep";
import { presignRecipeThumbnails } from "@/lib/recipes/thumbnails";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReceptenBoard } from "./ReceptenBoard";
import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

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
// #391: card thumbnails are presigned here (local crypto, hour-stable URLs),
// with the `/api/recipe-thumbnail` route as onError fallback. See
// design/notes/CardContentRecipe.md.
//
// #170: the fetch + ReceptenBoard render moved into `ReceptenPageContent`
// so the default export itself never awaits anything — `<Suspense>` here is
// what actually lets AppShellNav's sidebar/header paint before
// `getRecipeCategoriesWithRecipes()` resolves, same story as
// app/(app)/te-doen/page.tsx's <TeDoenPageBody> wrap.
async function ReceptenPageContent() {
  const t = await getTranslations();
  // #318 / ADR-0019 §1: stuck `importing` rows (> 5 min) become failed/timeout
  // before the board reads them, so they show as a failed card, not a skeleton.
  const userId = await getAuthenticatedUserId();
  if (userId) await sweepStuckImports(await createSupabaseServerClient(), userId);
  const [categories, admin] = await Promise.all([getRecipeCategoriesWithRecipes(), isAdmin()]);

  const thumbnailUrls = await presignRecipeThumbnails(
    userId,
    categories.flatMap((c) => c.recipes),
    "card",
  );

  return (
    <ReceptenBoard
      categories={categories}
      thumbnailUrls={thumbnailUrls}
      title={t("nav.recipes")}
      addCategoryLabel={t("components.pageHeader.recipes.addCategoryLabel")}
      ingredientsLabel={admin ? t("components.pageHeader.recipes.ingredientsLabel") : undefined}
    />
  );
}

// Loading stage 2: header-only skeleton (outer fallback) until the per-category
// recipe counts are in, then the exact-shaped skeleton while the full fetch runs.
// See design/notes/Skeletons.md.
async function ReceptenPageStream() {
  const counts = await getRecipeCategoryRecipeCounts();
  return (
    <Suspense fallback={<BoardSkeleton variant="recipes" counts={counts} />}>
      <ReceptenPageContent />
    </Suspense>
  );
}

// #223 follow-up: links this route's own Web App Manifest, same mechanism
// as app/(app)/te-doen/page.tsx — see that file's comment and
// design/notes/AppShell.md.
export const metadata: Metadata = {
  manifest: "/recepten/manifest.webmanifest",
};

// #318: `after()` in startRecipeImport shares the invoking route's max
// duration, and a Server Action takes it from the page that calls it. The
// pipeline is bounded well inside this (fetch 10 s, one LLM call, no retries).
export const maxDuration = 60;

export default function ReceptenPage() {
  return (
    <Suspense fallback={<BoardSkeleton variant="recipes" />}>
      <ReceptenPageStream />
    </Suspense>
  );
}

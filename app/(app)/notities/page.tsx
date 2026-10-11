import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { loadNotitiesColumnCounts, loadNotitiesPageData } from "./notes-data";
import { NotitiesBoard } from "./NotitiesBoard";
import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

// #230/#231: categorie-kanban + zoeken uit de database, exact zoals
// /recepten (#124) en /te-doen (#93) dat opzetten. `BoardView`'s
// `renderItem` kan de Server->Client-grens niet over, dus blijft dit een
// dunne Server Component die alleen data ophaalt (`NotitiesPageData`,
// notes-data.ts) en aan `NotitiesBoard.tsx` ("use client") doorgeeft.
// `?sort=`/`?q=` worden hier gelezen (zelfde patroon als app/(app)/te-doen/
// page.tsx) omdat het los staat van de trage databasefetch hieronder --
// alleen die laatste zit in <Suspense>. Eigen Web App Manifest (#390): zie
// app/(app)/winkelmand/page.tsx en design/notes/AppShell.md.
export const metadata: Metadata = {
  manifest: "/notities/manifest.webmanifest",
};

async function NotitiesPageContent({
  sortParam,
  queryParam,
}: {
  sortParam?: string;
  queryParam?: string;
}) {
  const t = await getTranslations();
  const data = await loadNotitiesPageData(sortParam, queryParam);

  return (
    <NotitiesBoard
      data={data}
      title={t("nav.notes")}
      addCategoryLabel={t("components.pageHeader.notes.addCategoryLabel")}
      sortLabel={t("components.pageHeader.notes.sortLabel")}
      searchPlaceholder={t("components.pageHeader.notes.searchPlaceholder")}
      searchClearLabel={t("components.pageHeader.notes.searchClearLabel")}
      noResultsLabel={t("notes.search.noResults")}
    />
  );
}

// Loading stage 2: header-only skeleton (outer fallback) until the per-category
// note counts are in; search mode has no columns and keeps header-only.
// See design/notes/Skeletons.md.
async function NotitiesPageStream({
  sortParam,
  queryParam,
}: {
  sortParam?: string;
  queryParam?: string;
}) {
  const counts = await loadNotitiesColumnCounts(queryParam);
  return (
    <Suspense fallback={<BoardSkeleton variant="notes" counts={counts} />}>
      <NotitiesPageContent sortParam={sortParam} queryParam={queryParam} />
    </Suspense>
  );
}

export default async function NotitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort, q } = await searchParams;
  return (
    <Suspense fallback={<BoardSkeleton variant="notes" />}>
      <NotitiesPageStream sortParam={sort} queryParam={q} />
    </Suspense>
  );
}

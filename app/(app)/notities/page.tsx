import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { loadNotitiesPageData } from "./notes-data";
import { NotitiesBoard } from "./NotitiesBoard";
import { BoardSkeleton } from "../_components/PageSkeleton";

// #230/#231: categorie-kanban + zoeken uit de database, exact zoals
// /recepten (#124) en /te-doen (#93) dat opzetten. `BoardView`'s
// `renderItem` kan de Server->Client-grens niet over, dus blijft dit een
// dunne Server Component die alleen data ophaalt (`NotitiesPageData`,
// notes-data.ts) en aan `NotitiesBoard.tsx` ("use client") doorgeeft.
// `?sort=`/`?q=` worden hier gelezen (zelfde patroon als app/(app)/te-doen/
// page.tsx) omdat het los staat van de trage databasefetch hieronder --
// alleen die laatste zit in <Suspense>. Geen `metadata.manifest` hier:
// #223's vervolg bouwde alleen Te-Doen/Recepten/Winkelmand een eigen Web App
// Manifest; Notities heeft nog geen route.ts daarvoor (wel al een
// favicon/apple-icon, #245) en dat toevoegen staat niet in dit ticket.
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

export default async function NotitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort, q } = await searchParams;
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <NotitiesPageContent sortParam={sort} queryParam={q} />
    </Suspense>
  );
}

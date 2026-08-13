import "server-only";
import { getNoteCategoriesWithNotes, searchNotes } from "@/lib/notes/queries";
import { isNoteSortOption, sortNotesForView, type NoteSortOption } from "@/lib/notes/sort";
import { effectiveNotesSearchQuery } from "@/lib/notes/search";
import type { CategoryWithNotes, NoteSummaryRow } from "@/lib/notes/types";

// #230/#231: resolves a `/notities` request's data -- same shape as
// app/(app)/te-doen/board-data.ts, scoped down since Notities has no
// board-switcher equivalent (a signed-in user has exactly one note overview,
// not several boards to pick between). An invalid/typo'd `?sort=` is treated
// as "no sort" (manual/position order) rather than a 400 -- same "never
// crash on a bad query string" posture as loadTeDoenPageData's own boardId
// guard.
//
// #231 extends this single loader (chosen over a second file, per the
// ticket's own explicit either/or) rather than adding a parallel
// `loadNotitiesSearchData`: `?q=` and `?sort=` both live on the exact same
// route/page.tsx call site, and the two branches already share the "resolve
// a searchParam, decide what to fetch" shape this function already had --
// splitting it would just move the branch into page.tsx instead of removing
// it. `?q=` wins outright when it clears `effectiveNotesSearchQuery`'s
// threshold (lib/notes/search.ts, shared with NotitiesBoard.tsx so the two
// sides can't disagree on where it is): search results are a flat,
// recency-ordered list (searchNotes' own ordering, lib/notes/queries.ts) with
// no category grouping, so `sort` has nothing to apply to and is not read at
// all in that branch -- not silently ignored, structurally absent from the
// returned shape.
export type NotitiesPageData =
  | { mode: "board"; categories: CategoryWithNotes[]; sort: NoteSortOption | null }
  | { mode: "search"; query: string; results: NoteSummaryRow[] };

export async function loadNotitiesPageData(
  sortParam: string | undefined,
  queryParam: string | undefined,
): Promise<NotitiesPageData> {
  const query = effectiveNotesSearchQuery(queryParam ?? "");
  if (query !== "") {
    const results = await searchNotes(query);
    return { mode: "search", query, results };
  }

  const sort = sortParam && isNoteSortOption(sortParam) ? sortParam : null;
  const categories = await getNoteCategoriesWithNotes();

  if (sort === null) return { mode: "board", categories, sort };

  // Sorting is a VIEW choice (lib/notes/sort.ts) -- reorders each category's
  // already-fetched `notes` array in memory, never rewrites `position`. Same
  // split as board-data.ts's own sort application.
  return {
    mode: "board",
    categories: categories.map((category) => ({
      ...category,
      notes: sortNotesForView(category.notes, sort),
    })),
    sort,
  };
}

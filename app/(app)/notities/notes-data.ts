import "server-only";
import { getNoteCategoriesWithNotes } from "@/lib/notes/queries";
import { isNoteSortOption, sortNotesForView, type NoteSortOption } from "@/lib/notes/sort";
import type { CategoryWithNotes } from "@/lib/notes/types";

// #230: resolves a `/notities` request's data -- same shape as
// app/(app)/te-doen/board-data.ts, scoped down since Notities has no
// board-switcher equivalent (a signed-in user has exactly one note overview,
// not several boards to pick between). An invalid/typo'd `?sort=` is treated
// as "no sort" (manual/position order) rather than a 400 -- same "never
// crash on a bad query string" posture as loadTeDoenPageData's own boardId
// guard.

export interface NotitiesPageData {
  categories: CategoryWithNotes[];
  sort: NoteSortOption | null;
}

export async function loadNotitiesPageData(sortParam: string | undefined): Promise<NotitiesPageData> {
  const sort = sortParam && isNoteSortOption(sortParam) ? sortParam : null;
  const categories = await getNoteCategoriesWithNotes();

  if (sort === null) return { categories, sort };

  // Sorting is a VIEW choice (lib/notes/sort.ts) -- reorders each category's
  // already-fetched `notes` array in memory, never rewrites `position`. Same
  // split as board-data.ts's own sort application.
  return {
    categories: categories.map((category) => ({
      ...category,
      notes: sortNotesForView(category.notes, sort),
    })),
    sort,
  };
}

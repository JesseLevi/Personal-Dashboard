import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { Suspense } from "react";
import { getSyncNotices } from "@/lib/agenda/notices";
import { getAgendaItems } from "@/lib/agenda/queries";
import { syncStaleAccounts } from "@/lib/agenda/sync";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import { AGENDA_TIME_ZONE, loadWindow, todayInAgendaZone, wallClockToUtc } from "@/lib/agenda/time";
import { AGENDA_VIEW_COOKIE, DEFAULT_AGENDA_VIEW, isAgendaView } from "@/lib/agenda/view";
import { getRecipeCategoriesWithRecipes } from "@/lib/recipes/queries";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { presignRecipeThumbnails } from "@/lib/recipes/thumbnails";
import { getRecipeBaskets } from "@/lib/shopping/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AgendaPage } from "./AgendaPage";
import { AgendaPageSkeleton } from "./AgendaPageSkeleton";

// Page-level manifest: a separate home-screen install (see design/notes/AppShell.md).
export const metadata: Metadata = {
  manifest: "/agenda/manifest.webmanifest",
};

async function AgendaPageBody() {
  const stored = (await cookies()).get(AGENDA_VIEW_COOKIE)?.value;
  const view = isAgendaView(stored) ? stored : DEFAULT_AGENDA_VIEW;
  const today = todayInAgendaZone();
  const window = loadWindow(today);
  const supabase = await createSupabaseServerClient();
  // ADR-0039: stale feeds sync after the response, with the user's own client; the page shows what is stored.
  after(() => syncStaleAccounts(supabase).catch(() => console.error("[agenda] lazy sync failed")));
  const [items, notices, categories, baskets, userId] = await Promise.all([
    getAgendaItems({
      from: wallClockToUtc(`${window.from}T00:00:00`),
      to: wallClockToUtc(`${window.to}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    }),
    getSyncNotices(),
    getRecipeCategoriesWithRecipes(),
    getRecipeBaskets(),
    getAuthenticatedUserId(),
  ]);

  // Imports still running or failed cannot be planned.
  const ready = categories.flatMap((category) => category.recipes.filter((recipe) => recipe.import_status === "done"));
  const thumbnails = await presignRecipeThumbnails(userId, ready, "card");
  const recipes: PlanRecipe[] = ready.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    servings: recipe.servings,
    categoryId: recipe.category_id,
    timeMinutes: recipe.time_minutes,
    thumbnailUrl: thumbnails[recipe.id] ?? null,
    thumbnailPath: recipe.thumbnail_path,
  }));

  return (
    <AgendaPage
      initialView={view}
      today={today}
      initialItems={items}
      initialNotices={notices}
      recipes={recipes}
      recipeCategories={categories.map(({ id, name }) => ({ id, name }))}
      baskets={baskets}
    />
  );
}

export default function AgendaRoute() {
  return (
    <Suspense fallback={<AgendaPageSkeleton />}>
      <AgendaPageBody />
    </Suspense>
  );
}

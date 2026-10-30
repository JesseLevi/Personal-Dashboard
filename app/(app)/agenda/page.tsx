import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { Suspense } from "react";
import { settleCookedMeals } from "@/lib/activity/settle";
import { parseDateParam } from "@/lib/agenda/date-param";
import { getCalendarOverview } from "@/lib/agenda/calendar-list";
import { AGENDA_HIDDEN_COOKIE, parseHidden } from "@/lib/agenda/hidden";
import { getSyncNotices } from "@/lib/agenda/notices";
import { getAgendaItems, getPlannableCards, getQuickAddBoard } from "@/lib/agenda/queries";
import { extendEventSeries } from "@/lib/agenda/series";
import { syncStaleAccounts } from "@/lib/agenda/sync";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import { AGENDA_TIME_ZONE, loadWindow, todayInAgendaZone, wallClockToUtc } from "@/lib/agenda/time";
import { AGENDA_TRAY_COOKIE, DEFAULT_AGENDA_TRAY, isAgendaTray } from "@/lib/agenda/tray";
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

async function AgendaPageBody({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const jar = await cookies();
  const stored = jar.get(AGENDA_VIEW_COOKIE)?.value;
  const view = isAgendaView(stored) ? stored : DEFAULT_AGENDA_VIEW;
  const storedTray = jar.get(AGENDA_TRAY_COOKIE)?.value;
  const trayOpen = (isAgendaTray(storedTray) ? storedTray : DEFAULT_AGENDA_TRAY) === "open";
  const hidden = parseHidden(jar.get(AGENDA_HIDDEN_COOKIE)?.value);
  const today = todayInAgendaZone();
  // `?date=` opens the Agenda on that day; anything invalid falls back to today.
  const initialDate = parseDateParam((await searchParams).date) ?? today;
  const window = loadWindow(initialDate);
  const supabase = await createSupabaseServerClient();
  // ADR-0039: stale feeds sync after the response, with the user's own client; the page shows what is stored.
  after(() => syncStaleAccounts(supabase).catch(() => console.error("[agenda] lazy sync failed")));
  // ADR-0042: recurring own events that fall short of 400 days ahead are topped up the same way.
  after(() => extendEventSeries(supabase).catch(() => console.error("[agenda] series extension failed")));
  // ADR-0044: meals whose day has passed become history, after the response.
  after(() => settleCookedMeals(supabase));
  const [items, notices, categories, baskets, userId, cardGroups, calendars, todoBoard] = await Promise.all([
    getAgendaItems({
      from: wallClockToUtc(`${window.from}T00:00:00`),
      to: wallClockToUtc(`${window.to}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    }),
    getSyncNotices(),
    getRecipeCategoriesWithRecipes(),
    getRecipeBaskets(),
    getAuthenticatedUserId(),
    getPlannableCards(),
    getCalendarOverview(supabase),
    // A failed read only hides the "new card" target; the rest of the page still works.
    getQuickAddBoard().catch(() => null),
  ]);

  // Imports still running or failed cannot be planned.
  const ready = categories.flatMap((category) => category.recipes.filter((recipe) => recipe.import_status === "done"));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const thumbnails = await presignRecipeThumbnails(userId, ready, "card");
  const recipes: PlanRecipe[] = ready.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    servings: recipe.servings,
    categoryId: recipe.category_id,
    categoryName: categoryNames.get(recipe.category_id) ?? "",
    timeMinutes: recipe.time_minutes,
    thumbnailUrl: thumbnails[recipe.id] ?? null,
    thumbnailPath: recipe.thumbnail_path,
  }));

  return (
    <AgendaPage
      initialView={view}
      initialTrayOpen={trayOpen}
      today={today}
      initialDate={initialDate}
      initialItems={items}
      initialNotices={notices}
      initialHidden={hidden}
      initialCalendars={calendars}
      recipes={recipes}
      recipeCategories={categories.map(({ id, name }) => ({ id, name }))}
      cardGroups={cardGroups}
      todoBoard={todoBoard}
      baskets={baskets}
    />
  );
}

export default function AgendaRoute({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  return (
    <Suspense fallback={<AgendaPageSkeleton />}>
      <AgendaPageBody searchParams={searchParams} />
    </Suspense>
  );
}

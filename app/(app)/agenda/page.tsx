import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { Suspense } from "react";
import { getSyncNotices } from "@/lib/agenda/notices";
import { getAgendaItems } from "@/lib/agenda/queries";
import { syncStaleAccounts } from "@/lib/agenda/sync";
import { AGENDA_TIME_ZONE, loadWindow, todayInAgendaZone, wallClockToUtc } from "@/lib/agenda/time";
import { AGENDA_VIEW_COOKIE, DEFAULT_AGENDA_VIEW, isAgendaView } from "@/lib/agenda/view";
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
  const [items, notices] = await Promise.all([
    getAgendaItems({
      from: wallClockToUtc(`${window.from}T00:00:00`),
      to: wallClockToUtc(`${window.to}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    }),
    getSyncNotices(),
  ]);
  return <AgendaPage initialView={view} today={today} initialItems={items} initialNotices={notices} />;
}

export default function AgendaRoute() {
  return (
    <Suspense fallback={<AgendaPageSkeleton />}>
      <AgendaPageBody />
    </Suspense>
  );
}

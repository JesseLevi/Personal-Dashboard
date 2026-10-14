import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getAgendaItems } from "@/lib/agenda/queries";
import { AGENDA_TIME_ZONE, loadWindow, todayInAgendaZone, wallClockToUtc } from "@/lib/agenda/time";
import { AGENDA_VIEW_COOKIE, DEFAULT_AGENDA_VIEW, isAgendaView } from "@/lib/agenda/view";
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
  const items = await getAgendaItems({
    from: wallClockToUtc(`${window.from}T00:00:00`),
    to: wallClockToUtc(`${window.to}T00:00:00`),
    timeZone: AGENDA_TIME_ZONE,
  });
  return <AgendaPage initialView={view} today={today} initialItems={items} />;
}

export default function AgendaRoute() {
  return (
    <Suspense fallback={<AgendaPageSkeleton />}>
      <AgendaPageBody />
    </Suspense>
  );
}

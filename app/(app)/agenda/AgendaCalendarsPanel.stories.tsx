import { useEffect, useRef } from "react";
import type { CalendarAccountView, CalendarActionResult } from "@/lib/agenda/calendars";
import nl from "@/messages/nl.json";
import { AgendaCalendarsPanel } from "./AgendaCalendarsPanel";

// The visual suite freezes the clock at 2026-01-01T14:00 local time.
const accounts: CalendarAccountView[] = [
  { id: "a1", name: "Werk (Outlook)", status: "ok", lastSyncedAt: "2026-01-01T13:55:00", errorCode: null },
  { id: "a2", name: "Gezin (Google)", status: "failed", lastSyncedAt: "2025-12-31T09:00:00", errorCode: "fetch_http_error" },
  { id: "a3", name: "Verjaardagen (iCloud)", status: "never", lastSyncedAt: null, errorCode: null },
];

// Dev-only mock actions: the panel never imports the real "use server" module.
const listed = (data: CalendarAccountView[]) => async (): Promise<CalendarActionResult<CalendarAccountView[]>> => ({
  success: true,
  data,
});
async function mockAdd(): Promise<CalendarActionResult<{ id: string }>> {
  return { success: true, data: { id: "new" } };
}
async function mockRemove(): Promise<CalendarActionResult> {
  return { success: true, data: undefined };
}

const common = { open: true, onClose: () => {}, onAdd: mockAdd, onRemove: mockRemove };
const withAccounts = listed(accounts);
const none = listed([]);

// The panel is `position: fixed`; the min-h wrapper gives the screenshot root a height (SidePanel.stories.tsx).
export const WithCalendars = () => (
  <div className="min-h-screen">
    <AgendaCalendarsPanel {...common} initialAccounts={accounts} onList={withAccounts} />
  </div>
);

export const Empty = () => (
  <div className="min-h-screen">
    <AgendaCalendarsPanel {...common} initialAccounts={[]} onList={none} />
  </div>
);

const deleteLabel = nl.components.agendaCalendarsPanel.deleteLabel.replace("{name}", accounts[0].name);

// Clicks the first delete button once on mount to show the confirm footer.
export const DeleteConfirm = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = Array.from(ref.current?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.getAttribute("aria-label") === deleteLabel,
    );
    button?.click();
  }, []);
  return (
    <div ref={ref} className="min-h-screen">
      <AgendaCalendarsPanel {...common} initialAccounts={accounts} onList={withAccounts} />
    </div>
  );
};

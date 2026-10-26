import { useEffect, useRef, useState } from "react";
import type { CalendarActionResult, CalendarOverview } from "@/lib/agenda/calendars";
import { NOTHING_HIDDEN, type AgendaHidden } from "@/lib/agenda/hidden";
import nl from "@/messages/nl.json";
import { AgendaCalendarsPanel, type AgendaCalendarsPanelProps } from "./AgendaCalendarsPanel";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda calendars panel" } satisfies StoryDefault;

const strings = nl.components.agendaCalendarsPanel;

// The visual suite freezes the clock at 2026-01-01T14:00 local time.
const overview: CalendarOverview = {
  categories: [
    { id: "c-default", name: null, color: "blue", isDefault: true },
    { id: "c-social", name: "Sociaal", color: "pink", isDefault: false },
    { id: "c-sport", name: "Sport", color: "orange", isDefault: false },
  ],
  accounts: [
    { id: "a1", calendarId: "c-work", color: "violet", name: "Werk (Outlook)", status: "ok", lastSyncedAt: "2026-01-01T13:55:00", errorCode: null },
    { id: "a2", calendarId: "c-family", color: "teal", name: "Gezin (Google)", status: "failed", lastSyncedAt: "2025-12-31T09:00:00", errorCode: "fetch_http_error" },
    { id: "a3", calendarId: "c-birthdays", color: "stone", name: "Verjaardagen (iCloud)", status: "never", lastSyncedAt: null, errorCode: null },
  ],
};

// Dev-only mock actions: the panel never imports the real "use server" module.
const listed = (data: CalendarOverview) => async (): Promise<CalendarActionResult<CalendarOverview>> => ({ success: true, data });
async function mockCreate(): Promise<CalendarActionResult<{ id: string }>> {
  return { success: true, data: { id: "new" } };
}
async function mockDone(): Promise<CalendarActionResult> {
  return { success: true, data: undefined };
}

type Props = Partial<AgendaCalendarsPanelProps>;

// The panel is `position: fixed`; the min-h wrapper gives the screenshot root a height (SidePanel.stories.tsx).
const Panel = ({ data = overview, startHidden = NOTHING_HIDDEN, ...rest }: Props & { data?: CalendarOverview; startHidden?: AgendaHidden }) => {
  const [hidden, setHidden] = useState(startHidden);
  return (
    <AgendaCalendarsPanel
      open
      onClose={() => {}}
      initialOverview={data}
      hidden={hidden}
      onHiddenChange={setHidden}
      onList={listed(data)}
      onAdd={mockCreate}
      onRemove={mockDone}
      onCreate={mockCreate}
      onUpdate={mockDone}
      onDelete={mockDone}
      {...rest}
    />
  );
};

// Clicks the buttons found by `steps`, one per frame, so each click sees the result of the one before.
function ClickThrough({ steps, children }: { steps: Array<(root: HTMLElement) => HTMLElement | undefined>; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const find of steps) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (cancelled || !ref.current) return;
        find(document.body)?.click();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [steps]);
  return (
    <div ref={ref} className="min-h-screen">
      {children}
    </div>
  );
}

const byText = (text: string) => (root: HTMLElement) =>
  Array.from(root.querySelectorAll("button")).find((button) => button.textContent?.trim() === text);

const openSport = [byText("Sport")];
const openWork = [byText("Werk (Outlook)")];
const askDelete = [byText("Sport"), byText(strings.deleteCategoryLabel)];

export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel for categories and synced calendars: colours, visibility per calendar and kind, add, edit and remove."
      note="AgendaCalendarsPanel"
    />
    <Panel />
  </div>
);

export const WithCalendars = () => (
  <div className="min-h-screen">
    <Panel />
  </div>
);

export const EditorOpen = () => (
  <ClickThrough steps={openSport}>
    <Panel />
  </ClickThrough>
);

export const LinkedEditorOpen = () => (
  <ClickThrough steps={openWork}>
    <Panel />
  </ClickThrough>
);

export const SomeHidden = () => (
  <div className="min-h-screen">
    <Panel startHidden={{ calendars: ["c-social", "c-family"], kinds: ["deadline"] }} />
  </div>
);

export const Empty = () => (
  <div className="min-h-screen">
    <Panel data={{ categories: overview.categories.slice(0, 1), accounts: [] }} />
  </div>
);

// Clicks Sport and then its Verwijderen once on mount to show the confirm footer.
export const DeleteConfirm = () => (
  <ClickThrough steps={askDelete}>
    <Panel />
  </ClickThrough>
);

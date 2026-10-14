import { useEffect, useRef } from "react";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaEventDetail, AgendaEventItem } from "@/lib/agenda/types";
import nl from "@/messages/nl.json";
import { AgendaEventPanel } from "./AgendaEventPanel";

// Dev-only mock actions: the panel never imports the real "use server" module.
async function mockLoad(input: unknown): Promise<AgendaActionResult<AgendaEventDetail>> {
  const { id } = input as { id: string };
  return {
    success: true,
    data: {
      id,
      title: "",
      location: "Tandartspraktijk Centrum",
      description: "Halfjaarlijkse controle. Pasje meenemen.",
      source: id === "sync-1" ? "sync" : "manual",
      calendarId: "cal-1",
    },
  };
}
async function mockCreate(): Promise<AgendaActionResult<{ id: string }>> {
  return { success: true, data: { id: "new" } };
}
async function mockMutate(): Promise<AgendaActionResult> {
  return { success: true, data: undefined };
}

const event: AgendaEventItem = {
  kind: "event",
  source: "manual",
  calendarId: "cal-1",
  missingSince: null,
  id: "own-1",
  title: "Tandarts",
  start: "2026-01-02T09:00:00",
  end: "2026-01-02T10:00:00",
  allDay: false,
  linkCount: 0,
};

const imported: AgendaEventItem = { ...event, source: "sync", id: "sync-1", title: "Teamoverleg" };

const holiday: AgendaEventItem = { ...event, id: "own-2", title: "Vakantie Marie", start: "2026-01-02", end: "2026-01-06", allDay: true };

const panelProps = {
  open: true,
  onClose: () => {},
  onLoadEvent: mockLoad,
  onCreateEvent: mockCreate,
  onUpdateEvent: mockMutate,
  onDeleteEvent: mockMutate,
};

// The panel is `position: fixed`; the min-h wrapper gives the screenshot root a height (SidePanel.stories.tsx).
export const CreateEvent = () => (
  <div className="min-h-screen">
    <AgendaEventPanel
      {...panelProps}
      target={{ mode: "create", span: { start: "2026-01-02T14:00:00+01:00", end: "2026-01-02T15:00:00+01:00", allDay: false } }}
    />
  </div>
);

export const CreateAllDay = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "create", span: { start: "2026-01-02", end: "2026-01-03", allDay: true } }} />
  </div>
);

export const EditEvent = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: event }} />
  </div>
);

export const EditAllDayEvent = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: holiday }} />
  </div>
);

export const ImportedReadOnly = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: imported }} />
  </div>
);

const deleteLabel = nl.components.agendaPanel.deleteLabel;

// Clicks "Verwijderen" once on mount to show the confirm footer, as CardDetailPanel's story does.
export const EditEventDeleteConfirm = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = Array.from(ref.current?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent?.trim() === deleteLabel,
    );
    button?.click();
  }, []);
  return (
    <div ref={ref} className="min-h-screen">
      <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: event }} />
    </div>
  );
};

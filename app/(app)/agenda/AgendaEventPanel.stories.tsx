import { useEffect, useRef } from "react";
import type { CalendarCategoryView } from "@/lib/agenda/calendars";
import type { AgendaLink, AgendaLinkCandidate } from "@/lib/agenda/links";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaEventDetail, AgendaEventItem } from "@/lib/agenda/types";
import nl from "@/messages/nl.json";
import { AgendaEventPanel } from "./AgendaEventPanel";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda event panel" } satisfies StoryDefault;

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
      calendarName: id === "sync-1" ? "Outlook" : null,
      repeat: id === "rec-1" ? { freq: "weekly", interval: 1, until: "2026-12-31" } : null,
    },
  };
}
async function mockCreate(): Promise<AgendaActionResult<{ id: string }>> {
  return { success: true, data: { id: "new" } };
}
async function mockMutate(): Promise<AgendaActionResult> {
  return { success: true, data: undefined };
}

const links: AgendaLink[] = [
  { id: "l1", kind: "recipe", targetId: "r1", title: "Pompoensoep met gember" },
  { id: "l2", kind: "card", targetId: "c1", title: "Cadeau kopen voor opa" },
  { id: "l3", kind: "note", targetId: "n1", title: "Vragen voor de tandarts" },
];
const mockLoadLinks = async (): Promise<AgendaActionResult<AgendaLink[]>> => ({ success: true, data: links });
const mockLoadNoLinks = async (): Promise<AgendaActionResult<AgendaLink[]>> => ({ success: true, data: [] });
const mockSearchLinks = async (): Promise<AgendaActionResult<AgendaLinkCandidate[]>> => ({ success: true, data: [] });

const event: AgendaEventItem = {
  kind: "event",
  source: "manual",
  calendarId: "cal-1",
  color: "blue",
  missingSince: null,
  id: "own-1",
  title: "Tandarts",
  start: "2026-01-02T09:00:00",
  end: "2026-01-02T10:00:00",
  allDay: false,
  linkCount: 0,
};

const recurring: AgendaEventItem = { ...event, id: "rec-1", title: "Teamlunch", recurring: true };

const imported: AgendaEventItem = { ...event, source: "sync", id: "sync-1", title: "Teamoverleg" };

const holiday: AgendaEventItem = { ...event, id: "own-2", title: "Vakantie Marie", start: "2026-01-02", end: "2026-01-06", allDay: true };

const categories: CalendarCategoryView[] = [
  { id: "cal-1", name: null, color: "blue", isDefault: true },
  { id: "cal-social", name: "Sociaal", color: "pink", isDefault: false },
  { id: "cal-sport", name: "Sport", color: "orange", isDefault: false },
];

const social: AgendaEventItem = { ...event, id: "own-3", title: "Koffie met Youri", calendarId: "cal-social", color: "pink" };

const panelProps = {
  open: true,
  onClose: () => {},
  categories,
  onLoadEvent: mockLoad,
  onCreateEvent: mockCreate,
  onUpdateEvent: mockMutate,
  onDeleteEvent: mockMutate,
  onLoadLinks: mockLoadLinks,
  onSearchLinks: mockSearchLinks,
  onLink: mockCreate,
  onUnlink: mockMutate,
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

export const EditEventOtherCategory = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: social }} />
  </div>
);

export const EditEventNoLinks = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} onLoadLinks={mockLoadNoLinks} target={{ mode: "edit", item: event }} />
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
const saveLabel = nl.components.agendaPanel.saveLabel;

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

// Clicks the enabled button with this label; false while it is missing or still disabled.
function clickButton(root: HTMLElement | null, label: string): boolean {
  const button = Array.from(root?.querySelectorAll("button") ?? []).find((candidate) => candidate.textContent?.trim() === label);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

// Sets a native field the way a user would, so React's onChange runs.
function setField(id: string, value: string) {
  const field = document.getElementById(id) as HTMLSelectElement | HTMLInputElement | null;
  if (!field) return;
  const proto = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Picks "Elke week" ending on a date, as a user would in the create panel.
export const CreateRepeating = () => {
  useEffect(() => {
    void (async () => {
      setField("agenda-event-repeat", "weekly");
      await tick();
      setField("agenda-event-ends", "on");
      await tick();
      setField("agenda-event-until", "2026-06-30");
    })();
  }, []);
  return (
    <div className="min-h-screen">
      <AgendaEventPanel
        {...panelProps}
        target={{ mode: "create", span: { start: "2026-01-02T14:00:00+01:00", end: "2026-01-02T15:00:00+01:00", allDay: false } }}
      />
    </div>
  );
};

export const EditRecurringEvent = () => (
  <div className="min-h-screen">
    <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: recurring }} />
  </div>
);

// Waits for the series to load (Opslaan stays disabled until then), then asks for the scope.
export const EditRecurringScopeSave = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (clickButton(ref.current, saveLabel)) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, []);
  return (
    <div ref={ref} className="min-h-screen">
      <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: recurring }} />
    </div>
  );
};

export const EditRecurringScopeDelete = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    clickButton(ref.current, deleteLabel);
  }, []);
  return (
    <div ref={ref} className="min-h-screen">
      <AgendaEventPanel {...panelProps} target={{ mode: "edit", item: recurring }} />
    </div>
  );
};

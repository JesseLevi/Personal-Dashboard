import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaDeadlineItem, AgendaPlannedCardItem } from "@/lib/agenda/types";
import { AgendaCardPanel } from "./AgendaCardPanel";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda card panel" } satisfies StoryDefault;

async function mockMutate(): Promise<AgendaActionResult> {
  return { success: true, data: undefined };
}

const planned: AgendaPlannedCardItem = {
  kind: "planned_card",
  id: "card-1",
  title: "KPN bellen",
  start: "2026-01-02",
  end: null,
  allDay: true,
  linkCount: 0,
  board: "Mijn bord",
  column: "Backlog",
};

const deadline: AgendaDeadlineItem = {
  kind: "deadline",
  id: "deadline:card-2",
  title: "Belastingaangifte",
  start: "2026-01-02",
  end: null,
  allDay: true,
  linkCount: 0,
};

const panelProps = { open: true, onClose: () => {}, onSaveDay: mockMutate, onRemove: mockMutate, onOpenCard: () => {} };

// The panel is `position: fixed`; the min-h wrapper gives the screenshot root a height (SidePanel.stories.tsx).
export const PlannedCard = () => (
  <div className="min-h-screen">
    <AgendaCardPanel {...panelProps} item={planned} />
  </div>
);

export const Deadline = () => (
  <div className="min-h-screen">
    <AgendaCardPanel {...panelProps} item={deadline} />
  </div>
);

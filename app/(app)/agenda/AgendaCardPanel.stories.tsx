import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaDeadlineItem, AgendaPlannedCardItem } from "@/lib/agenda/types";
import { AgendaCardPanel } from "./AgendaCardPanel";
import { StoryIntro } from "@/.ladle/story-kit";
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

export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel for a card on the agenda: change its day, take it off the agenda or open the card. A deadline is read-only."
      note="AgendaPage"
    />
    <AgendaCardPanel {...panelProps} item={planned} />
  </div>
);

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

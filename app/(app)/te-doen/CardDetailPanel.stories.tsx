// figma: node-id=3779:4846 (+3779:4938 desktop)
import { useEffect, useRef, useState } from "react";
import { CardDetailPanel, type CardDetailPanelColumn } from "./CardDetailPanel";
import type { ActionResult, CardRow, CardWithLabels } from "@/lib/boards/types";
import nl from "@/messages/nl.json";
import { Button } from "@/components/atoms/Button";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Te doen / Card detail panel" } satisfies StoryDefault;

// Dev-only mock actions — CardDetailPanel never imports the real "use server"
// module itself (design/notes/CardDetailPanel.md), so these stand in for
// createCard/updateCard/moveCard/deleteCard without needing Supabase/Next's
// request context, which Ladle's plain Vite runtime doesn't have.
async function mockCreateCard(input: unknown): Promise<ActionResult<CardRow>> {
  console.log("createCard", input);
  return { success: true, data: input as unknown as CardRow };
}
async function mockUpdateCard(input: unknown): Promise<ActionResult> {
  console.log("updateCard", input);
  return { success: true, data: undefined };
}
async function mockMoveCard(input: unknown): Promise<ActionResult<{ position: number }>> {
  console.log("moveCard", input);
  return { success: true, data: { position: 1000 } };
}
async function mockDeleteCard(input: unknown): Promise<ActionResult> {
  console.log("deleteCard", input);
  return { success: true, data: undefined };
}

// Same 4-column shape BoardView.stories.tsx samples (Ideeën/Klaar/Bezig/Afgerond).
const columns: CardDetailPanelColumn[] = [
  { id: "ideeen", name: "Ideeën", icon: "Lightbulb" },
  { id: "klaar", name: "Klaar", icon: "AlarmClockCheck" },
  { id: "bezig", name: "Bezig", icon: "Loader" },
  { id: "afgerond", name: "Afgerond", icon: "CircleCheck" },
];

const sampleCard: CardWithLabels = {
  id: "card-1",
  user_id: "user-1",
  column_id: "ideeen",
  title: "HBO Wachtwoord updaten",
  description: "Nieuw wachtwoord instellen voor het studentenportaal.",
  priority: "medium",
  size: "m",
  due_at: "2026-08-01T00:00:00.000Z",
  planned_for: null,
  position: 1000,
  source: "manual",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  labels: [],
};

// `min-h-screen` wrapper (#106, same precedent as SidePanel.stories.tsx):
// SidePanel's overlay/panel are `position: fixed`, so they contribute 0 to
// their ancestors' flow height — without this, the Provider div (which
// tests/visual/screenshot-override.css crops the baseline to) collapses to
// near-zero and the screenshot misses almost the entire panel. Not needed by
// real app usage (the real page around CardDetailPanel already has its own
// height), only by this harness.

// Most representative state: edit mode with every field filled. The panel is `position: fixed`,
// so the intro sits in the dimmed area beside it.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel to create or edit a ticket: title, description, status, priority, size, deadline and planned day. Delete asks for a second click."
      note="CardDetailPanel"
    />
    <CardDetailPanel
      open
      onClose={() => {}}
      columns={columns}
      target={{ mode: "edit", card: sampleCard }}
      onCreateCard={mockCreateCard}
      onUpdateCard={mockUpdateCard}
      onMoveCard={mockMoveCard}
      onDeleteCard={mockDeleteCard}
    />
  </div>
);

// Create mode: empty fields, prefilled Status = the column whose Plus button
// was clicked. Delete button is absent (nothing to delete yet).
export const CreateItem = () => (
  <div className="min-h-screen">
    <CardDetailPanel
      open
      onClose={() => {}}
      columns={columns}
      target={{ mode: "create", columnId: "ideeen" }}
      onCreateCard={mockCreateCard}
      onUpdateCard={mockUpdateCard}
      onMoveCard={mockMoveCard}
      onDeleteCard={mockDeleteCard}
    />
  </div>
);

// Edit mode: every field prefilled from `sampleCard`. Click "Verwijderen" to
// exercise the two-step confirm — footer swaps to "Weet je het zeker?" +
// Annuleren/Ja, verwijderen, Annuleren returns to the normal footer.
export const EditItem = () => (
  <div className="min-h-screen">
    <CardDetailPanel
      open
      onClose={() => {}}
      columns={columns}
      target={{ mode: "edit", card: sampleCard }}
      onCreateCard={mockCreateCard}
      onUpdateCard={mockUpdateCard}
      onMoveCard={mockMoveCard}
      onDeleteCard={mockDeleteCard}
    />
  </div>
);

// "Verwijderen" trigger button text, via the catalog (not typed here
// directly) — `.ladle/components.tsx` locks the Ladle locale to `nl`.
const deleteLabelNl = nl.components.cardDetailPanel.deleteLabel;

// Delete-confirm footer state (#106): `deleteConfirming` is local state
// inside CardDetailPanel, flipped by clicking "Verwijderen"
// (design/notes/CardDetailPanel.md's "Two-step delete" entry) — there is no
// prop to force it. This story renders the real EditItem panel and clicks
// that button once on mount to drive the component into the confirm footer
// (text on its own line + 2 buttons 50/50, the 2026-07-25 decision) rather
// than adding a test-only prop just for Ladle/Playwright.
export const EditItemDeleteConfirm = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const deleteButton = Array.from(containerRef.current?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === deleteLabelNl,
    );
    deleteButton?.click();
  }, []);
  return (
    <div ref={containerRef} className="min-h-screen">
      <CardDetailPanel
        open
        onClose={() => {}}
        columns={columns}
        target={{ mode: "edit", card: sampleCard }}
        onCreateCard={mockCreateCard}
        onUpdateCard={mockUpdateCard}
        onMoveCard={mockMoveCard}
        onDeleteCard={mockDeleteCard}
      />
    </div>
  );
};

// Real panel, local state, mock actions that report what the panel would have sent. Open it
// from either button, fill the fields, save, or press the delete button to see the confirm step.
export const Interactive = () => {
  const [state, setState] = useState<{
    open: boolean;
    target: { mode: "create"; columnId: string } | { mode: "edit"; card: CardWithLabels };
  }>({ open: false, target: { mode: "create", columnId: "ideeen" } });
  const [lastAction, setLastAction] = useState("Nothing sent yet");

  const report = (name: string, input: unknown) => {
    setLastAction(`${name}: ${JSON.stringify(input)}`);
  };

  return (
    <div className="flex max-w-prose flex-col gap-stack-md">
      <StoryIntro
        what="Open the panel, fill in the fields, save or delete. The line below shows what each action would send to the server."
        note="CardDetailPanel"
      />
      <div className="flex gap-inline-sm">
        <Button
          variant="filled"
          onClick={() => setState({ open: true, target: { mode: "create", columnId: "ideeen" } })}
        >
          New item in Ideeën
        </Button>
        <Button
          variant="filled"
          onClick={() => setState({ open: true, target: { mode: "edit", card: sampleCard } })}
        >
          Edit sample card
        </Button>
      </div>
      <p className="break-words text-xs text-text-secondary">{lastAction}</p>
      <CardDetailPanel
        open={state.open}
        onClose={() => setState((current) => ({ ...current, open: false }))}
        columns={columns}
        target={state.target}
        onCreateCard={async (input) => {
          report("createCard", input);
          return mockCreateCard(input);
        }}
        onUpdateCard={async (input) => {
          report("updateCard", input);
          return mockUpdateCard(input);
        }}
        onMoveCard={async (input) => {
          report("moveCard", input);
          return mockMoveCard(input);
        }}
        onDeleteCard={async (input) => {
          report("deleteCard", input);
          return mockDeleteCard(input);
        }}
      />
    </div>
  );
};

// Edit mode with a planned day next to the deadline (cards.planned_for).
export const EditItemPlanned = () => (
  <div className="min-h-screen">
    <CardDetailPanel
      open
      onClose={() => {}}
      columns={columns}
      target={{ mode: "edit", card: { ...sampleCard, planned_for: "2026-10-17" } }}
      onCreateCard={mockCreateCard}
      onUpdateCard={mockUpdateCard}
      onMoveCard={mockMoveCard}
      onDeleteCard={mockDeleteCard}
    />
  </div>
);

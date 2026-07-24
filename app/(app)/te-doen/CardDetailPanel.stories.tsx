// figma: node-id=3779:4846 (+3779:4938 desktop)
import { useState } from "react";
import { CardDetailPanel, type CardDetailPanelColumn } from "./CardDetailPanel";
import type { ActionResult, CardRow, CardWithLabels } from "@/lib/boards/types";

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
  position: 1000,
  source: "manual",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  labels: [],
};

// Create mode: empty fields, prefilled Status = the column whose Plus button
// was clicked. Delete button is absent (nothing to delete yet).
export const CreateItem = () => (
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
);

// Edit mode: every field prefilled from `sampleCard`. Click "Verwijderen" to
// exercise the two-step confirm — footer swaps to "Weet je het zeker?" +
// Annuleren/Ja, verwijderen, Annuleren returns to the normal footer.
export const EditItem = () => (
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
);

// Exercises the real open/close cycle plus create->edit target switching, the
// same way SidePanel.stories.tsx's own Interactive story does for the bare
// panel. Not screenshot-stable by design (starts closed).
export const Interactive = () => {
  const [state, setState] = useState<{
    open: boolean;
    target: { mode: "create"; columnId: string } | { mode: "edit"; card: CardWithLabels };
  }>({ open: false, target: { mode: "create", columnId: "ideeen" } });

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "create", columnId: "ideeen" } })}
      >
        Nieuw item in Ideeën
      </button>
      <button
        type="button"
        className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "edit", card: sampleCard } })}
      >
        Bewerk voorbeeldkaart
      </button>
      <CardDetailPanel
        open={state.open}
        onClose={() => setState((current) => ({ ...current, open: false }))}
        columns={columns}
        target={state.target}
        onCreateCard={mockCreateCard}
        onUpdateCard={mockUpdateCard}
        onMoveCard={mockMoveCard}
        onDeleteCard={mockDeleteCard}
      />
    </div>
  );
};

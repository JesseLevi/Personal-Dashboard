// figma: node-id=3878:9060 (+3878:9047 mobile)
import { BoardPanel } from "./BoardPanel";
import type { ActionResult, BoardRow } from "@/lib/boards/types";

// Dev-only mock actions — same approach as CardDetailPanel.stories.tsx:
// BoardPanel takes its actions as props and never imports the real
// "use server" module, so no Supabase/Next request context (or useRouter) is
// needed under Ladle's plain Vite runtime.
async function mockCreateBoard(input: unknown): Promise<ActionResult<BoardRow>> {
  console.log("createBoard", input);
  return { success: true, data: input as unknown as BoardRow };
}
async function mockRenameBoard(input: unknown): Promise<ActionResult> {
  console.log("renameBoard", input);
  return { success: true, data: undefined };
}

const sampleBoard: BoardRow = {
  id: "board-1",
  user_id: "user-1",
  name: "Persoonlijk",
  position: 1000,
  is_favorite: false,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

// `min-h-screen` wrapper: SidePanel's overlay/panel are `position: fixed`, so
// without it the Provider div the baseline is cropped to collapses to a
// sliver (see CardDetailPanel.stories.tsx, commit 6e10fb5). Harness-only.

// Create mode: empty Name field, Save disabled until something is typed.
export const CreateBoard = () => (
  <div className="min-h-screen">
    <BoardPanel
      open
      onClose={() => {}}
      target={{ mode: "create" }}
      onCreateBoard={mockCreateBoard}
      onRenameBoard={mockRenameBoard}
      onCreated={() => {}}
      onRenamed={() => {}}
    />
  </div>
);

// Edit mode: Name prefilled from `sampleBoard`.
export const EditBoard = () => (
  <div className="min-h-screen">
    <BoardPanel
      open
      onClose={() => {}}
      target={{ mode: "edit", board: sampleBoard }}
      onCreateBoard={mockCreateBoard}
      onRenameBoard={mockRenameBoard}
      onCreated={() => {}}
      onRenamed={() => {}}
    />
  </div>
);

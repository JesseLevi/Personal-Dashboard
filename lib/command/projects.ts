import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDoneColumn } from "@/lib/command/progress";
import type { CommandProject } from "@/lib/command/types";

const PROJECT_LIMIT = 50;

type RawProject = {
  id: string;
  title: string;
  updated_at: string;
  card_subtasks: Array<{ done: boolean }>;
  column: {
    position: number;
    is_done: boolean;
    board: { id: string; name: string; board_columns: Array<{ position: number }> };
  };
};

/**
 * Cards with at least one subtask outside a done column, most recently updated first, at most 50
 * (ADR-0053 §6). One RLS-bound round trip; the card's column carries `is_done` (ADR-0050).
 */
export async function getCommandProjects(): Promise<CommandProject[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, title, updated_at, card_subtasks!inner(done), column:board_columns!inner(position, is_done, board:boards!inner(id, name, board_columns(position)))",
    )
    .order("updated_at", { ascending: false })
    .limit(PROJECT_LIMIT * 4)
    .overrideTypes<RawProject[], { merge: false }>();

  if (error) {
    console.error("[command] getCommandProjects failed:", error.code, error.message);
    throw new Error("Failed to load projects");
  }

  return data
    .filter(
      ({ column }) =>
        !isDoneColumn({ position: column.position, isDone: column.is_done }, column.board.board_columns.map((c) => c.position)),
    )
    .slice(0, PROJECT_LIMIT)
    .map((card) => ({
      id: card.id,
      title: card.title,
      href: `/te-doen/${card.column.board.id}?card=${card.id}`,
      boardName: card.column.board.name,
      total: card.card_subtasks.length,
      done: card.card_subtasks.filter((subtask) => subtask.done).length,
    }));
}

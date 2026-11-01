import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { boardProgress } from "@/lib/command/progress";
import type { CommandBoard } from "@/lib/command/types";

type RawBoard = {
  id: string;
  name: string;
  is_favorite: boolean;
  updated_at: string;
  board_columns: Array<{
    position: number;
    cards: Array<{ count: number }>;
    latest: Array<{ updated_at: string }>;
  }>;
};

/** The latest of the board's own `updated_at` and its cards': a board without cards falls back to itself. */
function lastActivity(board: RawBoard): number {
  let latest = Date.parse(board.updated_at);
  for (const column of board.board_columns) {
    for (const card of column.latest) latest = Math.max(latest, Date.parse(card.updated_at));
  }
  return latest;
}

/**
 * All Te doen boards with deterministic progress, most recently active first (ADR-0053 §6); ties keep
 * board order. One RLS-bound round trip: each column embeds its single newest card, so cards are not read.
 */
export async function getCommandBoards(): Promise<CommandBoard[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, is_favorite, updated_at, board_columns(position, cards(count), latest:cards(updated_at))")
    .order("position", { ascending: true })
    .order("updated_at", { ascending: false, referencedTable: "board_columns.latest" })
    .limit(1, { referencedTable: "board_columns.latest" })
    .overrideTypes<RawBoard[], { merge: false }>();

  if (error) {
    console.error("[command] getCommandBoards failed:", error.code, error.message);
    throw new Error("Failed to load boards");
  }

  return data
    .map((board) => ({ board, activity: lastActivity(board) }))
    .sort((a, b) => b.activity - a.activity)
    .map(({ board }) => ({
      id: board.id,
      name: board.name,
      href: `/te-doen/${board.id}`,
      isFavorite: board.is_favorite,
      ...boardProgress(
        board.board_columns.map((column) => ({
          position: column.position,
          cardCount: column.cards[0]?.count ?? 0,
        })),
      ),
    }));
}

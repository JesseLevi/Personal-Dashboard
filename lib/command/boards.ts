import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { boardProgress } from "@/lib/command/progress";
import type { CommandBoard } from "@/lib/command/types";

type RawBoard = {
  id: string;
  name: string;
  is_favorite: boolean;
  board_columns: Array<{ position: number; is_done: boolean; cards: Array<{ count: number }> }>;
};

/** Te doen boards with deterministic progress, favourites first then by position. One RLS-bound round trip. */
export async function getCommandBoards(): Promise<CommandBoard[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, is_favorite, board_columns(position, is_done, cards(count))")
    .order("is_favorite", { ascending: false })
    .order("position", { ascending: true })
    .overrideTypes<RawBoard[], { merge: false }>();

  if (error) {
    console.error("[command] getCommandBoards failed:", error.code, error.message);
    throw new Error("Failed to load boards");
  }

  return data.map((board) => ({
    id: board.id,
    name: board.name,
    href: `/te-doen/${board.id}`,
    isFavorite: board.is_favorite,
    ...boardProgress(
      board.board_columns.map((column) => ({
        position: column.position,
        cardCount: column.cards[0]?.count ?? 0,
        isDone: column.is_done,
      })),
    ),
  }));
}

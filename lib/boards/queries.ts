import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import type {
  BoardColumnWithCards,
  BoardRow,
  BoardWithColumns,
  CardWithLabels,
  LabelRow,
} from "@/lib/boards/types";

// Read side of #92. Both functions filter on the signed-in user's id in
// addition to relying on RLS (see the "don't trust the client for
// ownership" note on the ticket) and never throw a database-shaped error
// message — callers are server components, so a thrown Error surfaces
// through the nearest error boundary; the message stays generic and the
// real detail goes to the server console only.

/** Boards belonging to the signed-in user, favorite first, then by position
 * (the board switcher's order). Empty array if signed out. */
export async function getBoardsForUser(): Promise<BoardRow[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("position", { ascending: true });

  if (error) {
    console.error("[boards] getBoardsForUser failed:", error.code, error.message);
    throw new Error("Failed to load boards");
  }
  return data;
}

// Exact shape of the nested select below — declared once here rather than
// inferred, because a raw multi-level embed string isn't reliably inferred
// by postgrest-js's generics; overrideTypes() asserts it against this.
interface RawBoardQueryRow extends BoardRow {
  board_columns: Array<
    Omit<BoardColumnWithCards, "cards"> & {
      cards: Array<
        Omit<CardWithLabels, "labels"> & {
          card_labels: Array<{ label: LabelRow | null }>;
        }
      >;
    }
  >;
}

/**
 * One full board — columns ordered by `position`, each column's cards
 * ordered by `position`, each card's labels resolved — fetched in a single
 * PostgREST round trip via nested embeds (no per-column/per-card follow-up
 * query). Returns `null` if the board doesn't exist, isn't owned by the
 * signed-in user, or the caller is signed out.
 */
export async function getBoardWithColumns(
  boardId: string,
): Promise<BoardWithColumns | null> {
  const parsedId = z.uuid().safeParse(boardId);
  if (!parsedId.success) return null;

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("boards")
    .select(
      `
      id, user_id, name, position, is_favorite, created_at, updated_at,
      board_columns (
        id, user_id, board_id, name, icon, position, created_at, updated_at,
        cards (
          id, user_id, column_id, title, description, priority, size,
          due_at, position, source, created_at, updated_at,
          card_labels ( label:labels ( id, user_id, board_id, name, created_at, updated_at ) )
        )
      )
    `,
    )
    // Explicit ownership filter alongside RLS — see the module comment.
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<RawBoardQueryRow, { merge: false }>();

  if (error) {
    console.error("[boards] getBoardWithColumns failed:", error.code, error.message);
    throw new Error("Failed to load board");
  }
  if (!data) return null;

  const { board_columns, ...board } = data;

  const columns: BoardColumnWithCards[] = [...board_columns]
    .sort((a, b) => a.position - b.position)
    .map(({ cards, ...column }) => ({
      ...column,
      cards: [...cards]
        .sort((a, b) => a.position - b.position)
        .map(({ card_labels, ...card }): CardWithLabels => ({
          ...card,
          labels: card_labels
            .map((cardLabel) => cardLabel.label)
            .filter((label): label is LabelRow => label !== null),
        })),
    }));

  return { ...board, columns };
}

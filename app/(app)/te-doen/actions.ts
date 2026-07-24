"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { InvalidNeighborOrderError, nextPosition } from "@/lib/boards/positioning";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/boards/defaults";
import {
  boardIdSchema,
  createBoardSchema,
  createCardSchema,
  createColumnSchema,
  deleteCardSchema,
  moveCardSchema,
  renameBoardSchema,
  renameColumnSchema,
  updateCardSchema,
} from "@/lib/boards/schemas";
import type { ActionResult, BoardColumnRow, BoardRow, CardRow } from "@/lib/boards/types";
import type { Database } from "@/lib/database.types";

// Write side of #92 — board/column/card CRUD + card move, called from the
// Kanban UI (later tickets). Every action:
//   1. parses its input with the matching lib/boards/schemas.ts schema;
//   2. resolves the signed-in user and filters every query on that id
//      explicitly, on top of RLS (see the ticket's "don't trust the client
//      for ownership" note — RLS alone would let a column_id from another
//      of the same user's boards through unnoticed, see moveCard below);
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `boards.errors.${error}` in the message catalog. Errors never
//      carry a database message or user-supplied content (only db.code is
//      logged, server-side, never returned).
// revalidatePath("/te-doen") runs on every successful write: the board
// switcher and the single /te-doen route both read through the same path,
// and there's no per-board route segment yet (BoardView, #90) to scope it to.

type Client = SupabaseClient<Database>;

async function requireUserId(
  supabase: Client,
): Promise<{ userId: string } | { error: "unauthenticated" }> {
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { error: "unauthenticated" };
  return { userId };
}

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[boards] ${action} failed:`, error.code, error.message);
}

// Position of the last row (by `position`) owned by `userId`, optionally
// further scoped to one parent — the shared "append at the end" building
// block for createBoard/createColumn/createCard. Null if there are no
// matching rows. Three thin variants rather than one table-generic helper:
// each table's scoping column differs, and a single function parameterized
// over the table name can't stay soundly typed across all three shapes.
async function lastBoardPosition(supabase: Client, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("boards")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

async function lastColumnPosition(
  supabase: Client,
  userId: string,
  boardId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("board_columns")
    .select("position")
    .eq("user_id", userId)
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

async function lastCardPosition(
  supabase: Client,
  userId: string,
  columnId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("cards")
    .select("position")
    .eq("user_id", userId)
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

export async function createBoard(input: unknown): Promise<ActionResult<BoardRow>> {
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const last = await lastBoardPosition(supabase, auth.userId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("boards")
    .insert({ user_id: auth.userId, name: parsed.data.name, position })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createBoard", error);
    return { success: false, error: "generic" };
  }

  // #95: a new board "opens in empty state" with the same four default
  // columns as the schema's own per-user seed (lib/boards/defaults.ts) — that
  // trigger only fires on account creation, not on every board, so this is
  // its own insert. Best-effort: the board row itself already succeeded and
  // is real/usable (just column-less) if this second insert fails, so a
  // failure here is logged but doesn't roll back or fail the action — the
  // user still gets a real board back, matching every other action's
  // "return what succeeded" shape.
  const { error: columnsError } = await supabase.from("board_columns").insert(
    DEFAULT_BOARD_COLUMNS.map((column, index) => ({
      user_id: auth.userId,
      board_id: data.id,
      name: column.name,
      icon: column.icon,
      position: (index + 1) * 1000,
    })),
  );
  if (columnsError) logDbError("createBoard/default-columns", columnsError);

  revalidatePath("/te-doen");
  return { success: true, data };
}

export async function renameBoard(input: unknown): Promise<ActionResult> {
  const parsed = renameBoardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("boards")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.boardId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameBoard", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen");
  return { success: true, data: undefined };
}

export async function toggleBoardFavorite(
  input: unknown,
): Promise<ActionResult<{ isFavorite: boolean }>> {
  const parsed = boardIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("id, is_favorite")
    .eq("id", parsed.data.boardId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (fetchError) {
    logDbError("toggleBoardFavorite", fetchError);
    return { success: false, error: "generic" };
  }
  if (!board) return { success: false, error: "not-found" };

  const nextFavorite = !board.is_favorite;

  if (nextFavorite) {
    // boards_one_favorite_per_user (partial unique index on is_favorite=true)
    // allows at most one true row per user, so the previous favorite must be
    // cleared before this one is set — see the migration's own note that
    // this is an app-layer responsibility, not enforced by a DB trigger.
    // Two sequential statements, not a single transaction (no RPC exists for
    // this yet): a failure between them can transiently leave zero
    // favorites, never two — the unique index still guarantees that half —
    // and the next toggle self-heals it.
    const { error: clearError } = await supabase
      .from("boards")
      .update({ is_favorite: false })
      .eq("user_id", auth.userId)
      .eq("is_favorite", true);
    if (clearError) {
      logDbError("toggleBoardFavorite/clear", clearError);
      return { success: false, error: "generic" };
    }
  }

  const { error: updateError } = await supabase
    .from("boards")
    .update({ is_favorite: nextFavorite })
    .eq("id", board.id)
    .eq("user_id", auth.userId);

  if (updateError) {
    logDbError("toggleBoardFavorite/set", updateError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/te-doen");
  return { success: true, data: { isFavorite: nextFavorite } };
}

export async function createColumn(
  input: unknown,
): Promise<ActionResult<BoardColumnRow>> {
  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", parsed.data.boardId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (boardError) {
    logDbError("createColumn/board-lookup", boardError);
    return { success: false, error: "generic" };
  }
  if (!board) return { success: false, error: "not-found" };

  const last = await lastColumnPosition(supabase, auth.userId, parsed.data.boardId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("board_columns")
    .insert({
      user_id: auth.userId,
      board_id: parsed.data.boardId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createColumn", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/te-doen");
  return { success: true, data };
}

export async function renameColumn(input: unknown): Promise<ActionResult> {
  const parsed = renameColumnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("board_columns")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.columnId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameColumn", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen");
  return { success: true, data: undefined };
}

export async function createCard(input: unknown): Promise<ActionResult<CardRow>> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: column, error: columnError } = await supabase
    .from("board_columns")
    .select("id")
    .eq("id", parsed.data.columnId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (columnError) {
    logDbError("createCard/column-lookup", columnError);
    return { success: false, error: "generic" };
  }
  if (!column) return { success: false, error: "not-found" };

  const last = await lastCardPosition(supabase, auth.userId, parsed.data.columnId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: auth.userId,
      column_id: parsed.data.columnId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      size: parsed.data.size ?? null,
      due_at: parsed.data.dueAt ?? null,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createCard", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/te-doen");
  return { success: true, data };
}

export async function updateCard(input: unknown): Promise<ActionResult> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const { cardId, ...fields } = parsed.data;
  // Only fields the caller actually sent get written — a schema `.optional()`
  // key that's absent must not overwrite existing data with `undefined`
  // (Supabase would just omit it, but being explicit keeps this correct even
  // if the schema changes later).
  const update: Database["public"]["Tables"]["cards"]["Update"] = {};
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.priority !== undefined) update.priority = fields.priority;
  if (fields.size !== undefined) update.size = fields.size;
  if (fields.dueAt !== undefined) update.due_at = fields.dueAt;

  if (Object.keys(update).length === 0) {
    return { success: false, error: "invalid-input" };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("cards")
    .update(update)
    .eq("id", cardId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("updateCard", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen");
  return { success: true, data: undefined };
}

export async function deleteCard(input: unknown): Promise<ActionResult> {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", parsed.data.cardId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteCard", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen");
  return { success: true, data: undefined };
}

export async function moveCard(
  input: unknown,
): Promise<ActionResult<{ position: number }>> {
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { cardId, columnId, targetIndex } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  // The card must exist, be owned by this user, and we need the board it
  // currently lives on (via its current column) to check against the
  // target column below.
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, column_id, board_columns!inner(board_id)")
    .eq("id", cardId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (cardError) {
    logDbError("moveCard/card-lookup", cardError);
    return { success: false, error: "generic" };
  }
  if (!card) return { success: false, error: "not-found" };
  const sourceBoardId = (
    card.board_columns as unknown as { board_id: string }
  ).board_id;

  // The known weak spot this ticket calls out: `columnId` is only checked
  // against RLS (does it belong to *a* board of this user?) by default —
  // nothing stops it from naming a column on a *different* board of the same
  // user. So resolve the target column's own board_id explicitly and compare
  // it to the card's current board_id; only proceed if they match.
  const { data: targetColumn, error: targetColumnError } = await supabase
    .from("board_columns")
    .select("id, board_id")
    .eq("id", columnId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (targetColumnError) {
    logDbError("moveCard/column-lookup", targetColumnError);
    return { success: false, error: "generic" };
  }
  if (!targetColumn) return { success: false, error: "not-found" };
  if (targetColumn.board_id !== sourceBoardId) {
    return { success: false, error: "column-mismatch" };
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from("cards")
    .select("id, position")
    .eq("column_id", columnId)
    .eq("user_id", auth.userId)
    .neq("id", cardId)
    .order("position", { ascending: true });
  if (siblingsError) {
    logDbError("moveCard/siblings-lookup", siblingsError);
    return { success: false, error: "generic" };
  }

  const clampedIndex = Math.min(Math.max(targetIndex, 0), siblings.length);
  const before = clampedIndex > 0 ? siblings[clampedIndex - 1].position : null;
  const after = clampedIndex < siblings.length ? siblings[clampedIndex].position : null;

  let position: number;
  try {
    position = nextPosition(before, after);
  } catch (err) {
    if (err instanceof InvalidNeighborOrderError) {
      return { success: false, error: "generic" };
    }
    throw err;
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update({ column_id: columnId, position })
    .eq("id", cardId)
    .eq("user_id", auth.userId);

  if (updateError) {
    logDbError("moveCard/update", updateError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/te-doen");
  return { success: true, data: { position } };
}

"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/boards/session";
import { nextPosition } from "@/lib/boards/positioning";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/boards/defaults";
import {
  boardIdSchema,
  createBoardSchema,
  createCardSchema,
  createColumnSchema,
  deleteCardSchema,
  deleteColumnSchema,
  moveCardSchema,
  planCardSchema,
  renameBoardSchema,
  renameColumnSchema,
  updateCardSchema,
} from "@/lib/boards/schemas";
import type { ActionResult, BoardColumnRow, BoardRow, CardRow } from "@/lib/boards/types";
import type { Database } from "@/lib/database.types";

// Write side of #92 — board/column/card CRUD + card move, called from the
// Kanban UI (later tickets). Every action:
//   1. parses its input with the matching lib/boards/schemas.ts schema;
//   2. resolves the signed-in user, stamps `user_id` on inserts and leaves
//      access to the RLS policies: no app-side `user_id` filter on reads,
//      updates or deletes (ADR-0033/0035, #507). Writes hit by RLS return no
//      row (`not-found`) or raise 42501 (`read-only`); moveCard's guard
//      against a column_id from another board lives in the public.move_card
//      RPC, #169;
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `boards.errors.${error}` in the message catalog. Errors never
//      carry a database message or user-supplied content (only db.code is
//      logged, server-side, never returned).
// revalidatePath("/te-doen", "layout") runs on every successful write except
// moveCard: the board switcher and /te-doen/[boardId] both read through this
// layout, and the "layout" type argument (#169) is required for a bare
// "/te-doen" call to also match the dynamic child segment — Next.js only
// does exact-path matching without it, so /te-doen/[boardId] previously got
// no server refresh from these actions at all. moveCard has no
// revalidatePath call: the client already applies the move optimistically
// (see moveCard's own comment below), and re-rendering the RSC tree inside
// the same Server Action response made the client wait through a full page
// re-render before the drag visually settled (#169's ~2s hang) for a write
// whose result the UI doesn't otherwise need from the server.

type Client = SupabaseClient<Database>;

// requireUserId used to be defined locally here (and, identically, in
// app/(app)/recepten/actions.ts and app/(app)/winkelmand/actions.ts) taking
// a `supabase` client as an argument. #168 replaced all three copies with
// the shared, cache()'d, argument-free lib/boards/session.ts helper -- see
// that file's header comment for why it no longer needs one.

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[boards] ${action} failed:`, error.code, error.message);
}

// A write RLS refuses with an error raises 42501 (insufficient privilege):
// that is `read-only` (a shared board the caller may only read), anything else
// is `generic`. A write RLS refuses silently returns no row and is `not-found`.
function readOnlyOrGeneric(error: { code: string }): "read-only" | "generic" {
  return error.code === "42501" ? "read-only" : "generic";
}

// Position of the last row (by `position`) -- the shared "append at the end"
// building block for createBoard/createColumn/createCard. Columns and cards
// are scoped to their parent and RLS decides which rows count; boards have no
// parent, so they stay filtered on the caller's own `userId` (otherwise a
// shared board would shift the caller's own position sequence). Null if there are no
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

async function lastColumnPosition(supabase: Client, boardId: string): Promise<number | null> {
  const { data } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

async function lastCardPosition(supabase: Client, columnId: string): Promise<number | null> {
  const { data } = await supabase
    .from("cards")
    .select("position")
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
  const auth = await requireUserId();
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

  revalidatePath("/te-doen", "layout");
  return { success: true, data };
}

export async function renameBoard(input: unknown): Promise<ActionResult> {
  const parsed = renameBoardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("boards")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.boardId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameBoard", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

export async function toggleBoardFavorite(
  input: unknown,
): Promise<ActionResult<{ isFavorite: boolean }>> {
  const parsed = boardIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  // One atomic RPC (#286, public.toggle_board_favorite): reads the current
  // state, clears the previous favorite when switching on (the
  // boards_one_favorite_per_user partial unique index allows one true row per
  // user) and sets the new value in a single transaction. security invoker,
  // so RLS plus the function's own user_id check govern ownership; MV404 =
  // board not found or not owned by this user.
  const { data: isFavorite, error } = await supabase.rpc("toggle_board_favorite", {
    p_board_id: parsed.data.boardId,
  });

  if (error) {
    logDbError("toggleBoardFavorite", error);
    if (error.code === "MV404") return { success: false, error: "not-found" };
    return { success: false, error: "generic" };
  }
  if (isFavorite === null) return { success: false, error: "generic" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: { isFavorite } };
}

export async function createColumn(
  input: unknown,
): Promise<ActionResult<BoardColumnRow>> {
  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", parsed.data.boardId)
    .maybeSingle();
  if (boardError) {
    logDbError("createColumn/board-lookup", boardError);
    return { success: false, error: readOnlyOrGeneric(boardError) };
  }
  if (!board) return { success: false, error: "not-found" };

  const last = await lastColumnPosition(supabase, parsed.data.boardId);
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

  revalidatePath("/te-doen", "layout");
  return { success: true, data };
}

export async function renameColumn(input: unknown): Promise<ActionResult> {
  const parsed = renameColumnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("board_columns")
    .update(
      parsed.data.icon === undefined
        ? { name: parsed.data.name }
        : { name: parsed.data.name, icon: parsed.data.icon },
    )
    .eq("id", parsed.data.columnId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameColumn", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

export async function deleteColumn(input: unknown): Promise<ActionResult> {
  const parsed = deleteColumnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  // cards.column_id is `on delete cascade`: the column's cards go with it.
  const { data, error } = await supabase
    .from("board_columns")
    .delete()
    .eq("id", parsed.data.columnId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteColumn", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

export async function createCard(input: unknown): Promise<ActionResult<CardRow>> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: column, error: columnError } = await supabase
    .from("board_columns")
    .select("id")
    .eq("id", parsed.data.columnId)
    .maybeSingle();
  if (columnError) {
    logDbError("createCard/column-lookup", columnError);
    return { success: false, error: readOnlyOrGeneric(columnError) };
  }
  if (!column) return { success: false, error: "not-found" };

  const last = await lastCardPosition(supabase, parsed.data.columnId);
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
      planned_for: parsed.data.plannedFor ?? null,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createCard", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/te-doen", "layout");
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
  if (fields.plannedFor !== undefined) update.planned_for = fields.plannedFor;

  if (Object.keys(update).length === 0) {
    return { success: false, error: "invalid-input" };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("cards")
    .update(update)
    .eq("id", cardId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("updateCard", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

// Plans a card on a day, or clears the day with `null` (ADR-0037 §1). Access is
// decided by the cards policies alone (ADR-0033, ADR-0035): there is no
// user_id filter here, so a card on a board shared with the caller works the
// day sharing extends those policies. A card RLS hides, or a write it refuses
// by returning no row, is `not-found`; a refused write that raises 42501 is
// `read-only`. The board shows the day on its ticket, hence the revalidation.
export async function planCard(input: unknown): Promise<ActionResult> {
  const parsed = planCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("cards")
    .update({ planned_for: parsed.data.plannedFor })
    .eq("id", parsed.data.cardId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("planCard", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

export async function deleteCard(input: unknown): Promise<ActionResult> {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", parsed.data.cardId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteCard", error);
    return { success: false, error: readOnlyOrGeneric(error) };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/te-doen", "layout");
  return { success: true, data: undefined };
}

// #169: one round trip via the public.move_card RPC instead of the previous
// auth → card lookup → target-column lookup → siblings lookup → update
// chain -- see 20260810000002_move_rpcs.sql's own comment for what the RPC
// does under the hood (ownership guard, same-board check, neighbor-midpoint
// computation ported from lib/boards/positioning.ts's nextPosition, update,
// all inside one atomic statement). No revalidatePath call here (see this
// file's header comment): the client already applies the move optimistically
// (TeDoenBoard.tsx), and shipping the RSC re-render inside this same
// response was the ~2s hang #169 exists to remove -- a single RPC round trip
// with nothing bundled onto it is the fix.
export async function moveCard(
  input: unknown,
): Promise<ActionResult<{ position: number }>> {
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { cardId, columnId, targetIndex } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: position, error } = await supabase.rpc("move_card", {
    p_card_id: cardId,
    p_column_id: columnId,
    p_target_index: targetIndex,
  });

  if (error) {
    logDbError("moveCard", error);
    // Custom SQLSTATEs raised by move_card's own guards (see the migration):
    // MV404 = card or target column not found/not owned by this user,
    // MV409 = target column belongs to a different board than the card's
    // current one. Anything else -- including the ported
    // InvalidNeighborOrderError case -- falls back to "generic", matching
    // this action's pre-RPC behavior for that branch.
    if (error.code === "MV404") return { success: false, error: "not-found" };
    if (error.code === "MV409") return { success: false, error: "column-mismatch" };
    return { success: false, error: "generic" };
  }
  if (position === null) return { success: false, error: "generic" };

  return { success: true, data: { position } };
}

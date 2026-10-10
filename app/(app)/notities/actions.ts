"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/notes/session";
import { nextPosition } from "@/lib/boards/positioning";
import { deriveTitle, extractNoteLinkIds, toPlainText } from "@/lib/notes/document";
import {
  createCategorySchema,
  createNoteSchema,
  deleteCategorySchema,
  deleteNoteSchema,
  moveNoteSchema,
  renameCategorySchema,
  reorderCategorySchema,
  updateNoteContentSchema,
} from "@/lib/notes/schemas";
import type { ActionResult, NoteCategoryRow, NoteRow } from "@/lib/notes/types";
import type { Database, Json } from "@/lib/database.types";

// Write side of #228 -- category/note CRUD, called from the Notities UI
// (later tickets, #230+). Every action follows app/(app)/recepten/actions.ts's
// pattern exactly:
//   1. parses its input with the matching lib/notes/schemas.ts schema;
//   2. resolves the signed-in user and filters every query on that id
//      explicitly, on top of RLS (don't trust the client for ownership,
//      #92's original note, applied here the same way);
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `notes.errors.${error}` in the message catalog.
// revalidatePath("/notities", "layout") runs on every successful write
// except moveNote -- same "the client already applies the move
// optimistically, don't bundle an RSC re-render onto the drag response"
// reasoning as te-doen/actions.ts's moveCard / recepten/actions.ts's
// moveRecipe (#169), and the "layout" type argument for the same reason
// those files needed it (a bare "/notities" call would not also revalidate
// a later dynamic child route, e.g. the editor page). The route itself
// doesn't exist yet (#228 is data-layer only) -- revalidatePath on a path
// with no matching page is a harmless no-op, and wiring it now means the
// later UI ticket doesn't have to remember to add it.

type Client = SupabaseClient<Database>;

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[notes] ${action} failed:`, error.code, error.message);
}

// Position of the last row (by `position`) owned by `userId`, optionally
// further scoped to one category -- the shared "append at the end" building
// block for createCategory/createNote, same shape as lib/recipes/'s
// lastCategoryPosition/lastRecipePosition (app/(app)/recepten/actions.ts).
async function lastCategoryPosition(supabase: Client, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("note_categories")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

async function lastNotePosition(
  supabase: Client,
  userId: string,
  categoryId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("notes")
    .select("position")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

// ============================================================================
// Categories
// ============================================================================

export async function createCategory(
  input: unknown,
): Promise<ActionResult<NoteCategoryRow>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const last = await lastCategoryPosition(supabase, auth.userId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("note_categories")
    .insert({
      user_id: auth.userId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createCategory", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/notities", "layout");
  return { success: true, data };
}

// Writes both `name` and `icon` together, not `name` alone -- #149 (recipes'
// updateCategory) found that a rename action writing only `name` silently
// drops an icon change the panel always resends alongside it. Same fix
// applied here from the start rather than re-discovering that bug.
export async function renameCategory(input: unknown): Promise<ActionResult> {
  const parsed = renameCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("note_categories")
    .update({ name: parsed.data.name, icon: parsed.data.icon })
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameCategory", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/notities", "layout");
  return { success: true, data: undefined };
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  // notes.category_id is `on delete cascade` (20260813000001_note_schema.sql):
  // deleting a category deletes its notes. No manual cleanup needed here.
  const { data, error } = await supabase
    .from("note_categories")
    .delete()
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteCategory", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/notities", "layout");
  return { success: true, data: undefined };
}

// Reorders note_categories within the signed-in user's own flat list --
// unlike moveNote below, a category never changes parent (there is no
// "board" a category could cross into), so this is a plain reposition, not
// an RPC: one ownership lookup, one sibling count/clamp/neighbor-midpoint
// computation (lib/boards/positioning.ts's nextPosition, same as every other
// "insert/reorder at an index" action in this codebase), one update. No
// atomicity gap exists here the way moveNote's category-switch-plus-
// reposition has (ADR-0015) -- a single UPDATE statement is already atomic.
export async function reorderCategory(input: unknown): Promise<ActionResult<{ position: number }>> {
  const parsed = reorderCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { categoryId, targetIndex } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: category, error: categoryError } = await supabase
    .from("note_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (categoryError) {
    logDbError("reorderCategory/lookup", categoryError);
    return { success: false, error: "generic" };
  }
  if (!category) return { success: false, error: "not-found" };

  const { count: siblingCount, error: countError } = await supabase
    .from("note_categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .neq("id", categoryId);
  if (countError) {
    logDbError("reorderCategory/count", countError);
    return { success: false, error: "generic" };
  }

  const clampedIndex = Math.min(Math.max(targetIndex, 0), siblingCount ?? 0);

  let before: number | null = null;
  let after: number | null = null;

  if (clampedIndex > 0) {
    const { data, error } = await supabase
      .from("note_categories")
      .select("position")
      .eq("user_id", auth.userId)
      .neq("id", categoryId)
      .order("position", { ascending: true })
      .range(clampedIndex - 1, clampedIndex - 1)
      .maybeSingle();
    if (error) {
      logDbError("reorderCategory/before", error);
      return { success: false, error: "generic" };
    }
    before = data?.position ?? null;
  }

  if (clampedIndex < (siblingCount ?? 0)) {
    const { data, error } = await supabase
      .from("note_categories")
      .select("position")
      .eq("user_id", auth.userId)
      .neq("id", categoryId)
      .order("position", { ascending: true })
      .range(clampedIndex, clampedIndex)
      .maybeSingle();
    if (error) {
      logDbError("reorderCategory/after", error);
      return { success: false, error: "generic" };
    }
    after = data?.position ?? null;
  }

  let position: number;
  try {
    position = nextPosition(before, after);
  } catch {
    // InvalidNeighborOrderError -- stale/inconsistent neighbor positions,
    // same "generic" fallback every other nextPosition call site in this
    // codebase uses (see lib/boards/positioning.ts).
    return { success: false, error: "generic" };
  }

  const { error: updateError } = await supabase
    .from("note_categories")
    .update({ position })
    .eq("id", categoryId)
    .eq("user_id", auth.userId);
  if (updateError) {
    logDbError("reorderCategory", updateError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/notities", "layout");
  return { success: true, data: { position } };
}

// ============================================================================
// Notes
// ============================================================================

// A new note starts empty. `title` and `content_text` are both written
// explicitly as `""` even though `content_text`'s column default is already
// `''` (20260813000001_note_schema.sql) -- the ticket's hard constraint is
// that no action writes `title` without writing `content_text` in the same
// statement, and leaning on the default would satisfy that in effect but not
// on inspection: someone grepping this file for `title` writes has to go read
// the migration to convince themselves the two can't diverge here. `content`
// is left to its column default (an empty-but-valid TipTap doc) -- that one
// isn't part of the pairing. Real title/content_text arrive with the first
// updateNoteContent call below (#228 ticket decision 1).
export async function createNote(input: unknown): Promise<ActionResult<NoteRow>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: category, error: categoryError } = await supabase
    .from("note_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (categoryError) {
    logDbError("createNote/category-lookup", categoryError);
    return { success: false, error: "generic" };
  }
  if (!category) return { success: false, error: "not-found" };

  const last = await lastNotePosition(supabase, auth.userId, parsed.data.categoryId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: auth.userId,
      category_id: parsed.data.categoryId,
      title: "",
      content_text: "",
      position,
    })
    .select()
    .single()
    .overrideTypes<NoteRow, { merge: false }>();

  if (error || !data) {
    if (error) logDbError("createNote", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/notities", "layout");
  return { success: true, data };
}

// The single write path for a note's body (#228 ticket decision 1 + 2):
// `title` is derived server-side from `content`'s first line
// (lib/notes/document.ts's deriveTitle) and `content_text` is the same
// document flattened to plain text (toPlainText) -- both written in this one
// `update` call alongside `content` itself, never as separate writes. No
// action in this file ever sets `title` without also setting `content_text`
// in the same statement (the ticket's hard constraint) -- this is the only
// action that writes either column at all.
export async function updateNoteContent(
  input: unknown,
): Promise<ActionResult<{ title: string }>> {
  const parsed = updateNoteContentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { noteId, content } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const title = deriveTitle(content);
  const contentText = toPlainText(content);

  // #340 (ADR-0023): one transaction writes content/title/content_text and
  // replaces the note's note_links set (public.save_note_content, security
  // invoker). `content` (parsed by tiptapDocumentSchema) is a TipTapDocument
  // -- a nominal interface, not structurally an indexable
  // `{ [key: string]: Json }`, so it needs an explicit cast at this write
  // boundary. Foreign/unknown target ids are dropped by the RPC.
  const { error } = await supabase.rpc("save_note_content", {
    p_note_id: noteId,
    p_content: content as unknown as Json,
    p_title: title,
    p_content_text: contentText,
    p_target_ids: extractNoteLinkIds(content),
  });

  if (error) {
    // NL404 = note not found / not owned by this user (see the migration).
    if (error.code === "NL404") return { success: false, error: "not-found" };
    logDbError("updateNoteContent", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/notities", "layout");
  return { success: true, data: { title } };
}

export async function deleteNote(input: unknown): Promise<ActionResult> {
  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsed.data.noteId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteNote", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/notities", "layout");
  return { success: true, data: undefined };
}

// Drag & drop persistence (ADR-0015): one round trip via the public.move_note
// RPC (20260813000002_move_note_rpc.sql) instead of a four-query
// auth -> note lookup -> target-category lookup -> siblings lookup -> update
// chain -- same shape as move_card/move_recipe, and the same reasoning this
// migration's own header spells out for why a plain multi-statement action
// isn't safe here: a drop can change `category_id` and reposition within the
// new category's sibling list in the same motion, and that has to be one
// atomic statement, not two sequential ones a partial failure could split.
// No revalidatePath call -- same "the client already applies the move
// optimistically" reasoning as moveCard/moveRecipe (see this file's header
// comment).
export async function moveNote(input: unknown): Promise<ActionResult<{ position: number }>> {
  const parsed = moveNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { noteId, categoryId, targetIndex } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: position, error } = await supabase.rpc("move_note", {
    p_note_id: noteId,
    p_category_id: categoryId,
    p_target_index: targetIndex,
  });

  if (error) {
    logDbError("moveNote", error);
    // MV404 = note or target category not found/not owned by this user (see
    // the migration) -- move_note never raises MV409, it has no
    // column-mismatch equivalent: note_categories, like recipe_categories,
    // have no parent entity the way board_columns have boards (same
    // reasoning as move_recipe, app/(app)/recepten/actions.ts's moveRecipe
    // comment). Anything else -- including the ported
    // InvalidNeighborOrderError case -- falls back to "generic".
    if (error.code === "MV404") return { success: false, error: "not-found" };
    return { success: false, error: "generic" };
  }
  if (position === null) return { success: false, error: "generic" };

  return { success: true, data: { position } };
}

import type { Database } from "@/lib/database.types";
import type { TipTapDocument } from "@/lib/notes/document";

// Read-side shapes returned by lib/notes/queries.ts, plus the write-side
// ActionResult/NotesErrorCode contract for app/(app)/notities/actions.ts --
// same split as lib/recipes/types.ts (#122) / lib/boards/types.ts (#92).

export type NoteCategoryRow = Database["public"]["Tables"]["note_categories"]["Row"];
export type NoteRow = Omit<Database["public"]["Tables"]["notes"]["Row"], "content"> & {
  // The generated `Row` type widens `content` to `Json` (any JSON value) --
  // narrowed here to the shape lib/notes/document.ts's deriveTitle/
  // toPlainText actually expect, since every row this app writes always
  // round-trips through updateNoteContent's tiptapDocumentSchema (#228,
  // supabase/migrations/20260813000001_note_schema.sql's default doc already
  // matches this shape too).
  content: TipTapDocument;
};

// getNoteCategoriesWithNotes' per-note shape (queries.ts): the overview card
// only needs id/title/a snippet/updated_at (#228 ticket, explicit "haal
// content jsonb hier niet op" instruction) -- category_id is kept alongside
// them anyway, same as CardRow/RecipeRow keep their own column_id/
// category_id inside a nested list (lib/boards/types.ts's
// BoardColumnWithCards, lib/recipes/types.ts's CategoryWithRecipes), so a
// single note card carries its own foreign key without depending on its
// parent's identity.
export type NoteSummaryRow = {
  id: string;
  category_id: string;
  title: string;
  /** #230: added for the Sorteer dropdown's "Aanmaakdatum" option (lib/notes/sort.ts) -- not read by CardContentNote's timestamp, which uses `updated_at` instead (see lib/notes/timestamp.ts). */
  created_at: string;
  updated_at: string;
  /** First `SNIPPET_MAX_LENGTH` characters of `content_text` (queries.ts), never the full text and never `content` jsonb. */
  snippet: string;
};

export type CategoryWithNotes = NoteCategoryRow & { notes: NoteSummaryRow[] };

// Every write action (app/(app)/notities/actions.ts) returns one of these
// instead of throwing or returning a bare string -- same shape and reasoning
// as lib/recipes/types.ts's ActionResult/RecipesErrorCode. Deliberately the
// small four-code set (matches lib/shopping/types.ts's ShoppingErrorCode):
// no "column-mismatch" -- moveNote's own RPC (public.move_note,
// 20260813000002_move_note_rpc.sql) has no cross-parent case to signal,
// same reasoning as move_recipe's error set (note_categories, like
// recipe_categories, have no parent entity the way board_columns have
// boards); no thumbnail-upload codes -- notes have no image upload.
export type NotesErrorCode = "invalid-input" | "unauthenticated" | "not-found" | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: NotesErrorCode };

import { z } from "zod";
import type { TipTapDocument } from "@/lib/notes/document";

// Validates every server-action input in app/(app)/notities/actions.ts
// (#228), same pattern and same split (shape/format here, ownership checked
// separately against the database) as lib/recipes/schemas.ts.

const name = z.string().trim().min(1).max(200);
// note_categories.icon: free-text column, validated against the IconName
// union at render time (components/atoms/Icon.tsx) -- same convention as
// lib/recipes/schemas.ts's `icon` for recipe_categories.icon and
// lib/boards/schemas.ts's `icon` for board_columns.icon.
const icon = z.string().trim().min(1).max(100);

// Structural TipTap node schema: `type` is any string, `text` is optional
// (leaf nodes only), `content` recurses. Deliberately not a schema per node
// type (paragraph/heading/table/...) -- validating a stored document against
// the app's fixed extension whitelist (data-layer.md, Architecture §7) is
// the TipTap editor's/renderer's job, not this data-layer transform's; this
// schema only needs to guarantee the shape lib/notes/document.ts's
// deriveTitle/toPlainText can safely walk. `.passthrough()` keeps every
// TipTap-specific field this schema doesn't know about (attrs, marks, ...)
// intact on the parsed value, since that parsed value is what gets written
// back to `notes.content` -- stripping unknown keys here would silently
// corrupt a document's formatting/attributes on every save.
const tiptapNodeSchema: z.ZodType<{ type: string; text?: string; content?: unknown[] }> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      text: z.string().optional(),
      content: z.array(tiptapNodeSchema).optional(),
    })
    .passthrough(),
);

// notes.content's default doc (`{"type":"doc","content":[]}`, the migration)
// is the shape every write must at least match.
export const tiptapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema),
}) as z.ZodType<TipTapDocument>;

// ============================================================================
// Categories
// ============================================================================

export const createCategorySchema = z.object({
  name,
  icon,
});

export const renameCategorySchema = z.object({
  categoryId: z.uuid(),
  name,
  icon,
});

export const deleteCategorySchema = z.object({
  categoryId: z.uuid(),
});

// Reorder within the flat note_categories list -- same "index, not a raw
// position" shape as lib/boards/schemas.ts's moveCardSchema / lib/recipes/
// schemas.ts's moveRecipeSchema, scoped down to one id since a category never
// changes parent (there is no cross-list move for a category, only a
// same-list reorder).
export const reorderCategorySchema = z.object({
  categoryId: z.uuid(),
  targetIndex: z.int().nonnegative(),
});

// ============================================================================
// Notes
// ============================================================================

// A new note is created empty (notes.content defaults to an empty-but-valid
// doc, the migration) and lands at the end of its category -- title/
// content_text only get real values from the first updateNoteContent call
// (see this file's header + document.ts's header comment on why title
// derivation isn't a database trigger).
export const createNoteSchema = z.object({
  categoryId: z.uuid(),
});

// The single write path for a note's body (#228 ticket decision 2): `content`
// and the server-derived `title`/`content_text` are always written together,
// in the one action below -- there is no schema here that accepts `title` on
// its own, precisely so no caller can write `title` without `content_text`.
export const updateNoteContentSchema = z.object({
  noteId: z.uuid(),
  content: tiptapDocumentSchema,
});

export const deleteNoteSchema = z.object({
  noteId: z.uuid(),
});

// Drag & drop persistence (ADR-0015, 20260813000002_move_note_rpc.sql's
// public.move_note) -- same shape as moveRecipeSchema/moveCardSchema above.
export const moveNoteSchema = z.object({
  noteId: z.uuid(),
  categoryId: z.uuid(),
  targetIndex: z.int().nonnegative(),
});

// searchNotes' search box (#231 builds the UI, the query lives in
// lib/notes/queries.ts). Empty string is valid input -- searchNotes itself
// trims/empty-guards it and returns `[]` rather than the whole list, so this
// only bounds length against a pathological payload, same reasoning as
// lib/recipes/schemas.ts's searchIngredientsSchema.
export const searchNotesSchema = z.object({
  query: z.string().max(200),
});

// #341: the `[[` menu's server action input.
export const searchNoteLinkTargetsSchema = z.object({
  noteId: z.uuid(),
  query: z.string().max(200),
});

export const noteImageParamsSchema = z.object({
  noteId: z.uuid(),
  imageId: z.uuid(),
});

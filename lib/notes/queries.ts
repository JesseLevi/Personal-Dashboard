import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { embeddedCounts } from "@/lib/ui/embedded-counts";
import { getAuthenticatedUserId } from "@/lib/notes/session";
import type { Database } from "@/lib/database.types";
import type { CategoryWithNotes, NoteCategoryRow, NoteRow, NoteSummaryRow } from "@/lib/notes/types";

// Read side of #228 (mirrors lib/recipes/queries.ts). Every function filters
// on the signed-in user's id in addition to relying on RLS (see the "don't
// trust the client for ownership" note on #92, applied here the same way)
// and never throws a database-shaped error message -- the real detail goes
// to the server console only.

type Client = SupabaseClient<Database>;

// Card display cap for the overview's snippet -- same number and same
// reasoning as lib/notes/document.ts's TITLE_MAX_LENGTH (matches
// lib/recipes/schemas.ts's `title` max(200), this codebase's one existing
// precedent for a one-line/short-text display cap). Independent constant
// (not imported from document.ts) because a snippet is a substring of
// content_text, not a derived title -- no ellipsis-and-trim behaviour is
// shared between the two, just the same numeric cap.
const SNIPPET_MAX_LENGTH = 200;

function snippetFrom(contentText: string): string {
  const trimmed = contentText.trim();
  if (trimmed.length <= SNIPPET_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

// Exact shape of getNoteCategoriesWithNotes' nested select -- declared once
// rather than inferred, same reasoning as lib/recipes/queries.ts's
// RawCategoryQueryRow (a raw multi-level embed string isn't reliably
// inferred by postgrest-js's generics). `content` is deliberately absent
// from both this type and the select string below -- the ticket's explicit
// "haal content jsonb hier niet op" instruction: the overview card never
// needs the full document tree, only content_text (flattened already) to
// derive a snippet from.
interface RawNoteSummaryQueryRow {
  id: string;
  category_id: string;
  title: string;
  content_text: string;
  position: number;
  created_at: string;
  updated_at: string;
}
interface RawCategoryQueryRow extends NoteCategoryRow {
  notes: RawNoteSummaryQueryRow[];
}

/**
 * Every note category belonging to the signed-in user, ordered by
 * `position`, each with its notes nested -- the shape the notes overview
 * (kanban-style) needs in one round trip. Empty array if signed out.
 *
 * Deliberately does NOT select `notes.content` (the full TipTap document
 * jsonb) -- only `content_text` (already-flattened plain text, maintained by
 * updateNoteContent) is fetched, and only to derive a short snippet from.
 * `getNote` below is the only function in this module that reads `content`.
 */
export async function getNoteCategoriesWithNotes(): Promise<CategoryWithNotes[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("note_categories")
    .select(
      `
      id, user_id, name, icon, position, created_at, updated_at,
      notes (
        id, category_id, title, content_text, position, created_at, updated_at
      )
    `,
    )
    // Explicit ownership filter alongside RLS -- see the module comment. Not
    // repeated on the nested `notes` embed: RLS already scopes it to the
    // same user, same as lib/recipes/queries.ts's recipes embed.
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .overrideTypes<RawCategoryQueryRow[], { merge: false }>();

  if (error) {
    console.error("[notes] getNoteCategoriesWithNotes failed:", error.code, error.message);
    throw new Error("Failed to load note categories");
  }

  return data.map(({ notes, ...category }) => ({
    ...category,
    notes: [...notes]
      .sort((a, b) => a.position - b.position)
      .map(
        (note): NoteSummaryRow => ({
          id: note.id,
          category_id: note.category_id,
          title: note.title,
          created_at: note.created_at,
          updated_at: note.updated_at,
          snippet: snippetFrom(note.content_text),
        }),
      ),
  }));
}

/**
 * One note, including its full `content` jsonb -- for the editor page (later
 * ticket). Returns `null` if the note doesn't exist, isn't owned by the
 * signed-in user, or the caller is signed out.
 */
export async function getNote(noteId: string): Promise<NoteRow | null> {
  const parsedId = z.uuid().safeParse(noteId);
  if (!parsedId.success) return null;

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<NoteRow, { merge: false }>();

  if (error) {
    console.error("[notes] getNote failed:", error.code, error.message);
    throw new Error("Failed to load note");
  }
  return data ?? null;
}

// Escapes ilike's own wildcard characters in user-typed input, same helper
// (and same reasoning) as lib/recipes/queries.ts's private escapeIlike --
// not shared across modules, each domain keeps its own copy (that file's own
// precedent).
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

// searchNotes' per-row shape -- no `position` (search results render as a
// flat list, ordered by recency, never by board position -- the ticket's
// "platte lijst zonder categoriegroepering").
interface RawNoteSearchRow {
  id: string;
  category_id: string;
  title: string;
  content_text: string;
  created_at: string;
  updated_at: string;
}

async function notesMatching(
  supabase: Client,
  userId: string,
  column: "title" | "content_text",
  pattern: string,
  limit: number,
) {
  return supabase
    .from("notes")
    // #230: `created_at` added purely to satisfy `NoteSummaryRow`'s shared
    // shape (the board's Sorteer dropdown needs it) -- searchNotes itself
    // still orders by `updated_at` only, unchanged.
    .select("id, category_id, title, content_text, created_at, updated_at")
    .eq("user_id", userId)
    .ilike(column, pattern)
    .order("updated_at", { ascending: false })
    .limit(limit)
    .overrideTypes<RawNoteSearchRow[], { merge: false }>();
}

/**
 * Textual search across the signed-in user's notes (title + content_text),
 * a flat list with no category grouping -- the shape the search UI (#231)
 * renders results in (Figma node 4067:19985), the ticket's stated design.
 * Empty array for a blank query or a signed-out caller.
 *
 * Two separate `ilike` queries (title, content_text) merged/de-duped in
 * memory rather than one `.or(...)` filter string -- same reasoning as
 * lib/recipes/queries.ts's searchIngredientLibrary: PostgREST's `.or()`
 * syntax needs its own comma/parenthesis escaping on top of ilike's, and
 * avoiding it here is simpler and safer. Both `notes.title`/
 * `notes.content_text` are pg_trgm-indexed (20260813000001_note_schema.sql),
 * so an `ilike '%...%'` substring match on either still uses the index
 * rather than a sequential scan.
 */
export async function searchNotes(query: string, limit = 20): Promise<NoteSummaryRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const pattern = `%${escapeIlike(trimmed)}%`;

  const [byTitle, byContentText] = await Promise.all([
    notesMatching(supabase, userId, "title", pattern, limit),
    notesMatching(supabase, userId, "content_text", pattern, limit),
  ]);

  if (byTitle.error || byContentText.error) {
    const error = byTitle.error ?? byContentText.error!;
    console.error("[notes] searchNotes failed:", error.code, error.message);
    throw new Error("Failed to search notes");
  }

  // De-dupe: a note could plausibly match both title and content_text for
  // the same query, and must only appear once. Sorted by updated_at
  // (freshest first, same order both queries already fetched in) and
  // re-sliced to `limit` since the merge of two `limit`-capped result sets
  // can exceed it.
  const byId = new Map<string, RawNoteSearchRow>();
  for (const row of [...byTitle.data, ...byContentText.data]) {
    byId.set(row.id, row);
  }

  return [...byId.values()]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
    .map(({ content_text, ...note }): NoteSummaryRow => ({
      ...note,
      snippet: snippetFrom(content_text),
    }));
}

/**
 * Notes per category in `position` order — count-only read for the loading
 * skeleton (embedded `notes(count)`, no content). Empty array if signed out.
 */
export async function getNoteCategoryNoteCounts(): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("note_categories")
    .select("id, notes(count)")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .overrideTypes<Array<{ id: string; notes: Array<{ count: number }> }>, { merge: false }>();

  if (error) {
    console.error("[notes] getNoteCategoryNoteCounts failed:", error.code, error.message);
    throw new Error("Failed to load note category counts");
  }
  return embeddedCounts(data, "notes");
}

/* #340 (ADR-0023): note links ------------------------------------------- */

export interface BacklinkRow {
  id: string;
  title: string;
  category_id: string;
  category_name: string;
}

interface RawBacklinkQueryRow {
  source: {
    id: string;
    title: string;
    category_id: string;
    updated_at: string;
    note_categories: { name: string } | null;
  } | null;
}

/**
 * Notes that link to `noteId` ("Gelinkt vanuit"), most recently updated
 * first, each with its category name. Empty array for an invalid id, a
 * signed-out caller, or a note nobody links to. RLS scopes both the link rows
 * and the embedded source notes to the signed-in user.
 */
export async function getBacklinks(noteId: string): Promise<BacklinkRow[]> {
  const parsedId = z.uuid().safeParse(noteId);
  if (!parsedId.success) return [];

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("note_links")
    .select(
      "source:notes!note_links_source_note_id_fkey(id, title, category_id, updated_at, note_categories(name))",
    )
    .eq("target_note_id", parsedId.data)
    .eq("user_id", userId)
    .overrideTypes<RawBacklinkQueryRow[], { merge: false }>();

  if (error) {
    console.error("[notes] getBacklinks failed:", error.code, error.message);
    throw new Error("Failed to load backlinks");
  }

  return data
    .flatMap((row) => (row.source ? [row.source] : []))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(
      (source): BacklinkRow => ({
        id: source.id,
        title: source.title,
        category_id: source.category_id,
        category_name: source.note_categories?.name ?? "",
      }),
    );
}

/**
 * Current titles for a set of note ids, as a `{ [noteId]: title }` record, in
 * one RLS-scoped query. Ids that don't exist (deleted target) or aren't the
 * caller's are simply absent -- the renderer shows its "deleted note" state
 * for those (ADR-0023 §2). Invalid ids are ignored.
 */
export async function resolveNoteTitles(ids: string[]): Promise<Record<string, string>> {
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  if (valid.length === 0) return {};

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return {};

  const { data, error } = await supabase
    .from("notes")
    .select("id, title")
    .in("id", valid)
    .eq("user_id", userId)
    .overrideTypes<Array<{ id: string; title: string }>, { merge: false }>();

  if (error) {
    console.error("[notes] resolveNoteTitles failed:", error.code, error.message);
    throw new Error("Failed to resolve note titles");
  }
  return Object.fromEntries(data.map((note) => [note.id, note.title]));
}

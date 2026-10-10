// Pure TipTap-document transforms for #228 -- no Supabase import, no
// "server-only" guard, same "framework-free so it's unit-testable without a
// database" shape as lib/boards/positioning.ts's nextPosition. Both
// deriveTitle and toPlainText are called server-side, from
// app/(app)/notities/actions.ts's updateNoteContent (see that file), but
// nothing here depends on that caller.
//
// User decision 2026-08-13 (issue #225's migration header, restated by
// #228's ticket body): notes.title is the first line of the TipTap document,
// derived at save time by the server action, never by a database trigger
// (flattening an arbitrary jsonb node tree isn't expressible as a Postgres
// generated-column expression). notes.content_text is the full flattened
// plain text, indexed by pg_trgm for search (searchNotes, lib/notes/queries.ts).

/**
 * Minimal structural shape of a TipTap node this module needs to walk the
 * tree and extract text -- not a full TipTap type import (no runtime TipTap
 * dependency exists in lib/ yet, and this module only ever reads `type`/
 * `content`/`text`). `attrs`/`marks`/other TipTap-specific fields are simply
 * ignored here; validating a stored document against the app's fixed
 * extension whitelist (data-layer.md, Architecture §7) is the editor's job
 * (a later ticket), not this data-layer transform's.
 */
export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
}

export interface TipTapDocument {
  type: "doc";
  content: TipTapNode[];
}

// Node types that end a "line" in the flattened plain text -- every other
// node type (bulletList/orderedList wrappers, table, marks, text/hardBreak
// leaves) contributes no line break of its own, it just nests. Deliberately
// structural rather than an exhaustive TipTap schema: a heading/paragraph/
// codeBlock/blockquote/listItem each read as one line, and so does a tableRow
// (cells tab-separated, see flatten), so a document that *starts* with a table
// derives its title from the first row (deriveTitle's test,
// tests/notes-document.test.ts).
const LINE_ENDING_TYPES = new Set([
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
  "listItem",
  // #329: a checklist item reads as one line, same as a listItem. Deliberately
  // NO check-box glyph prefix: a prefix would put "☐ " in front of the derived
  // title when a note starts with a checklist, and adds noise to search.
  "taskItem",
  "tableRow",
  // #336: a collapsible section is `details` > `detailsSummary` (one line) +
  // `detailsContent` (ordinary blocks, each ending its own line). Both are
  // flattened whether the section is open or collapsed, so a note stays
  // searchable by text it hides.
  "detailsSummary",
]);

function flatten(node: TipTapNode): string {
  if (node.type === "text") return node.text ?? "";
  // hardBreak (Shift+Enter) is a genuine mid-block line break, same as a
  // LINE_ENDING_TYPES node's trailing newline below -- both get collapsed by
  // toPlainText's regex the same way, so it doesn't need special-casing there.
  if (node.type === "hardBreak") return "\n";

  // #330: a table row is one line, its cells separated by a tab (a cell's own
  // line breaks collapse to spaces); trailing empty cells add no tabs.
  if (node.type === "tableRow") {
    const cells = (node.content ?? []).map((cell) =>
      (cell.content ?? []).map(flatten).join("").replace(/\n+/g, " ").trim(),
    );
    const line = cells.join("\t").replace(/\t+$/, "");
    return line.trim() === "" ? "" : `${line}\n`;
  }

  const inner = (node.content ?? []).map(flatten).join("");
  return LINE_ENDING_TYPES.has(node.type) ? `${inner}\n` : inner;
}

/**
 * Flattens a TipTap document to plain text, one line per block-level node
 * (paragraph/heading/codeBlock/blockquote/list item/table row/table cell).
 * This is `notes.content_text` (supabase/migrations/20260813000001_note_schema.sql),
 * maintained by updateNoteContent in the same write as `content` -- never a
 * separate call.
 *
 * Empty document, or a document containing only empty/whitespace blocks,
 * returns `""` -- never `"\n"` or other line-break-only noise (trimmed at
 * the end after collapsing consecutive newlines produced by nested
 * LINE_ENDING_TYPES, e.g. a listItem's own paragraph plus the listItem's own
 * newline).
 */
export function toPlainText(doc: TipTapDocument): string {
  const raw = (doc.content ?? []).map(flatten).join("");
  return raw.replace(/\n{2,}/g, "\n").trim();
}

// Matches lib/recipes/schemas.ts's `title` field's own `max(200)` -- this
// codebase's one existing precedent for "how long is a one-line title
// allowed to be" (a recipe's user-typed title is capped at the same length),
// so a note's derived title reuses that number rather than inventing a
// second, arbitrary one. Overflow gets a trailing ellipsis so a truncated
// title still reads as truncated rather than as if the note's first line
// genuinely ended there.
const TITLE_MAX_LENGTH = 200;

/**
 * Derives `notes.title` from the document's first line (user decision
 * 2026-08-13, see this file's header comment) -- literally `toPlainText`'s
 * output up to its first `"\n"`, trimmed and capped at `TITLE_MAX_LENGTH`.
 * A brand-new or content-less note (empty doc, or only an empty paragraph)
 * derives `""`, which `notes.title text not null` already accepts as valid
 * (the migration's own file-header note).
 */
export function deriveTitle(doc: TipTapDocument): string {
  const firstLine = (toPlainText(doc).split("\n")[0] ?? "").replace(/\t+/g, " ").trim();
  if (firstLine.length <= TITLE_MAX_LENGTH) return firstLine;
  return `${firstLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/* #340 (ADR-0023): note links ------------------------------------------- */

/** The inline node type the editor uses for a link to another note (#341). */
export const NOTE_LINK_NODE_TYPE = "noteLink";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LinkAwareNode {
  type: string;
  attrs?: { noteId?: unknown };
  content?: LinkAwareNode[];
}

/**
 * Distinct target note ids of every `noteLink` node in the document, in
 * document order. Attribute values that aren't uuids are skipped, so a
 * malformed node never reaches the `save_note_content` RPC's uuid[] argument.
 */
export function extractNoteLinkIds(doc: TipTapDocument): string[] {
  const ids = new Set<string>();
  const walk = (node: LinkAwareNode) => {
    if (node.type === NOTE_LINK_NODE_TYPE) {
      const id = node.attrs?.noteId;
      if (typeof id === "string" && UUID_RE.test(id)) ids.add(id.toLowerCase());
    }
    for (const child of node.content ?? []) walk(child);
  };
  for (const node of doc.content ?? []) walk(node as LinkAwareNode);
  return [...ids];
}

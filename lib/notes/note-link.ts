import { extractNoteLinkIds, type TipTapDocument } from "./document";

// #341 (ADR-0023): the read-time side of a `noteLink` node. The node stores
// `noteId` + `label` (the target's title when it was inserted); what the editor
// SHOWS is the target's current title, resolved server-side for the note being
// opened (lib/notes/queries.ts resolveNoteTitles) and handed to the editor as
// a `NoteLinkResolution`. Pure and framework-free: no React, no Supabase.

export interface NoteLinkResolution {
  /** Current title per target id, for the ids that still exist. */
  titles: Record<string, string>;
  /** Target ids that were in the document when it opened but no longer exist. */
  missing: readonly string[];
  /** Client-side navigation; without it a click does a full page load. */
  navigate?: (href: string) => void;
}

export const EMPTY_NOTE_LINK_RESOLUTION: NoteLinkResolution = { titles: {}, missing: [] };

export function noteLinkHref(noteId: string): string {
  return `/notities/${noteId}`;
}

/**
 * Resolution for a freshly loaded document: ids the server could not resolve
 * (deleted, or not the caller's) are `missing` and render the deleted state.
 * A link inserted later in the session is never missing: its target was just
 * picked from the live list, and its stored label is the fallback.
 */
export function buildNoteLinkResolution(
  doc: TipTapDocument,
  titles: Record<string, string>,
): NoteLinkResolution {
  return { titles, missing: extractNoteLinkIds(doc).filter((id) => !(id in titles)) };
}

export type ResolvedNoteLink =
  | { state: "link"; title: string; href: string }
  | { state: "deleted" };

/** What to render for one link: its current title (stored label as fallback), or the deleted state. */
export function resolveNoteLink(
  resolution: NoteLinkResolution,
  noteId: string,
  label: string,
): ResolvedNoteLink {
  const id = noteId.toLowerCase();
  if (resolution.missing.includes(id) && !(id in resolution.titles)) return { state: "deleted" };
  return { state: "link", title: (resolution.titles[id] ?? label).trim(), href: noteLinkHref(id) };
}

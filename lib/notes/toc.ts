// #342 (ADR-0021 s3): helpers for the table-of-contents rail. Pure and
// framework-free, so they are unit-testable without an editor. Rationale:
// design/notes/NoteEditor.md (#342).

/** The rail only appears when the note has at least this many (non-empty) headings. */
export const MIN_TOC_HEADINGS = 3;

export interface TocItem {
  /** The heading's `id` attribute, also its DOM id (scroll target). */
  id: string;
  /** 1-3, the heading's own level. */
  level: number;
  text: string;
}

/**
 * The heading to highlight: the last one whose top has scrolled to or above
 * `threshold`; the first one before any has. At the very bottom of the page
 * the last heading wins, so a short final section can still become active.
 */
export function pickActiveId(
  tops: ReadonlyArray<{ id: string; top: number }>,
  threshold: number,
  atBottom = false,
): string | null {
  if (tops.length === 0) return null;
  if (atBottom) return tops[tops.length - 1].id;
  let active = tops[0].id;
  for (const entry of tops) {
    if (entry.top <= threshold) active = entry.id;
    else break;
  }
  return active;
}

// figma: node-id=4067:18495
import clsx from "clsx";

/**
 * Molecule/Card-content/Note — Figma component "Card-content/Note"
 * (node-id 4067:18495, Card-contents section, Development page). Row
 * (title FILL, timestamp HUG, space-between) above a snippet line. Figma's
 * layer names are all "Recepi name" copy-paste residue from Card-content/
 * Recipe — no naming signal, left uncorrected in the file per the ticket.
 * `title`/`timestamp`/`snippet` are all caller-supplied, already-formatted
 * strings — no date logic here (ADR-0007, i18n belongs to the caller). See
 * design/notes/CardContentNote.md.
 * Snippet is clamped to 2 lines (product decision #307, deviates from Figma).
 */
export interface CardContentNoteProps {
  /** Figma TEXT "Note title" — note title (first line of the document). */
  title: string;
  /** Figma TEXT "12:24" — already-formatted relative timestamp (also seen as "Gisteren"/"12-03-2026" in the fetched design). Not formatted here. */
  timestamp: string;
  /** Figma TEXT "Text from note that could be this long." — note body preview. */
  snippet: string;
  className?: string;
}

export function CardContentNote({
  title,
  timestamp,
  snippet,
  className,
}: CardContentNoteProps) {
  return (
    <div className={clsx("flex w-full flex-col gap-stack-xs p-component-sm", className)}>
      <div className="flex w-full items-center justify-between">
        <p className="min-w-0 flex-1 text-base font-semibold text-text-primary">{title}</p>
        <p className="shrink-0 text-xs font-semibold text-text-secondary">{timestamp}</p>
      </div>
      <p className="line-clamp-2 w-full text-sm font-medium text-text-secondary">{snippet}</p>
    </div>
  );
}

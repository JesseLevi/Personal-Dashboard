// #337: pure helpers for "Exporteer als .md" -- no TipTap import, so this
// stays in the initial chunk at no cost. The markdown itself is produced by
// the lazily loaded lib/notes/markdown.ts.

const FORBIDDEN_FILENAME_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_BASENAME_LENGTH = 100;

/**
 * Turns the derived note title into a safe `.md` filename: path separators and
 * other filesystem-hostile characters removed, whitespace collapsed, leading
 * dots stripped (no hidden files, no `..`), length capped. An empty result
 * falls back to `fallback` (the translated "Untitled note").
 */
export function markdownFilename(title: string, fallback: string): string {
  const cleaned = title
    .replace(FORBIDDEN_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, MAX_BASENAME_LENGTH)
    .trim();
  const base = cleaned || fallback.replace(FORBIDDEN_FILENAME_CHARS, " ").trim() || "note";
  return `${RESERVED_WINDOWS_NAMES.test(base) ? `${base}_` : base}.md`;
}

/** Client-only: hands `markdown` to the browser as a downloaded `.md` file. */
export function downloadMarkdown(markdown: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

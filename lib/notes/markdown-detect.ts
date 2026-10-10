// #337: cheap, synchronous "does this pasted plain text look like markdown?"
// check. Kept free of @tiptap/markdown on purpose: the paste handler needs an
// instant answer (ProseMirror's handlePaste is synchronous) while the parser
// itself is loaded lazily (lib/notes/markdown.ts), only once this says yes.
//
// Block-level markers only (heading, list, task, quote, fence, table
// separator). Inline markers alone (`*`, `_`, `[x](y)`) are too common in
// ordinary prose to justify rewriting what the user pasted.
const BLOCK_MARKERS: RegExp[] = [
  /^ {0,3}#{1,6}\s+\S/, // heading
  /^\s*[-*+]\s+\[[ xX]\]\s/, // task item
  /^\s*[-*+]\s+\S/, // bullet
  /^\s*\d{1,9}[.)]\s+\S/, // ordered
  /^ {0,3}>\s?\S/, // quote
  /^ {0,3}<details[\s>]/, // collapsible section
  /^ {0,3}(```|~~~)/, // code fence
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/, // table separator row
];

export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length > 2_000_000) return false;
  return text.split(/\r?\n/).some((line) => BLOCK_MARKERS.some((marker) => marker.test(line)));
}

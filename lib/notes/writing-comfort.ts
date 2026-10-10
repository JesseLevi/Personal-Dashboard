import { Typography } from "@tiptap/extension-typography";

// Editor-only input rules (they never change stored content structure), so
// this is applied at the NoteEditor.tsx call site, not in the content
// whitelist lib/notes/extensions.ts. Quote style follows the next-intl
// locale; code marks/blocks are excluded by the extension itself.
// Rationale: design/notes/NoteEditor.md.
export function typographyForLocale(locale: string) {
  if (locale.startsWith("nl")) {
    return Typography.configure({
      openDoubleQuote: "„",
      closeDoubleQuote: "”",
      openSingleQuote: "‚",
      closeSingleQuote: "’",
    });
  }
  return Typography.configure({
    openDoubleQuote: "“",
    closeDoubleQuote: "”",
    openSingleQuote: "‘",
    closeSingleQuote: "’",
  });
}

const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w !== "").length;
}

/** Whole minutes, at least 1 once there is any text. */
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

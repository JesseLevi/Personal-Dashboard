const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/** Lower-cases and strips diacritics, so "Café" and "cafe" compare equal. */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

const wordsOf = (text: string): string[] => normalizeForMatch(text).split(WORD_SPLIT).filter(Boolean);

/** True when every word of `query` is a prefix of some word of `label`; an empty query matches everything. */
export function matchesQuery(label: string, query: string): boolean {
  const queryWords = wordsOf(query);
  if (queryWords.length === 0) return true;
  const labelWords = wordsOf(label);
  return queryWords.every((word) => labelWords.some((labelWord) => labelWord.startsWith(word)));
}

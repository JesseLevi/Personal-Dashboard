// Pure alias-key normalisation (ADR-0020 §2). Client-safe on purpose: the
// server-only matcher re-exports it and the admin alias panel previews the key.

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  // NL descriptors, state and size
  "verse", "vers", "fijngehakte", "gehakte", "fijngesneden", "gesneden", "geraspte",
  "gemalen", "gedroogde", "gedroogd", "biologische", "biologisch", "bio", "grote",
  "groot", "kleine", "klein", "middelgrote", "rijpe", "extra", "vierge",
  // NL function words
  "van", "of", "en", "de", "het", "een", "wat",
  // EN descriptors, state and size
  "fresh", "chopped", "finely", "minced", "diced", "sliced", "grated", "ground",
  "dried", "organic", "large", "small", "medium", "big", "ripe", "virgin",
  // EN function words
  "and", "or", "the", "a", "an", "of",
]);

// Words the plural rules would mangle, or irregular plurals. Keys are already
// lowercase/diacritic-free; "kaas", "ananas", "bloem" etc. pass through the
// rules untouched and are listed in the tests as guards.
const SINGULAR_EXCEPTIONS: Record<string, string> = {
  uien: "ui", eieren: "ei", bladeren: "blad", groen: "groen", olijven: "olijf", citroen: "citroen", peas: "pea",
  chickpeas: "chickpea", leaves: "leaf", knives: "knife", loaves: "loaf",
  radijs: "radijs", mais: "mais", anijs: "anijs", couscous: "couscous", hummus: "hummus",
  asparagus: "asparagus", molasses: "molasses", gras: "gras", bonus: "bonus",
};

const VOWELS = "aeiou";

function isVowel(ch: string | undefined): boolean {
  return ch !== undefined && VOWELS.includes(ch);
}

/** Conservative NL/EN plural to singular for one word; unknown shapes stay as-is. */
function singularize(word: string): string {
  const exception = SINGULAR_EXCEPTIONS[word];
  if (exception !== undefined) return exception;
  if (word.length < 4) return word;

  // EN -ies -> -y (cherries, berries); NL has no such plural.
  if (/[^aeiou]ies$/.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  // EN -es after o/ch/sh/x/ss (tomatoes, peaches, radishes, boxes).
  if (/(o|ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);

  // NL -en: strip, then restore the stem (tomaten -> tomaat, kippen -> kip).
  if (word.endsWith("en") && word.length >= 5) {
    const stem = word.slice(0, -2);
    const last = stem[stem.length - 1];
    const prev = stem[stem.length - 2];
    if (last === prev && !isVowel(last)) return stem.slice(0, -1); // kippen, bessen
    if (!isVowel(last) && isVowel(prev) && !isVowel(stem[stem.length - 3]) && stem.length >= 3) {
      return `${stem.slice(0, -2)}${prev}${prev}${last}`; // tomat -> tomaat
    }
    return stem;
  }

  // Apostrophe plurals (paprika's, kiwi's).
  if (word.endsWith("'s")) return word.slice(0, -2);
  // -s: not after s/u/i/a (kaas, ananas, hummus, radijs-like), which are
  // singular far more often than plural.
  if (word.endsWith("s") && !/[suia]s$/.test(word) && word.length >= 5) return word.slice(0, -1);
  return word;
}

/**
 * Normalises a parsed ingredient name into the key stored in
 * `ingredient_aliases.alias_normalized` and fed to the trigram search:
 * lowercase, diacritics stripped, text after a comma/semicolon and in
 * parentheses dropped, punctuation and whitespace collapsed, descriptor and
 * function words removed, last word singularised. Pure; never returns an
 * empty string for a non-empty name (if every word is a stopword the words
 * are kept).
 */
export function normalizeIngredientName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;]/)[0]
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/['’](?!s\b)/g, "")
    .replace(/-/g, " ");
  const all = base.split(/\s+/).filter(Boolean);
  const kept = all.filter((word) => !STOPWORDS.has(word));
  const words = kept.length > 0 ? kept : all;
  if (words.length === 0) return "";
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(" ");
}

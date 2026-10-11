// Deterministic NL/EN ingredient line parser (#315). Pure and framework-free,
// same house style as units.ts: no Supabase, no server-only, no i18n.
// "1 1/2 el olijfolie (extra vierge)" -> { quantity 1.5, unit eetlepel,
// name "olijfolie", note "extra vierge" }. No LLM: a line this module cannot
// read with confidence is returned as `confidence: "low"` so a later step
// (#317) can pick it up. Matching names to the ingredient library is #316.
//
// Policies (all covered in tests/recipes-parse-ingredient.test.ts):
// - Range ("2-3", "2 tot 3", "2 to 3"): quantity = LOWER bound, the original
//   range text is kept in `note`, so scaling stays safe and nothing is lost.
// - Pack "N x M <unit>" ("2 x 400 g blik tomaten"): quantity N*M in the inner
//   unit (800 gram), original "2 x 400 g" in `note`, so the nutrition
//   calculator gets a measurable amount. Inner count unit multiplies too;
//   inner without unit ("2 x 3 eieren") -> 6 stuk, note "2 x 3"; inner
//   unmapped word -> N*M, unit null, low. Ranges with a pack are not
//   supported and come out low (name keeps the unread text).
// - A quantity with no unit ("2 uien") gets the count unit for "stuk".
//   unit null (no quantity and no unit, or an unmapped measure word) means
//   the persistence step must resolve it: recipe_unit is NOT NULL in the DB.
// - A measure word with no UnitCode (teentje, bosje, cl, ...) is not
//   invented: unit stays null, the raw word goes to `note`, confidence "low".
// - Unit codes appear ONLY in UNIT_ALIASES below; the unit list itself is
//   units.ts's (decided, ADR-0011) and is never extended here.

import { isUnitCode, magnitudeOf, type UnitCode } from "@/lib/recipes/units";

/** Alias (lowercase, no trailing dot) -> UnitCode. The only place codes live. */
export const UNIT_ALIASES = {
  g: "gram", gr: "gram", gram: "gram", grammen: "gram",
  kg: "kilogram", kilo: "kilogram", kilogram: "kilogram",
  oz: "ounce", ounce: "ounce",
  lb: "pound", pound: "pound",
  ml: "milliliter", milliliter: "milliliter",
  dl: "deciliter", deciliter: "deciliter",
  l: "liter", liter: "liter",
  tl: "theelepel", theelepel: "theelepel",
  el: "eetlepel", eetlepel: "eetlepel",
  cup: "cup",
  tsp: "teaspoon", teaspoon: "teaspoon",
  tbsp: "tablespoon", tbs: "tablespoon", tablespoon: "tablespoon",
  "fl oz": "fluid_ounce", "fluid ounce": "fluid_ounce",
  stuk: "stuk", stukken: "stuk", st: "stuk", pc: "stuk", pcs: "stuk", piece: "stuk",
  snufje: "snufje", snuf: "snufje", pinch: "snufje", pinches: "snufje",
  scoop: "scoop", schep: "scoop", schepje: "scoop", schepjes: "scoop",
  "naar smaak": "naar_smaak", "to taste": "naar_smaak",
} as const satisfies Record<string, UnitCode>;

/** Measure words used in kitchens that have no UnitCode (not invented here). */
export const UNMAPPED_UNIT_WORDS: ReadonlySet<string> = new Set([
  "cl", "mespunt", "mespuntje", "handvol", "scheut", "scheutje", "bosje",
  "teen", "teentje", "takje", "plak", "plakje", "blaadje", "klont", "dash",
  "kop", "kopje",
]);

export type ParsedIngredient = {
  kind: "ingredient";
  quantity: number | null;
  unit: UnitCode | null;
  name: string;
  note: string | null;
  raw: string;
  confidence: "high" | "low";
};
export type ParsedGroup = { kind: "group"; label: string; raw: string };
export type ParsedIngredientLine = ParsedIngredient | ParsedGroup;

const FRACTIONS: Record<string, number> = {
  "½": 1 / 2, "¼": 1 / 4, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 1 / 8,
  "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8, "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5,
  "⅘": 4 / 5, "⅙": 1 / 6, "⅚": 5 / 6,
};
const FR = Object.keys(FRACTIONS).join("");
// mixed ASCII, mixed unicode, ASCII fraction, unicode fraction, decimal/integer
const QTY = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${FR}]|\\d+\\/\\d+|[${FR}]|\\d+(?:[.,]\\d+)?)`;
const MULT_RE = new RegExp(`^(${QTY})\\s*[x×]\\s*(${QTY})\\s*`, "u");
const RANGE_RE = new RegExp(`^(${QTY})\\s*(?:[-–—]|\\b(?:tot|to)\\b)\\s*(${QTY})(?![\\d/])\\s*`, "u");
const SINGLE_RE = new RegExp(`^(${QTY})\\s*`, "u");
const OF_RE = /^(?:van|of)\s+/i;

function toNumber(text: string): number {
  const s = text.trim();
  const frac = [...s].find((c) => c in FRACTIONS);
  if (frac !== undefined) {
    const whole = s.replace(frac, "").trim();
    return (whole === "" ? 0 : Number(whole)) + (FRACTIONS[frac] ?? Number.NaN);
  }
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const simple = /^(\d+)\/(\d+)$/.exec(s);
  if (simple) return Number(simple[1]) / Number(simple[2]);
  return Number(s.replace(",", "."));
}

type UnitMatch =
  | { kind: "unit"; code: UnitCode; word: string; rest: string }
  | { kind: "unmapped"; word: string; rest: string };

function lookupWord(word: string): UnitCode | null {
  const aliases: Record<string, string> = UNIT_ALIASES;
  const w = word.toLowerCase();
  const hit = aliases[w] ?? aliases[w.replace(/s$/, "")];
  return hit !== undefined && isUnitCode(hit) ? hit : null;
}

/** Reads a unit at the start of `text` (multi-word aliases first). */
function matchUnit(input: string): UnitMatch | null {
  const text = input.replace(/^fl\.\s*oz\b\.?/i, "fl oz");
  const lower = text.toLowerCase();
  for (const alias of Object.keys(UNIT_ALIASES).filter((a) => a.includes(" "))) {
    if (lower === alias || lower.startsWith(`${alias} `)) {
      const code = lookupWord(alias);
      if (code) return { kind: "unit", code, word: alias, rest: text.slice(alias.length).trim() };
    }
  }
  const m = /^(\p{L}+)\.?(?=\s|$)/u.exec(text);
  if (!m?.[1]) return null;
  const rest = text.slice(m[0].length).trim();
  const code = lookupWord(m[1]);
  if (code) return { kind: "unit", code, word: m[1], rest };
  const w = m[1].toLowerCase();
  if (UNMAPPED_UNIT_WORDS.has(w) || UNMAPPED_UNIT_WORDS.has(w.replace(/(?:en|s|je)$/, ""))) {
    return { kind: "unmapped", word: m[1], rest };
  }
  return null;
}

export function parseIngredientLine(raw: string): ParsedIngredientLine {
  let text = raw.trim().replace(/\s+/g, " ").replace(/^[-•*–]\s+/, "");

  // Group heading: trailing colon, or an all-caps line with no digits.
  if (/^[^\p{Ll}\d]*\p{Lu}[^\p{Ll}\d]*\p{Lu}[^\p{Ll}\d]*$/u.test(text) || /^[^\d]*:$/.test(text)) {
    return { kind: "group", label: text.replace(/:$/, "").trim(), raw };
  }

  const parens: string[] = [];
  text = text.replace(/\s*\(([^()]*)\)/g, (_m, inner: string) => {
    if (inner.trim()) parens.push(inner.trim());
    return "";
  });

  let unit: UnitCode | null = null;
  const taste = /(?:,\s*|\s+)(naar smaak|to taste)\s*$/i.exec(text);
  if (taste?.[1]) {
    unit = lookupWord(taste[1]);
    text = text.slice(0, taste.index).trim();
  }

  let prep: string | null = null;
  const comma = /,(?=\s|$)/.exec(text);
  if (comma) {
    prep = text.slice(comma.index + 1).trim() || null;
    text = text.slice(0, comma.index).trim();
  }

  let quantity: number | null = null;
  let low = false;
  let packNote: string | null = null;
  let rangeNote: string | null = null;
  let unmappedWord: string | null = null;
  let rest = text;

  const mult = MULT_RE.exec(rest);
  const range = mult ? null : RANGE_RE.exec(rest);
  const single = mult || range ? null : SINGLE_RE.exec(rest);
  if (mult?.[1] && mult[2]) {
    const packs = toNumber(mult[1]);
    const inner = toNumber(mult[2]);
    quantity = packs * inner;
    rest = rest.slice(mult[0].length);
    const pack = matchUnit(rest);
    const innerText = `${mult[1].trim()} x ${mult[2].trim()}`;
    if (pack?.kind === "unit") {
      unit = pack.code;
      packNote = `${innerText} ${pack.word}`;
      rest = pack.rest;
    } else if (pack) {
      unmappedWord = pack.word;
      packNote = innerText;
      rest = pack.rest;
      low = true;
    } else {
      unit = lookupWord("stuk");
      packNote = innerText;
    }
  } else if (range?.[1] && range[2]) {
    quantity = toNumber(range[1]);
    rangeNote = range[0].trim();
    rest = rest.slice(range[0].length);
  } else if (single?.[1]) {
    quantity = toNumber(single[1]);
    rest = rest.slice(single[0].length);
  }
  if (quantity !== null && !Number.isFinite(quantity)) {
    quantity = null;
    low = true;
  }

  if (!mult) {
    let candidate = rest;
    let article = false;
    if (quantity === null) {
      const art = /^(?:een|a|an)\s+(.+)$/i.exec(rest);
      if (art?.[1] && matchUnit(art[1])) {
        candidate = art[1];
        article = true;
      }
    }
    const match = matchUnit(candidate);
    if (match) {
      rest = match.rest.replace(OF_RE, "");
      if (article) quantity = 1;
      if (match.kind === "unit") {
        unit = match.code;
        if (quantity === null && magnitudeOf(unit) !== "count") low = true;
      } else {
        unmappedWord = match.word;
        low = true;
      }
    }
  }

  if (quantity !== null && unit === null && unmappedWord === null) unit = lookupWord("stuk");

  const name = rest.replace(/^[\s,.;:]+|[\s,.;]+$/g, "");
  if (name === "" || !/^\p{L}/u.test(name) || /[\d()]/.test(name)) low = true;

  const notes = [rangeNote, packNote, unmappedWord, ...parens, prep].filter((n): n is string => !!n);
  return {
    kind: "ingredient",
    quantity,
    unit,
    name,
    note: notes.length ? notes.join("; ") : null,
    raw,
    confidence: low ? "low" : "high",
  };
}

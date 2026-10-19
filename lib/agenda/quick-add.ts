import { en as chronoEn, nl as chronoNl } from "chrono-node";
import { localDateTime } from "@/lib/agenda/map";
import type { RepeatChoice } from "@/lib/agenda/repeat";
import { AGENDA_TIME_ZONE, addDays, startOfWeek } from "@/lib/agenda/time";
import type { MealSlot } from "@/lib/agenda/types";

// Quick add (ADR-0041): plain text in, a proposal out. Pure and client-safe; nothing leaves the device.
// Own rules take the parts Dutch chrono-node does not know (times like "20u", "10:30-12:00", "23-10",
// "overmorgen", "volgende week woensdag", names, places, repeats); chrono-node reads the rest of the day.

export type QuickAddLocale = "nl" | "en";
export type QuickAddKind = "event" | "meal" | "todo";
export type QuickAddSpanKind = "when" | "time" | "person" | "place" | "repeat" | "moment";

export interface QuickAddSpan {
  start: number;
  end: number;
  kind: QuickAddSpanKind;
}

export interface QuickAddCategory {
  id: string;
  name: string | null;
  isDefault: boolean;
}

export interface QuickAddContext {
  locale: QuickAddLocale;
  /** The moment of typing; "today" and the coming Friday are read in the Agenda zone. */
  now: Date;
  /** The user's own categories (ADR-0040); without them no category is suggested. */
  categories?: readonly QuickAddCategory[];
  /** Recipes a meal can name. */
  recipes?: readonly { id: string; title: string }[];
  /** The kind the user picked; the text is then read as that kind. */
  kind?: QuickAddKind;
}

export interface QuickAddResult {
  /** The picked kind, else the detected one. */
  kind: QuickAddKind;
  /** What the text alone says, whatever was picked. */
  autoKind: QuickAddKind;
  /** The text without the recognised parts, first letter capitalised; "" when nothing is left. */
  title: string;
  /** `YYYY-MM-DD`; null when the text names no day (the caller falls back to today or the slot). */
  date: string | null;
  /** `HH:mm`; null without a time. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  /** The text says "hele dag" itself, so a slot's time does not apply. */
  explicitAllDay: boolean;
  people: string[];
  place: string | null;
  repeat: RepeatChoice;
  /** The suggested category (a name in the text wins, then keywords, then the default one); null without categories. */
  categoryId: string | null;
  /** Meal moment; null when the text names none (the caller uses dinner). */
  slot: MealSlot | null;
  /** The recipe the title names, if one fits all its words. */
  recipeId: string | null;
  /** What to search recipes for: the title without the moment word. */
  recipeQuery: string;
  spans: QuickAddSpan[];
}

const MASK = "\u0001";
const WORD = "(?:['’]s|\\p{L}[\\p{L}'’-]*)";

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

interface LocaleRules {
  chrono: Pick<typeof chronoNl, "parse">;
  weekdays: Record<string, number>;
  months: string[];
  /** Words that end a name or place. */
  stop: string[];
  with: string;
  at: string | null;
  and: string;
  nextWeek: string;
  allDay: RegExp;
  partOfDay: RegExp;
  todo: RegExp;
  slots: Record<string, MealSlot>;
  social: string[];
  sport: string[];
  /** Groups `unit` ("elke week") or `adverb` ("wekelijks"). */
  repeatEvery: RegExp;
  repeatEveryWeekday: (weekdays: string) => RegExp;
  repeatOther: RegExp;
  repeatWords: Record<string, RepeatChoice>;
  dayAfterTomorrow: RegExp | null;
  stopWordsForRecipes: string[];
}

const NL_WEEKDAYS: Record<string, number> = {
  zondag: 0, zo: 0, maandag: 1, ma: 1, dinsdag: 2, di: 2, woensdag: 3, wo: 3,
  donderdag: 4, do: 4, vrijdag: 5, vr: 5, zaterdag: 6, za: 6,
};
const EN_WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const NL_MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december", "jan", "feb", "mrt", "apr", "jun", "jul", "aug", "sep", "sept", "okt", "nov", "dec"];
const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"];

const names = (record: Record<string, number>) => Object.keys(record).sort((a, b) => b.length - a.length).join("|");

const RULES: Record<QuickAddLocale, LocaleRules> = {
  nl: {
    chrono: chronoNl,
    weekdays: NL_WEEKDAYS,
    months: NL_MONTHS,
    stop: [
      "op", "om", "van", "tot", "bij", "in", "naar", "voor", "na", "over", "vandaag", "morgen", "overmorgen",
      "volgende", "deze", "komende", "aanstaande", "hele", "de", "het", "een", "met", "en", "'s", "u", "uur",
      "elke", "elk", ...Object.keys(NL_WEEKDAYS),
    ],
    with: "met",
    at: "bij",
    and: "en",
    nextWeek: "volgende\\s+week",
    allDay: /\b(?:de\s+)?hele\s+dag\b/i,
    partOfDay: /(?<![\p{L}])['’]s\s*(avonds|middags|ochtends|morgens|nachts)(?![\p{L}])/iu,
    todo: /\b(?:bellen|bel|regelen|kopen|koop|betalen|betaal|opzeggen|mailen|mail|bestellen|bestel|aanvragen|inleveren|repareren|verlengen|todo|taak)\b/i,
    slots: { ontbijt: "breakfast", brunch: "lunch", lunch: "lunch", diner: "dinner", avondeten: "dinner", snack: "snack", tussendoortje: "snack" },
    social: ["film", "bios", "bioscoop", "borrel", "etentje", "diner", "lunch", "koffie", "drankje", "feest", "verjaardag", "barbecue", "bbq", "concert", "theater", "uitje", "spelletjesavond"],
    sport: ["sport", "gym", "padel", "hardlopen", "fitness", "voetbal", "tennis", "zwemmen", "yoga", "squash", "wielrennen", "hockey", "bootcamp", "klimmen", "pilates"],
    repeatEvery: /\b(?:elke?\s+(?<unit>dag|week|maand|jaar)|(?<adverb>dagelijks|wekelijks|maandelijks|jaarlijks))\b/i,
    repeatEveryWeekday: (weekdays) => new RegExp(`\\belke\\s+(${weekdays})\\b`, "i"),
    repeatOther: /\b(?:om\s+de\s+(?:2\s+|twee\s+)?wee?k(?:en)?|elke\s+andere\s+week|tweewekelijks)\b/i,
    repeatWords: { dag: "daily", week: "weekly", maand: "monthly", jaar: "yearly", dagelijks: "daily", wekelijks: "weekly", maandelijks: "monthly", jaarlijks: "yearly" },
    dayAfterTomorrow: /\bovermorgen\b/i,
    stopWordsForRecipes: ["de", "het", "een", "met", "en", "van", "voor", "bij", "op", "om"],
  },
  en: {
    chrono: chronoEn,
    weekdays: EN_WEEKDAYS,
    months: EN_MONTHS,
    stop: [
      "on", "at", "from", "to", "until", "by", "in", "for", "after", "tomorrow", "today", "tonight", "next", "this",
      "coming", "the", "a", "an", "with", "and", "'s", "noon", "midnight", "every", "all", "day",
      ...Object.keys(EN_WEEKDAYS),
    ],
    with: "with",
    at: "at",
    and: "and",
    nextWeek: "next\\s+week",
    allDay: /\ball[\s-]day\b/i,
    partOfDay: /\bin\s+the\s+(morning|afternoon|evening)\b/i,
    todo: /\b(?:call|buy|pay|cancel|email|order|renew|submit|repair|fix|arrange|todo|task)\b/i,
    slots: { breakfast: "breakfast", brunch: "lunch", lunch: "lunch", dinner: "dinner", supper: "dinner", snack: "snack" },
    social: ["movie", "movies", "film", "cinema", "drinks", "dinner", "lunch", "brunch", "coffee", "birthday", "party", "concert", "theatre", "theater", "barbecue", "bbq"],
    sport: ["sport", "gym", "padel", "run", "running", "fitness", "football", "soccer", "tennis", "swim", "swimming", "yoga", "squash", "cycling", "hockey", "pilates"],
    repeatEvery: /\b(?:every\s+(?<unit>day|week|month|year)|(?<adverb>daily|weekly|monthly|yearly|annually))\b/i,
    repeatEveryWeekday: (weekdays) => new RegExp(`\\bevery\\s+(${weekdays})\\b`, "i"),
    repeatOther: /\b(?:every\s+other\s+week|every\s+(?:2|two)\s+weeks|biweekly|fortnightly)\b/i,
    repeatWords: { day: "daily", week: "weekly", month: "monthly", year: "yearly", daily: "daily", weekly: "weekly", monthly: "monthly", yearly: "yearly", annually: "yearly" },
    dayAfterTomorrow: /\bday\s+after\s+tomorrow\b/i,
    stopWordsForRecipes: ["the", "a", "an", "with", "and", "of", "for", "at", "on"],
  },
};

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first `weekday` (0 = Sunday) on or after `from`. */
function nextWeekday(from: string, weekday: number): string {
  return addDays(from, (weekday - dayOfWeek(from) + 7) % 7);
}

// ---- recipes -------------------------------------------------------------------------------

function words(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function wordMatches(queryWord: string, recipeWord: string): boolean {
  if (queryWord === recipeWord) return true;
  if (queryWord.length >= 3 && recipeWord.startsWith(queryWord)) return true;
  return recipeWord.length >= 4 && queryWord.startsWith(recipeWord);
}

function recipeScore(queryWords: readonly string[], title: string): number {
  const recipeWords = words(title);
  return queryWords.filter((word) => recipeWords.some((candidate) => wordMatches(word, candidate))).length;
}

/** Recipes whose title shares words with `query` (whole words, prefixes and plurals), best first. */
export function rankRecipes<T extends { title: string }>(query: string, recipes: readonly T[]): T[] {
  const queryWords = words(query).filter((word) => word.length >= 2);
  if (queryWords.length === 0) return [];
  return recipes
    .map((recipe) => ({ recipe, score: recipeScore(queryWords, recipe.title), size: words(recipe.title).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.size - b.size || a.recipe.title.localeCompare(b.recipe.title))
    .map((entry) => entry.recipe);
}

// ---- the parser -----------------------------------------------------------------------------

interface Draft {
  text: string;
  masked: string;
  spans: QuickAddSpan[];
}

function claim(draft: Draft, start: number, end: number, kind: QuickAddSpanKind): boolean {
  while (start < end && /\s/.test(draft.text[start])) start += 1;
  while (end > start && /\s/.test(draft.text[end - 1])) end -= 1;
  if (start >= end || draft.spans.some((span) => start < span.end && end > span.start)) return false;
  draft.spans.push({ start, end, kind });
  draft.masked = draft.masked.slice(0, start) + MASK.repeat(end - start) + draft.masked.slice(end);
  return true;
}

interface Grab {
  words: string[];
  end: number;
}

// Takes words after a keyword until a stop word, a masked part or the end; "," and the and-word join names.
function grabWords(text: string, from: number, stop: ReadonlySet<string>, and: string, options: { join: boolean; chain: boolean; max: number }): Grab {
  const re = new RegExp(`\\s*(,|${WORD})`, "uy");
  re.lastIndex = from;
  const grabbed: string[] = [];
  let end = from;
  let joined = true;
  for (let token = re.exec(text); token; token = re.exec(text)) {
    const word = token[1];
    const lower = word.toLowerCase();
    if (word === "," || lower === and) {
      if (grabbed.length === 0 || !options.join) break;
      joined = true;
      continue;
    }
    if (stop.has(lower) || !joined) break;
    grabbed.push(word);
    end = re.lastIndex;
    joined = options.chain;
    if (grabbed.length >= options.max) break;
  }
  return { words: grabbed, end };
}

function parseRepeat(draft: Draft, rules: LocaleRules): { repeat: RepeatChoice; weekday: number | null } {
  const text = draft.masked;
  let match = rules.repeatOther.exec(text);
  if (match && claim(draft, match.index, match.index + match[0].length, "repeat")) return { repeat: "biweekly", weekday: null };
  match = rules.repeatEveryWeekday(names(rules.weekdays)).exec(text);
  if (match && claim(draft, match.index, match.index + match[0].length, "repeat")) {
    return { repeat: "weekly", weekday: rules.weekdays[fold(match[1])] ?? null };
  }
  match = rules.repeatEvery.exec(text);
  if (match && claim(draft, match.index, match.index + match[0].length, "repeat")) {
    return { repeat: rules.repeatWords[fold(match.groups?.unit ?? match.groups?.adverb ?? "")] ?? "none", weekday: null };
  }
  return { repeat: "none", weekday: null };
}

function parsePeopleAndPlace(draft: Draft, rules: LocaleRules): { people: string[]; place: string | null } {
  const stop = new Set(rules.stop);
  const placeStop = new Set(rules.stop.filter((word) => !["de", "het", "een", "the", "a", "an"].includes(word)));
  let people: string[] = [];
  const withRe = new RegExp(`(?<![\\p{L}])${rules.with}\\s+`, "giu");
  for (let match = withRe.exec(draft.masked); match; match = withRe.exec(draft.masked)) {
    const grab = grabWords(draft.masked, match.index + match[0].length, stop, rules.and, { join: true, chain: false, max: 4 });
    if (grab.words.length > 0 && claim(draft, match.index, grab.end, "person")) people = grab.words.map(capitalise);
  }
  let place: string | null = null;
  if (rules.at) {
    const atRe = new RegExp(`(?<![\\p{L}])${rules.at}\\s+`, "iu");
    const match = atRe.exec(draft.masked);
    if (match) {
      const grab = grabWords(draft.masked, match.index + match[0].length, placeStop, rules.and, { join: false, chain: true, max: 3 });
      if (grab.words.length > 0 && claim(draft, match.index, grab.end, "place")) place = capitalise(grab.words.join(" "));
    }
  }
  return { people, place };
}

interface Clock {
  start: number | null;
  end: number | null;
}

function to24(hour: number, suffix: string | undefined): number {
  const s = suffix?.toLowerCase();
  if (s === "pm" && hour < 12) return hour + 12;
  if (s === "am" && hour === 12) return 0;
  return hour;
}

const PART_DEFAULT_HOUR: Record<string, number> = { ochtends: 9, morgens: 9, morning: 9, middags: 14, afternoon: 14, avonds: 19, evening: 19, nachts: 22 };
const PM_PARTS = new Set(["middags", "afternoon", "avonds", "evening", "nachts"]);

function parseRange(draft: Draft): Clock | null {
  const re = /(?<![\p{L}\d:.\-/])(?:(van|from)\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(uur|u|am|pm)?\s*(-|–|tot|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(uur|u|am|pm)?(?![\d:])/giu;
  for (let match = re.exec(draft.masked); match; match = re.exec(draft.masked)) {
    const [, prefix, h1, m1, s1, connector, h2, m2, s2] = match;
    const explicit = Boolean(prefix || m1 || m2 || s1 || s2 || /^[a-z]/i.test(connector));
    const a = Number(h1);
    const b = Number(h2);
    if (!explicit || a > 24 || b > 24 || Number(m1 ?? 0) > 59 || Number(m2 ?? 0) > 59) continue;
    if (!claim(draft, match.index, match.index + match[0].length, "time")) continue;
    const start = to24(a, s1 ?? (a <= b ? s2 : undefined)) * 60 + Number(m1 ?? 0);
    let end = to24(b, s2) * 60 + Number(m2 ?? 0);
    if (end <= start) end = start + 60;
    return { start, end };
  }
  return null;
}

function parseSingleTime(draft: Draft, rules: LocaleRules): Clock | null {
  const split = /(?<![\p{L}\d:.\-/])(\d{1,2})u(\d{2})(?![\d:])/iu.exec(draft.masked);
  if (split && Number(split[1]) <= 24 && Number(split[2]) < 60 && claim(draft, split.index, split.index + split[0].length, "time")) {
    return { start: Number(split[1]) * 60 + Number(split[2]), end: null };
  }
  const monthAfter = new RegExp(`^\\s*(?:${rules.months.join("|")})(?![\\p{L}])`, "iu");
  const re = /(?<![\p{L}\d:.\-/])(?:(om|at)\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(uur|u|h|am|pm)?(?![\d:])/giu;
  for (let match = re.exec(draft.masked); match; match = re.exec(draft.masked)) {
    const [whole, prefix, hour, minutes, suffix] = match;
    if (!(prefix || minutes || suffix)) continue;
    if (monthAfter.test(draft.masked.slice(match.index + whole.length))) continue;
    const h = Number(hour);
    if (h > 24 || Number(minutes ?? 0) > 59) continue;
    if (!claim(draft, match.index, match.index + whole.length, "time")) continue;
    return { start: to24(h, suffix) * 60 + Number(minutes ?? 0), end: null };
  }
  return null;
}

function parseClock(draft: Draft, rules: LocaleRules): Clock {
  let clock: Clock = parseRange(draft) ?? parseSingleTime(draft, rules) ?? { start: null, end: null };
  const part = rules.partOfDay.exec(draft.masked);
  if (part && claim(draft, part.index, part.index + part[0].length, "time")) {
    const name = fold(part[1]);
    if (clock.start !== null) {
      if (PM_PARTS.has(name) && clock.start < 12 * 60) {
        clock = { start: clock.start + 12 * 60, end: clock.end === null ? null : clock.end + (clock.end < 12 * 60 ? 12 * 60 : 0) };
      }
    } else {
      clock = { start: PART_DEFAULT_HOUR[name] * 60, end: null };
    }
  }
  return clock;
}

function yearOf(today: string, month: number, day: number, written: string | undefined): string {
  if (written) return written.length === 2 ? `20${written}` : written;
  const thisYear = Number(today.slice(0, 4));
  return String(`${thisYear}-${pad(month)}-${pad(day)}` < today ? thisYear + 1 : thisYear);
}

function validDate(year: string, month: number, day: number): string | null {
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day ? date : null;
}

function parseOwnDate(draft: Draft, rules: LocaleRules, locale: QuickAddLocale, today: string): string | null {
  const weekdays = names(rules.weekdays);
  const around = new RegExp(`(?<![\\p{L}])(?:(?:op|on)\\s+)?(?:${rules.nextWeek}\\s+(?:(?:op|on)\\s+)?(${weekdays})|(${weekdays})\\s+${rules.nextWeek})(?![\\p{L}])`, "iu");
  let match = around.exec(draft.masked);
  if (match && claim(draft, match.index, match.index + match[0].length, "when")) {
    const weekday = rules.weekdays[fold(match[1] ?? match[2])];
    return addDays(startOfWeek(today), 7 + ((weekday + 6) % 7));
  }
  if (rules.dayAfterTomorrow) {
    match = rules.dayAfterTomorrow.exec(draft.masked);
    if (match && claim(draft, match.index, match.index + match[0].length, "when")) return addDays(today, 2);
  }
  const numeric = (locale === "nl" ? /(?<![\d:.\-/])(?:op\s+)?(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2}|\d{4}))?(?![\d:.\-/])(?!\s*(?:u|uur)\b)/iu : /(?<![\d:.\-/])(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?![\d:.\-/])/iu).exec(draft.masked);
  if (numeric) {
    const [first, second] = [Number(numeric[1]), Number(numeric[2])];
    // English reads month first, unless that cannot be a month.
    const [day, month] = locale === "en" && first <= 12 ? [second, first] : [first, second];
    const date = month >= 1 && month <= 12 ? validDate(yearOf(today, month, day, numeric[3]), month, day) : null;
    if (date && claim(draft, numeric.index, numeric.index + numeric[0].length, "when")) return date;
  }
  return null;
}

interface ChronoOutcome {
  date: string | null;
  clock: Clock;
}

// chrono-node reads what is left of the text; its reference is the Agenda's wall clock as local time, so only
// calendar components are read back (never `Date#toISOString`), which keeps the result independent of the device zone.
function parseWithChrono(draft: Draft, rules: LocaleRules, wall: string): ChronoOutcome {
  const [year, month, day] = wall.slice(0, 10).split("-").map(Number);
  const reference = new Date(year, month - 1, day, Number(wall.slice(11, 13)), Number(wall.slice(14, 16)));
  // Claimed parts are cut out (padding them with spaces confuses chrono's month parser); `source` maps back.
  let input = "";
  const source: number[] = [];
  for (let i = 0; i < draft.masked.length; i += 1) {
    if (draft.masked[i] === MASK) {
      if (input !== "" && !input.endsWith(" ")) {
        input += " ";
        source.push(i);
      }
      continue;
    }
    input += draft.masked[i];
    source.push(i);
  }
  let date: string | null = null;
  let clock: Clock = { start: null, end: null };
  for (const result of rules.chrono.parse(input.trimEnd(), reference, { forwardDate: true })) {
    const dated = result.start.isCertain("day") || result.start.isCertain("weekday");
    const timed = result.start.isCertain("hour");
    if (!dated && !timed) continue;
    if (!claim(draft, source[result.index], source[result.index + result.text.length - 1] + 1, dated ? "when" : "time")) continue;
    if (dated && date === null) {
      const [y, m, d] = [result.start.get("year"), result.start.get("month"), result.start.get("day")];
      if (y && m && d) date = `${y}-${pad(m)}-${pad(d)}`;
    }
    if (timed && clock.start === null) {
      const start = (result.start.get("hour") ?? 0) * 60 + (result.start.get("minute") ?? 0);
      const end = result.end?.isCertain("hour") ? (result.end.get("hour") ?? 0) * 60 + (result.end.get("minute") ?? 0) : null;
      clock = { start, end: end !== null && end > start ? end : null };
    }
  }
  return { date, clock };
}

function titleFrom(draft: Draft): string {
  let out = "";
  let at = 0;
  for (const span of [...draft.spans].sort((a, b) => a.start - b.start)) {
    out += `${draft.text.slice(at, span.start)} `;
    at = span.end;
  }
  out += draft.text.slice(at);
  return out
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:op|om|van|tot|met|bij|en|in|voor|on|at|from|to|with|and|for)\s+)+/i, "")
    .replace(/(?:\s+(?:op|om|van|tot|met|bij|en|in|voor|on|at|from|to|with|and|for))+$/i, "")
    .replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, "");
}

function suggestCategory(text: string, rules: LocaleRules, categories: readonly QuickAddCategory[]): string | null {
  if (categories.length === 0) return null;
  const haystack = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const named = categories.find((category) => {
    const name = category.name ? fold(category.name).replace(/[^\p{L}\p{N}]+/gu, " ").trim() : "";
    return name !== "" && haystack.includes(` ${name} `);
  });
  if (named) return named.id;
  const textWords = new Set(words(text));
  const find = (aliases: string[]) =>
    categories.find((category) => category.name && aliases.includes(fold(category.name).trim()));
  const sociaal = find(["sociaal", "social", "vrienden", "friends", "vrienden en familie", "friends and family"]);
  const sport = find(["sport", "sports", "fitness", "beweging"]);
  if (sociaal && rules.social.some((word) => textWords.has(word))) return sociaal.id;
  if (sport && rules.sport.some((word) => textWords.has(word))) return sport.id;
  return (categories.find((category) => category.isDefault) ?? categories[0]).id;
}

export function parseQuickAdd(text: string, context: QuickAddContext): QuickAddResult {
  const rules = RULES[context.locale];
  const wall = localDateTime(context.now.toISOString(), AGENDA_TIME_ZONE);
  const today = wall.slice(0, 10);
  const draft: Draft = { text, masked: text, spans: [] };

  const { repeat, weekday: repeatWeekday } = parseRepeat(draft, rules);
  const { people, place } = parsePeopleAndPlace(draft, rules);
  const allDayMatch = rules.allDay.exec(draft.masked);
  const forcedAllDay = Boolean(allDayMatch && claim(draft, allDayMatch.index, allDayMatch.index + allDayMatch[0].length, "when"));
  const ownDate = parseOwnDate(draft, rules, context.locale, today);
  const ownClock = parseClock(draft, rules);
  const chrono = parseWithChrono(draft, rules, wall);

  const clockResult = ownClock.start !== null ? ownClock : chrono.clock;
  const date = ownDate ?? chrono.date ?? (repeatWeekday !== null ? nextWeekday(today, repeatWeekday) : null);

  const slotMatch = new RegExp(`(?<![\\p{L}])(${Object.keys(rules.slots).join("|")})(?![\\p{L}])`, "iu").exec(draft.masked);
  const hasContext = people.length > 0 || place !== null;
  const baseTitle = titleFrom(draft);
  const titleWords = words(baseTitle).filter((word) => word.length >= 3 && !rules.stopWordsForRecipes.includes(word) && !(word in rules.slots));
  const recipes = context.recipes ?? [];
  const matches = titleWords.length > 0 ? rankRecipes(titleWords.join(" "), recipes) : [];
  const recipeFits = matches.length > 0 && recipeScore(titleWords, matches[0].title) === titleWords.length;
  const exactRecipe = recipeFits && words(matches[0].title).length === titleWords.length;

  let autoKind: QuickAddKind = "event";
  if (rules.todo.test(text) && !exactRecipe) autoKind = "todo";
  else if (!hasContext && (recipeFits || slotMatch)) autoKind = "meal";
  const kind = context.kind ?? autoKind;

  if (kind === "meal" && slotMatch) claim(draft, slotMatch.index, slotMatch.index + slotMatch[0].length, "moment");
  // A task keeps "met Youri" and "bij de bakker" in its title: there is nowhere else to put them.
  if (kind === "todo") draft.spans = draft.spans.filter((span) => span.kind !== "person" && span.kind !== "place");
  const title = capitalise(titleFrom(draft));
  const slot = slotMatch ? rules.slots[slotMatch[1].toLowerCase()] : null;

  const allDay = forcedAllDay || clockResult.start === null;
  const start = allDay || clockResult.start === null ? null : clock(clockResult.start);
  const end = allDay || clockResult.end === null ? null : clock(clockResult.end);

  return {
    kind,
    autoKind,
    title,
    date,
    start,
    end,
    allDay,
    explicitAllDay: forcedAllDay,
    people,
    place,
    repeat,
    categoryId: suggestCategory(text, rules, context.categories ?? []),
    slot,
    recipeId: kind === "meal" && recipeFits ? matches[0].id : null,
    recipeQuery: title,
    spans: [...draft.spans].sort((a, b) => a.start - b.start),
  };
}

/** One hour after `start` (`HH:mm`), held at 23:59 so an evening item never crosses midnight. */
export function defaultEndTime(start: string): string {
  const minutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + 60;
  return minutes >= 24 * 60 ? "23:59" : clock(minutes);
}

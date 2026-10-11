import "server-only";

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";

// Recipe extraction from a fetched page (#314, ADR-0019 step 2). HTML string
// in (from safe-fetch, #313), either a structured recipe or plain page text
// out. Deterministic, no network, no LLM; runs on Node (linkedom supplies the
// DOM that Readability needs, no browser globals).
//
// 1. schema.org Recipe in any <script type="application/ld+json"> -> kind
//    "recipe". Tolerated: invalid JSON (that block is skipped), @graph, nested
//    arrays, @type as string or array, instructions as text / HowToStep /
//    HowToSection. A Recipe with neither ingredients nor steps is not usable.
// 2. Otherwise Readability main text -> kind "text", for the LLM step (#317).
//    Capped at MAX_TEXT_CHARS.
//
// Every string leaving this module is plain text: tags stripped, entities
// decoded, whitespace collapsed (Architecture §5.5: output is never HTML).
// Ingredient lines stay raw; splitting them is parse-ingredient.ts.

/**
 * Upper bound for the fallback text handed to the LLM. Real recipe articles
 * are 2-6k characters after Readability; 20k (~5k tokens) leaves room for
 * long blog stories but bounds LLM cost per import (ADR-0018 guardrails) and
 * the amount of untrusted text that can carry prompt injection.
 */
export const MAX_TEXT_CHARS = 20_000;

export const ExtractedRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  recipeIngredient: z.array(z.string().min(1)),
  steps: z.array(z.string().min(1)),
  timeMinutes: z.number().int().positive().nullable(),
  servings: z.number().int().positive().nullable(),
  image: z.string().nullable(),
});
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

export type ExtractionResult =
  | { kind: "recipe"; recipe: ExtractedRecipe }
  | { kind: "text"; title: string | null; text: string; image: string | null };

/** `no_content`: no usable Recipe JSON-LD and no readable text on the page. */
export class ExtractError extends Error {
  constructor(
    readonly code: "no_content",
    message: string,
  ) {
    super(message);
    this.name = "ExtractError";
  }
}

type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (v: Json): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------- text

const BLOCK_END_RE = /<br\s*\/?>|<\/(?:p|div|li|h[1-6]|tr|ul|ol)>/gi;

/**
 * HTML fragment -> plain text with `\n` kept at block boundaries. A decode
 * loop (max 2 rounds) handles double-encoded input ("&amp;amp;"), which JSON-LD
 * from some WordPress plugins contains; scripts and styles never survive.
 */
function stripHtml(input: string): string {
  let text = input;
  for (let round = 0; round < 2; round++) {
    if (!/[<&]/.test(text)) break;
    const { document } = parseHTML("<!doctype html><html><body><div></div></body></html>");
    const box = document.querySelector("div");
    if (!box) break;
    box.innerHTML = text.replace(BLOCK_END_RE, "$&\n");
    box.querySelectorAll("script,style").forEach((el) => el.remove());
    text = box.textContent ?? "";
  }
  return text.replace(/ /g, " ");
}

/** One-line plain text: stripped, whitespace collapsed. "" when not a string. */
function oneLine(v: Json): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return "";
  return stripHtml(v).replace(/\s+/g, " ").trim();
}

/** Multi-line plain text as trimmed non-empty lines. */
function lines(v: Json): string[] {
  if (typeof v !== "string") return [];
  return stripHtml(v)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l !== "");
}

// ---------------------------------------------------------------- numbers

/**
 * ISO-8601 duration -> whole minutes. Weeks, days, hours, minutes and seconds
 * are read; years/months are ambiguous and, like anything invalid or zero,
 * give null. "PT1H30M" -> 90, "P0DT45M" -> 45, "PT90M" -> 90.
 */
export function parseIsoDuration(value: Json): number | null {
  if (typeof value !== "string") return null;
  const m =
    /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      value.trim(),
    );
  if (!m) return null;
  const [w, d, h, min, s] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
  const total = (w ?? 0) * 10080 + (d ?? 0) * 1440 + (h ?? 0) * 60 + (min ?? 0) + (s ?? 0) / 60;
  const minutes = Math.round(total);
  return minutes > 0 ? minutes : null;
}

/**
 * recipeYield -> servings. Number, string ("4 personen", "Makes 12"), or an
 * array of those (["4", "4 servings"]; first readable entry wins). A range
 * ("4-6") gives the lower bound, like ingredient ranges (ADR-0019).
 */
export function parseServings(value: Json): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const n = parseServings(item);
      if (n !== null) return n;
    }
    return null;
  }
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    const m = /\d+(?:[.,]\d+)?/.exec(value);
    if (!m) return null;
    n = Number(m[0].replace(",", "."));
  } else return null;
  const whole = Math.round(n);
  return Number.isFinite(whole) && whole >= 1 && whole <= 1000 ? whole : null;
}

// ---------------------------------------------------------------- JSON-LD

function typesOf(node: JsonObject): string[] {
  const t = node["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

const isRecipeNode = (node: JsonObject) =>
  typesOf(node).some((t) => /(?:^|[/:#])Recipe$/i.test(t));

/** Flattens arrays, @graph and mainEntity into the list of candidate nodes. */
function collectNodes(value: Json, out: JsonObject[] = [], depth = 0): JsonObject[] {
  if (depth > 6) return out;
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out, depth + 1);
  } else if (isObject(value)) {
    out.push(value);
    collectNodes(value["@graph"], out, depth + 1);
    collectNodes(value["mainEntity"], out, depth + 1);
  }
  return out;
}

function ingredientsOf(node: JsonObject): string[] {
  const raw = node["recipeIngredient"] ?? node["ingredients"];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.flatMap((i) => (typeof i === "string" ? lines(i) : []));
}

/** recipeInstructions -> flat list of plain steps. Section titles are dropped. */
function stepsOf(value: Json, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return lines(value);
  if (Array.isArray(value)) return value.flatMap((v) => stepsOf(v, depth + 1));
  if (!isObject(value)) return [];
  const own = lines(value["text"]);
  if (own.length) return own;
  if (value["itemListElement"] !== undefined) return stepsOf(value["itemListElement"], depth + 1);
  return lines(value["name"] ?? value["description"]);
}

/** http(s) URL string from a string / ImageObject / array; null if none. */
function imageOf(value: Json, baseUrl: string | undefined): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const u = imageOf(v, baseUrl);
      if (u) return u;
    }
    return null;
  }
  const raw = isObject(value) ? (value["url"] ?? value["contentUrl"]) : value;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim(), baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function minutesOf(node: JsonObject): number | null {
  const total = parseIsoDuration(node["totalTime"]);
  if (total !== null) return total;
  const prep = parseIsoDuration(node["prepTime"]);
  const cook = parseIsoDuration(node["cookTime"]);
  return prep === null && cook === null ? null : (prep ?? 0) + (cook ?? 0);
}

// ---------------------------------------------------------------- extract

/**
 * @param html Page HTML (already fetched by safe-fetch).
 * @param baseUrl Final page URL; resolves relative image URLs.
 * @throws ExtractError("no_content") when there is neither a usable Recipe
 *   nor any readable text.
 */
export function extractRecipe(html: string, baseUrl?: string): ExtractionResult {
  const { document } = parseHTML(html);

  const meta = (selector: string) =>
    oneLine(document.querySelector(selector)?.getAttribute("content") ?? "");
  const ogImage = imageOf(meta('meta[property="og:image"]'), baseUrl);
  const pageTitle =
    meta('meta[property="og:title"]') || oneLine(document.querySelector("title")?.textContent);

  const nodes: JsonObject[] = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collectNodes(JSON.parse(script.textContent ?? ""), nodes);
    } catch {
      // Invalid JSON-LD is common in the wild; skip that block only.
    }
  }

  for (const node of nodes.filter(isRecipeNode)) {
    const parsed = ExtractedRecipeSchema.safeParse({
      name: oneLine(node["name"]) || pageTitle,
      description: oneLine(node["description"]) || null,
      recipeIngredient: ingredientsOf(node),
      steps: stepsOf(node["recipeInstructions"]),
      timeMinutes: minutesOf(node),
      servings: parseServings(node["recipeYield"]),
      image: imageOf(node["image"], baseUrl) ?? ogImage,
    });
    if (parsed.success && (parsed.data.recipeIngredient.length || parsed.data.steps.length)) {
      return { kind: "recipe", recipe: parsed.data };
    }
  }

  return textFallback(document, pageTitle, ogImage);
}

function textFallback(
  document: ReturnType<typeof parseHTML>["document"],
  pageTitle: string,
  image: string | null,
): ExtractionResult {
  // Readability mutates the document, so this must stay the last step.
  // linkedom's Document is structurally close enough to the DOM type.
  const article = new Readability(document as unknown as Document).parse();
  let raw = article?.textContent ?? "";
  if (raw.trim() === "") {
    document.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
    raw = document.body?.textContent ?? "";
  }
  let text = raw
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text === "") throw new ExtractError("no_content", "page has no readable text");
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    // Do not cut a surrogate pair in half.
    if (/[\ud800-\udbff]$/.test(text)) text = text.slice(0, -1);
    text = text.trimEnd();
  }
  return { kind: "text", title: oneLine(article?.title) || pageTitle || null, text, image };
}

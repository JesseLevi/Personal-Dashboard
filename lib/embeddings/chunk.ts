import { createHash } from "node:crypto";

// Chunking for the embedding pipeline (ADR-0043 §8): split on headings and
// paragraphs, pack toward TARGET_CHARS with a little overlap, cap each source.

export const TARGET_CHARS = 1_200;
export const OVERLAP_CHARS = 150;
/** Hard cap per source: text beyond it is not indexed (about 25 chunks). */
export const MAX_SOURCE_CHARS = 30_000;

const MIN_CHARS_BEFORE_HEADING_SPLIT = TARGET_CHARS / 2;
const HEADING = /^#{1,6}\s/;

export type Chunk = { index: number; text: string; hash: string };

/** sha-256 of model + text: a new model never reuses an old vector. */
export function contentHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}

// Paragraphs, with every heading line starting a unit of its own.
function toUnits(text: string): string[] {
  const units: string[] = [];
  for (const block of text.split(/\n[ \t]*\n/)) {
    let current: string[] = [];
    const flush = () => {
      const unit = current.join("\n").trim();
      if (unit) units.push(unit);
      current = [];
    };
    for (const line of block.split("\n")) {
      if (HEADING.test(line)) flush();
      current.push(line);
    }
    flush();
  }
  return units;
}

// A unit longer than TARGET_CHARS: hard slices at whitespace, each starting
// OVERLAP_CHARS before the previous end.
function splitLong(unit: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < unit.length) {
    let end = Math.min(start + TARGET_CHARS, unit.length);
    if (end < unit.length) {
      const space = unit.lastIndexOf(" ", end);
      if (space > start + TARGET_CHARS * 0.8) end = space;
    }
    pieces.push(unit.slice(start, end).trim());
    if (end >= unit.length) break;
    let next = end - OVERLAP_CHARS;
    const space = unit.indexOf(" ", next);
    if (space !== -1 && space < end) next = space + 1;
    start = Math.max(next, start + 1);
  }
  return pieces.filter((piece) => piece !== "");
}

/** Chunk texts, each at most TARGET_CHARS long. Empty text gives no chunks. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim().slice(0, MAX_SOURCE_CHARS);
  if (!normalized) return [];

  const units = toUnits(normalized).flatMap((unit) => (unit.length > TARGET_CHARS ? splitLong(unit) : [unit]));
  const chunks: string[] = [];
  let current = "";
  let lastUnit = "";
  for (const unit of units) {
    const splitHere = HEADING.test(unit) && current.length >= MIN_CHARS_BEFORE_HEADING_SPLIT;
    if (current && (splitHere || current.length + 2 + unit.length > TARGET_CHARS)) {
      chunks.push(current);
      const seed = lastUnit.length <= OVERLAP_CHARS && !HEADING.test(unit) ? lastUnit : "";
      current = seed && seed.length + 2 + unit.length <= TARGET_CHARS ? seed : "";
    }
    current = current ? `${current}\n\n${unit}` : unit;
    lastUnit = unit;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkSource(text: string, model: string): Chunk[] {
  return chunkText(text).map((chunk, index) => ({ index, text: chunk, hash: contentHash(model, chunk) }));
}

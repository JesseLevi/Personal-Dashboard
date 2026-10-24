// Pure merge step of hybrid search (#580, ADR-0043 §10): Reciprocal Rank
// Fusion of the keyword and the semantic list, and the collapse of repeated
// events.

export const SEARCH_TYPES = ["note", "recipe", "card", "calendar_event", "shopping_list_item"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const isSearchType = (value: string): value is SearchType =>
  (SEARCH_TYPES as readonly string[]).includes(value);

export type RankedHit = { sourceType: SearchType; sourceId: string; score: number };

export const RRF_K = 60;

const keyOf = (hit: { sourceType: string; sourceId: string }) => `${hit.sourceType}:${hit.sourceId}`;

/**
 * Each list is taken in the order given (best first). A source scores the sum
 * of 1 / (k + rank) over the lists it appears in, so it is listed once.
 * Ties keep the keyword order, then the semantic order.
 */
export function fuseRanked(keyword: RankedHit[], semantic: RankedHit[]): RankedHit[] {
  const fused = new Map<string, RankedHit>();
  for (const list of [keyword, semantic]) {
    list.forEach((hit, index) => {
      const key = keyOf(hit);
      const add = 1 / (RRF_K + index + 1);
      const seen = fused.get(key);
      if (seen) seen.score += add;
      else fused.set(key, { sourceType: hit.sourceType, sourceId: hit.sourceId, score: add });
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score);
}

/**
 * Events sharing a `contentHash` are one result: it takes the place of the
 * best-ranked one and shows the occurrence closest to `now`. Other items and
 * events without a hash pass through.
 */
export function collapseEvents<T extends { sourceType: SearchType; contentHash?: string | null; startsAt?: string }>(
  ranked: T[],
  now: Date,
): T[] {
  const distance = (item: T) => Math.abs(Date.parse(item.startsAt ?? "") - now.getTime());
  const slot = new Map<string, number>();
  const out: T[] = [];
  for (const item of ranked) {
    if (item.sourceType !== "calendar_event" || !item.contentHash) {
      out.push(item);
      continue;
    }
    const at = slot.get(item.contentHash);
    if (at === undefined) {
      slot.set(item.contentHash, out.length);
      out.push(item);
    } else if (distance(item) < distance(out[at]!)) {
      out[at] = item;
    }
  }
  return out;
}

const SNIPPET_LENGTH = 140;

/** A one-line excerpt of `text` around the first occurrence of `query`; null when there is no text. */
export function makeSnippet(text: string | null | undefined, query: string): string | null {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= SNIPPET_LENGTH) return flat;
  const at = flat.toLowerCase().indexOf(query.trim().toLowerCase());
  const start = at < 0 ? 0 : Math.max(0, at - 40);
  const end = Math.min(flat.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

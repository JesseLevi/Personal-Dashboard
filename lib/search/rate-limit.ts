import "server-only";

// Semantic-search budget (#580): 30 embedded queries per minute per member.
// No table exists for it, so the window lives in memory: per server instance,
// best effort, and it resets on a cold start. It only guards spend, the
// provider cap is the hard stop (compare lib/recipes/import/rate-limit.ts,
// which can count rows instead). Over the limit the search runs keyword-only.

export const SEMANTIC_SEARCHES_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

const windows = new Map<string, number[]>();

/** True and counted while the member is under the limit; false once over it. */
export function consumeSemanticSearch(userId: string, now: number = Date.now()): boolean {
  const recent = (windows.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= SEMANTIC_SEARCHES_PER_MINUTE) {
    windows.set(userId, recent);
    return false;
  }
  recent.push(now);
  windows.set(userId, recent);
  return true;
}

export function resetSemanticSearchLimit(): void {
  windows.clear();
}

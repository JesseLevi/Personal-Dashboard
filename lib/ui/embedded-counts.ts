// PostgREST `select("id, <rel>(count)")` returns `{ id, <rel>: [{ count }] }`
// per parent. Flattens that to one number per parent, in row order (the
// loading skeletons' per-column card counts).
export function embeddedCounts<K extends string>(
  rows: ReadonlyArray<Record<K, ReadonlyArray<{ count: number }>>>,
  relation: K,
): number[] {
  return rows.map((row) => row[relation][0]?.count ?? 0);
}

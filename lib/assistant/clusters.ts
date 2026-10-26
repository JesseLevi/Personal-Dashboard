import { createHash } from "node:crypto";

// Pure grouping for the pattern step (ADR-0046 §3): neighbour edges in,
// clusters of 3-8 sources out. No I/O, deterministic for a given input.

export type SourceType = "note" | "card";
export type SourceRef = { type: SourceType; id: string };
export type Edge = { a: SourceRef; b: SourceRef; similarity: number };
export type Cluster = { sources: SourceRef[]; score: number };

export const MIN_CLUSTER_SIZE = 3;
export const MAX_CLUSTER_SIZE = 8;
/** Cards untouched for this long are stale: context for a pattern, never a reason for one. */
export const STALE_DAYS = 21;

export const sourceKey = (type: SourceType, id: string) => `${type}:${id}`;
const keyOf = (s: SourceRef) => sourceKey(s.type, s.id);

/** Sorted, so the same set of sources always gets the same key. */
export function dedupeKeyFor(sources: readonly SourceRef[]): string {
  const joined = sources.map(keyOf).sort().join("|");
  return createHash("sha256").update(joined).digest("hex").slice(0, 32);
}

type Graph = Map<string, Map<string, number>>;

function buildGraph(edges: readonly Edge[]): { graph: Graph; refs: Map<string, SourceRef> } {
  const graph: Graph = new Map();
  const refs = new Map<string, SourceRef>();
  const link = (from: SourceRef, to: SourceRef, w: number) => {
    const a = keyOf(from);
    const b = keyOf(to);
    refs.set(a, from);
    refs.set(b, to);
    const row = graph.get(a) ?? new Map<string, number>();
    row.set(b, Math.max(row.get(b) ?? 0, w));
    graph.set(a, row);
  };
  for (const e of edges) {
    if (keyOf(e.a) === keyOf(e.b) || !Number.isFinite(e.similarity)) continue;
    link(e.a, e.b, e.similarity);
    link(e.b, e.a, e.similarity);
  }
  return { graph, refs };
}

function components(nodes: ReadonlySet<string>, graph: Graph): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of [...nodes].sort()) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const n = stack.pop() as string;
      comp.push(n);
      for (const m of graph.get(n)?.keys() ?? []) {
        if (nodes.has(m) && !seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/**
 * Connected components over the edges. A component over MAX_CLUSTER_SIZE is
 * trimmed by dropping the weakest-connected node (lowest summed similarity
 * inside the set, then the largest key) until it fits or falls apart; the
 * pieces are handled the same way. Pieces under MIN_CLUSTER_SIZE are dropped.
 */
export function buildClusters(edges: readonly Edge[]): Cluster[] {
  const { graph, refs } = buildGraph(edges);
  const result: Cluster[] = [];

  const settle = (nodes: Set<string>) => {
    for (const comp of components(nodes, graph)) {
      if (comp.length < MIN_CLUSTER_SIZE) continue;
      if (comp.length > MAX_CLUSTER_SIZE) {
        const set = new Set(comp);
        let weakest = "";
        let weakestWeight = Infinity;
        for (const n of [...set].sort()) {
          let w = 0;
          for (const [m, sim] of graph.get(n) ?? []) if (set.has(m)) w += sim;
          if (w <= weakestWeight) {
            weakest = n;
            weakestWeight = w;
          }
        }
        set.delete(weakest);
        settle(set);
        continue;
      }
      const set = new Set(comp);
      let score = 0;
      for (const n of comp) for (const [m, sim] of graph.get(n) ?? []) if (set.has(m) && n < m) score += sim;
      result.push({ sources: comp.sort().map((k) => refs.get(k) as SourceRef), score });
    }
  };

  settle(new Set(graph.keys()));
  return result.sort(
    (x, y) => y.score - x.score || dedupeKeyFor(x.sources).localeCompare(dedupeKeyFor(y.sources)),
  );
}

/** True when `updatedAt` is older than STALE_DAYS before `now`. */
export function isStale(updatedAt: string | Date, now: Date): boolean {
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && now.getTime() - t > STALE_DAYS * 86_400_000;
}

/**
 * A stuck card is never a signal on its own (ADR-0046 §1): a cluster needs at
 * least two sources that are not stale, so staleness is context, not the topic.
 */
export function hasEnoughFreshSources(cluster: Cluster, staleKeys: ReadonlySet<string>): boolean {
  return cluster.sources.filter((s) => !staleKeys.has(keyOf(s))).length >= 2;
}


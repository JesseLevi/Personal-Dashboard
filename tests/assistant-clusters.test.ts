import { describe, expect, it } from "vitest";
import {
  buildClusters,
  dedupeKeyFor,
  hasEnoughFreshSources,
  isStale,
  type Edge,
  type SourceRef,
} from "@/lib/assistant/clusters";

const n = (id: string): SourceRef => ({ type: "note", id });
const c = (id: string): SourceRef => ({ type: "card", id });
const edge = (a: SourceRef, b: SourceRef, similarity = 0.9): Edge => ({ a, b, similarity });

describe("dedupeKeyFor", () => {
  it("ignores order and differs per set and per type", () => {
    expect(dedupeKeyFor([n("1"), n("2"), c("3")])).toBe(dedupeKeyFor([c("3"), n("2"), n("1")]));
    expect(dedupeKeyFor([n("1"), n("2"), c("3")])).not.toBe(dedupeKeyFor([n("1"), n("2"), n("3")]));
    expect(dedupeKeyFor([n("1"), n("2"), c("3")])).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("buildClusters", () => {
  it("groups connected sources, in either edge direction", () => {
    const clusters = buildClusters([edge(n("1"), n("2")), edge(c("3"), n("2"))]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sources.map((s) => s.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("drops pairs and keeps separate groups apart", () => {
    const clusters = buildClusters([
      edge(n("1"), n("2")),
      edge(n("2"), n("3")),
      edge(n("10"), n("11")),
      edge(n("20"), n("21")),
      edge(n("21"), n("22")),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((cl) => cl.sources.length === 3)).toBe(true);
  });

  it("ignores self edges and non-finite similarities", () => {
    expect(buildClusters([edge(n("1"), n("1")), edge(n("1"), n("2"), Number.NaN), edge(n("2"), n("1"))])).toEqual([]);
  });

  it("trims a component over eight sources to at most eight, weakest first", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `s${String(i).padStart(2, "0")}`);
    const edges: Edge[] = [];
    // A chain, plus a heavy core among s00..s05.
    for (let i = 0; i < ids.length - 1; i++) edges.push(edge(n(ids[i]), n(ids[i + 1]), 0.81));
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) edges.push(edge(n(ids[i]), n(ids[j]), 0.95));
    const clusters = buildClusters(edges);
    expect(clusters.length).toBeGreaterThan(0);
    for (const cl of clusters) {
      expect(cl.sources.length).toBeGreaterThanOrEqual(3);
      expect(cl.sources.length).toBeLessThanOrEqual(8);
    }
    const first = clusters[0].sources.map((s) => s.id);
    for (const core of ids.slice(0, 6)) expect(first).toContain(core);
  });

  it("is deterministic and orders by score", () => {
    const edges = [
      edge(n("a"), n("b"), 0.82),
      edge(n("b"), n("c"), 0.82),
      edge(n("x"), n("y"), 0.99),
      edge(n("y"), n("z"), 0.99),
    ];
    const one = buildClusters(edges);
    const two = buildClusters([...edges].reverse());
    expect(one).toEqual(two);
    expect(one[0].sources.map((s) => s.id)).toEqual(["x", "y", "z"]);
  });
});

describe("stale cards", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("isStale: older than 21 days", () => {
    expect(isStale("2026-10-05T11:00:00Z", now)).toBe(true);
    expect(isStale("2026-10-06T12:00:00Z", now)).toBe(false);
    expect(isStale("not a date", now)).toBe(false);
  });

  it("a cluster with fewer than two fresh sources never qualifies", () => {
    const cluster = { sources: [c("1"), c("2"), c("3")], score: 1 };
    expect(hasEnoughFreshSources(cluster, new Set(["card:1", "card:2", "card:3"]))).toBe(false);
    expect(hasEnoughFreshSources(cluster, new Set(["card:1", "card:2"]))).toBe(false);
    expect(hasEnoughFreshSources(cluster, new Set(["card:1"]))).toBe(true);
    expect(hasEnoughFreshSources(cluster, new Set())).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildRunArgs,
  clusterSizes,
  emptyFunnel,
  promptVersion,
  selectOutcome,
  similarityBands,
  type RunState,
} from "@/lib/assistant/pattern-log";

const state = (patch: Partial<RunState["funnel"]> = {}, rest: Partial<Omit<RunState, "funnel">> = {}): RunState => ({
  funnel: { ...emptyFunnel(), ...patch },
  paused: false,
  budgetHit: false,
  errorCode: null,
  ...rest,
});

describe("similarityBands", () => {
  it("buckets by 0.05 from 0.80, the last band including 1.00", () => {
    const sims = [0.8, 0.84, 0.85, 0.899, 0.9, 0.95, 1, 0.7];
    expect(similarityBands(sims.map((similarity) => ({ similarity })))).toEqual({
      "0.80": 2,
      "0.85": 2,
      "0.90": 1,
      "0.95": 2,
    });
  });

  it("always lists every band", () => {
    expect(similarityBands([])).toEqual({ "0.80": 0, "0.85": 0, "0.90": 0, "0.95": 0 });
  });
});

describe("clusterSizes", () => {
  it("counts clusters per size from 3 to 8", () => {
    const c = (n: number) => ({ sources: Array.from({ length: n }, (_, i) => ({ type: "note" as const, id: String(i) })) });
    expect(clusterSizes([c(3), c(3), c(5)])).toEqual({ "3": 2, "4": 0, "5": 1, "6": 0, "7": 0, "8": 0 });
  });
});

describe("selectOutcome", () => {
  it("covers every outcome", () => {
    expect(selectOutcome(state())).toBe("no_edges");
    expect(selectOutcome(state({ edges: 2 }))).toBe("no_clusters");
    expect(selectOutcome(state({ edges: 2, clusters: 1, known: 1 }))).toBe("all_known");
    expect(selectOutcome(state({ edges: 2, clusters: 1, candidates: 1, notFresh: 1 }))).toBe("no_candidates");
    expect(selectOutcome(state({ edges: 2, clusters: 1, candidates: 1 }, { paused: true }))).toBe("paused");
    expect(selectOutcome(state({ edges: 2, clusters: 1, candidates: 1 }, { budgetHit: true }))).toBe("budget");
    expect(selectOutcome(state({ edges: 2, clusters: 1, candidates: 1, calls: 1 }))).toBe("ok");
    expect(selectOutcome(state({ edges: 2 }, { errorCode: "overloaded" }))).toBe("error");
  });

  it("an error beats a pause, and calls before the budget ran out stay ok", () => {
    expect(selectOutcome(state({ candidates: 1 }, { paused: true, errorCode: "x" }))).toBe("error");
    expect(selectOutcome(state({ edges: 3, clusters: 2, candidates: 2, calls: 1 }, { budgetHit: true }))).toBe("ok");
  });
});

describe("promptVersion", () => {
  it("is the first 12 hex characters of the sha256", () => {
    expect(promptVersion("abc")).toBe("ba7816bf8f01");
    expect(promptVersion("abd")).not.toBe(promptVersion("abc"));
  });
});

describe("buildRunArgs", () => {
  it("maps the funnel onto the RPC arguments", () => {
    const args = buildRunArgs({
      path: "cron",
      startedAt: new Date("2026-11-03T10:00:00Z"),
      durationMs: 12.6,
      state: state({ edges: 2, calls: 1, inputTokens: 5, outputTokens: 6 }, { errorCode: "auth" }),
      config: {
        model: "m",
        prompt_version: "v",
        similarity_threshold: 0.8,
        cluster_min: 3,
        cluster_max: 8,
        max_calls_per_day: 3,
        max_candidates: 6,
      },
    });
    expect(args).toMatchObject({
      p_path: "cron",
      p_started_at: "2026-11-03T10:00:00.000Z",
      p_duration_ms: 13,
      p_outcome: "error",
      p_error_code: "auth",
      p_edges: 2,
      p_calls: 1,
      p_input_tokens: 5,
      p_output_tokens: 6,
    });
  });
});

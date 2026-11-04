import { createHash } from "node:crypto";
import {
  MAX_CLUSTER_SIZE,
  MIN_CLUSTER_SIZE,
  sourceKey,
  type Cluster,
  type Edge,
  type SourceRef,
} from "@/lib/assistant/clusters";

// Pure funnel logic of the pattern run log (ADR-0060 §2): counters, the
// similarity histogram, the outcome and the row sent to record_assistant_pattern_run.
// Counts only, never content. No I/O.

/** Edges below this never reach the step: pattern_edges() only returns >= 0.80 (ADR-0046 §3). */
export const SIMILARITY_FLOOR = 0.8;
export const BAND_WIDTH = 0.05;
const BAND_COUNT = 4;

export type PatternOutcome =
  | "no_edges"
  | "no_clusters"
  | "all_known"
  | "no_candidates"
  | "paused"
  | "budget"
  | "ok"
  | "error";

export type Funnel = {
  edges: number;
  similarityBands: Record<string, number>;
  clusters: number;
  clusterSizes: Record<string, number>;
  known: number;
  notFresh: number;
  candidates: number;
  calls: number;
  helpful: number;
  notHelpful: number;
  rejectedByCleaner: number;
  callFailures: number;
  inputTokens: number;
  outputTokens: number;
};

const bandKey = (index: number) => (SIMILARITY_FLOOR + index * BAND_WIDTH).toFixed(2);

/** Bands of 0.05 from 0.80: "0.80", "0.85", "0.90", "0.95" (the last one includes 1.00). */
export function similarityBands(edges: ReadonlyArray<{ similarity: number }>): Record<string, number> {
  const bands: Record<string, number> = {};
  for (let i = 0; i < BAND_COUNT; i++) bands[bandKey(i)] = 0;
  for (const { similarity } of edges) {
    const index = Math.floor((similarity - SIMILARITY_FLOOR) / BAND_WIDTH + 1e-9);
    if (index < 0) continue;
    bands[bandKey(Math.min(index, BAND_COUNT - 1))]++;
  }
  return bands;
}

/** Cluster count per size, keyed by the size ("3" to "8"). */
export function clusterSizes(clusters: ReadonlyArray<Pick<Cluster, "sources">>): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (let size = MIN_CLUSTER_SIZE; size <= MAX_CLUSTER_SIZE; size++) sizes[String(size)] = 0;
  for (const c of clusters) {
    const key = String(c.sources.length);
    sizes[key] = (sizes[key] ?? 0) + 1;
  }
  return sizes;
}

export function emptyFunnel(): Funnel {
  return {
    edges: 0,
    similarityBands: {},
    clusters: 0,
    clusterSizes: {},
    known: 0,
    notFresh: 0,
    candidates: 0,
    calls: 0,
    helpful: 0,
    notHelpful: 0,
    rejectedByCleaner: 0,
    callFailures: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

export type RunState = {
  funnel: Funnel;
  /** The member paused the pattern step (profiles.assistant_patterns_enabled is off). */
  paused: boolean;
  /** reserve_pattern_signal said 'budget'. */
  budgetHit: boolean;
  /** Set when the run failed; becomes error_code. */
  errorCode: string | null;
};

/**
 * One outcome per run. Order matters: a failure wins, then the pause (the run
 * stopped on purpose before reserving), then how far the funnel got.
 */
export function selectOutcome(state: RunState): PatternOutcome {
  const f = state.funnel;
  if (state.errorCode !== null) return "error";
  if (state.paused) return "paused";
  if (f.edges === 0) return "no_edges";
  if (f.clusters === 0) return "no_clusters";
  if (f.candidates === 0) return "all_known";
  if (f.calls > 0) return "ok";
  if (state.budgetHit) return "budget";
  return "no_candidates";
}

/** First 12 hex characters of the sha256 of the system prompt: changes when the prompt does. */
export function promptVersion(system: string): string {
  return createHash("sha256").update(system).digest("hex").slice(0, 12);
}

export type RunConfig = {
  model: string;
  prompt_version: string;
  similarity_threshold: number;
  cluster_min: number;
  cluster_max: number;
  max_calls_per_day: number;
  max_candidates: number;
};

export function buildConfig(args: { model: string; system: string; maxCallsPerDay: number; maxCandidates: number }): RunConfig {
  return {
    model: args.model,
    prompt_version: promptVersion(args.system),
    similarity_threshold: SIMILARITY_FLOOR,
    cluster_min: MIN_CLUSTER_SIZE,
    cluster_max: MAX_CLUSTER_SIZE,
    max_calls_per_day: args.maxCallsPerDay,
    max_candidates: args.maxCandidates,
  };
}

/** Arguments of record_assistant_pattern_run (without p_user). */
export function buildRunArgs(args: {
  path: "lazy" | "cron";
  startedAt: Date;
  durationMs: number;
  state: RunState;
  config: RunConfig;
}) {
  const f = args.state.funnel;
  return {
    p_path: args.path,
    p_started_at: args.startedAt.toISOString(),
    p_duration_ms: Math.max(0, Math.round(args.durationMs)),
    p_outcome: selectOutcome(args.state),
    p_error_code: args.state.errorCode ?? "",
    p_edges: f.edges,
    p_similarity_bands: f.similarityBands,
    p_clusters: f.clusters,
    p_cluster_sizes: f.clusterSizes,
    p_known: f.known,
    p_not_fresh: f.notFresh,
    p_candidates: f.candidates,
    p_calls: f.calls,
    p_helpful: f.helpful,
    p_not_helpful: f.notHelpful,
    p_rejected_by_cleaner: f.rejectedByCleaner,
    p_call_failures: f.callFailures,
    p_input_tokens: f.inputTokens,
    p_output_tokens: f.outputTokens,
    p_config: args.config,
  };
}

// ---------------------------------------------------------------------------
// Traces (ADR-0060 §3): what was sent for one cluster, and what came back.
// ---------------------------------------------------------------------------

export type TraceItem = {
  type: "note" | "card";
  id: string;
  kind: "note" | "card";
  title: string;
  fragment: string;
  stale: boolean;
};

export type TraceSimilarity = { a: number; b: number; similarity: number };

export type TraceAnswer = {
  helpful: boolean;
  message_raw: string;
  message: string | null;
  rejected: "empty" | "link" | null;
};

/** Pairs inside the cluster, as indexes into `ordered` (the order of items), strongest first. */
export function traceSimilarities(ordered: readonly SourceRef[], edges: readonly Edge[]): TraceSimilarity[] {
  const index = new Map(ordered.map((s, i) => [sourceKey(s.type, s.id), i]));
  const best = new Map<string, TraceSimilarity>();
  for (const e of edges) {
    const a = index.get(sourceKey(e.a.type, e.a.id));
    const b = index.get(sourceKey(e.b.type, e.b.id));
    if (a === undefined || b === undefined || a === b) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${lo}:${hi}`;
    const similarity = Math.round(e.similarity * 10000) / 10000;
    if ((best.get(key)?.similarity ?? -1) < similarity) best.set(key, { a: lo, b: hi, similarity });
  }
  return [...best.values()].sort((x, y) => y.similarity - x.similarity || x.a - y.a || x.b - y.b);
}

/** Arguments of record_assistant_pattern_trace (without p_user). */
export function buildTraceArgs(args: {
  status: "asked" | "paused";
  dedupeKey: string;
  items: readonly TraceItem[];
  similarities: readonly TraceSimilarity[];
  config: Pick<RunConfig, "prompt_version" | "model">;
  answer?: TraceAnswer;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}) {
  return {
    p_status: args.status,
    p_dedupe_key: args.dedupeKey,
    p_items: [...args.items],
    p_similarities: [...args.similarities],
    p_prompt_version: args.config.prompt_version,
    p_model: args.config.model,
    p_answer: args.answer ?? null,
    p_input_tokens: Math.max(0, Math.round(args.inputTokens ?? 0)),
    p_output_tokens: Math.max(0, Math.round(args.outputTokens ?? 0)),
    p_duration_ms: Math.max(0, Math.round(args.durationMs ?? 0)),
  };
}

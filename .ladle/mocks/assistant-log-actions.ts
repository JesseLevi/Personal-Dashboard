import type { AssistantLogExport, LogRun, LogTrace } from "../../lib/assistant/log-export";
import type { ActionResult } from "../../lib/profile/types";

// Ladle stand-in for lib/assistant/log-actions.ts ("use server", needs a Next request
// context); wired in .ladle/vite.config.mjs. Same signature, a fixed fixture.

const EXPORTED_AT = "2026-11-04T10:00:00.000Z";

const run = (id: string, startedAt: string, patch: Partial<LogRun>): LogRun => ({
  id,
  path: "lazy",
  started_at: startedAt,
  duration_ms: 420,
  outcome: "no_edges",
  error_code: null,
  edges: 0,
  similarity_bands: {},
  clusters: 0,
  cluster_sizes: {},
  known: 0,
  not_fresh: 0,
  candidates: 0,
  calls: 0,
  helpful: 0,
  not_helpful: 0,
  rejected_by_cleaner: 0,
  call_failures: 0,
  input_tokens: 0,
  output_tokens: 0,
  config: {},
  created_at: startedAt,
  ...patch,
});

const trace = (id: string, patch: Partial<LogTrace>): LogTrace => ({
  id,
  dedupe_key: id,
  status: "asked",
  items: [],
  similarities: [],
  prompt_version: "3f9a1c2b7d10",
  model: "claude-haiku",
  answer: null,
  input_tokens: null,
  output_tokens: null,
  duration_ms: null,
  signal_id: null,
  first_seen_at: "2026-11-03T08:12:00.000Z",
  last_seen_at: "2026-11-03T08:12:00.000Z",
  seen_count: 1,
  signal_status: null,
  status_changed_at: null,
  ...patch,
});

export const assistantLogFixture: AssistantLogExport = {
  format: "atlas.assistant-log.v1",
  exported_at: EXPORTED_AT,
  config: { model: "claude-haiku", prompt_version: "3f9a1c2b7d10", similarity_threshold: 0.8, patterns_enabled: true },
  runs: [
    run("r1", "2026-11-04T07:41:00.000Z", {
      outcome: "ok",
      edges: 14,
      clusters: 3,
      known: 1,
      candidates: 2,
      calls: 2,
      helpful: 1,
      not_helpful: 1,
    }),
    run("r2", "2026-11-04T04:30:00.000Z", { path: "cron", outcome: "all_known", edges: 9, clusters: 2, known: 2 }),
    run("r3", "2026-11-03T16:05:00.000Z", { outcome: "no_clusters", edges: 2 }),
    run("r4", "2026-11-03T08:12:00.000Z", { outcome: "paused", edges: 11, clusters: 2, candidates: 2 }),
    run("r5", "2026-11-02T09:20:00.000Z", { outcome: "budget", edges: 8, clusters: 4, candidates: 4, calls: 0 }),
    run("r6", "2026-11-01T09:20:00.000Z", { outcome: "error", error_code: "rate_limited", edges: 6, clusters: 1, candidates: 1, calls: 1, call_failures: 1 }),
  ],
  traces: [
    trace("t1", {
      last_seen_at: "2026-11-04T07:41:00.000Z",
      items: [
        { type: "note", id: "n1", kind: "note", title: "Koffie bij Bocca", fragment: "Beste flat white van de stad, volgende keer bonen kopen.", stale: false },
        { type: "note", id: "n2", kind: "note", title: "Bonen vergelijken", fragment: "Lichte branding, fruitig. Wat past bij de nieuwe molen?", stale: false },
        { type: "card", id: "c1", kind: "card", title: "Molen schoonmaken", fragment: "", stale: true },
      ],
      answer: {
        helpful: true,
        message_raw: "Je schrijft vaak over koffie. Misschien een lijstje met favoriete bonen?",
        message: "Je schrijft vaak over koffie. Misschien een lijstje met favoriete bonen?",
        rejected: null,
      },
      input_tokens: 412,
      output_tokens: 38,
      signal_status: "new",
    }),
    trace("t2", {
      last_seen_at: "2026-11-04T07:41:00.000Z",
      items: [
        { type: "note", id: "n3", kind: "note", title: "Vakantie Portugal", fragment: "Route langs de kust, huisje bij Sagres.", stale: false },
        { type: "note", id: "n4", kind: "note", title: "Pakken", fragment: "Zonnebrand, adapter, boek.", stale: false },
        { type: "note", id: "n5", kind: "note", title: "Vluchten", fragment: "Heen op vrijdag, terug zondag.", stale: false },
      ],
      answer: { helpful: true, message_raw: "Meer info op https://example.com/reis", message: null, rejected: "link" },
      input_tokens: 390,
      output_tokens: 30,
      signal_status: "skipped",
    }),
    trace("t3", {
      last_seen_at: "2026-11-03T08:12:00.000Z",
      status: "paused",
      seen_count: 3,
      items: [
        { type: "card", id: "c2", kind: "card", title: "Belastingaangifte", fragment: "Bonnetjes zoeken", stale: false },
        { type: "note", id: "n6", kind: "note", title: "Aftrekposten", fragment: "Hypotheekrente, zorgkosten.", stale: false },
        { type: "note", id: "n7", kind: "note", title: "Brief van de Belastingdienst", fragment: "Uitstel tot 1 mei aangevraagd.", stale: false },
      ],
    }),
    trace("t4", {
      last_seen_at: "2026-10-30T09:00:00.000Z",
      items: [
        { type: "note", id: "n8", kind: "note", title: "Pasta carbonara", fragment: "Guanciale, pecorino, eigeel.", stale: false },
        { type: "note", id: "n9", kind: "note", title: "Pasta met pesto", fragment: "Basilicum uit eigen tuin.", stale: false },
        { type: "note", id: "n10", kind: "note", title: "Pastamachine", fragment: "", stale: false },
      ],
      answer: { helpful: false, message_raw: "", message: null, rejected: null },
      input_tokens: 380,
      output_tokens: 12,
      signal_status: "dismissed",
    }),
    trace("t5", {
      last_seen_at: "2026-10-28T09:00:00.000Z",
      items: [
        { type: "note", id: "n11", kind: "note", title: "Hardlopen schema", fragment: "Drie keer per week, rustig opbouwen.", stale: false },
        { type: "note", id: "n12", kind: "note", title: "Nieuwe schoenen", fragment: "", stale: false },
        { type: "card", id: "c3", kind: "card", title: "Marathon inschrijven", fragment: "", stale: false },
      ],
      answer: { helpful: true, message_raw: "Je bouwt je hardloopschema rustig op, een inschrijving past erbij.", message: "Je bouwt je hardloopschema rustig op, een inschrijving past erbij.", rejected: null },
      input_tokens: 401,
      output_tokens: 33,
      signal_status: "acted",
    }),
  ],
};

export const emptyAssistantLogFixture: AssistantLogExport = { ...assistantLogFixture, runs: [], traces: [] };

export async function getAssistantLog(): Promise<ActionResult<AssistantLogExport>> {
  return { success: true, data: assistantLogFixture };
}

import { AssistantLogPanel } from "./AssistantLogPanel";
import { StoryIntro } from "@/.ladle/story-kit";
import type { AssistantLogView, LogRun, LogTrace } from "@/lib/assistant/log-types";
import type { StoryDefault } from "@ladle/react";

export default { title: "Account / Assistant log panel" } satisfies StoryDefault;

// The panel is `position: fixed`, so the wrapper keeps the Provider div (the
// baseline crop) from collapsing. Stories seed it through `initialLog`.
const base = { open: true, onClose: () => {} } as const;

const run = (over: Partial<LogRun>): LogRun => ({
  id: "r",
  path: "lazy",
  started_at: "2025-12-31T10:00:00Z",
  duration_ms: 120,
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
  created_at: "2025-12-31T10:00:00Z",
  ...over,
});

const note = (id: string, title: string, fragment: string, stale = false) => ({
  type: "note",
  id,
  kind: "note",
  title,
  fragment,
  stale,
});

const trace = (over: Partial<LogTrace>): LogTrace => ({
  id: "t",
  dedupe_key: "k",
  status: "asked",
  items: [],
  similarities: [],
  prompt_version: "a1b2c3d4e5f6",
  model: "claude-haiku",
  answer: null,
  input_tokens: 0,
  output_tokens: 0,
  duration_ms: 0,
  signal_id: null,
  first_seen_at: "2025-12-31T10:00:00Z",
  last_seen_at: "2025-12-31T10:00:00Z",
  seen_count: 1,
  signal_status: null,
  status_changed_at: null,
  ...over,
});

const coffee = [
  note("n1", "Koffiebonen vergelijken", "Ethiopië smaakt fruitig, Brazilië eerder noten."),
  note("n2", "Nieuwe molen", "Handmolen of elektrisch? Prijsrange 80 tot 150 euro."),
  note("n3", "Ochtendroutine", "Eerst koffie, dan pas mail."),
];

const log: AssistantLogView = {
  runs: [
    run({ id: "r1", outcome: "ok", started_at: "2025-12-31T05:30:00Z", edges: 14, clusters: 2, known: 1, candidates: 1, calls: 1, helpful: 1, input_tokens: 412, output_tokens: 58 }),
    run({ id: "r2", outcome: "all_known", started_at: "2025-12-31T14:10:00Z", edges: 14, clusters: 2, known: 2 }),
    run({ id: "r3", outcome: "paused", started_at: "2025-12-30T09:00:00Z", edges: 9, clusters: 1, candidates: 1 }),
    run({ id: "r4", outcome: "no_edges", started_at: "2025-12-29T09:00:00Z" }),
    run({ id: "r5", outcome: "error", error_code: "overloaded", started_at: "2025-12-29T18:00:00Z", edges: 6, clusters: 1, candidates: 1, calls: 1, call_failures: 1 }),
  ],
  traces: [
    trace({
      id: "t1",
      status: "asked",
      items: coffee,
      answer: { helpful: true, message_raw: "Je schrijft vaak over koffie.", message: "Je schrijft vaak over koffie: misschien een vergelijking maken?", rejected: null },
      input_tokens: 412,
      output_tokens: 58,
      signal_status: "new",
      last_seen_at: "2025-12-31T05:30:00Z",
    }),
    trace({
      id: "t2",
      status: "paused",
      items: [note("n4", "Verhuisdoos 3", "Keuken, boeken, planten."), note("n5", "Inpaklijst", "Dozen bestellen."), note("n6", "Nieuw adres", "Doorgeven aan de bank.", true)],
      seen_count: 3,
      last_seen_at: "2025-12-30T09:00:00Z",
    }),
    trace({
      id: "t3",
      status: "asked",
      items: coffee,
      answer: { helpful: true, message_raw: "Bekijk https://voorbeeld.nl", message: null, rejected: "link" },
      input_tokens: 398,
      output_tokens: 41,
      signal_status: "skipped",
      last_seen_at: "2025-12-20T09:00:00Z",
    }),
    trace({
      id: "t4",
      status: "asked",
      items: coffee,
      answer: { helpful: true, message_raw: "Drie notities gaan over je ochtend.", message: "Drie notities gaan over je ochtend.", rejected: null },
      input_tokens: 400,
      output_tokens: 30,
      signal_status: "dismissed",
      last_seen_at: "2025-12-18T09:00:00Z",
    }),
  ],
};

export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Level-2 panel opened from the AI settings: runs of the last 30 days per day, and what Haiku saw and answered, plus the export for analysis."
      note="AssistantLogPanel"
    />
    <AssistantLogPanel {...base} initialLog={log} />
  </div>
);

export const Empty = () => (
  <div className="min-h-screen">
    <AssistantLogPanel {...base} initialLog={{ runs: [], traces: [] }} />
  </div>
);

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LOG_VIEW_DAYS, type LogRun, type LogTrace } from "@/lib/assistant/log-types";

// Reads of the Assistent log (ADR-0060 §5) through the member's own RLS client:
// the policies decide what is visible, nothing is filtered on user_id here.

type Client = SupabaseClient<Database>;

const RUN_LIMIT = 1000;
const TRACE_LIMIT = 500;
const DAY_MS = 86_400_000;

function withoutUser<T extends { user_id: string }>(row: T): Omit<T, "user_id"> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "user_id")) as Omit<T, "user_id">;
}

async function readRuns(client: Client, since: Date | null): Promise<LogRun[]> {
  let query = client.from("assistant_pattern_runs").select("*").order("started_at", { ascending: false }).limit(RUN_LIMIT);
  if (since) query = query.gte("started_at", since.toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(withoutUser);
}

async function readTraces(client: Client): Promise<LogTrace[]> {
  const { data, error } = await client
    .from("assistant_pattern_traces")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(TRACE_LIMIT);
  if (error) throw error;
  const rows = data ?? [];

  const signalIds = [...new Set(rows.map((r) => r.signal_id).filter((id): id is string => id !== null))];
  const signals = new Map<string, { status: string; status_changed_at: string }>();
  if (signalIds.length > 0) {
    const result = await client.from("agent_signals").select("id, status, status_changed_at").in("id", signalIds);
    if (result.error) throw result.error;
    for (const s of result.data ?? []) signals.set(s.id, s);
  }
  return rows.map((row) => {
    const signal = row.signal_id ? signals.get(row.signal_id) : undefined;
    return { ...withoutUser(row), signal_status: signal?.status ?? null, status_changed_at: signal?.status_changed_at ?? null };
  });
}

/** Runs of the last 30 days and the traces, newest first: what the Settings panel shows. */
export async function readAssistantLogView(client: Client, now: Date = new Date()) {
  const since = new Date(now.getTime() - LOG_VIEW_DAYS * DAY_MS);
  const [runs, traces] = await Promise.all([readRuns(client, since), readTraces(client)]);
  return { runs, traces };
}

/** Everything the member may see (runs up to the 180-day prune, traces up to 90 days): the export. */
export async function readAssistantLogAll(client: Client) {
  const [runs, traces] = await Promise.all([readRuns(client, null), readTraces(client)]);
  return { runs, traces };
}

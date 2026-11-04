import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL } from "@/lib/ai";
import { serializeAssistantLog, type AssistantLogExport, type LogConfig } from "@/lib/assistant/log-export";
import { buildConfig } from "@/lib/assistant/pattern-log";
import { MAX_CALLS_PER_DAY, MAX_CANDIDATES, systemFor } from "@/lib/assistant/patterns";
import type { Database } from "@/lib/database.types";

// Reads the member's own Assistent log (ADR-0060 §5). Always through the member's
// session client: RLS decides what is visible, nothing here can reach another member.

type Client = SupabaseClient<Database>;

const MAX_RUNS = 1000;
const MAX_TRACES = 500;

export async function loadAssistantLog(
  client: Client,
  userId: string,
  options: { now?: Date; runDays?: number } = {},
): Promise<AssistantLogExport> {
  const now = options.now ?? new Date();
  let runsQuery = client
    .from("assistant_pattern_runs")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(MAX_RUNS);
  if (options.runDays !== undefined) {
    runsQuery = runsQuery.gte("started_at", new Date(now.getTime() - options.runDays * 86_400_000).toISOString());
  }

  const [runs, traces, profile] = await Promise.all([
    runsQuery,
    client
      .from("assistant_pattern_traces")
      .select("*, agent_signals(status, status_changed_at)")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(MAX_TRACES),
    client.from("profiles").select("assistant_patterns_enabled, locale").eq("id", userId).maybeSingle(),
  ]);
  if (runs.error) throw runs.error;
  if (traces.error) throw traces.error;
  if (profile.error) throw profile.error;

  const locale = profile.data?.locale === "en" ? "en" : "nl";
  const config: LogConfig = {
    ...buildConfig({
      model: AI_MODEL,
      system: systemFor(locale),
      maxCallsPerDay: MAX_CALLS_PER_DAY,
      maxCandidates: MAX_CANDIDATES,
    }),
    patterns_enabled: profile.data?.assistant_patterns_enabled ?? true,
    locale,
  };

  return serializeAssistantLog({ exportedAt: now, config, runs: runs.data ?? [], traces: traces.data ?? [] });
}

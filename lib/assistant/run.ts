import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { runPatterns } from "@/lib/assistant/patterns";
import type { Database } from "@/lib/database.types";

// Assistent runtime (ADR-0046 §7). Lazy path: the member's own RLS client from
// `after()`. Cron path: service_role, one member at a time. Both fail silently
// and log one JSON line without content, like runLazyEmbeddingDrain.
type Client = SupabaseClient<Database>;

export type AssistantPath = "lazy" | "cron";

/** Pattern step (ADR-0046 §3): a no-op without opt-in, key or embeddings. */
export async function runPatternStep(args: { client: Client; userId: string; path: AssistantPath }): Promise<number> {
  return runPatterns(args);
}

/** Returns the number of new signals, or null when the run was skipped or failed. */
export async function runAssistant(args: { client: Client; userId: string; path: AssistantPath }): Promise<number | null> {
  const { client, userId, path } = args;
  const started = Date.now();
  try {
    let created: number;
    if (path === "lazy") {
      const { data: claimed } = await client.rpc("claim_assistant_run");
      if (!claimed) return null;
      // Settle first so the cook rhythm is current; the cron path relies on the calendar-sync cron for this.
      await client.rpc("settle_cooked_meals");
      const { data, error } = await client.rpc("detect_rhythm_signals");
      if (error) throw error;
      created = data ?? 0;
    } else {
      const { data, error } = await client.rpc("detect_rhythm_signals_for", { p_user: userId });
      if (error) throw error;
      created = data ?? 0;
    }
    created += await runPatternStep({ client, userId, path });
    console.info(JSON.stringify({ event: "assistant_run", path, created, ms: Date.now() - started }));
    return created;
  } catch {
    console.error("[assistant] run failed", path);
    return null;
  }
}

export type AssistantAllResult = { members: number; failed: number; remaining: number; created: number };

/**
 * Cron path (ADR-0039 §6): every member within a time budget, members whose
 * last Assistent run is oldest first (service_role-only function; private.
 * assistant_runs is not reachable over PostgREST). If that call fails, the
 * start index rotates daily so a budget cut-off does not starve the same members.
 */
export async function runAssistantForAllMembers(
  client: Client,
  options: { budgetMs: number; now?: number },
): Promise<AssistantAllResult> {
  const deadline = Date.now() + options.budgetMs;
  const result: AssistantAllResult = { members: 0, failed: 0, remaining: 0, created: 0 };
  let ordered: { id: string }[];
  const byRun = await client.rpc("assistant_members_by_last_run");
  if (!byRun.error && byRun.data) {
    ordered = byRun.data.map((row) => ({ id: row.user_id }));
  } else {
    const { data: profiles, error } = await client.from("profiles").select("id").order("id");
    if (error) {
      console.error("[assistant] members failed", error.code);
      result.failed++;
      return result;
    }
    const offset = profiles.length ? Math.floor((options.now ?? Date.now()) / 86_400_000) % profiles.length : 0;
    ordered = [...profiles.slice(offset), ...profiles.slice(0, offset)];
  }
  for (const [index, profile] of ordered.entries()) {
    if (Date.now() >= deadline) {
      result.remaining = ordered.length - index;
      break;
    }
    const created = await runAssistant({ client, userId: profile.id, path: "cron" });
    if (created === null) result.failed++;
    else {
      result.members++;
      result.created += created;
    }
  }
  return result;
}

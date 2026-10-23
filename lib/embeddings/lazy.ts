import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmbeddingConfigured } from "@/lib/ai";
import type { Database } from "@/lib/database.types";
import { drainEmbeddings } from "@/lib/embeddings/drain";

// Lazy trigger (ADR-0043 §5): called from `after()`, so the page never waits.
// RLS client only; claim_embedding_drain() allows one run per 10 minutes.
const BUDGET_MS = 20_000;
const MAX_SOURCES = 50;

export async function runLazyEmbeddingDrain(client: SupabaseClient<Database>, userId: string): Promise<void> {
  try {
    if (!isEmbeddingConfigured()) return;
    const { data: profile } = await client.from("profiles").select("ai_enabled").eq("id", userId).maybeSingle();
    if (!profile?.ai_enabled) return;
    const { data: claimed } = await client.rpc("claim_embedding_drain");
    if (!claimed) return;
    const result = await drainEmbeddings({ client, budgetMs: BUDGET_MS, maxSources: MAX_SOURCES });
    console.info(JSON.stringify({ event: "embedding_drain", path: "lazy", ...result }));
  } catch {
    console.error("[embeddings] lazy drain failed");
  }
}

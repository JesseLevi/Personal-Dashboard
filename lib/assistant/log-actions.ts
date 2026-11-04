"use server";

import { readAssistantLogView } from "@/lib/assistant/log";
import type { AssistantLogResult } from "@/lib/assistant/log-types";
import { requireUserId } from "@/lib/profile/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Read for the Assistent-logboek panel (ADR-0060 §5), under the member's session.
// Own RLS client, never service_role: the policies show only the caller's rows.
export async function loadAssistantLog(): Promise<AssistantLogResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: "unauthenticated" };
  try {
    const client = await createSupabaseServerClient();
    return { success: true, data: await readAssistantLogView(client) };
  } catch {
    console.error("[assistant] log read failed");
    return { success: false, error: "generic" };
  }
}

"use server";

import type { AssistantLogExport } from "@/lib/assistant/log-export";
import { loadAssistantLog } from "@/lib/assistant/log";
import { LOG_PANEL_DAYS } from "@/lib/assistant/log-view";
import { requireUserId } from "@/lib/profile/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/profile/types";

// Read for the Assistent log panel (ADR-0060 §5): the member's own runs of the last
// 30 days and their traces, through the RLS client. Returns a result, never throws.

export async function getAssistantLog(): Promise<ActionResult<AssistantLogExport>> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  try {
    const client = await createSupabaseServerClient();
    return { success: true, data: await loadAssistantLog(client, auth.userId, { runDays: LOG_PANEL_DAYS }) };
  } catch {
    console.error("[assistant] log read failed");
    return { success: false, error: "generic" };
  }
}

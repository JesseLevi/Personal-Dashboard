import { NextResponse } from "next/server";
import { exportFileName } from "@/lib/assistant/log-export";
import { loadAssistantLog } from "@/lib/assistant/log";
import { getAuthenticatedUserId } from "@/lib/profile/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Export for analysis" (ADR-0060 §5): one JSON download of the member's own Assistent
// log. Runs under the member's session with the RLS client, never service_role. A plain
// read: no tokens, no LLM. Never cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const client = await createSupabaseServerClient();
    const log = await loadAssistantLog(client, userId);
    return new NextResponse(JSON.stringify(log, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(new Date(log.exported_at))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error("[assistant] log export failed");
    return NextResponse.json({ error: "generic" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

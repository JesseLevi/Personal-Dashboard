import { NextResponse } from "next/server";
import { readAssistantLogAll } from "@/lib/assistant/log";
import { exportFileName, serializeAssistantLog } from "@/lib/assistant/log-export";
import { patternConfig } from "@/lib/assistant/patterns";
import { requireUserId } from "@/lib/profile/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Exporteer voor analyse" (ADR-0060 §5): one JSON download of the member's own
// log, read under their session with the RLS client. No LLM, no service_role.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  try {
    const client = await createSupabaseServerClient();
    const [{ runs, traces }, profile] = await Promise.all([
      readAssistantLogAll(client),
      client.from("profiles").select("locale").eq("id", auth.userId).maybeSingle(),
    ]);
    const exportedAt = new Date();
    const body = serializeAssistantLog({
      exportedAt,
      config: patternConfig(profile.data?.locale === "en" ? "en" : "nl"),
      runs,
      traces,
    });
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(exportedAt)}"`,
      },
    });
  } catch {
    console.error("[assistant] log export failed");
    return NextResponse.json({ error: "generic" }, { status: 500, headers: NO_STORE });
  }
}

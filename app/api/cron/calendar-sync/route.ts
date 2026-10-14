import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/agenda/cron-auth";
import { syncAllStaleAccounts } from "@/lib/agenda/sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Daily backstop for the calendar sync (ADR-0039). Not a user request: Vercel
// Cron calls it with `Authorization: Bearer $CRON_SECRET`, and anything else
// gets 401 before a service_role client exists. The budget stays below
// maxDuration; accounts left over wait for the next run or the lazy path.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 45_000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await syncAllStaleAccounts(createSupabaseServiceClient(), { budgetMs: BUDGET_MS });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { settleAllMembers } from "@/lib/activity/settle";
import { isCronAuthorized } from "@/lib/agenda/cron-auth";
import { syncAllStaleAccounts } from "@/lib/agenda/sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Daily backstop for the calendar sync (ADR-0039). Not a user request: Vercel
// Cron calls it with `Authorization: Bearer $CRON_SECRET`, and anything else
// gets 401 before a service_role client exists. The budget stays below
// maxDuration; accounts left over wait for the next run or the lazy path.
// The cooked-meals settle (ADR-0044) follows the sync in the rest of the budget.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYNC_BUDGET_MS = 35_000;
const TOTAL_BUDGET_MS = 50_000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  const client = createSupabaseServiceClient();
  const sync = await syncAllStaleAccounts(client, { budgetMs: SYNC_BUDGET_MS });
  const settle = await settleAllMembers(client, { budgetMs: Math.max(TOTAL_BUDGET_MS - (Date.now() - started), 0) });
  return NextResponse.json({ ...sync, settle });
}

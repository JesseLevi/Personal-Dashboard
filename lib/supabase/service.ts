import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// The one service_role client in app code (ADR-0039 §4). Only the closed cron
// route may import it; it never runs on a user's request path (ADR-0033), and
// scripts/check-server-only.sh allows this file and no other. It bypasses RLS,
// so callers pass an account id and let the database derive the owner.
export function createSupabaseServiceClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

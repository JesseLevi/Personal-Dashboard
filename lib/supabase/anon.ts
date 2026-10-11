import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Stateless anon client (ADR-0031): no cookies read or written, no session, so
// the role is always `anon`. Only for the public login-greeting RPC; everything
// user-scoped goes through createSupabaseServerClient().
export function createSupabaseAnonClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

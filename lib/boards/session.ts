import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Shared by lib/boards/queries.ts and app/(app)/te-doen/actions.ts: RLS is
// the real ownership boundary, but every read/write below also filters on
// this id explicitly rather than trusting a client-supplied user_id (ADR-0002
// / ADR-0003, and the "don't trust the client for ownership" note on #92).
export async function getAuthenticatedUserId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The browser never talks to Supabase directly (ADR-0003): all access goes
// through this server-side client, authenticated as the requesting user so
// RLS applies. Note: no NEXT_PUBLIC_ env vars anywhere — nothing about the
// Supabase deployment is exposed to the client bundle.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Next.js forbids cookie writes during Server Component render, so
            // a token refresh triggered from an RSC lands here. The refreshed
            // session still applies to this request; persisting it is the job
            // of the session-refresh middleware (Phase 1 follow-up ticket).
          }
        },
      },
    },
  );
}

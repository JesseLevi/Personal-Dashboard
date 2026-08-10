import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

// The browser never talks to Supabase directly (ADR-0003): all access goes
// through this server-side client, authenticated as the requesting user so
// RLS applies. Note: no NEXT_PUBLIC_ env vars anywhere — nothing about the
// Supabase deployment is exposed to the client bundle.
// <Database> types every .from(table) call against lib/database.types.ts —
// added for #92's board/column/card queries, kept here (not re-declared
// per call site) so every caller, present and future, gets the same typing.
// #168: wrapped in React's cache() so every call within one request/RSC
// render reuses the same client instance instead of re-reading cookies() and
// re-constructing a client per call site — this is what makes the cached
// getAuthenticatedUserId() in lib/boards/session.ts free after its first
// call in a given request.
export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
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
            // of middleware.ts's session-refresh pass (#168/#8), which runs
            // ahead of the RSC render and can write cookies onto the response.
          }
        },
      },
    },
  );
});

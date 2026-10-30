import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// #168/#8: closes the token-refresh hole lib/supabase/server.ts's own catch
// block has documented since #92 — Next.js forbids cookie writes during
// Server Component render, so a refresh triggered from an RSC never
// persisted; the refreshed session applied to that one request and was gone
// on the next. Middleware runs ahead of rendering and is allowed to write
// response cookies, so it's the only place in this app a refreshed session
// can actually be saved.
//
// Deliberately NOT a route guard: this repo already has exactly one
// redirect rule for unauthenticated access to (app) routes --
// app/(app)/layout.tsx's own check, which predates this file and is kept
// (ticket instruction: don't create a second, competing redirect rule).
// This middleware's only job is to call getClaims() early enough (before
// any response is generated -- @supabase/ssr's own documented requirement)
// that a refreshed access/refresh token pair gets written back onto the
// response via setAll below; the layout still decides who gets redirected.
//
// Same anon-key server client shape as lib/supabase/server.ts (ADR-0002/
// ADR-0003 -- no NEXT_PUBLIC_ vars, never service_role), just wired to
// NextRequest/NextResponse's cookie API instead of next/headers' cookies()
// since middleware has no access to the latter.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Mirror the refreshed cookies onto the request too, not just the
          // response: a later middleware/handler reading request.cookies in
          // this same pass must see the new values, and re-deriving
          // `response` from the updated `request` is the documented way to
          // keep both in sync (the response object captured above still
          // wraps the stale request otherwise).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Triggers a token refresh when the access token is expired (verified
  // locally via WebCrypto against the project's asymmetric signing key --
  // see lib/boards/session.ts's header comment); refreshed cookies land on
  // `response` through setAll above before this function returns them.
  await supabase.auth.getClaims();

  return response;
}

// Excludes: Next's own static/image-optimizer internals, the file-convention
// static assets under app/ (favicon.ico, icon.png, apple-icon.png,
// manifest.webmanifest) and public/ (anything with a common static
// extension), and app/api/recipe-thumbnail/[recipeId]/route.ts -- #171's
// same-origin thumbnail image route, deliberately not routed through an
// auth-cookie-refreshing middleware pass since it authenticates itself
// per-request the same way every other server module does and is called
// from a plain <img>/next/image src, not a context that benefits from a
// refreshed cookie being written back; and app/api/widget (ADR-0047), which
// authenticates by bearer token and must never touch a session.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/recipe-thumbnail|api/widget|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

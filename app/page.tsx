import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/boards/session";

// #158: the placeholder Phase-1 homepage is gone now that /login has a real
// design — this route is redirect-only. /te-doen is the landing page for a
// signed-in visit (password sign-in, magic link, and this route all agree,
// per app/login/actions.ts and app/auth/confirm/route.ts); a signed-out
// visit goes to /login. #168: cache()'d helper instead of a direct
// supabase.auth.getUser() call — see lib/boards/session.ts.
export default async function HomePage() {
  const userId = await getAuthenticatedUserId();
  redirect(userId ? "/te-doen" : "/login");
}

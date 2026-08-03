import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// #158: the placeholder Phase-1 homepage is gone now that /login has a real
// design — this route is redirect-only. /te-doen is the landing page for a
// signed-in visit (password sign-in, magic link, and this route all agree,
// per app/login/actions.ts and app/auth/confirm/route.ts); a signed-out
// visit goes to /login.
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/te-doen" : "/login");
}

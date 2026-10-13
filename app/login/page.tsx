import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shouldRedirectAuthenticated } from "@/lib/auth/login-redirect";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { LoginFormClient } from "./LoginFormClient";
import { lookupGreetingName } from "./greeting-action";
import { sendLoginCode, signInWithPassword } from "./actions";

// figma: node-id=3929:25181 (Pages/Login — LogIn/Desktop 3929:25202,
// LogIn/Mobile 3929:25182). Server Component: auth-check + translations +
// the form; the frame and visual pane live in layout.tsx; LoginForm.tsx owns the interactive
// two-step animation. Full record: design/notes/LoginForm.md.
//
// Desktop only ever draws step 1 (StepAnimation didn't exist yet when that
// frame was made) — read as "desktop gets the same two-step behaviour as
// mobile", not "desktop has no step 3" (design/notes/LoginForm.md).
export default async function LoginPage() {
  // #168: cache()'d helper instead of a direct supabase.auth.getUser() call
  // — see lib/boards/session.ts.
  const userId = await getAuthenticatedUserId();
  // A login action re-renders this route with the fresh session; LoginForm must stay
  // mounted to play its exit animation and navigate itself (lib/auth/login-redirect.ts).
  const isServerAction = (await headers()).has("next-action");
  if (shouldRedirectAuthenticated({ userId, isServerAction })) redirect("/te-doen");

  // Server-side env, never NEXT_PUBLIC_ (ADR-0031).
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || null;

  return (
    <LoginFormClient
      signInWithPasswordAction={signInWithPassword}
      sendLoginCodeAction={sendLoginCode}
      lookupGreetingNameAction={lookupGreetingName}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}

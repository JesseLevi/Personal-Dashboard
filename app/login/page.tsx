import { redirect } from "next/navigation";
import Image from "next/image";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { LoginFormClient } from "./LoginFormClient";
import { lookupGreetingName } from "./greeting-action";
import { sendMagicLink, signInWithPassword } from "./actions";

// figma: node-id=3929:25181 (Pages/Login — LogIn/Desktop 3929:25202,
// LogIn/Mobile 3929:25182). Server Component: auth-check + translations +
// layout + the decorative visual pane; LoginForm.tsx owns the interactive
// two-step animation. Full record: design/notes/LoginForm.md.
//
// Desktop only ever draws step 1 (StepAnimation didn't exist yet when that
// frame was made) — read as "desktop gets the same two-step behaviour as
// mobile", not "desktop has no step 3" (design/notes/LoginForm.md).
export default async function LoginPage() {
  // #168: cache()'d helper instead of a direct supabase.auth.getUser() call
  // — see lib/boards/session.ts.
  const userId = await getAuthenticatedUserId();
  if (userId) redirect("/te-doen");

  // Server-side env, never NEXT_PUBLIC_ (ADR-0031).
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || null;

  return (
    // `lg` (1024px), not `md`: below it (including tablet-width viewports)
    // gets the stacked mobile layout — see design/notes/LoginForm.md. Row's
    // default cross-axis `stretch` (no `items-*` override) is load-bearing:
    // it's what gives the image's `lg:h-full` a real height to resolve
    // against, and what makes the login column's own height fill the row so
    // its internal `justify-center` actually has room to center into.
    // `h-screen`, not `min-h-screen`: a percentage height (`h-full` on the
    // image below) only resolves against a *definite* ancestor height —
    // `min-height` alone leaves that ancestor height indefinite even once
    // painted, and `h-full` silently collapses to 0 (confirmed empirically,
    // not assumed — see design/notes/LoginForm.md).
    // `lg:gap-page-stack` is a stack-family token on a row axis: that is how
    // the Figma node binds it, not a slip — see design/notes/LoginForm.md.
    <main className="flex h-screen flex-col p-component-lg lg:flex-row lg:gap-page-stack">
      <div className="flex flex-1 flex-col items-center justify-center">
        <LoginFormClient
          signInWithPasswordAction={signInWithPassword}
          sendMagicLinkAction={sendMagicLink}
          lookupGreetingNameAction={lookupGreetingName}
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>

      {/* Flat image-fill in Figma (both breakpoints) — exported once and
          committed as a static asset rather than re-fetched at build time
          (Figma URLs expire). Decorative: aria-hidden + empty alt.
          Width-driven (`w-full`) stacked under the login block on mobile;
          height-driven (`h-full`, `w-auto`) beside it on desktop, so it
          always fills the available square exactly instead of following
          whatever width `flex-1` happens to leave it — see
          design/notes/LoginForm.md for the bug this replaced. */}
      <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-container bg-surface-secondary lg:h-full lg:w-auto">
        <Image
          src="/login/login-visual-mobile.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 1024px) 0px, 100vw"
          className="object-cover lg:hidden"
        />
        <Image
          src="/login/login-visual-desktop.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 1024px) 100vh, 0px"
          className="hidden object-cover lg:block"
        />
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import Image from "next/image";
import { LoginExitProvider, LoginVisual } from "./LoginExit";

// Shared by /login and /login/code (#492): the page frame and the decorative
// visual live here, so the image stays put while the form column swaps from the
// e-mail steps to the code step. Page frame record: design/notes/LoginForm.md.
export default function LoginLayout({ children }: { children: ReactNode }) {
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
      <LoginExitProvider>
        <div className="flex flex-1 flex-col items-center justify-center">{children}</div>

        {/* Flat image-fill in Figma (both breakpoints) — exported once and
            committed as a static asset rather than re-fetched at build time
            (Figma URLs expire). Decorative: aria-hidden + empty alt.
            Width-driven (`w-full`) stacked under the login block on mobile;
            height-driven (`h-full`, `w-auto`) beside it on desktop, so it
            always fills the available square exactly instead of following
            whatever width `flex-1` happens to leave it — see
            design/notes/LoginForm.md for the bug this replaced. Blurs out
            last in LoginForm's exit (LoginExit.tsx, stagger index 4). */}
        <LoginVisual
          index={4}
          className="relative aspect-square w-full shrink-0 overflow-hidden rounded-container bg-surface-secondary lg:h-full lg:w-auto"
        >
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
        </LoginVisual>
      </LoginExitProvider>
    </main>
  );
}

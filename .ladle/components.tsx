import "../app/globals.css";
import type { GlobalProvider } from "@ladle/react";

/**
 * Ladle's per-story wrapper hook (`@ladle/react`'s `Provider` named export,
 * consumed from `virtual:generated-list`, which requires this exact filename
 * — see get-components-import.js in @ladle/react's Vite plugin). It wraps
 * every story's rendered output, inside `Story` (lib/app/src/story.tsx), for
 * BOTH of Ladle's render paths:
 * - the normal embedded workbench (sidebar + preview pane), where the outer
 *   chrome is themed separately via `.ladle/ladle-theme.css` + `appendToHead`
 *   (see that file's header for why the chrome needs its own hook — it lives
 *   in a DOM subtree this file never renders into);
 * - Ladle's bare `?mode=preview` view (`app.tsx`'s `ModeState.Preview`
 *   branch), which renders `<Story>` with NONE of the chrome DOM (no
 *   `.ladle-background`/`.ladle-wrapper`) — this is why the preview canvas
 *   was still browser-default white even after #41 themed the chrome, and
 *   why this Provider (reached by both paths) is the fix rather than another
 *   chrome-side tweak.
 *
 * Background reads the `surface` semantic token via the ordinary `bg-surface`
 * Tailwind utility (no hex, no `dark:` prefix) — this file already imports
 * `app/globals.css`, so `[data-theme="dark"]`'s override in `app/theme.css`
 * applies here exactly like it does in the real app, and Ladle's Light/Dark
 * toggle (which sets `data-theme` on the outer document) flips it.
 *
 * Unlike `appendToHead`'s injected `<link>` (a dev-server-only `/@fs/` path,
 * see #49), this is a real module import that Vite bundles and fingerprints
 * as part of the ordinary story module graph, so it survives `pnpm
 * ladle:build` the same way any other CSS import in this repo does.
 */
export const Provider: GlobalProvider = ({ children }) => (
  <div className="min-h-screen bg-surface p-8">{children}</div>
);

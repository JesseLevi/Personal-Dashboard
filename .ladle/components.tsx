import "../app/globals.css";
import "./story-frame.css";
import type { GlobalProvider } from "@ladle/react";
import { NextIntlClientProvider } from "next-intl";
import nl from "../messages/nl.json";

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
 * Background reads the semantic token via an ordinary Tailwind utility (no
 * hex, no `dark:` prefix) — this file already imports `app/globals.css`, so
 * `[data-theme="dark"]`'s override in `app/theme.css` applies here exactly
 * like it does in the real app, and Ladle's Light/Dark toggle (which sets
 * `data-theme` on the outer document) flips it.
 *
 * The utility is `bg-surface-highlight-white`, not its pre-#203 name: #203 renamed
 * that token onto its Figma path and missed this file, so from #203 until
 * #213 the class named a token that no longer existed and Tailwind emitted no
 * rule for it at all — the canvas silently reverted to the
 * browser-default white this Provider was written to replace. In light mode
 * that is the same white the token resolves to, which is why no baseline ever
 * moved and nobody noticed; **in dark mode it meant the canvas stayed white**
 * while the components on it switched, i.e. the toggle this comment describes
 * had been dead for two tickets.
 *
 * Unlike the outer chrome's stylesheet injection (.ladle/vite.config.mjs, a
 * `pre`-order transformIndexHtml hook — needed because #49 found that a plain
 * `appendToHead` <link> is dev-server-only and never survives `pnpm
 * ladle:build`), this file's CSS import is a real module import that Vite
 * bundles and fingerprints as part of the ordinary story module graph, so it
 * survives the build the same way any other CSS import in this repo does.
 *
 * `NextIntlClientProvider` was added for #94 (the first story-able component
 * to call `useTranslations`/`useFormatter` directly rather than receiving
 * already-translated strings as props, per design/notes/CardDetailPanel.md)
 * — `app/layout.tsx`'s own provider relies on `getLocale()`/request-scoped
 * message resolution, neither of which exists outside a real Next.js
 * request, so `locale`/`messages` are supplied explicitly here from the same
 * `nl` catalog `i18n/request.ts` hardcodes today. Every pre-existing story
 * that never calls a next-intl hook is unaffected by this addition.
 */
export const Provider: GlobalProvider = ({ children }) => (
  <NextIntlClientProvider locale="nl" messages={nl}>
    <div className="min-h-screen bg-surface-highlight-white p-8">{children}</div>
  </NextIntlClientProvider>
);

import path from "node:path";

/*
 * #49: build-safe replacement for injecting the Ladle chrome stylesheet
 * (.ladle/ladle-theme.css) via `appendToHead` (previously in
 * .ladle/config.mjs).
 *
 * `appendToHead` runs through Ladle's own `transformIndexHtml` hook
 * (@ladle/react's vite-plugin.js), which is a plain-function hook with no
 * `order` set, so Vite treats it as "normal" priority. Vite's build-time HTML
 * handling (`vite:build-html`) only scans a "pre"-order hook's output for
 * `<script type="module" src>` / `<link rel="stylesheet" href>` tags to turn
 * into real bundle entries (see vite/dist/node's html plugin: it calls
 * `applyHtmlTransforms(html, preHooks, ...)` *before* `traverseHtml`'s tag
 * scan). A "normal"-order tag is therefore stamped into the final HTML as an
 * inert string and never enters the module graph — which is exactly why
 * `pnpm ladle:build` shipped the literal dev-only `/@fs/` href in
 * build/index.html instead of a built asset.
 *
 * Registering the identical <link> through a real Vite plugin's `pre`-order
 * transformIndexHtml hook (only reachable via a real vite.config file, hence
 * Ladle's `viteConfig` option) makes Vite scan it *before* that check, so the
 * stylesheet is resolved, pushed through the ordinary CSS pipeline (running
 * `@import "tailwindcss"` + app/theme.css, exactly like ladle-theme.css's own
 * header requires) and fingerprinted into build/assets/ like any other CSS
 * import — and the emitted build/index.html has no machine-specific path,
 * because `/@fs/` is only a *request format* Vite's resolver understands in
 * both dev and build (see resolve.ts's FS_PREFIX handling); it never survives
 * into output HTML since the build always ends by rewriting these tags to
 * content-hashed asset URLs.
 *
 * In dev this behaves identically to the old appendToHead href: the dev
 * server doesn't bundle ahead of time, so it serves the same `/@fs/...`
 * request either way.
 */
const chromeThemeHref = `/@fs/${path.resolve(process.cwd(), ".ladle/ladle-theme.css").split(path.sep).join("/")}`;

/** @type {import('vite').UserConfig} */
const ladleViteConfig = {
  // SettingsPanel imports the real server actions; Ladle gets a no-op stand-in.
  resolve: {
    alias: [
      {
        find: /^@\/lib\/profile\/actions$/,
        replacement: path.resolve(process.cwd(), ".ladle/mocks/profile-actions.ts"),
      },
    ],
  },
  plugins: [
    {
      name: "ladle-chrome-theme",
      transformIndexHtml: {
        order: "pre",
        handler() {
          return [
            {
              tag: "link",
              attrs: { rel: "stylesheet", href: chromeThemeHref },
              injectTo: "head",
            },
          ];
        },
      },
    },
  ],
};

export default ladleViteConfig;

/**
 * Screenshot-baseline gate over every Ladle story (issue #6, ADR-0010).
 *
 * One test per story, generated from Ladle's own build manifest
 * (`build/meta.json`, produced by `pnpm ladle:build` — playwright.config.ts's
 * `webServer` runs that build before this file is even collected) so the story
 * list here can never drift out of sync with what Ladle actually renders.
 *
 * Each story is loaded through Ladle's own `?story=<id>&mode=preview` URL, which
 * renders ONLY the story (still wrapped by .ladle/components.tsx's `Provider`,
 * so design tokens / bg-surface apply) with none of Ladle's outer chrome DOM.
 * That is deliberate, not incidental: `mode=preview` never renders the chrome
 * subtree at all (confirmed by inspecting the rendered DOM before wiring this
 * file — see the ticket #6 handoff for the walkthrough), so these baselines
 * are unaffected by how the chrome itself is themed — including #49, which
 * fixed the chrome stylesheet no-oping in `ladle:build` output (it was
 * injected via a dev-server-only `/@fs/...` path; now a `.ladle/vite.config.mjs`
 * plugin makes it survive the build), and would still be irrelevant here even
 * unfixed.
 *
 * Cross-platform caveat: screenshot pixels are only comparable when captured
 * with the same browser build + OS + font rasterizer. Playwright's default
 * `snapshotPathTemplate` already suffixes each baseline with `-{platform}`
 * (e.g. `-darwin.png` / `-linux.png`) specifically so a mismatched environment
 * fails loudly with "no baseline found" instead of silently diffing unrelated
 * pixels — this file intentionally does not override that template. See the
 * ticket #6 report for the open question this raises for CI.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Playwright compiles this config as CommonJS (the project's package.json has
// no "type": "module"), so __dirname is available and preferred over
// `import.meta.url` here.
const stylePath = path.join(__dirname, "screenshot-override.css");

interface LadleMeta {
  stories: Record<string, { name: string; filePath: string }>;
}

const metaPath = path.join(process.cwd(), "build", "meta.json");
const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as LadleMeta;
const storyIds = Object.keys(meta.stories).sort();

test.describe("Ladle story visual baselines", () => {
  // Fails loudly (rather than reporting a silent "0 tests passed") if the
  // Ladle build didn't produce the manifest this file depends on.
  test("build/meta.json lists at least one story", () => {
    expect(storyIds.length).toBeGreaterThan(0);
  });

  for (const storyId of storyIds) {
    test(storyId, async ({ page }) => {
      // #158: LoginForm.tsx corrects its time-of-day greeting to the
      // visitor's local clock in a post-mount effect, which would otherwise
      // make its baselines flip text depending on when this suite runs.
      // Frozen once here (harmless to every other story, none of which read
      // the clock) rather than added per-story — the zero-tolerance
      // threshold below can't absorb a text change. 14:00 lands in the
      // "afternoon" bucket, matching the Figma reference frames' own sample
      // copy ("Goeiemiddag en welkom").
      await page.clock.setFixedTime(new Date("2026-01-01T14:00:00"));
      await page.goto(`/?story=${storyId}&mode=preview`);

      // .ladle/components.tsx's Provider wraps every story in a `min-h-screen`
      // div; screenshot-override.css neutralizes just that min-height so the
      // baseline crops to the story's actual rendered size instead of the
      // full (mostly blank) viewport.
      const root = page.locator("#ladle-root > div").first();
      await root.waitFor({ state: "visible" });

      await expect(root).toHaveScreenshot(`${storyId}.png`, { stylePath });
    });
  }
});

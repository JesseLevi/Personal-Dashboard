import { defineConfig, devices } from "@playwright/test";

/**
 * Screenshot-baseline gate over the Ladle stories (issue #6, ADR-0010).
 * See tests/visual/ladle.visual.spec.ts for how stories are discovered and
 * screenshotted, and the ticket #6 report for the cross-platform-baseline
 * question this raises for CI.
 */
const PORT = 4310;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Single worker: story pages mount into a shared Ladle SPA shell, and
  // running many story navigations at full concurrency against one preview
  // server buys nothing on a component workbench this small while adding
  // scheduling noise to screenshot timing.
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      // Absolute pixel count, NOT a ratio: every story is cropped from the
      // same full-viewport-width (1280px) Provider wrapper (see the spec
      // file), so a narrow component like a single Tag badge is mostly
      // incidental white padding. A ratio-based tolerance dilutes a real,
      // whole-badge color regression below its threshold on exactly those
      // narrow stories — confirmed by deliberately breaking Tag's "urgent"
      // variant color while building this harness: maxDiffPixelRatio: 0.01
      // let a full red->green badge swap pass silently. maxDiffPixels: 100
      // covers only the handful of anti-aliased edge pixels Playwright's own
      // docs acknowledge can jitter between two runs on the SAME browser+OS
      // (not an attempt to paper over cross-OS font-rasterization
      // differences, which are far larger and must be solved by matching
      // environments — see the ticket #6 report).
      maxDiffPixels: 0,
    },
  },

  // `pnpm ladle:build` produces the static app and its story manifest
  // (build/meta.json, read by tests/visual/ladle.visual.spec.ts) and
  // `ladle preview` serves it — chained so the spec file's story list is
  // always read from the build it's actually testing against, never a stale
  // one.
  webServer: {
    command: `pnpm ladle:build && pnpm exec ladle preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

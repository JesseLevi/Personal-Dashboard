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
  // Was `process.env.CI ? 1 : 0` — the retry was masking exactly the flake
  // described in the `maxDiffPixels` comment below (the ±1px antialiasing
  // noise "was previously hidden by CI retries"). `maxDiffPixels: 16` now
  // absorbs that noise directly, so a retry only doubles the cost of a run
  // and hides genuine flake behind a silent second attempt (#259). Always 0.
  retries: 0,
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
      // BOTH knobs must be zero. They are not redundant, and getting this
      // wrong produces a gate that reports green while seeing nothing:
      //
      // `threshold` is a PER-PIXEL colour distance (YIQ, default 0.2). Any
      // pixel closer than it is counted as identical, so `maxDiffPixels` is
      // never even reached. At the default, swapping the Sidebar's active nav
      // item from stone-300 to stone-200 — the exact regression PR #84
      // shipped past all four other gates — produced a diff count of 0 and
      // PASSED. At `threshold: 0` the same swap reports 7248 differing pixels
      // and fails. Grey-on-grey token mistakes are this project's most common
      // visual defect and they live well inside the default threshold.
      //
      // `maxDiffPixels` is the absolute count of differing pixels, NOT a
      // ratio: every story is cropped from the same 1280px-wide Provider
      // wrapper, so a narrow component like a single Tag badge is mostly
      // incidental white padding and a ratio dilutes a real whole-badge
      // regression below any sane threshold (`maxDiffPixelRatio: 0.01` let a
      // full red->green Tag swap pass silently).
      //
      // `threshold` stays at 0 — it is the knob that catches this project's
      // characteristic defect and must never be widened.
      //
      // `maxDiffPixels` was also 0, on the claim that rasterization is stable
      // within one browser build + OS. Measured on `main` (#203): it is not.
      // Repeated runs of the same three stories reported 0, then 1/4/5, then 0
      // differing pixels — always ±1 in a single channel, always on the
      // antialiased pixels of a rounded corner. Skia's corner AA is not
      // bit-reproducible across runs, so a literal zero made the gate flaky
      // rather than strict, and the flake was previously hidden by CI retries.
      // 16 absorbs that noise while leaving a factor ~450 of headroom below
      // the 7248-pixel #84 regression described above: a real token mistake
      // repaints whole fills, never four corner pixels.
      //
      // Cross-OS rasterization differences are far larger than this and must
      // still be solved by matching environments, never by widening further —
      // see the CI job's comment in .github/workflows/ci.yml.
      threshold: 0,
      maxDiffPixels: 16,
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

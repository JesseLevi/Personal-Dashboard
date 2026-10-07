# Guide: UI components (Figma → code)

Read this before building or changing anything in `components/` or `app/`'s UI. Referenced from `CLAUDE.md`.

## Design system: Figma → code, Atomic Design

The Figma file ("Notion - V2") is the source of truth for UI, mirrored 1:1 into `components/{atoms,molecules,organisms}/` (folder ↔ section map: `Architecture.md` §2). Rules:

- **Component names match Figma layer names.** `Atom/Button` → `components/atoms/Button.tsx`; `Card-content/Recipi` → `components/molecules/CardContentRecipe.tsx` (translate NL→EN in code, keep the mapping obvious).
- **Before building or changing a UI component, fetch its dev-ready node from Figma first.** Don't guess spacing, colour or type scale from memory or a screenshot. Note the node-id in the PR/commit.
  - **Tools.** The `figma-console` bridge (`figma_get_status` with `probe: true` first — it must report "[PD] Personal Dashboard"; `figma_execute` for bindings/geometry) talks to the Desktop Bridge plugin over a local WebSocket: no rate limit, and the only route that exposes `boundVariables`. The hosted Figma MCP (`get_design_context`, `get_screenshot`, `get_metadata`) is rate-limited (Starter plan, no full seat) and dies after a few calls.
  - **A resolved value never identifies a token — read `boundVariables` off the node.** `radius/control-outer` and `radius/card` are both 12; 4/8/12/16 each appear in all three spacing groups; and a ramp step's *name* is not the *state* it is used in (`Button/White` and `Button/Destructive` bind Hover → `…/selected` and Active → `…/hover`; #204 got this wrong, #213 fixed it). Resolve each id via `figma.variables.getVariableByIdAsync()`:

    ```js
    const n = await figma.getNodeByIdAsync('<nodeId>');
    const bv = n.boundVariables || {};   // .fills .strokes .topLeftRadius .itemSpacing .paddingLeft/Top
    // COMPONENT_SET: n.children are the variants — read each one's own bindings.
    ```
  - **Dev Mode annotations are not in the MCP payload.** Read them via the REST API (`GET https://api.figma.com/v1/files/<fileKey>/nodes?ids=<nodeId>`, header `X-Figma-Token` with a personal access token from env/`.mcp.json`; `annotations[].label` per node). Check them whenever a ticket touches interaction (click targets, motion, drag, empty/first-load states). Geometry from the bridge/MCP, behaviour from annotations.
  - **The agent that writes the component does the fetch itself** — first tool call of the build. When delegating, tell the subagent to fetch its node; never paste a pre-digested summary instead.
  - **Pixel-parity is verified, not assumed.** Render the Ladle story, compare it with the Figma screenshot, record the check (and any intentional deviation) in the PR. Run **`pnpm test:visual`** before opening the PR and `pnpm test:visual:update` when a design change is intended (review regenerated PNGs like any diff). In CI the visual job is non-blocking until Linux baselines exist (#188/#260), so a local run is not optional.
  - **Visual flake: run the FULL suite twice, never bisect.** Identical code gives fail-then-pass across full runs, and isolation changes rasterization. Never let two runs overlap. `threshold` stays 0 (it catches grey-on-grey); `maxDiffPixels` is 16 (Skia rounded-corner AA is not bit-reproducible, ±1 channel). Flake can exceed 16 (seen: 22px on a branch touching no `components/`), so re-run the full suite before believing a lone failure.
  - **Gate blind spots**: hover/active/focus-visible is rendered only for Button (`tests/visual/states.visual.spec.ts`, #282), `.tiptap` prose only via `note-editor-content--prose` (#283), and dark mode only for the subset below. A green suite says nothing about other components' state tokens or dark values — verify those by eye.
  - **Dark baselines (#281)**: `tests/visual/dark.visual.spec.ts` screenshots 24 stories (every component reading `stroke-primary`/`stroke-lines`/`overlay`/`stroke-secondary-active`, plus Tag/Step/Card/PortionStepper for the surface/text ramps) under `[data-theme="dark"]` (`?theme=dark`), as `<story>-dark-chromium-darwin.png`; macOS only, ~40s. Adding a dark-overriding story means adding its id to `DARK_STORIES`; update with `pnpm exec playwright test tests/visual/dark.visual.spec.ts --update-snapshots`. Proof it bites: breaking dark `stroke-primary` fails 16 of 24.
  - **Icons: Figma layer names are the exact lucide export names** (`Icon/Ellipsis`, not `Icon/Dots`). **Never trust the name alone** — render the candidate export and compare its paths against the Figma node (same-named exports can be false friends: lucide's `Cross` is a medical glyph, not an X). If no lucide export matches, it is an Architecture-level call (custom SVG vs Figma vector) — flag it, never hand-draw. Details and the story-coverage gap → `design/notes/Icon.md`.
- **Never build a component that doesn't exist in Figma yet.** If a ticket needs undesigned UI, stop and flag it (send it back through the Fable/Figma loop) rather than inventing a layout. The same goes for a state: don't invent one the fetched node lacks (e.g. Checkbox's "delete") — leave the gap flagged in `design/notes/<Component>.md`.
- **Claude-designed UI — only on an explicit request.** The user may ask you to design a component, state or screen yourself, in the conversation or on the ticket. Asking you to *build* a ticket is not that request. When asked:
  1. Build it from **existing** components and **bound semantic variables** only. No new tokens or primitives without asking, because the scale is closed.
  2. Design it directly in code; no Figma step. Instead of `// figma: node-id=…`, the header says `// design: Claude-designed on request (#NNN)`. It still gets a Ladle story and a visual baseline, and a screenshot goes to the user for review.
  3. Record "Claude-designed on request (#NNN)" plus the components and tokens it reuses in `design/notes/<Component>.md`.
- **Compose exactly as Figma nests** — if Figma builds `Card-container` from `Card` instances wrapping `Card-content/*` in a slot, the React tree mirrors it. Dependencies flow one way: atoms ← molecules ← organisms ← `app/`.
- **Variants via CVA**: Figma variant properties (Style, Type) → CVA props; **State (Hover/Active/pressed) → CSS pseudo-classes, never props**; Figma booleans (`With icon`) → optional props; SLOT nodes → `children`/named slots.
- **An optimistic success animation can hide a broken write path** (`AnimatedAddToBasketButton` played "Toegevoegd" regardless of `ActionResult`). Show success only on a successful result; an undesigned failure display is flagged, not invented.

The full component update loop (node-id → fetch → update → Ladle diff → PR) is `Architecture.md` §3.3 / ADR-0010.

## Component code conventions (house style)

- **Server Component by default.** A presentational atom/molecule (no handlers, no hooks) must NOT carry `"use client"`; add it only when the component itself owns state/handlers. Precedent: `Dropdown` owns its open state; `Checkbox` stays a Server Component and is interactive via `<button role="checkbox">`.
- **`className` merging**: every component merges the caller's `className` through `cn()` from `@/lib/ui/cn` (clsx + tailwind-merge, configured with the token names generated from `app/theme.css` by `pnpm sync:tokens`) — for cva components `cn(xVariants({ ... }), className)`, never cva's own `class`/`className` arg (it does not dedupe). Later conflicting utilities win, so a bare `hidden` on a `Button` works. Never import `clsx` directly, concatenate by hand or drop a caller's `className`. A new token namespace needs adding in `lib/ui/cn.ts` (`tests/cn.test.ts` covers every family).
- **Icons go through the `Icon` atom only** — the single module importing `lucide-react`. `IconName` is the Figma vocabulary (spelling-corrected), identical to lucide's export names so each entry is a direct lookup. Decorative icons get `aria-hidden`; an icon that IS the control's label gets the accessible name on the wrapping control.
- **Accessibility is part of the atom**: form-shaped atoms expose semantics (`Checkbox` = `role="checkbox"` + `aria-checked`, not a bare styled `<div>`). Decide input-vs-role deliberately and note it in the PR.
- **Ladle stories use Tailwind utilities, never inline `style={{…}}`** — token classes, not raw px/hex. `pnpm ladle:build` (not `ladle build`).
- **Raw hex never appears in `components/`, not even in comments** (`check:server-only` greps the whole file). Describe colours by primitive/token name; exact Figma hex belongs in `design/notes/<Component>.md` (not grepped).
- **A token gap is flagged, never papered over.** If Figma uses a value with no matching *semantic* token, reuse the nearest token for the correct pixels **and** record the gap in `design/notes/<Component>.md` with a one-line pointer in the component. Never hardcode the hex or silently normalise the design.
- **Raw radius/spacing utilities are gated**: `pnpm check:raw-spacing` fails on raw `rounded-{sm..3xl}`, `gap-N`, `space-{x,y}-N`, `p{,x,y,l,r,t,b}-N` in `components/**/*.tsx` and `app/**/*.tsx` (not `*.stories.tsx`). Convert to the semantic token wherever the node's `boundVariables` bind one (measured, never inferred). Where a value is genuinely unbound, has no Figma node, or is a native-element reset (`p-0` on a `<textarea>`), flag it:

  ```
  // spacing-flag: <short reason> — design/notes/<Component>.md
  ```

  The marker and the `design/notes/` pointer must both sit in the contiguous comment block **directly above** the flagged line (the gate only looks upward; a trailing same-line comment does not count). Figma can bind different tokens per axis on wrap containers (`itemSpacing` vs `counterAxisSpacing`) — measure both.
- **Comments in component source are a budget.** `pnpm check:comment-budget` (CI): max 30% comment lines per file (files under 25 comment lines exempt), max 15 lines per block, no ticket narration (a bare `(#68)` pointer is fine).
  - *In the component*: the `// figma: node-id=…` line; a header of ≤ ~8 lines naming the Figma component and mapping variant axes onto props/slots/CSS states; a sentence or two wherever the code is non-obvious enough that an editor would break it; active token-gap flags. Cite, don't repeat: `// Selected only sets color, so it composes with hover/active. See design/notes/Button.md.`
  - *In `design/notes/<Component>.md`* (the design record, `design/notes/README.md`): history, measurements, state/pixel matrix, rejected alternatives.
  - Never explain what the code plainly states or restate a rule from `CLAUDE.md` or this guide.

## Design tokens (ADR-0010)

Pipeline: Figma variables → `design/tokens.json` (`pnpm sync:tokens`) → generated `app/theme.css` (Tailwind v4 `@theme`) → utilities (`Architecture.md` §3.2). Never hand-edit generated theme files; `pnpm check:tokens-drift` checks the mirror against `design/figma-variables/`. Renamed/removed tokens go in `design/retired-tokens.json`; `pnpm check:retired-tokens` (#285) fails on their `--color-*`/utility forms anywhere in the repo, `.ladle/` and configs included.

- **Figma text styles are Tailwind-native**: `text-xl/semibold` → `text-xl font-semibold`.
- **The token scale is closed.** A Figma value with no scale/semantic equivalent: ask the user before inventing a one-off.
- **`design/figma-map.json` is the component↔node-id map** (name → path → node-id only; every component carries `// figma: node-id=...`). Per-component record = `design/notes/<Component>.md`. Adding a component = map entry + note file + header annotation + Ladle story, same PR.
- **Colour states live in `docs/design-tokens.md`** (the `role`/`role-hover`/`role-active`/`border-selected` scale, why Selected must compose with Hover/Active, token-change log). Read it before adding state styling.
- `accent` no longer exists. Dark mode follows the OS via `next-themes` (`data-theme`); there is no `dark:` utility anywhere (`design/notes/AppShell.md`).

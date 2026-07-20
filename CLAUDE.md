# CLAUDE.md

Guidance for Claude Code when working in this repository. See `Vision.md` for product scope, `Architecture.md` for system design, and `docs/decisions/` for ADRs (ADRs win on conflict) — this file covers *how* to build, not *what* to build.

## Workflow this project follows

Prompts get refined with Claude (chat) + Figma MCP → Fable 5 analyzes `Vision.md` and asks questions → Fable produces `Architecture.md` + individual ADRs in `docs/decisions/` → Opus splits architecture into GitHub tickets → **Claude Code (you) executes tickets.**

Implication: you are not the architecture layer. If a ticket seems to conflict with an existing ADR or with the Figma design system, flag it — don't silently redesign. Architectural decisions belong in `docs/decisions/`, not improvised mid-ticket.

## Ticket workflow: GitHub Project kanban board

Tickets live as issues on `JesseLevi/Personal-Dashboard` (one milestone per phase) and are tracked on the user's GitHub Project kanban board: **project 1, owner `JesseLevi`**, Status columns `Backlog → Ready → In progress → In review → Done` (`gh project item-list 1 --owner JesseLevi`). Rules for Claude Code:

- Work tickets in phase/milestone order and honor the dependencies stated in each ticket body.
- **When you start a ticket, move its card to "In progress" *before* writing code.** This is not bookkeeping — the "In progress" column is the single source of truth for *what is mid-flight*. If a session ends abruptly (token/context budget, crash), the next agent reads this column to know exactly which ticket to resume; an unmoved card looks untouched and gets dropped or double-started. So: before starting anything new, check the In-progress column first and finish whatever is already there.
- **Delegating a ticket to a subagent counts as starting it.** The *orchestrator* (parent) owns the card: move it to "In progress" at spawn time and to "In review" once you have verified the agent's committed work — do this for each delegated ticket, and keep a note of which ticket maps to which agent. **Subagents must never touch the board themselves** (parallel agents would race on board state and often lack the `project` token scope). The board move is the orchestrator's job precisely so the In-progress column stays an accurate, crash-safe map of in-flight work.
- **When you finish a ticket** (implementation done, checks pass, PR opened/pushed), **move its card to the "In review" column** — via `gh project item-edit`, or flag it for the user if the `project` token scope is missing. Leave the issue open; the user reviews and moves it to Done/closes it.
- Don't move other cards, reorder the board, or close issues on your own.

## Tech stack

See `Architecture.md` (authoritative, incl. library choices per ADR) and `Vision.md` §2.5 (rationale). Code-level rules: **Tailwind v4 utility classes only** — no inline styles, no ad-hoc hex values. **All data access goes through Next.js server code** (server components/actions) — the browser never talks to Supabase directly, and `service_role` never leaves server/worker modules (ADR-0002/0003).

## Design system: Figma → code, Atomic Design

The Figma file ("Notion - V2") is the source of truth for UI, structured with Atomic Design sections: **Atoms → Molecules → Organisms → Pages**. Code must mirror this 1:1:

```
components/
  atoms/        # Figma "Atoms" section — Button, Icon, Tag, etc.
  molecules/    # Figma "Molecules" section — Card-content, Card, etc.
  organisms/    # Figma "Organisms" section — Carousel, Sidebar, Card container, etc.
```

Rules:
- **Component names match Figma layer names.** A Figma component named `Atom/Button` becomes `components/atoms/Button.tsx`. A Figma frame named `Card-content/Recipi` becomes `components/molecules/CardContentRecipe.tsx` (translate NL→EN in code, keep the mapping obvious). This is what keeps the Figma↔code link traceable for both of us.
- **Before building or changing a UI component, fetch it from Figma via MCP first** (`get_figma_data` with the relevant node-id). Don't guess spacing, color, or type scale from memory or from a screenshot — pull it from the dev-ready node. Note the node-id you used in the PR/commit description.
  - **The agent that writes the component does the fetch itself** — first tool call of the build. A second-hand summary pasted into the prompt is not a substitute: it drops fidelity (only the fields someone chose to copy) and defeats the point of a live dev-ready pull. When delegating a component ticket to a subagent, tell it to call MCP for its node; do not pre-digest the node into the prompt and skip the fetch.
  - **Pixel-parity is verified, not assumed.** Components must match the Figma dev-ready node. Fetch the visual with `download_figma_images`, render the Ladle story, and compare — the ADR-0010 Ladle/Playwright screenshot baseline is the enforcement mechanism (ticket #6). Until #6 lands, eyeball the rendered story against the Figma image and record the check (and any intentional deviation) in the PR.
  - **Icons: name the Figma layer after the exact lucide export it should use** (e.g. `Icon/Ellipsis`, not `Icon/Dots`) — this is the convention as of 2026-07-20 (`design/figma-map.json` → `Icon/*`). Done this way, the Icon atom's mapping is a direct lookup, not a judgment call, and the result genuinely is the same open-source vector Figma shows (real pixel parity, not an approximation). **Never trust the name alone** — a same-named lucide export can still be the wrong glyph (a "false friend"): e.g. lucide's literal `Cross` is a medical/plus-sign icon, not an X, even though a Figma layer might reasonably be called "Cross" for a dismiss button. Verify by rendering the candidate export (`renderToStaticMarkup` or the Ladle story) and comparing its actual paths/shape against the Figma node — matching the name is not sufficient. If no lucide export matches at all (rare now), that's an Architecture-level call (custom SVG vs. exporting Figma's own vector via `download_figma_images`) — flag it, don't improvise a hand-drawn approximation in a component ticket.
- **Never build a component that doesn't exist in Figma yet.** If a ticket needs UI that isn't designed, stop and flag it rather than inventing a layout — send it back through the Fable/Figma loop instead of freelancing.
- **Compose exactly as Figma nests.** If Figma builds `Card-container` out of `Card` instances which wrap `Card-content/*` in a slot, the React tree mirrors that composition — don't flatten it into one big component. Dependencies flow one way only: atoms ← molecules ← organisms ← `app/`; an atom never imports a molecule.
- **Variants via CVA**: Figma variant properties (Style, Type) become CVA props; **State (Hover/Active) becomes CSS pseudo-classes, never props**; Figma booleans (`With icon`) become optional props; Figma SLOT nodes become `children`/named slots. Icons go through the `Icon` atom (lucide-react).
- **Component update loop** (ADR-0010): node-id from `design/figma-map.json` → fetch via MCP → update CVA classes/structure → Ladle screenshot diff → PR. Details in `Architecture.md` §3.3.

### Component code conventions (house style — locked in by the Phase 2 atoms)

These exist because the first parallel component work diverged on each of the points below. Follow them so components read as one hand:

- **Server Component by default.** A presentational atom/molecule (no event handlers, no hooks) must NOT carry `"use client"`. Interactivity is wired by the composing molecule/organism, not baked into the leaf atom. Add `"use client"` only when the component itself owns state/handlers.
- **`className` merging is not ad-hoc.** Variant components use `cva()` and pass caller `className` through its `class`/`className` arg. Non-variant components merge with **`clsx`** (already a dependency). Never concatenate class strings by hand, and never drop a caller's `className` on the floor.
- **Icons go through the `Icon` atom only.** `Icon` is the single module that imports `lucide-react`; every other component renders icons as `<Icon name="…" />`. The `IconName` union is the Figma vocabulary (spelling-corrected, e.g. `Calendar` not `Calandar`), deliberately decoupled from lucide's export names — a lucide rename touches only `Icon.tsx`. Decorative icons get `aria-hidden`; an icon that IS the control's label gets its accessible name on the wrapping control.
- **Accessibility is part of the atom.** Form-shaped presentational atoms expose semantics: e.g. `Checkbox` renders `role="checkbox"` + `aria-checked` rather than a bare styled `<div>` or a misleading `readOnly` native input. Decide input-vs-role deliberately and note it in the PR.
- **Ladle stories use Tailwind utility classes, never inline `style={{…}}`** — even though stories are dev-only, they showcase the design system and must model correct usage (token classes, not raw px/hex). Delete the placeholder `Welcome.stories.tsx` once a real story exists (done).
- **Don't invent Figma states that aren't in the fetched node.** If `design/figma-map.json` notes a variant/state the dev-ready node doesn't actually contain (e.g. Checkbox's "delete"), build only what Figma exposes and leave the gap flagged in the map note for triage — never freelance the missing state (reinforces the "never build what isn't in Figma" rule above).

## Design tokens: primitive → semantic → Tailwind v4 (ADR-0010)

Pipeline: Figma variables → `design/tokens.json` (synced via `pnpm sync:tokens`) → generated `app/theme.css` (Tailwind v4 `@theme`) → utility classes. Never hand-edit generated theme files; never use a raw value where a semantic token exists.

- Figma text styles are named to match Tailwind 1:1 (e.g. `text-xl/semibold` → `text-xl font-semibold`). When Figma MCP returns a `textStyle`, translate it directly into that class pair — don't re-derive font-size/line-height/weight by hand.
- Figma fills map to named tokens in `design/tokens.json` — if a fill isn't a token yet, add it via the token sync, never hardcode hex in a component.
- If a value in Figma has no Tailwind-scale equivalent, check with the user before inventing a one-off — the token scale stays closed.
- Component↔Figma mapping lives in `design/figma-map.json`; every component file carries `// figma: node-id=...` in its header. When adding a component: add its map entry, header annotation, and Ladle story in the same PR.

## Product & data rules

Fundamentals (multi-user + RLS, NL/EN i18n, security-by-design) are decided in `Vision.md` §2 — don't relitigate them. Applied in code:

- Every table gets a `user_id` foreign key and a Row Level Security policy, **plus an RLS test in `supabase/tests` in the same PR** — CI fails on untested tables (ADR-0009). Schema changes only via `supabase/migrations`.
- Ownership is user_id-only per ADR-0001 — no household/sharing structures, not even "convenient" ones.
- Per-account secrets (AI keys, calendar credentials) go through the Vault pattern of ADR-0002 — never plaintext, never logged, decrypted only server-side.
- No hardcoded user-facing strings — everything through next-intl catalogs (`messages/nl.json` + `messages/en.json`, both filled in the same PR — ADR-0007).
- Render stored rich text only through TipTap's React renderer (fixed extension whitelist); render AI-agent output as plain text. Never `dangerouslySetInnerHTML` on user or model content.
- `Vision.md` lists explicit "buiten scope" items per module — treat those as real boundaries, not backlog.

## Priorities

When a ticket forces a trade-off, resolve it in this order:

1. Secure from the ground up (RLS, server-only data access, no secret leakage)
2. Runs fully locally (Mac mini + Ollama — no cloud dependencies in core paths)
3. Clean migration path to cloud hosting later (Supabase Cloud, hosted inference)
4. Multi-language from the ground up (never hardcode strings)
5. LLM-readable by design (predictable structure, canonical text columns, semantic tokens)
6. Make your code easily readable for humans and structure files neatily with a clear folder structure

## Build status

`docs/phase-log.md` is the authoritative record of what is already built per phase — check it before creating or executing tickets, and update it when a phase item lands.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — ESLint, tsc, Vitest
- `pnpm sync:tokens` — regenerate `app/theme.css` from `design/tokens.json` (run after every token edit; CI fails on drift)
- `pnpm ladle` — design-system workbench
- `pnpm worker` — job queue consumer (needs `.env` with service_role)
- `pnpm db:reset` / `pnpm test:rls` / `pnpm db:types` — Supabase (needs Docker: CI or the server, not this dev machine)
- `pnpm check:rls-coverage` / `pnpm check:server-only` — CI gates, also runnable locally

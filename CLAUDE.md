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

The Figma file ("Notion - V2") is the source of truth for UI, mirrored 1:1 into `components/{atoms,molecules,organisms}/` after Figma's Atomic Design sections (folder ↔ section map: `Architecture.md` §2). Rules:

- **Component names match Figma layer names.** `Atom/Button` → `components/atoms/Button.tsx`; `Card-content/Recipi` → `components/molecules/CardContentRecipe.tsx` (translate NL→EN in code, keep the mapping obvious). This is what keeps the Figma↔code link traceable.
- **Before building or changing a UI component, fetch it from Figma via MCP first** (`get_figma_data` with the relevant node-id). Don't guess spacing, colour, or type scale from memory or a screenshot — pull it from the dev-ready node. Note the node-id in the PR/commit description.
  - **The agent that writes the component does the fetch itself** — first tool call of the build. A second-hand summary pasted into the prompt is not a substitute: it drops fidelity and defeats the point of a live dev-ready pull. When delegating, tell the subagent to call MCP for its node; do not pre-digest the node into the prompt and skip the fetch.
  - **Pixel-parity is verified, not assumed.** Fetch the visual with `download_figma_images`, render the Ladle story, compare, and record the check (and any intentional deviation) in the PR. The ADR-0010 Ladle/Playwright screenshot baseline is the eventual enforcement (ticket #6, **not yet wired into CI** — eyeball until then).
  - **Icons: Figma layer names are the exact lucide export names** (`Icon/Ellipsis`, not `Icon/Dots`), so the `Icon` atom's mapping is a direct lookup and the rendered glyph really is the vector Figma shows. **Never trust the name alone** — render the candidate export (`renderToStaticMarkup` or the Ladle story) and compare its paths against the Figma node. Same-named exports can be "false friends" (lucide's `Cross` is a medical/plus glyph, not an X), and shape-verification has already caught three real mismappings. If no lucide export matches, that's an Architecture-level call (custom SVG vs. exporting Figma's vector) — flag it, never hand-draw an approximation.
- **Never build a component that doesn't exist in Figma yet.** If a ticket needs undesigned UI, stop and flag it rather than inventing a layout — send it back through the Fable/Figma loop instead of freelancing.
- **Compose exactly as Figma nests.** If Figma builds `Card-container` out of `Card` instances wrapping `Card-content/*` in a slot, the React tree mirrors that composition — don't flatten it. Dependencies flow one way only: atoms ← molecules ← organisms ← `app/`; an atom never imports a molecule.
- **Variants via CVA**: Figma variant properties (Style, Type) → CVA props; **State (Hover/Active/pressed) → CSS pseudo-classes, never props**; Figma booleans (`With icon`) → optional props; Figma SLOT nodes → `children`/named slots.

The full component update loop (node-id → fetch → update → Ladle screenshot diff → PR) lives in `Architecture.md` §3.3 / ADR-0010.

### Component code conventions (house style — locked in by the Phase 2 atoms)

These exist because the first parallel component work diverged on each of the points below. Follow them so components read as one hand:

- **Server Component by default.** A presentational atom/molecule (no event handlers, no hooks) must NOT carry `"use client"`. Interactivity is wired by the composing molecule/organism, not baked into the leaf atom. Add `"use client"` only when the component itself owns state/handlers.
- **`className` merging is not ad-hoc.** Variant components use `cva()` and pass caller `className` through its `class`/`className` arg. Non-variant components merge with **`clsx`** (already a dependency). Never concatenate class strings by hand, and never drop a caller's `className` on the floor.
- **Icons go through the `Icon` atom only.** `Icon` is the single module that imports `lucide-react`; every other component renders icons as `<Icon name="…" />`. The `IconName` union is the Figma vocabulary (spelling-corrected, e.g. `Calendar` not `Calandar`), kept identical to lucide's export names so each entry is a direct PascalCase lookup to the identically-named export (see `Icon.tsx`'s header and the icon rule under *Design system* above). Because `Icon.tsx` is the only place lucide is imported, a lucide-side rename is absorbed there in one edit rather than rippling through call sites. Decorative icons get `aria-hidden`; an icon that IS the control's label gets its accessible name on the wrapping control.
- **Accessibility is part of the atom.** Form-shaped presentational atoms expose semantics: e.g. `Checkbox` renders `role="checkbox"` + `aria-checked` rather than a bare styled `<div>` or a misleading `readOnly` native input. Decide input-vs-role deliberately and note it in the PR.
- **Ladle stories use Tailwind utility classes, never inline `style={{…}}`** — even though stories are dev-only, they showcase the design system and must model correct usage (token classes, not raw px/hex). Delete the placeholder `Welcome.stories.tsx` once a real story exists (done).
- **Raw hex never appears in `components/`, not even in comments.** `check:server-only` greps the whole file, so documenting a mapping as `bg #E7E5E4` fails the build. Describe colours by their primitive/token name (`stone-200` → `surface-raised`); the exact Figma hex belongs in `design/figma-map.json`, which is the design-source record and is not grepped.
- **A token gap is flagged, never papered over.** If Figma uses a value that has no matching *semantic* token (e.g. a hover fill that happens to equal the `border` token), reuse the existing token for the correct pixels **and** record the gap in the component doc comment + `design/figma-map.json`, so the token sync can add a real token later. Never hardcode the hex, and never silently normalise the design to a different colour.
- **Don't invent Figma states that aren't in the fetched node.** If `design/figma-map.json` notes a variant/state the dev-ready node doesn't actually contain (e.g. Checkbox's "delete"), build only what Figma exposes and leave the gap flagged in the map note for triage — never freelance the missing state (reinforces the "never build what isn't in Figma" rule above).

## Design tokens (ADR-0010)

Pipeline: Figma variables → `design/tokens.json` (`pnpm sync:tokens`) → generated `app/theme.css` (Tailwind v4 `@theme`) → utility classes (full detail in `Architecture.md` §3.2). Never hand-edit generated theme files; never use a raw value where a semantic token exists (enforced by `check:server-only`, see house style above).

- **Figma text styles are Tailwind-native**: `text-xl/semibold` → `text-xl font-semibold`. Translate a returned `textStyle` directly into that class pair — don't re-derive size/line-height/weight by hand.
- **The token scale is closed.** If a Figma value has no Tailwind-scale/semantic equivalent, check with the user before inventing a one-off — never hardcode the hex.
- **`design/figma-map.json` is the canonical component↔node-id map**; every component carries `// figma: node-id=...` in its header. Adding a component = map entry + header annotation + Ladle story, all in the same PR.
- **Per-state colour convention (#52, #56):** `docs/design-tokens.md` is the authoritative spec — every colour role gets `role` / `role-hover` / `role-active` tokens, never one token reused across states, and a component reads those colours from tokens, never from a `dark:` prefix, raw hex, or one-off value. Selected is deliberately **not** a colour token: it only darkens text (`aria-pressed:text-text`), which lets it compose with hover/active instead of overriding them. Read the doc before adding state styling to any component.

## Product & data rules

Fundamentals (multi-user + RLS, NL/EN i18n, security-by-design) are decided in `Vision.md` §2 — don't relitigate them. Applied in code:

- Every table gets a `user_id` foreign key and a Row Level Security policy, **plus an RLS test in `supabase/tests` in the same PR** (copy `rls-profiles.sql`) — CI fails on untested tables (ADR-0009). Schema changes only via `supabase/migrations`.
- **A new table's migration must also grant table access**: `grant select, insert, update, delete on public.<table> to authenticated;` and `grant select on public.<table> to anon;`. RLS policies are the real boundary, but without the grants every query fails with `42501 permission denied` — this project's Supabase does not auto-expose new tables. Copy the grants block in `20260720000001_profiles.sql`.
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

## Build status & session start

- **`docs/HANDOFF.md`** — where the project stands right now and what to do next. Read it first in a new session; keep it accurate when you finish work.
- **`docs/phase-log.md`** — what infrastructure exists per phase and why. Read on demand; update when a phase item lands.
- Per-ticket status lives on the **board**, not in these files.

## This dev machine

- **No Docker and no standalone supabase CLI** — `supabase` runs via `npx` (devDependency), so `pnpm db:reset` / `pnpm test:rls` are CI/server-only. Don't treat their absence as a failure.
- `gh` is installed and authenticated (incl. `project` scope), so board and PR commands work.
- `.mcp.json` (Figma key) and `.env` are git-ignored on purpose; `.env.example` documents the needed vars.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — ESLint, tsc, Vitest
- `pnpm sync:tokens` — regenerate `app/theme.css` from `design/tokens.json` (run after every token edit; CI fails on drift)
- `pnpm ladle` — design-system workbench
- `pnpm worker` — job queue consumer (needs `.env` with service_role)
- `pnpm db:reset` / `pnpm test:rls` / `pnpm db:types` — Supabase (needs Docker: CI or the server, not this dev machine)
- `pnpm check:rls-coverage` / `pnpm check:server-only` — CI gates, also runnable locally

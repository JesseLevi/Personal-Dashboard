# CLAUDE.md

Guidance for Claude Code in this repository — *how* to build, not *what* to build. `Vision.md` = product scope, `Architecture.md` = system design, `docs/decisions/` = ADRs (**ADRs win on conflict**).

## Read this first, per task

Load only the guide your task touches — each is authoritative for its area; don't work from memory there.

| If your task touches… | Read |
| --- | --- |
| Anything in `components/`, Figma, tokens, Ladle | `docs/guides/ui-components.md` |
| `supabase/`, server actions, migrations, secrets, i18n strings | `docs/guides/data-layer.md` |
| Starting / finishing / delegating a ticket, the kanban board | `docs/guides/ticket-workflow.md` |
| Colour states on a component | `docs/design-tokens.md` |
| One specific component (its node-id, recorded gaps, ticket history) | `design/notes/<Component>.md` — never the whole map |
| Figma is missing something the ticket assumes | `docs/open-questions.md` — reference by slug, never by number |
| Why a past ticket went wrong, or why a token has its value | `docs/incidents.md` — on demand only |

Session start: read **`docs/HANDOFF.md`** (state, next steps; ≤ 6KB). On finish replace stale bullets, never append dated or per-ticket sections. History → `git log` / `docs/incidents.md` / `design/notes/`; ticket status → the **board**. `docs/phase-log.md` = infra per phase, on demand, updated when a phase item lands.

## Non-negotiables (apply to every task)

- **Not the architecture layer** — flag ADR/Figma-design-system conflicts, don't silently redesign.
- **Never build UI absent from Figma** — fetch the dev-ready node first; never guess from memory or a screenshot. For any *token binding*, use the `figma-console` bridge and read `boundVariables` off the node — a resolved value never identifies a token (`docs/guides/ui-components.md`).
- **Tailwind v4 utilities + semantic tokens only** — no inline styles/raw hex in `components/` (incl. comments; `check:server-only` greps the file). Missing token → flag, never hardcode.
- **All data access via Next.js server code** — browser never talks to Supabase directly; `service_role` never leaves server/worker modules (ADR-0002/0003).
- **Every table**: `user_id` FK + RLS policy + an RLS test in `supabase/tests`, same PR (ADR-0009). Schema changes only via `supabase/migrations`.
- **One home per fact** — ticket history/measurements/design record live in `design/notes/<Component>.md`; component files carry only a short header + pointers. Budgeted by `check:comment-budget`.
- **No hardcoded user-facing strings** — next-intl catalogs, `messages/nl.json` *and* `messages/en.json`, same PR (ADR-0007).
- **Move ticket card to "In progress" before coding**, to "In review" when done. Check In-progress column before starting anything new.

## Priorities

When a ticket forces a trade-off, resolve it in this order:

1. Secure from the ground up (RLS, server-only data access, no secret leakage)
2. Runs fully locally (Mac mini + Ollama — no cloud dependencies in core paths)
3. Clean migration path to cloud hosting later (Supabase Cloud, hosted inference)
4. Multi-language from the ground up (never hardcode strings)
5. LLM-readable by design (predictable structure, canonical text columns, semantic tokens)
6. Readable for humans — clear file and folder structure

## Tooling

- `gh` with `project` scope is required for board/PR commands. No Docker locally: `pnpm db:reset` / `test:rls` / `db:types` are CI-only (absence isn't a failure); `supabase` runs via `npx`.
- `.mcp.json` (Figma key) and `.env` are git-ignored; `.env.example` documents the vars.
- Figma: the **`figma-console` bridge** (Figma Desktop + Desktop Bridge plugin; check `figma_get_status` with `probe: true`) is the only route to `boundVariables`; the hosted Figma MCP is rate-limited.
- Ad-hoc verification screenshots go in `screenshots/` (git-ignored), never the repo root.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — ESLint, tsc, Vitest
- `pnpm sync:tokens` — regenerate `app/theme.css` from `design/tokens.json` (run after every token edit; CI fails on drift)
- `pnpm ladle` — design-system workbench (`pnpm ladle:build` for a non-interactive build; `pnpm ladle build` hangs)
- `pnpm test:visual` / `pnpm test:visual:update` — Playwright screenshot baselines; run before every component PR (CI's job is non-blocking until Linux baselines exist)
- `pnpm worker` — job queue consumer (needs `.env` with service_role)
- `pnpm db:reset` / `pnpm test:rls` / `pnpm db:types` — Supabase (needs Docker: CI or the server, not this dev machine)
- `pnpm check:rls-coverage` / `pnpm check:server-only` / `pnpm check:raw-spacing` / `pnpm check:comment-budget` — CI gates, also runnable locally

# CLAUDE.md

Guidance for Claude Code in this repository — *how* to build, not *what* to build. `Vision.md` = product scope, `Architecture.md` = system design, `docs/decisions/` = ADRs (**ADRs win on conflict**).

## Read this first, per task

Load only the guide your task touches. Each is authoritative for its area; don't work from memory in these areas.

| If your task touches… | Read |
| --- | --- |
| Anything in `components/`, Figma, tokens, Ladle | `docs/guides/ui-components.md` |
| `supabase/`, server actions, migrations, secrets, i18n strings | `docs/guides/data-layer.md` |
| Starting / finishing / delegating a ticket, the kanban board | `docs/guides/ticket-workflow.md` |
| Colour states on a component | `docs/design-tokens.md` |

Session start: read **`docs/HANDOFF.md`** (where the project stands, what's next) and keep it accurate when you finish work. `docs/phase-log.md` = what infrastructure exists per phase; read on demand, update when a phase item lands. Per-ticket status lives on the **board**, not in these files.

## Non-negotiables (apply to every task)

- **You are not the architecture layer.** If a ticket conflicts with an ADR or the Figma design system, flag it — don't silently redesign.
- **Never build UI that doesn't exist in Figma yet.** Fetch the dev-ready node via Figma MCP before building or changing a component; never guess from memory or a screenshot.
- **Tailwind v4 utility classes + semantic tokens only** — no inline styles, no raw hex anywhere in `components/` (also not in comments; `check:server-only` greps the file). A missing token is flagged, never hardcoded.
- **All data access goes through Next.js server code.** The browser never talks to Supabase directly; `service_role` never leaves server/worker modules (ADR-0002/0003).
- **Every table**: `user_id` FK + RLS policy + an RLS test in `supabase/tests` in the same PR (ADR-0009). Schema changes only via `supabase/migrations`.
- **No hardcoded user-facing strings** — next-intl catalogs, `messages/nl.json` *and* `messages/en.json` in the same PR (ADR-0007).
- **Move the ticket card to "In progress" before writing code**, and to "In review" when it's done. Check the In-progress column before starting anything new.

## Priorities

When a ticket forces a trade-off, resolve it in this order:

1. Secure from the ground up (RLS, server-only data access, no secret leakage)
2. Runs fully locally (Mac mini + Ollama — no cloud dependencies in core paths)
3. Clean migration path to cloud hosting later (Supabase Cloud, hosted inference)
4. Multi-language from the ground up (never hardcode strings)
5. LLM-readable by design (predictable structure, canonical text columns, semantic tokens)
6. Readable for humans — clear file and folder structure

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

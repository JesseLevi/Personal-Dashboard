# Handoff — start here in a new Claude Code session

**Read order for context**: `CLAUDE.md` (auto-loaded — build rules) → `docs/phase-log.md` (what exists, what doesn't — authoritative) → `Architecture.md` + `docs/decisions/` ADR-0001…0010 (why). `Vision.md` is product scope. ADRs win on conflict.

## Where the project stands (2026-07-20)

Phase 0 (foundation) is built and committed on `main`, **verified locally**: `pnpm lint`, `pnpm typecheck`, `pnpm test` (5/5), `pnpm build`, `pnpm check:server-only` all pass. **Never verified**: the CI workflow (repo has no GitHub remote yet) and everything requiring Docker (`pnpm db:reset`, `pnpm test:rls` — no Docker on this dev machine; runs in CI/on the server).

The workflow position: Fable produced Architecture.md + ADRs and built Phase 0. **GitHub tickets for the remaining work have NOT been written yet.** Next process step per `CLAUDE.md`: Opus writes tickets from `Architecture.md` §10 minus everything marked ✅ in `docs/phase-log.md`; Sonnet executes them.

## Immediate next actions (in order)

1. **Create GitHub repo + push** (user action or `gh` once installed). Watch the first CI run — the `db` job (supabase start + pgTAP + coverage gate) has never executed; expect possible environment quirks there, not in the app job.
2. **Write tickets** from `Architecture.md` §10, skipping ✅ items in `docs/phase-log.md`, honoring the "Conventions locked in" section at the bottom of that file. One milestone per phase; every UI ticket carries its Figma node-id + mapping entry.
3. **First code work: Phase 2 atoms** (Button, Tag, InputField, Checkbox, Icon) — fetch each from Figma via MCP (`design/figma-map.json` has the reserved paths; fill in `nodeId` as you go), CVA variants per `CLAUDE.md` rules, Ladle story per component (replace `components/Welcome.stories.tsx`), semantic token classes only.

## Gotchas a fresh session must know

- **This dev machine has no Docker, no `gh`, no standalone supabase CLI** — supabase runs via `npx supabase` (devDependency); db-dependent commands are CI/server-only for now.
- **No `NEXT_PUBLIC_SUPABASE*` env vars, ever** — the browser never talks to Supabase (ADR-0003); `scripts/check-server-only.sh` greps for violations and CI fails on them.
- **New table ⇒ migration + `supabase/tests/rls-<table>.sql` in the same PR** (copy `rls-profiles.sql`), or the coverage gate fails CI.
- **Token edits**: change `design/tokens.json`, run `pnpm sync:tokens`, commit both — never touch `app/theme.css` directly.
- `.mcp.json` (Figma key) and `.env` are git-ignored on purpose; `.env.example` documents the needed vars.
- The worker (`worker/index.ts`) references a `claim_next_job()` SQL function that does not exist yet — it ships with the Phase 7 jobs-table migration. The worker is a skeleton by design; don't "fix" it earlier.
- Figma spelling variants ("Recipi", "Distructive", "Calandar") are translated in code per the map in `Architecture.md` §3.1 / `design/figma-map.json`.

## Environment/tooling still to set up (outside this repo)

**Dev machine (minimum to continue):** `gh` CLI (`brew install gh` + `gh auth login`) — or create the repo manually in the GitHub UI and `git remote add origin … && git push -u origin main`. Optional but useful: Docker Desktop/OrbStack so `pnpm db:reset` + `pnpm test:rls` run locally instead of CI-only.

**Mac mini (server, per docs/phase-log.md ⬜ list):** Docker + two Supabase stacks (ports bound to 127.0.0.1 — verify with `scripts/check-localhost-binding.sh`), `cloudflared` tunnel + Cloudflare Access on staging, Ollama (`OLLAMA_HOST=127.0.0.1`, pull `bge-m3` + chat model sized to RAM), GitHub Actions self-hosted runner (hardened, deploy-only), restic backups + separate Vault-root-key backup.

**Accounts to create (all have free tiers):** Cloudflare (domain + tunnel + Access), an SMTP provider (e.g. Resend — magic links don't work without it, §7), Healthchecks.io (dead-man's-switch), an S3-compatible bucket for off-site backups (e.g. Backblaze B2).

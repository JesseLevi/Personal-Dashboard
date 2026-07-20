# Handoff — start here in a new Claude Code session

**Read order for context**: `CLAUDE.md` (auto-loaded — build rules incl. the project-board workflow) → `docs/phase-log.md` (what exists, what doesn't — authoritative) → `Architecture.md` + `docs/decisions/` ADR-0001…0010 (why). `Vision.md` is product scope. ADRs win on conflict.

## Where the project stands (2026-07-20, end of day)

- **Phase 0 (foundation) is built and on `main`**, verified locally: `pnpm lint`, `pnpm typecheck`, `pnpm test` (5/5), `pnpm build`, `pnpm check:server-only` all pass. Still **never verified**: everything requiring Docker (`pnpm db:reset`, `pnpm test:rls` — no Docker on this dev machine; runs in CI/on the server).
- **Repo is on GitHub**: `JesseLevi/Personal-Dashboard` (private), remote `origin`, `main` pushed.
- **CI has never run green — through no fault of ours**: the first pushes hit a GitHub Actions platform outage (instant `startup_failure`, 0 jobs; confirmed incident on githubstatus.com). Workflow YAML, permissions and registration were all verified fine.
- **The full ticket backlog exists** (written by Fable 2026-07-20, deviating from the CLAUDE.md Opus-role with the user's explicit consent): 10 milestones (Phase 0 remainder … Phase 9), 35 issues. Phase 2 component tickets carry verified Figma node-ids + the standard PR checklist. Issue #26 (triage) is resolved/closed: Dropdown (#34) and ButtonToggle (#35) are **in scope** and in `design/figma-map.json` + Architecture §3.1.
- **GitHub Project kanban board is live**: project 1, owner `JesseLevi`, columns `Backlog → Ready → In progress → In review → Done`, auto-add enabled (all 35 issues on it). Workflow rules are in `CLAUDE.md` ("Ticket workflow"): move your card to **In review** when a ticket is finished; never close issues yourself.

## Immediate next actions (in order)

1. **Verify CI once the GitHub Actions outage is over**: `gh run list` → if still `startup_failure`, check githubstatus.com; when recovered, `gh run rerun <id>` (or push) and watch the **db job** (supabase start + pgTAP + coverage gate — never executed; environment quirks expected there, not in the app job).
2. **Start issue #12: Atom Icon** (`components/atoms/Icon.tsx`) — everything else in Phase 2 depends on it (Button #13, InputField #15, Sidebar #25 embed icons). Then the rest of Phase 2 in issue order. Per ticket: fetch the node via Figma MCP first, CVA per CLAUDE.md, Ladle story (first real story replaces `components/Welcome.stories.tsx`), semantic token classes only, board card → In review when done.
3. **Phase 0 remainder / Phase 1 tickets** (#1–#11) are server-side or need user accounts — coordinate with the user, don't start them unprompted.

## Gotchas a fresh session must know

- **This dev machine has no Docker and no standalone supabase CLI** — supabase runs via `npx supabase` (devDependency); db-dependent commands are CI/server-only for now. `gh` IS installed (authenticated as JesseLevi incl. `project` scope).
- **Git identity on this machine is auto-guessed** (`Jesse@mbp-van-jesse.home`) — user was advised to set `git config --global user.name/email`; check before attributing commits.
- **No `NEXT_PUBLIC_SUPABASE*` env vars, ever** — the browser never talks to Supabase (ADR-0003); `scripts/check-server-only.sh` greps for violations and CI fails on them.
- **New table ⇒ migration + `supabase/tests/rls-<table>.sql` in the same PR** (copy `rls-profiles.sql`), or the coverage gate fails CI.
- **Token edits**: change `design/tokens.json`, run `pnpm sync:tokens`, commit both — never touch `app/theme.css` directly.
- `.mcp.json` (Figma key) and `.env` are git-ignored on purpose; `.env.example` documents the needed vars.
- The worker (`worker/index.ts`) references a `claim_next_job()` SQL function that does not exist yet — it ships with the Phase 7 jobs-table migration (issue #31). The worker is a skeleton by design; don't "fix" it earlier.
- Figma spelling variants ("Recipi", "Distructive", "Calandar", "Trekking-icon") are translated in code per the map in `Architecture.md` §3.1 / `design/figma-map.json`.
- Figma "Notion - V2" (`PE9Tc5r8ybDZWVrJrQPqXi`), Development canvas: Atoms `3760:6190`, Molecules `3761:5193`, Organisms `3761:5462`; per-component node-ids are in the Phase 2 issues and `design/figma-map.json`.

## Environment/tooling still to set up (outside this repo)

**Dev machine (optional):** Docker Desktop/OrbStack so `pnpm db:reset` + `pnpm test:rls` run locally instead of CI-only.

**Mac mini (server — ticketed as issues #1–#5):** Docker + two Supabase stacks (ports bound to 127.0.0.1 — verify with `scripts/check-localhost-binding.sh`), `cloudflared` tunnel + Cloudflare Access on staging, Ollama (`OLLAMA_HOST=127.0.0.1`, pull `bge-m3` + chat model sized to RAM), GitHub Actions self-hosted runner (hardened, deploy-only), restic backups + separate Vault-root-key backup.

**Accounts to create (all have free tiers):** Cloudflare (domain + tunnel + Access), an SMTP provider (e.g. Resend — magic links don't work without it, §7), Healthchecks.io (dead-man's-switch), an S3-compatible bucket for off-site backups (e.g. Backblaze B2).

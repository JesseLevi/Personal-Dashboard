# CLAUDE.md

**Atlas** is a personal platform for a small circle of friends and family. It brings daily-life information together so connections become visible, and it takes small decisions off people's hands. Product scope: `Vision.md`. Current system: `Architecture.md`. Decisions: `docs/decisions/README.md` (an ADR wins over the other docs; fix the conflict in the same PR).

## Start of a session

Read `docs/HANDOFF.md` (state and next step). Check the board's "In progress" column before starting anything new: `gh project item-list 1 --owner JesseLevi`.

## Load only what the task touches

| Task touches | Read |
| --- | --- |
| `components/`, `app/` UI, tokens, Ladle, visual tests | `docs/guides/ui-components.md` (colour states: `docs/design-tokens.md`) |
| One component | `design/notes/<Component>.md` |
| `supabase/`, server actions, auth, storage, AI, i18n | `docs/guides/data-layer.md` |
| Deploys, hosted settings, env vars | `docs/operations.md`, ADR-0032 |
| Tickets, board, subagents | `docs/guides/ticket-workflow.md` |
| A known gap or open product question | `docs/open-questions.md`, by slug |
| Why something failed before | `docs/incidents.md` (on demand only) |

## Invariants

CI enforces much of this (`pnpm check:*`); the rest is on you.

- **Security first.**
  - The browser talks only to Atlas, and RLS decides access (ADR-0033).
  - `service_role` never runs on a user's request path.
  - A new table ships with `user_id`, RLS, grants and a pgTAP test in the same PR.
  - Keep access logic in policies; sharing extends them through role functions, never app-side checks (ADR-0035).
- **Hosted is production, and every hosted write needs the user's explicit go, per action.** That covers migrations, `deploy.yml`, dashboard settings and role grants. Committing a migration does not apply it (ADR-0032).
- **UI** (ADR-0034):
  - Design it in code from existing components and semantic tokens.
  - Add a new component only by exception, and a new token only with consent.
  - When the user names a Figma design, implement it exactly and read token bindings from the node.
  - Tailwind utilities only: no inline styles, no raw hex in `components/`.
- **Every user-facing string** goes in `messages/nl.json` and `messages/en.json` in the same PR.
- **AI**:
  - deterministic code first;
  - only through `lib/ai/`;
  - zod-validated output, rendered as plain text;
  - rate-limited;
  - must still work without a key.
- **Decisions are recorded.** When the user decides something architectural, write the ADR and update `Architecture.md` (and `Vision.md` when scope moves) in the same PR. If a task conflicts with an ADR, flag it instead of silently diverging.
- **One home per fact.**
  - Component contract → its design note.
  - State → HANDOFF.
  - History → git.
  - Don't append ticket narration to docs or code comments.

**When priorities conflict**: secure → cheap to run → portable seams (`lib/ai`, `lib/storage`, plain Postgres) → multilingual → LLM-readable data → readable code.

## How we work

- **Roles**: Opus plans and reviews (ADRs, tickets, board, verification). Sonnet subagents implement. Details: `docs/guides/ticket-workflow.md`.
- **Board**: move a card to "In progress" before code and to "In review" once a PR exists. Leave closing to the user.
- **Done means verified**:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, plus the relevant `pnpm check:*`;
  - for UI, a screenshot to the user;
  - the visual suite's CI Linux job is the gate.

## Environment

- **No Docker locally.** `pnpm db:reset`, `test:rls` and `db:types` run in CI only. The Supabase CLI runs via `npx`.
- **Figma**, only when a design is named: use the `figma-console` bridge (`figma_get_status` with `probe: true`); it is the only route to `boundVariables`. The hosted Figma MCP is rate-limited.
- **Scratch output**: ad-hoc screenshots go in `screenshots/` (git-ignored). `.env` and `.mcp.json` are git-ignored; `.env.example` documents the variables.
- **Commands**:
  - `pnpm dev` / `lint` / `typecheck` / `test`;
  - `pnpm sync:tokens` after any token edit;
  - `pnpm ladle:build` (not `ladle build`);
  - `pnpm test:visual`: regenerate baselines with `gh workflow run visual-update.yml --ref <branch>`;
  - `pnpm check:*` for the CI gates.

# Handoff — start here in a new Claude Code session

`CLAUDE.md` = build rules and guide routing. This file = **state only**, one screen. History lives in `git log`, `docs/incidents.md` and `design/notes/<Component>.md`.

**Truth sources**: tickets → the board (`gh project item-list 1 --owner JesseLevi`); colours → `docs/design-tokens.md`; component↔node-id → `design/figma-map.json`; design gaps → `docs/open-questions.md`; infra per phase → `docs/phase-log.md`; per-component record → `design/notes/`.

**Keeping this file**: replace stale bullets, never append dated sections. A fact about one component belongs in that component's note, with at most a pointer here.

## State (2026-08-10)

- `main` is green and the open-PR queue is empty. Phases 0–3 are feature-complete, design-review rounds 1–3 merged.
- **Phase 4 (Recepten) and Phase 5 (Boodschappenlijst) are both mid-flight.** Per-ticket status lives on the board, never here.
  - `/recepten` category-kanban · `/recepten/[recipeId]` V2 detail page (nutrition row, "Pas aan" panel, NEVO/USDA-backed macros) · private `recipe-thumbnails` bucket with server-side re-encode → `design/notes/RecipeDetailPage.md`, `ReceptenBoard.md`
  - `/winkelmand` with grouping, sort and swipe-to-cart → `design/notes/WinkelmandPage.md`
- **Ready to pick up** (board column): #162 i18n wiring, #172 iOS standalone PWA, #182 Winkelmand sort-button alignment.
- **In review**: #171 and #174 — merged via PR #181, but the issues stay open by this repo's convention (no closing keyword; the user reviews, then closes).
- Backlog: #1–#5, #8–#11 (server-side, need real accounts — don't start unprompted), #168–#173 (perf), #30–#33 (phases 6–9), plus the verification tickets below.
- `middleware.ts` is deliberately absent — session refresh is #8; the auth guard lives in `app/(app)/layout.tsx` until then. Every sign-in path lands on `/te-doen`.

## Traps that have already cost a session

- **Committing a migration does not apply it.** `deploy.yml` is `workflow_dispatch`-only, so a push to `main` deploys code and migrates nothing. Check `supabase_migrations.schema_migrations` on the hosted project *before* debugging a data-shaped bug.
- **A migration applied by hand or via the Supabase MCP server gets that route's own timestamp as its version**, not the repo filename, and `supabase db push` then refuses. Correct the version row by hand every time a migration reaches hosted outside `deploy.yml`.
- **Never batch a migration across parallel agents** — that raced two writers into 250 duplicate `reference.ingredients` rows on #161. One sequential call.
- **Visual flake: isolation is not a control — run the FULL suite twice.** Confirmed flaky stories: `category-panel--create-category`, `category-panel--edit-category`, `recipe-panel--filled`. Identical code has given fail-then-pass across consecutive full runs, and a story that failed 3/3 *in isolation* passed in a full run — story count, ordering and parallelism all change the rasterization. Never bisect a visual failure; regenerate the baseline or widen the threshold. Never let two runs overlap.
- **Verify a ticket's Figma links resolve before planning against them.** Two nodes cited by #166 no longer exist in the file.
- **An optimistic success animation can hide a fully broken write path.** `AnimatedAddToBasketButton` plays "Toegevoegd" regardless of the `ActionResult`, which masked a failing insert for an entire ticket. → `docs/open-questions.md#winkelmand-send-no-success-feedback`

## Unverified against reality

The hosted **schema** was audited 2026-08-10 and is sound: all 16 `public` tables have RLS on with 4 policies each, `reference.*` is select-only, the `recipe-thumbnails` bucket and its 4 `storage.objects` policies exist, and `replace_recipe_contents(uuid,jsonb,jsonb)` is `security invoker` with `search_path=''`. What is still untested is **behaviour**, and one migration never landed.

- **`supabase/migrations/20260810000001_recipe_thumbnails_bucket_cap.sql` is committed but not applied** — the hosted bucket still caps uploads at 5 MiB instead of 1 MiB. Needs ADR-0012's confirm-then-apply step, plus the version-row correction above.
- **#185** — no authenticated run has ever happened against live Supabase; every query, server action and storage-cleanup path is reasoned-only.
- **#186** — #96's drag-persistence acceptance and #114's drop-hover fix have never run in a real browser.
- **#187** — #113's iOS Safari viewport fixes, #118's 750ms touch-hold and #110's hidden scrollbar have never run on real hardware.
- **#188** — the visual gate is macOS-only: 100 `-darwin.png` baselines, zero `-linux.png`, so CI's `visual` job is `continue-on-error`.
- **#189** — Supabase security advisors report 9 WARN: four `security definer` functions are callable by `anon`, and leaked-password protection is off.
- **#190** — `lib/database.types.ts` is hand-written with no CI drift gate, and the obvious gate is blocked on the `reference`-schema override.
- **#191** — `BoardPanel.tsx` has no Ladle story, so it has zero visual coverage.
- **`toggleBoardFavorite` is not transactional** — two sequential statements; a failure between them leaves zero favourites (never two) and self-heals on the next toggle.
- **Production promotion is manual** (ADR-0012): either "Promote to Production" / `vercel promote` on an existing build, or a `workflow_dispatch` run of `deploy.yml` (verified green 2026-08-07, #165), which migrates and promotes together. Either way, migrations land first.

## Next

1. **Work the verification tickets** (#185–#191). This is the real remaining Phase 3 work — there is no missing UI behind it.
2. **7 ADRs are owed** for shipped schema deviations: `cards.size`, `boards.is_favorite`, `recipe_categories.icon`, `recipe_ingredients.group_label`, the `unit` enum, `recipe_step_ingredients`, and the `replace_recipe_contents` RPC-backed-transaction pattern (user-approved 2026-08-01). Write-up only, but it is the architecture layer — flag, don't improvise.
3. Phase 4 and 5 remainder, per the board.

Constraints worth knowing before touching these areas:

- `public.recipe_unit` is the one unit enum — reuse it, never redeclare (`tests/recipes-units-enum-sync.test.ts` fails on drift).
- `reference` is exposed to the Data API by a role override in `supabase/config.toml`, which shadows the dashboard toggle; type generation needs `--schema public,reference`. → `docs/guides/data-layer.md`
- NEVO nutrition: `NULL` means unknown — never coerce it to `0`. The licence attribution line in the macro dropdowns is mandatory (ADR-0013 §2). Volume↔mass coverage is deliberately partial (ADR-0014), so a remaining `?` is the specified fallback, not a bug.

## Environment still to set up (outside this repo)

**Mac mini (#1–#5)**: Docker plus two Supabase stacks (127.0.0.1, verify with `scripts/check-localhost-binding.sh`); `cloudflared` + Cloudflare Access; Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` and a chat model sized to RAM); a hardened self-hosted runner; restic backups including a separately-backed-up Vault root key.

**Accounts (free tier)**: Cloudflare; SMTP (Resend, for magic links); Healthchecks.io; an S3-compatible bucket (e.g. Backblaze B2).

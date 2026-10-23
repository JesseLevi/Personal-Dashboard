# Architecture: Atlas

This document describes the **current** system. Why each piece is the way it is lives in the ADRs (`docs/decisions/README.md` is the index). An ADR that changes the system updates this file in the same PR. History stays in the ADRs and git, not here.

## 1. System context

```
Browser (PWA) ──HTTPS──► Next.js on Vercel (fra1)
                          ├── Supabase Cloud: Postgres + Auth + RLS  (RLS-bound client per request)
                          ├── Cloudflare R2: uploaded images         (lib/storage, presigned GET)
                          ├── Anthropic API: Claude Haiku            (lib/ai, recipe import, unit weights)
                          └── public web pages                       (lib/net/safe-fetch, recipe import)
```

- The browser only talks to Atlas (ADR-0033). There is one hosted environment, production. Builds, promotion and migrations follow ADR-0032. Hosted settings that live outside the repo are listed in `docs/operations.md`.
- Async work runs after the response via Next.js `after()`, plus daily cron routes. There is no always-on worker (ADR-0018 §4).

## 2. Repository layout

```
app/                  App Router. (app)/ = signed-in routes: te-doen, recepten, winkelmand, notities
  api/                image delivery routes (recipe-thumbnail, note-image)
components/           design system: atoms/ molecules/ organisms/ (Atomic Design)
lib/                  server and shared logic, one folder per domain or seam:
  supabase/           server client (RLS-bound)   ai/       inference seam (ADR-0018)
  storage/            R2 seam (ADR-0024)          net/      safe-fetch, the SSRF guard
  auth/ profile/      session, greeting, profile  defaults/ ensure_user_defaults call
  boards/ notes/ recipes/ shopping/   domain queries, schemas, pure logic
  embeddings/         canonical text, chunking, drain
  ui/                 cn() and UI helpers
messages/             nl.json, en.json (ADR-0007)
supabase/migrations/  every schema change     supabase/tests/  pgTAP RLS suite
design/               tokens.json, figma-variables/, figma-map.json, notes/<Component>.md
scripts/              CI gates, token sync, data imports (NEVO, USDA)
tests/                Vitest; tests/visual = Playwright screenshot suite over Ladle
```

## 3. Frontend and design system

- **Rendering**: React Server Components by default. Mutations go through Server Actions with zod validation. There is no client data library.
- **Styling**: Tailwind v4 with semantic tokens only. `design/figma-variables/` (Figma export) feeds `design/tokens.json`, `pnpm sync:tokens` generates `app/theme.css`, and CI checks the chain for drift (ADR-0010). Dark mode follows the OS via `next-themes` (`data-theme`).
- **Components**: built with CVA. Variant axes are props; Hover/Active/Focus are CSS states, never props. Composition mirrors the design hierarchy: atoms ← molecules ← organisms ← `app/`. Icons go only through the `Icon` atom (lucide).
- **Design source** (ADR-0034): Claude designs UI in code from existing components and tokens. A Figma design the user names is implemented exactly.
- **Every component** gets a Ladle story, a visual baseline and a `design/notes/<Component>.md` contract.
- **Libraries**: dnd-kit (drag and drop), TipTap 3 with official MIT extensions only (ADR-0021), Floating UI (menus), next-intl (i18n), FullCalendar standard/MIT for the Agenda (ADR-0037).
- **PWA**: per-section web manifests, so Te doen, Recepten, Winkelmand and Notities can each be a home-screen icon.

## 4. Data model

### 4.1 Conventions

- snake_case, plural tables, `uuid` primary keys, `created_at`/`updated_at` (trigger-maintained).
- **Every `public` table** has `user_id uuid not null references auth.users on delete cascade`, RLS with the four standard policies, explicit grants, and a pgTAP test in `supabase/tests` (ADR-0009/0035). `user_id` is the owner, not the only reader. `pnpm check:rls-coverage` fails on any gap.
- **`reference` schema**: shared, non-user data with no `user_id`. Select for everyone. Writes only through migrations, except admin-written `eigen` rows and shared aliases (ADR-0011/0020).
- **`private` schema**: not exposed by PostgREST; written only by definer functions (ADR-0031). Also holds the sharing role functions (ADR-0035).
- **Sharing** (ADR-0035): a container (now `shopping_lists`) is shared through `shares` (one nullable FK per shareable type, `pending|accepted`, role `editor`). Rows inside a container carry the owner's `user_id`; their policies call `private.<type>_role(id)`. Other members' names come only from `member_profiles()` / `search_members()`.
- **Recipe share = copy** (ADR-0036): a recipe offer is a pending `shares` row (`recipe_id`, never `accepted`). The invitee reads it only through `pending_recipe_shares()`; `accept_recipe_share()` (definer) copies the recipe into their own first category, then `lib/sharing/recipes.ts` copies the thumbnail in R2. Afterwards the two recipes are unrelated.
- **Small closed sets** are text with a check constraint (`priority`, `size`, `source`). Units are the shared enum `public.recipe_unit` (ADR-0028).
- **Ordering** uses fractional `position` (numeric midpoint), mirrored in TypeScript and SQL (ADR-0015).
- **Multi-statement writes** are `security invoker` RPCs with `search_path = ''`, an explicit ownership guard, and execute granted only to `authenticated`: `replace_recipe_contents`, `move_card`, `move_recipe`, `move_note`, `toggle_board_favorite`, `save_note_content` (ADR-0015/0030).
- **Per-user defaults** are seeded by triggers at signup and lazily by `ensure_user_defaults()` (ADR-0017).
- `lib/database.types.ts` is generated in CI. Never hand-edit it.

### 4.2 Tables

| Area | Tables |
| --- | --- |
| Account | `profiles` (`display_name` = first name, `last_name`, `locale`), `user_seeds` |
| Te doen | `boards` (`is_favorite`, one per user), `board_columns` (`icon`), `cards` (`priority`, `size`, `due_at`, `source`), `labels`, `card_labels` |
| Recepten | `recipe_categories` (`icon`), `recipes` (`thumbnail_path`, `source_url`, `import_status`, `import_error`), `recipe_ingredients` (`ingredient_id`, `unit`, `group_label`, `needs_review`), `recipe_steps`, `recipe_step_ingredients`, `tags`, `recipe_tags` |
| Ingredient library | `ingredients` (user layer, nullable `reference_id`), `ingredient_unit_masses` (user overrides), `ingredient_aliases` (user) |
| Reference | `reference.ingredients` (NEVO + `eigen`, nutrients per 100 g, bilingual names/categories), `reference.ingredient_unit_masses` (NEVO portions, USDA), `reference.ingredient_aliases` (admin) |
| Winkelmand | `shopping_lists` (container, one `is_default` per user), `shopping_list_items` (`list_id`, `unit`, `checked`, `recipe_id` provenance) |
| Sharing | `shares` (ADR-0035) |
| Notities | `note_categories`, `notes` (`content` TipTap JSON, derived `title` + `content_text`), `note_links` (derived on save) |

Agenda tables: §7.

### 4.3 Search

Textual search uses `pg_trgm` on names, titles and `notes.content_text`. Ingredient matching runs own alias, then shared alias, then `pg_trgm` (`match_ingredient_candidates`), then the LLM (ADR-0020). Phase 8 adds semantic search across modules (§6).

### 4.4 Object storage

- R2 holds image bytes under keys `<user_id>/<module>/…`. The owning row in Postgres decides ownership (ADR-0024).
- Uploads are re-encoded server-side with `sharp`: magic-byte check, WebP, EXIF stripped.
- Delivery is an app route that checks session and ownership, then redirects to an hour-stable presigned URL. Server-rendered pages may presign directly.
- There are no RLS policies on objects, so Vitest ownership tests per consumer replace them.

## 5. Security model

- **Isolation**: RLS on every user table, tested in CI (ADR-0009). Access decisions live in policies, not in app code; sharing extends them through role functions, never app-side checks (ADR-0035). A share is active only after the member accepts.
- **Boundaries** (ADR-0033):
  - no `NEXT_PUBLIC_` Supabase variables;
  - `service_role` only in server-only modules, never in a request on a user's behalf;
  - one server-only module per external seam;
  - `check:server-only` enforces these.
- **Auth**:
  - Supabase Auth with password or a 6-digit e-mail code (plus fallback link); self-signup disabled (ADR-0038); DB-throttled, Turnstile on submit (ADR-0045).
  - Mail goes through Resend SMTP; template `supabase/templates/magic_link.html`, hosted config via `pnpm auth:email`.
  - `middleware.ts` only refreshes tokens; the redirect is in `app/(app)/layout.tsx`.
  - `getClaims()` verifies locally, so a revoked session lasts until token expiry.
  - Admins: `app_metadata.role = 'admin'` (ADR-0020).
- **Untrusted input**:
  - user URLs go through `safe-fetch`: https only, DNS-pinned, private ranges blocked, 3 redirects, 3 MB, 10 s;
  - rich text renders only through TipTap's whitelist; never `dangerouslySetInnerHTML`;
  - LLM output is zod-validated and rendered as plain text.
- **AI guardrails** (ADR-0018 §3):
  - deterministic code first;
  - schema-constrained output;
  - per-user rate limit;
  - provider spend cap;
  - degraded mode without a key.
- **Known accepted trade-off**: the login greeting shows a known address's first name, throttled (ADR-0031).
- **Backups**: Supabase Cloud backups cover Postgres. R2 has no second copy (ADR-0024).

## 6. AI and async work

- **Today**: `lib/ai/` exposes one provider-neutral function (prompt + zod schema in, validated object out). It runs Claude Haiku via Anthropic. Consumers: the recipe import pipeline, in `after()` with a lazy sweep for stuck rows (ADR-0019), and a recipe save that estimates a re-linked line's missing weight per unit (`lib/recipes/unit-weights.ts`).
- **Phase 8** (ADR-0043, epic #31), the connections layer:
  - `embed()` in `lib/ai/` runs `@cf/baai/bge-m3` (1024d) on Cloudflare Workers AI; the free daily quota is the spend cap;
  - opt-in per member (`profiles.ai_enabled`); without it nothing leaves Atlas (keyword search only);
  - `embeddings`: a row per chunk, exclusive arc over notes, recipes, cards, events and basket items, `halfvec(1024)`, owner-only RLS, exact search;
  - no queue: `embedding_backlog()` finds stale sources; a lazy `after()` drain (at most every 10 min) and the daily `/api/cron/embeddings` embed them, reusing vectors for identical text;
  - search across modules merges `search_text()` and `search_semantic()` (`security invoker`) with RRF.
- **History** (ADR-0044): triggers append basket adds and checks to `activity_events`; `settle_cooked_meals()` adds `recipe_cooked` for past meal plans. Every member, no AI.
- **Phase 9**: SQL detectors over `activity_events`, `embeddings` and cards; one LLM call per signal (consenting members) into `agent_signals`; no tools, no other writes, plain text.
- **Scheduled work** (ADR-0039, Vercel Hobby): a lazy "when stale" run in `after()` where a user is present, plus daily Vercel Cron routes behind `CRON_SECRET` as a backstop. Cron routes may use `service_role` (no user request). Anything more frequent needs a new ADR.

## 7. Agenda (ADR-0037)

- **One timeline, nothing copied**: manual events (editable), synced events (source fields read-only, never written back), `meal_plans`, `cards.planned_for` and the `cards.due_at` overlay, unioned by one `security invoker` function.
- **Schema**:
  - `calendars`: the container (ADR-0035); a default per user (ADR-0017); an imported feed is its own calendar. Manual calendars are the UI's categories; each calendar has a palette `color` (ADR-0040).
  - `calendar_accounts`: provider, credentials in Vault (ADR-0002), `sync_state`, `last_synced_at`.
  - `calendar_events`: `calendar_id`, `starts_at`/`ends_at`, `all_day`, `source` `manual|sync`, `external_id` unique per account, `missing_since`.
  - `meal_plans`: `calendar_id`, `recipe_id`, `servings`, `slot` (breakfast/lunch/dinner/snack), and either `planned_on` or `calendar_event_id`; "naar mand" sets `shopping_list_items.meal_plan_id`.
  - `calendar_event_links`: an event plus exactly one card, recipe or note, cascading on both sides.
  - `calendar_event_series`: rule and template of a recurring own event; occurrences are `calendar_events` rows (`series_id`), 400 days ahead, extended on Agenda load (ADR-0042).
- **Sync** (ADR-0037 §5): `ics` → `caldav` → Graph/Google on need, via `safe-fetch`, parsed by `ical.js`; recurring instances expanded −30 d / +400 d, upserted by UID + instance start; a failed, empty or halved fetch deletes nothing; two-miss deletion with a basket notice; writes only on a changed hash.
- **Colour, creation**: items use their calendar's `event-<colour>-*` tokens (ADR-0040); quick add parses with `chrono-node`, no AI (ADR-0041).
- **Sync trigger** (ADR-0039): opening the Agenda syncs the user's accounts older than an hour in `after()`; the daily cron syncs accounts older than 20 hours. `apply_calendar_sync` (`security definer`, advisory lock) applies a parsed feed per account: upsert, hash, two-miss deletion, and a `calendar_sync_notices` row (item ids kept, as `meal_plan_id` is nulled). The URL sits in Vault; `lib/agenda/sync.ts` and `app/api/cron/` call it.

## 8. Testing and CI gates

- **Vitest** covers pure logic: units, positioning, parsing, import, storage ownership.
- **pgTAP** covers RLS isolation and function grants.
- **Playwright** screenshots Ladle stories:
  - light + a dark subset, Button states;
  - the Linux CI baselines are the gate;
  - regenerate them with the `visual-update` workflow.
- **Gates** (`pnpm check:*`):
  - `rls-coverage`, `server-only`, `raw-spacing`, `comment-budget`, `retired-tokens`, `tokens-drift`, `doc-budget`;
  - key parity between `nl.json` and `en.json`.

## 9. Phases

| Phase | Status |
| --- | --- |
| 0 Foundation, 1 Account, 2 Design system | ✅ (Resend hookup on hosted is open, #10) |
| 3 Te doen, 4 Recepten (incl. import, nutrition), 5 Winkelmand, 6 Notities | ✅ in production use |
| Delen fase 1 (#420) and 2 (#464), 7 Agenda (#33) | ✅ built |
| 8 Connections layer and activity history (#31, ADR-0043/0044) | 🔜 next |
| 9 Assistent: agent signals | backlog (#32) |
| Later | sharing boards (ADR-0035), live recipe sharing, mail integration (`Vision.md`) |

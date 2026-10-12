# Architecture: Atlas

This document describes the **current** system. Why each piece is the way it is lives in the ADRs (`docs/decisions/README.md` is the index). An ADR that changes the system updates this file in the same PR. History stays in the ADRs and git, not here.

## 1. System context

```
Browser (PWA) ──HTTPS──► Next.js on Vercel (fra1)
                          ├── Supabase Cloud: Postgres + Auth + RLS  (RLS-bound client per request)
                          ├── Cloudflare R2: uploaded images         (lib/storage, presigned GET)
                          ├── Anthropic API: Claude Haiku            (lib/ai, recipe import)
                          └── public web pages                       (lib/net/safe-fetch, recipe import)
```

- The browser only talks to Atlas (ADR-0033). There is one hosted environment, production. Builds, promotion and migrations follow ADR-0032. Hosted settings that live outside the repo are listed in `docs/operations.md`.
- Async work: short tasks run after the response via Next.js `after()`. There is no always-on worker (ADR-0018 §4). `worker/` is a skeleton.

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
  ui/                 cn() and UI helpers
messages/             nl.json, en.json (ADR-0007)
supabase/migrations/  every schema change     supabase/tests/  pgTAP RLS suite
design/               tokens.json, figma-variables/, figma-map.json, notes/<Component>.md
scripts/              CI gates, token sync, data imports (NEVO, USDA)
tests/                Vitest; tests/visual = Playwright screenshot suite over Ladle
worker/               job-consumer skeleton (unused until a scheduled-work mechanism is chosen)
```

## 3. Frontend and design system

- **Rendering**: React Server Components by default. Mutations go through Server Actions with zod validation. There is no client data library.
- **Styling**: Tailwind v4 with semantic tokens only. `design/figma-variables/` (Figma export) feeds `design/tokens.json`, `pnpm sync:tokens` generates `app/theme.css`, and CI checks the chain for drift (ADR-0010). Dark mode follows the OS via `next-themes` (`data-theme`).
- **Components**: built with CVA. Variant axes are props; Hover/Active/Focus are CSS states, never props. Composition mirrors the design hierarchy: atoms ← molecules ← organisms ← `app/`. Icons go only through the `Icon` atom (lucide).
- **Design source** (ADR-0034): Claude designs UI in code from existing components and tokens. A Figma design the user names is implemented exactly.
- **Every component** gets a Ladle story, a visual baseline and a `design/notes/<Component>.md` contract.
- **Libraries**: dnd-kit (drag and drop), TipTap 3 with official MIT extensions only (ADR-0021), Floating UI (menus), next-intl (i18n), Schedule-X for the Agenda (ADR-0008).
- **PWA**: per-section web manifests, so Te doen, Recepten, Winkelmand and Notities can each be a home-screen icon.

## 4. Data model

### 4.1 Conventions

- snake_case, plural tables, `uuid` primary keys, `created_at`/`updated_at` (trigger-maintained).
- **Every `public` table** has `user_id uuid not null references auth.users on delete cascade`, RLS with the four standard policies, explicit grants, and a pgTAP test in `supabase/tests` (ADR-0009/0035). `user_id` is the owner, not the only reader. `pnpm check:rls-coverage` fails on any gap.
- **`reference` schema**: shared, non-user data with no `user_id`. Select for everyone. Writes only through migrations, except admin-written `eigen` rows and shared aliases (ADR-0011/0020).
- **`private` schema**: not exposed by PostgREST; written only by definer functions (ADR-0031). Also holds the sharing role functions (ADR-0035).
- **Sharing** (ADR-0035): a container (now `shopping_lists`) is shared through `shares` (one nullable FK per shareable type, `pending|accepted`, role `editor`). Rows inside a container carry the owner's `user_id`; their policies call `private.<type>_role(id)`. Other members' names come only from `member_profiles()` / `search_members()`.
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

Planned for Phase 7: `calendar_events` and `calendar_accounts` (§7).

### 4.3 Search

Textual search uses `pg_trgm` on names, titles and `notes.content_text`. Ingredient matching runs own alias, then shared alias, then `pg_trgm` (`match_ingredient_candidates`), then the LLM (ADR-0020). Semantic search is Phase 8 (§6).

### 4.4 Object storage

- R2 holds image bytes under keys `<user_id>/<module>/…`. The owning row in Postgres decides ownership (ADR-0024).
- Uploads are re-encoded server-side with `sharp`: magic-byte check, WebP, EXIF stripped.
- Delivery is an app route that checks session and ownership, then redirects to an hour-stable presigned URL. Server-rendered pages may presign directly (#391).
- There are no RLS policies on objects, so Vitest ownership tests per consumer replace them.

## 5. Security model

- **Isolation**: RLS on every user table, tested in CI (ADR-0009). Access decisions live in policies, not in app code; sharing extends them through role functions, never app-side checks (ADR-0035). A share is active only after the member accepts.
- **Boundaries** (ADR-0033):
  - no `NEXT_PUBLIC_` Supabase variables;
  - `service_role` only in server-only modules, never in a request on a user's behalf;
  - one server-only module per external seam;
  - `check:server-only` enforces these.
- **Auth**:
  - Supabase Auth with password or magic link; self-signup disabled.
  - `middleware.ts` only refreshes tokens; the redirect lives in `app/(app)/layout.tsx`.
  - `getClaims()` verifies locally, so a revoked session lasts until token expiry (#168).
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
- **Known accepted trade-off**: the login greeting reveals a first name for a known address, throttled (ADR-0031).
- **Backups**: Supabase Cloud backups cover Postgres. R2 has no second copy (ADR-0024).

## 6. AI and async work

- **Today**: `lib/ai/` exposes one provider-neutral function (prompt + zod schema in, validated object out). It runs Claude Haiku via Anthropic. Its only consumer is the recipe import pipeline, which runs in `after()` with a lazy sweep for stuck rows (ADR-0019).
- **Phase 8 shape** (ADR-0006, amended by 0018), with the model and host still open:
  - triggers enqueue `embed` jobs for notes and recipes;
  - a handler builds canonical text, skips unchanged content by hash, chunks, embeds and upserts `embeddings`;
  - `search_semantic()` is `security invoker`, so RLS filters results.
- **Phase 9 shape**:
  - SQL detectors produce candidate signals;
  - one LLM call phrases each signal into `agent_signals`;
  - the agent has no tools and no writes beyond its own rows, and its output is plain text.
- **Open decisions** (each needs an ADR before its phase starts):
  1. the runtime for scheduled and longer work (candidates: Vercel Cron → route handler, Supabase Cron + Edge Functions, or a lazy "sync when stale" on page load in the ADR-0017 style);
  2. the hosted multilingual embedding model and its dimension;
  3. the privacy stance on sending notes to a provider (ADR-0018 requires it to be explicit).

## 7. Agenda (Phase 7, planned)

- **Schema** (ADR-0005/0008):
  - `calendar_events`: title, `starts_at`/`ends_at` as `timestamptz`, `all_day` flag, location, description, `source` `manual|sync`, nullable `calendar_account_id` + `external_id`, unique per account.
  - `calendar_accounts`: provider `ics|caldav|google`, display name, `vault_secret_id`, `sync_state`, `last_synced_at`.
  - Keep a clear owning container, so a shared calendar can come later (ADR-0035).
- **Sync**:
  - read-only import, providers in order `ics` → `caldav` (`tsdav`) → `google` (OAuth refresh token);
  - credentials, including secret ICS URLs, in Vault (ADR-0002);
  - fetches through `safe-fetch`;
  - recurring events expanded into instances within −30 d / +400 d;
  - synced rows are read-only in the UI.
- **Deadlines** from `cards.due_at` overlay at query time; they are never copied.
- **UI**: Schedule-X themed with semantic tokens, Claude-designed (ADR-0034).
- **Sync trigger** depends on open decision 1 in §6.

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
| 0 Foundation, 1 Account, 2 Design system | ✅ (SMTP for magic links on hosted is open, #10) |
| 3 Te doen, 4 Recepten (incl. import, nutrition), 5 Winkelmand, 6 Notities | ✅ in production use |
| Delen, fase 1: Winkelmand (#420) | 🔜 now (ADR-0035) |
| 7 Agenda | 🔜 after #420 (#33) |
| 8 AI pipeline: embeddings and semantic search | backlog (#31) |
| 9 Assistent: agent signals | backlog (#32) |
| Later | sharing boards and recipes (ADR-0035), weekmenu, mail integration (`Vision.md`) |

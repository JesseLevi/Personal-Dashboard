# Architecture — Personal Dashboard

**Status**: Draft for ticket generation (Opus) and execution (Claude Code/Sonnet).
**Inputs**: `Vision.md` (product scope), `CLAUDE.md` (build conventions), Figma "Notion - V2" dev page (node 3670-3261), user decisions 2026-07-20 (recorded in ADRs).
**ADRs**: `docs/decisions/` — referenced as ADR-NNNN throughout. Where this document and an ADR conflict, the ADR wins.

---

## 1. System context

```
                    ┌──────────────────────────── Mac mini M4 (homeserver) ───────────────────────────┐
Browser ── HTTPS ── Cloudflare Tunnel ── Next.js app (staging + prod instances)                       │
                    │                        │            │                                           │
                    │                        │            ├── Supabase self-hosted (Docker,          │
                    │                        │            │     bound to 127.0.0.1 only)             │
                    │                        │            │     Postgres + Auth + RLS + pgvector      │
                    │                        │            │     + Vault + Storage + pg_cron           │
                    │                        │            └── Ollama (native macOS, 127.0.0.1 only)   │
                    │                        │                  chat model 14–27B quantized           │
                    │                        │                  embeddings: bge-m3                    │
                    │                        └── Worker (Node process): job queue consumer            │
                    └─────────────────────────────────────────────────────────────────────────────────┘
```

Only the Next.js app is reachable from outside, via Cloudflare Tunnel (ADR-0003). Supabase (API, Studio) and Ollama bind to localhost — they are never exposed. The browser talks to Supabase exclusively through the Next.js server (server components / server actions / route handlers), not directly.

## 2. Repository layout

Single repo, single Next.js package, worker as a second entrypoint in the same package (no monorepo tooling — one person maintains this).

```
app/                    # Next.js App Router routes
components/
  atoms/                # mirrors Figma "Atoms" section
  molecules/            # mirrors Figma "Molecules" section
  organisms/            # mirrors Figma "Organisms" section
lib/                    # supabase clients, i18n, zod schemas, utils
worker/                 # job consumer (embeddings, agent, calendar sync) — run with tsx
supabase/
  migrations/           # every schema change, via Supabase CLI (ADR-0009)
  tests/                # RLS test suite (ADR-0009)
  seed.sql
docs/decisions/         # ADRs
messages/               # i18n message catalogs: nl.json, en.json (ADR-0007)
```

## 3. Frontend

- **Next.js App Router**, React Server Components by default, mutations via Server Actions with `zod` validation. No client-side data library until a concrete need appears.
- **Tailwind CSS v4** (CSS-first `@theme`), utility classes only (see CLAUDE.md). The theme is **generated from `design/tokens.json`** — see §3.2 / ADR-0010; nobody edits theme values by hand.
- Component variants via **CVA** (`class-variance-authority`): the Figma Button matrix (Style × State) maps to a CVA `variant` prop for Style; **State (Hover/Active) maps to CSS pseudo-classes, never to React props**. Figma boolean props (e.g. `With icon`) become optional React props/slots; Figma SLOT nodes become `children` or named slot props.
- **Icons**: one `Icon` atom wrapping `lucide-react` (the Figma icon set matches lucide names: Croissant, Infinity, Lightbulb, Shirt, …); size/stroke come from tokens. Custom SVG only when lucide has no match.
- **Design-system workbench**: **Ladle** with one story per atom/molecule/organism, plus Playwright screenshot baselines committed to the repo — every Figma re-sync shows up as a reviewable visual diff (ADR-0010).
- **Kanban drag & drop**: `dnd-kit` (MIT).
- **Rich text**: TipTap (Notities — UI in a later round, schema now).
- **Calendar UI**: NOT CalendarKit — that library is React Native-only and cannot run in this stack. Recommended replacement: **Schedule-X** (MIT, web-native). Decision + fallback in ADR-0008. UI build waits for Figma designs regardless.
- **i18n**: `next-intl`, NL default, EN second (ADR-0007). No hardcoded user-facing strings, including in this round's NL-only UI.

### 3.1 Figma → code naming map

Figma contains spelling variants; code uses corrected English. This table is the human-readable view; the canonical machine-readable version lives in **`design/figma-map.json`** (component name ↔ file path ↔ Figma node-id), and **every component file carries its Figma node-id in a header comment** (`// figma: node-id=3670:3261`) so re-syncing a component is mechanical (ADR-0010). Opus must include the relevant mapping in every UI ticket:

| Figma name | Code |
|---|---|
| `Atom/Button`, `Button/Default` | `components/atoms/Button.tsx` |
| Button `Style=Distructive` | `variant="destructive"` |
| `Atom/Tag`, `Tag` | `components/atoms/Tag.tsx` |
| `Input-field`, `Atom/Input-field` | `components/atoms/InputField.tsx` |
| `Checkbox` | `components/atoms/Checkbox.tsx` |
| `Dropdown` | `components/atoms/Dropdown.tsx` |
| `Button/Toggle` | `components/atoms/ButtonToggle.tsx` |
| `Icon/*` (27 icons; `Icon/Calandar` → Calendar) | `components/atoms/icons/*` — prefer `lucide-react` equivalents, custom SVG only when no match |
| `Card-content/Recipi` | `components/molecules/CardContentRecipe.tsx` |
| `Card-content/Ingredient` | `components/molecules/CardContentIngredient.tsx` |
| `Card-content/Ticket` | `components/molecules/CardContentTicket.tsx` |
| `Card-content/Step` | `components/molecules/CardContentStep.tsx` |
| `Card`, `Step` | `components/molecules/Card.tsx`, `Step.tsx` |
| `Card-container` | `components/organisms/CardContainer.tsx` |
| `Carousel` | `components/organisms/Carousel.tsx` |
| `Sidebar` | `components/organisms/Sidebar.tsx` |

### 3.2 Design tokens: `tokens.json` as the single source (ADR-0010)

Pipeline: Figma variables (primitive → semantic) → `design/tokens.json` in the repo (synced via Figma MCP/API, `pnpm sync:tokens`) → generated `app/theme.css` (Tailwind v4 `@theme`) → utility classes. The six Figma text styles are Tailwind-native (`text-xs/normal` → `text-xs`, etc.); colors sit on Tailwind's stone scale plus named semantic tokens (accent purple `#8A38F5`, priority colors red/orange/blue/green with pastel backgrounds). Components reference **semantic** token classes, never primitives directly and never inline hex (CLAUDE.md). A token change in Figma is therefore a re-sync + a reviewable diff, with zero component edits.

### 3.3 Component update loop

When a component changes in Figma: look up its node-id in `design/figma-map.json` → fetch via Figma MCP → update the component's CVA classes/structure → Ladle screenshot diff shows exactly what changed → PR. This loop is the maintenance contract; tickets that add components must also add their map entry, header annotation, and story.

## 4. Data architecture

### 4.1 Conventions

- snake_case, plural table names, `uuid` PKs (`gen_random_uuid()`), `created_at`/`updated_at` (trigger-maintained).
- **Every table**: `user_id uuid not null references auth.users(id) on delete cascade` (ADR-0001) + RLS enabled + the standard four policies (`select/insert/update/delete using/with check user_id = (select auth.uid())`). No exceptions; CI enforces this (ADR-0009).
- Schema changes only via `supabase/migrations` (ADR-0009). Types generated with `supabase gen types typescript` into `lib/database.types.ts`.

### 4.2 Tables per module

**Auth/profile**: `profiles` (PK = auth.users id, `display_name`, `locale`).

**Kanban (Te-Doen)**: `boards`, `board_columns` (board_id, name, position), `cards` (column_id, title, description, priority enum `urgent|medium|mid|low`, due_at nullable, position, `source` enum default `'manual'` — ADR-0005), `labels` (board-scoped), `card_labels`.

**Notities** (schema this round, UI later): `notes` (title, `content jsonb` TipTap doc, `content_text` generated/maintained plain text for search + embedding), `tags` (user-scoped, shared with recipes), `note_tags`.

**Recepten**: `recipe_categories` (user-defined, name, position — the "kanban" columns of the recipe overview), `recipes` (title, category_id, servings int, thumbnail_path, time_minutes), `recipe_ingredients` (recipe_id, name, quantity numeric nullable, unit text nullable, position), `recipe_steps` (recipe_id, position, instruction), `recipe_tags`.

**Boodschappenlijst**: `shopping_list_items` (name, quantity, unit, `checked bool`, `section` text nullable for supermarket grouping, `recipe_id` nullable provenance link, position). Portion scaling happens at "send to list" time in the app layer (scale quantity by servings factor); the list stores resolved values.

**Agenda** (schema this round, UI later): `calendar_events` (title, starts_at, ends_at, all_day, location, description, `source` enum `manual|sync` — ADR-0005, `calendar_account_id` nullable, `external_id` nullable, unique on (calendar_account_id, external_id)), `calendar_accounts` (provider enum `google|caldav|ics`, display_name, `vault_secret_id` — credentials in Vault per ADR-0002 pattern, `sync_state jsonb`, last_synced_at).

**Kleding** (schema this round, UI later): `clothing_items` (name, type, season, photo_path), `outfits`, `outfit_items`.

**AI/infra**: `embeddings` (source_table, source_id, chunk_index, `content_hash`, `content_text`, `embedding vector(1024)` — bge-m3, ADR-0006), `jobs` (type, payload jsonb, status enum `pending|running|done|failed`, run_at, attempts, last_error), `agent_signals` (detector, message, payload jsonb, status enum `new|dismissed`), `user_ai_keys` → Vault-backed (ADR-0002).

**Storage buckets** (private, RLS'd, path prefix = user_id): `recipe-thumbnails`, `clothing-photos`.

### 4.3 Search

Textual search: `pg_trgm` ILIKE indexes on `notes.content_text`, `recipes.title`, `recipe_ingredients.name` (works across NL/EN without language-specific FTS config). Semantic search: §5.

## 5. AI & search pipeline (ADR-0006)

One generic pipeline; no module-specific embedding code.

1. **Enqueue**: DB triggers on `notes` and `recipes`(+ingredients/steps) insert a `jobs` row (`embed`, `{source_table, source_id}`) on insert/update.
2. **Worker** (Node, `worker/`, runs on Mac mini next to the app): polls `jobs` with `FOR UPDATE SKIP LOCKED` (service_role, LAN). For `embed` jobs: build canonical text → compare `content_hash` (skip if unchanged) → chunk → Ollama `/api/embed` (bge-m3) → upsert `embeddings`.
3. **Semantic search**: route handler embeds the query via Ollama, then calls a **security-invoker** Postgres function `search_semantic(query_embedding, scope, limit)` doing pgvector cosine top-k — RLS applies automatically because the function runs as the calling user.
4. **AI-agent**: `pg_cron` runs SQL detectors (e.g. cards stale in a column > N days, overdue due_at, recurring themes via vector neighbors) → inserts candidate rows into `jobs` (`agent`) → worker assembles context (signal + related content via vector search) → **one** Ollama chat call → stores the natural-language result in `agent_signals`. Surfaced via an API endpoint + minimal list UI; a designed dashboard surface is a later round (needs Figma).
5. **Prompt-injection containment**: user content (notes, recipes, sync'd event titles) flows into LLM prompts. The agent therefore has **no tools and no write access to anything but its own `agent_signals` row**, and agent output is rendered as plain text (never markdown-to-HTML). Worst case for an injected note is a misleading message, never an action.

Deliberately simple: no streaming, no agent frameworks, no LangChain. A queue table, a poller, and two Ollama endpoints.

## 6. External calendar sync (ADR-0008)

**This round: read-only import.** Provider abstraction with three implementations, cheapest first: `ics` (public/secret ICS URL — no OAuth), `caldav` (`tsdav`, MIT), `google` (OAuth offline refresh token). Credentials/tokens stored via the Vault pattern (ADR-0002). Worker job `calendar:sync` per account on an interval: incremental where supported (Google syncToken, CalDAV ctag/etag) → upsert `calendar_events` with `source='sync'`. Sync'd events are read-only in the UI. Two-way sync is explicitly a later round.

- **SSRF guard (mandatory)**: user-supplied ICS/CalDAV URLs are fetched by the worker, which sits next to Supabase and Ollama. Fetches must be https-only, resolve DNS first and reject private/loopback/link-local ranges, cap redirects (re-validating each hop), and enforce response size/time limits. This ships in the same ticket as the first provider, not later.
- **Recurring events**: expanded into concrete event instances at sync time within a rolling window (e.g. −30d/+400d); no RRULE storage or evaluation in-app this round. Manual events have no recurrence yet (not in Vision scope).
- All timestamps `timestamptz`; all-day events flagged, not midnight-encoded.

## 7. Security (ADR-0003)

- **Exposure**: `cloudflared` on the Mac mini; tunnel routes `dash.<domain>` → prod Next.js, `staging.<domain>` → staging. Staging behind Cloudflare Access; **recommended: prod behind Access too** (email allowlist of household members — free, closes the entire pre-auth attack surface incl. future Next.js/Auth CVEs; drop it only when someone outside the allowlist needs access). No inbound ports on the router.
- **Strict localhost binding**: Supabase's Docker compose publishes ports on `0.0.0.0` by default — every published port (Kong, Postgres, Studio, Analytics) must be explicitly bound to `127.0.0.1`, and Ollama runs with `OLLAMA_HOST=127.0.0.1`. "On the LAN" is not trusted; any IoT device on the home Wi-Fi would otherwise reach the database. Phase 0 includes a check script for this.
- **Email delivery**: magic-link auth requires SMTP for self-hosted GoTrue — configure a transactional provider (e.g. Resend/Postmark free tier) in Phase 1; without it, half the login story silently doesn't work.
- **Secrets**: `.env` files live outside git (repo ships `.env.example`); CI secrets in GitHub Actions; `service_role` key exists only in server/worker env, never in client bundles (`import "server-only"` + CI grep, ADR-0002). Per-user AI API keys and calendar credentials in Supabase Vault via server-side functions (ADR-0002).
- **Content rendering**: TipTap documents render exclusively through TipTap's React renderer with a fixed extension whitelist — never `dangerouslySetInnerHTML` on stored content. Agent output renders as plain text (§5.5).
- **Uploads**: clothing/recipe images are content-type- and size-validated server-side, **EXIF-stripped on upload** (clothing photos are taken at home — GPS metadata is a real leak), stored in private buckets, served via short-lived signed URLs.
- **RLS everywhere**, verified by CI (ADR-0009).
- **Supply chain / CI runner**: the self-hosted runner executes generated code on the machine that holds all data. Mitigations: runner under a dedicated non-admin macOS user; workflows run only from this repo's protected branches (no fork PRs); `pnpm install --frozen-lockfile` everywhere; Renovate/Dependabot with manual merge; `pnpm audit` in CI.
- **Backups**: nightly `pg_dump` + Storage rsync, encrypted off-site copy (restic → any S3-compatible bucket); **the pgsodium/Vault root key is backed up separately from the dumps** (a dump alone restores Vault secrets as undecryptable blobs); restore drill onto staging monthly.
- **Observability**: worker and backup jobs ping a dead-man's-switch (e.g. Healthchecks.io); the failure mode of a solo-maintained homeserver is silence, not errors.

## 8. Environments & CI/CD

- **Local dev**: `supabase start` (CLI), local Ollama, `next dev`.
- **Staging + prod**: two Supabase Docker stacks + two app instances on the Mac mini, separate tunnel hostnames. **Capacity note**: prod Supabase + Ollama (a 14B q4 model ≈ 9 GB) already stress a 16 GB machine — staging runs **on-demand** (started for deploy verification/restore drills, stopped otherwise), and model size follows available RAM, not ambition.
- **CI (GitHub Actions)**: lint → typecheck → unit tests (`--frozen-lockfile`) → `supabase db reset` + RLS suite (ADR-0009) → Ladle screenshot diff (ADR-0010) → build. **CD**: self-hosted runner on the Mac mini (hardened per §7); deploy = migrate then restart app/worker; staging on merge to `main`, prod on tag.

## 9. Testing

- **Vitest** for unit (portion scaling, chunking, sync mapping are the high-value targets).
- **RLS suite** (ADR-0009): for every table, assert user A cannot read/write user B's rows; a CI script diffs the table list against the test list and fails on gaps.
- **Playwright**: one smoke flow per shipped module (login → create → see → mutate).

## 10. Build order (ADR-0004) — the ticket phasing for Opus

Dependencies: Login gates everything; Recepten → Boodschappenlijst is the only hard module dependency; embedding pipeline gates semantic search and agent; agent benefits from real data existing first.

- **Phase 0 — Foundation**: repo scaffold (Next.js, Tailwind v4, CVA, next-intl, Ladle, CI skeleton), `design/tokens.json` sync + generated theme + `design/figma-map.json` (ADR-0010), Supabase local + migrations setup, RLS test harness, localhost-binding check script, Cloudflare Tunnel + staging/prod stacks, backup job incl. Vault root key + dead-man's-switch pings.
- **Phase 1 — Auth**: Supabase Auth (email/password + magic link), `profiles`, minimal login UI with existing atoms (no Figma design exists — keep deliberately plain, ADR-0004).
- **Phase 2 — Design system core**: atoms + molecules from Figma (Button, Tag, InputField, Checkbox, icons, Card family), Sidebar + CardContainer organisms. Every component ticket carries its Figma node-id.
- **Phase 3 — Te-Doen (Kanban)**: schema + board UI (designed), dnd-kit, labels/filtering. Includes `source` column (ADR-0005).
- **Phase 4 — Recepten**: schema + overview (category kanban), recipe detail, add-recipe flow incl. ingredients (all designed), thumbnails bucket.
- **Phase 5 — Boodschappenlijst**: schema + Winkelmand UI (designed), "send ingredients to list" with portion scaling, sectie-grouping.
- **Phase 6 — Backend-only schemas**: Notities, Agenda, Kleding tables + server actions + RLS tests. No UI (no designs; CLAUDE.md forbids invented UI).
- **Phase 7 — AI pipeline**: jobs + worker + embeddings + triggers, semantic search over recipes (+ notes data if any exists via API), pg_trgm textual search.
- **Phase 8 — AI-agent**: pg_cron detectors, agent job type, `agent_signals` + minimal surface.
- **Phase 9 — Calendar sync (backend)**: provider abstraction, ics → caldav → google order, Vault credential flow, sync worker job.

Each phase must end shippable; later phases must not block earlier ones from deploying.

## 11. Deferred / future rounds

Mail-integratie (the `source` field is its only present-day footprint — ADR-0005), Notities/Agenda/Kleding UI (awaiting Figma), two-way calendar sync, household sharing (requires migration under ADR-0001 — accepted trade-off), dashboard/agent surface design, weekmenu, native app, Home Assistant.

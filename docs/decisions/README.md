# Decisions (ADRs)

Read this index first, then only the ADRs your task touches. An ADR wins over `Architecture.md` when they conflict. That conflict is a bug: fix it in the same PR.

**Writing one**: the user decides, Claude records. Use the next free number; numbers are never reused. Start with `**Status**: Accepted (…, date, #ticket)`. Amend in place at most once. After that, write a new ADR that supersedes the old one, and set the old one's status to `Superseded by ADR-NNNN`. An ADR that changes the system updates `Architecture.md` (and `Vision.md` when scope moves) in the same PR, plus its row here.

## Platform and process

| ADR | Decides | Status |
| --- | --- | --- |
| [0018](0018-shelve-self-hosting-and-local-inference.md) | Vercel + Supabase Cloud is the target; hosted AI behind `lib/ai/` with cost guardrails; no always-on worker | Accepted |
| [0032](0032-deploy-and-release.md) | Builds on `main` only, manual promotion, migration routes, CI scope | Accepted |
| [0033](0033-server-only-data-access.md) | Browser talks only to Atlas; all data through server code | Accepted |
| [0038](0038-login-by-email-code.md) | Login by 6-digit e-mail code plus fallback link; Resend SMTP; hosted config scripted | Accepted |
| [0039](0039-scheduled-work-runtime.md) | Scheduled work: lazy "sync when stale" in `after()` plus one daily Vercel Cron (Hobby); rules in one definer function | Accepted |
| [0007](0007-i18n-next-intl.md) | next-intl, NL default, EN in the same PR | Accepted |
| [0009](0009-rls-testing-and-migration-discipline.md) | Migrations only; RLS test per table; CI coverage gate | Accepted (storage part amended by 0024) |
| [0034](0034-ui-design-source.md) | Claude designs UI in code by default; a named Figma design is binding | Accepted |
| [0010](0010-design-token-sync-and-component-traceability.md) | Token pipeline Figma → `tokens.json` → `theme.css`; component traceability | Accepted, amended by 0034 |
| [0004](0004-build-order.md) | Original phase order (current order: `Architecture.md` §9) | History |
| [0012](0012-vercel-supabase-cloud-deploy-and-migration-delivery.md) | How migration delivery came about | Superseded by 0032 |
| [0003](0003-cloudflare-tunnel-exposure.md) | Cloudflare Tunnel for the Mac mini | Superseded by 0018 |

## Data model and security

| ADR | Decides | Status |
| --- | --- | --- |
| [0035](0035-sharing-model.md) | Sharing per container via one `shares` table; access in policies through `private.<type>_role()`; member search by name | Accepted |
| [0036](0036-recipe-share-sends-a-copy.md) | Sharing a recipe sends a copy: offer in `shares`, two definer RPCs, accept copies into the recipient's data | Accepted |
| [0001](0001-user-scoped-data-ownership.md) | `user_id` ownership + RLS on every table | Superseded by 0035 |
| [0002](0002-secrets-in-vault-server-only-access.md) | Per-user credentials in Vault, decrypted server-side only | Accepted, amended by 0039 |
| [0005](0005-source-field-now.md) | `source` column on `cards` and `calendar_events` | Accepted |
| [0015](0015-move-rpcs-atomic-drag-persistence.md) | Multi-statement writes as `security invoker` RPCs with an ownership guard | Accepted |
| [0017](0017-lazy-ensure-user-defaults.md) | Per-user seeds via `ensure_user_defaults()` + `user_seeds` | Accepted |
| [0020](0020-curated-ingredient-mappings-and-admin-role.md) | Admin role in `app_metadata`; admin-written `reference` rows | Accepted |
| [0024](0024-object-storage-on-r2.md) | Uploaded binaries in R2 via `lib/storage/`; presigned delivery | Accepted |
| [0031](0031-login-greeting-name-lookup.md) | Login greeting by e-mail: accepted enumeration trade-off, rate-limited | Accepted |
| [0045](0045-login-rate-limit.md) | Login actions throttled per address, client and globally in one definer function; Turnstile on password submit and code send | Accepted |

## Te doen (Kanban)

| ADR | Decides | Status |
| --- | --- | --- |
| [0025](0025-cards-size.md) | `cards.size` s/m/l/xl | Accepted |
| [0026](0026-boards-is-favorite.md) | One favourite board per user | Accepted |

## Recepten and Winkelmand

| ADR | Decides | Status |
| --- | --- | --- |
| [0011](0011-ingredient-library-and-reference-data.md) | Two-layer ingredient library, `reference` schema, unit-mass resolution | Accepted, amended by 0013/0014/0020 |
| [0013](0013-nevo-nutrition-import.md) | NEVO as nutrition source; attribution in the UI is mandatory | Accepted |
| [0014](0014-kitchen-unit-conversion-and-fraction-notation.md) | Volume ↔ mass via curated rows; fraction display | Accepted |
| [0019](0019-recipe-import-via-url.md) | Recipe import: deterministic first, Haiku via `after()`, guardrails | Accepted, amended by 0020 |
| [0027](0027-recipe-categories-icon-and-ingredient-group-label.md) | Category icon; ingredient `group_label` | Accepted |
| [0028](0028-recipe-unit-enum.md) | One `recipe_unit` enum for every unit column | Accepted |
| [0029](0029-recipe-step-ingredients.md) | Steps link to recipe ingredient rows | Accepted |
| [0030](0030-replace-recipe-contents-rpc.md) | Recipe save as one replace RPC | Accepted |
| [0016](0016-kleding-out-of-scope.md) | Kleding is out of Atlas | Accepted |

## Notities

| ADR | Decides | Status |
| --- | --- | --- |
| [0021](0021-notes-editor-capabilities.md) | Editor capabilities, extension whitelist, stored-content rules | Accepted |
| [0022](0022-note-images-storage.md) | Images in notes (storage per 0024) | Accepted, amended by 0024 |
| [0023](0023-note-links-and-backlinks.md) | `[[` note links, `note_links`, backlinks | Accepted |

## Agenda, AI and history

| ADR | Decides | Status |
| --- | --- | --- |
| [0037](0037-agenda-as-planner.md) | Agenda = one timeline over events, meal plans and planned cards; `calendars` container; links on any event; safe sync deletion; ics → caldav → Graph/Google; FullCalendar (MIT) + `ical.js` | Accepted, amended by 0042 |
| [0040](0040-agenda-categories-are-calendars.md) | Categories are manual calendars with `calendars.color` (9-colour palette, code-only tokens); delete moves contents; visibility per device | Accepted |
| [0041](0041-agenda-quick-add.md) | One quick-add surface (+ Nieuw, slot, `N`); deterministic parsing with `chrono-node` + own rules, no AI | Accepted |
| [0042](0042-recurring-own-events.md) | Recurring own events: rule in `calendar_event_series`, occurrences materialised 400 days ahead, edit/delete scope | Accepted |
| [0043](0043-connections-layer-embeddings.md) | Embeddings: `bge-m3` on Cloudflare Workers AI, opt-in per member, backlog scan instead of a queue, exclusive-arc `embeddings`, hybrid search across modules | Accepted, amended by 0046 |
| [0044](0044-activity-history.md) | Append-only `activity_events`: basket items added/checked and meals cooked, recorded by triggers for every member | Accepted |
| [0046](0046-assistant-signals.md) | Assistent: deterministic rhythm signals for every member, LLM pattern signals on opt-in (no tools, plain text); never a stuck-card reminder; no surface yet | Accepted |
| [0047](0047-iphone-day-widget.md) | iPhone day widget: Scriptable script, read-only widget token, `widget_today()` acting through the `atlas_widget` role under RLS, tap via the "Open Atlas" Shortcut | Accepted |
| [0008](0008-calendar-sync-and-ui-library.md) | Read-only sync, Schedule-X, SSRF guard | Superseded by 0037 |
| [0006](0006-embedding-pipeline.md) | Jobs + worker + `bge-m3` via Ollama | Superseded by 0043 |

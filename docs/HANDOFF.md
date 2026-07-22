# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (infrastructure by phase), `Architecture.md` + `docs/decisions/` (why, per phase), `Vision.md` (scope), `docs/guides/ui-components.md` (design-system/token conventions), `docs/guides/ticket-workflow.md` (board process + session gotchas), and `docs/incidents.md` (per-ticket defect/merge write-ups — only when investigating a specific ticket).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.
**`docs/design-tokens.md` is the source of truth for state colours** — read it before styling any component. This file does not restate its matrix.

## State (2026-07-22)

- **Every Phase 2 component ticket is now merged.** `main` has Phase 0 (foundation), Phase 1 login/logout, **all Phase 2 atoms** (incl. `Step`), **all four `Card-content/*` molecules + `Card`**, and **all three organisms** — `CardContainer` (#23), `Carousel` (#24, PR #83), `Sidebar` (#25, PR #84) — plus the token/border rework through #68/#69. Lint/typecheck/test/`check:server-only` all green; the db job still needs CI (no Docker here).
- **`design/figma-map.json` now has zero `nodeId: null` entries** — the component↔node map is complete for Phase 2. The map is now lookup-only (name → path → node-id); the per-component design notes live in `design/notes/<Component>.md`.
- Built: `components/atoms/` Button, ButtonToggle, Checkbox, Dropdown, Icon, InputField, Step, Tag · `components/molecules/` Card, CardContentRecipe, CardContentIngredient, CardContentTicket, CardContentStep · `components/organisms/` CardContainer, Carousel, Sidebar.
- **`Step` moved from `components/molecules/` to `components/atoms/` (2026-07-21, user-reported)**: Figma files it under "Atoms"/"Steps"; the old placement note misread ADR-0010 as justifying molecules — the ADR only makes `figma-map.json` canonical for the node-id record, not for overriding Figma's own section. `Card` now imports it from `../atoms/Step` (molecule importing atom, as CLAUDE.md expects). `figma-map.json` and `Architecture.md` §3.1 updated to match.
- **#66** (ticket #19, `CardContentRecipe`) and **#67** (ticket #20, `CardContentIngredient`) are **merged** (2026-07-21) — see `docs/incidents.md` for the merge-conflict resolution and the CI-gate-hole write-up. `Card.stories.tsx` gained an `AllContentTypes` story composing one `Card` per built `Card-content/*` molecule.
- **Carousel + Sidebar (#24, #25, 2026-07-22) both shipped defects that passed every CI gate**, caught only by measuring rendered DOM against the Figma node — full write-up in `docs/incidents.md`.
- Board: `#7`, `#12`–`#25`, `#34`, `#35`, `#52`, `#53`, `#56`, `#58`–`#61`, `#68`, `#69` sit in **In review**; `#41`–`#45` are in **Done** (auto-closed by `Fixes #NN` in their PR bodies — reopen any you wanted to review); the rest is Backlog. Issues stay open until the user closes them.
- **The board's "Ready" column is stale**: `#69` and `#58` sit there, but both issues are **closed** and PRs #71/#64 **merged** — need dragging to Done. Verify a Ready card against `gh issue view` first.
- `feat/phase2-atoms` has been **deleted** (9 commits, all squash-merged to `main`). Work on `main`.

## Next actions

1. **#6 Playwright + screenshot baselines — merged, but only half-armed.** 46 committed baselines, `pnpm test:visual`, gated at `threshold: 0` / `maxDiffPixels: 0`; verified to catch the real shipped defect #5. **What remains: the CI job is `continue-on-error` because the committed baselines are `-darwin.png` from this Docker-less Mac and CI runs Linux.** Close it by generating `-linux.png` baselines inside the pinned `mcr.microsoft.com/playwright` container (a `workflow_dispatch` job whose output a human commits), then remove `continue-on-error`. Until then the gate protects local runs only. #49 turned out not to block this — `?story=…&mode=preview` renders no Ladle chrome.
2. **Phase 2 component work is complete** — #19–#25 merged. What remains is non-component: `#49` (Ladle chrome theming), `#59` (preview canvas + trim story sets), `#78` (Input-field height + merge icon stories).
3. **`#1`–`#5`, `#8`–`#11`** are server-side or need user accounts — coordinate, don't start unprompted.

## Open questions for the user

**Figma-authoring gaps** — the ticket/property list promises something the dev-ready node doesn't contain. Each needs a design-side fix before a follow-up ticket can model it; don't build from guesswork.

- **No Hover state anywhere in the pointer-affordance family**: `Atom/Button`'s Transparent style, `Button/Toggle`'s segments, and `Card-content/Ingredient` rows all have *no* mouse-over feedback. One decision covers all three — details in `docs/design-tokens.md` questions 3 and 5.
- **Checkbox "delete" state**: `design/notes/Checkbox.md` notes it, the Figma node doesn't contain it.
- **Figma `Input-field` "Text" boolean** can hide the entire input row; not modelled (an input without its input isn't meaningful).
- **Toggle-group / shared track**: the `Button/Toggle` node's demo shows 5 chips sharing one grey track. #69 rebuilt the track; whether a *grouped* composition needs its own ticket is open.
- **Token names are hex-derived, not Figma-derived.** The Figma MCP returns resolved hex only, never variable names, so every semantic name in `tokens.json` is a pixel matched back to a role by us. Worth aligning with real Figma names before the vocabulary calcifies.
- **A persistent "selected" state now needs a real fill token (new, #25).** `docs/design-tokens.md` deliberately has **no `role-selected`**, and its log records `surface-raised-selected` as removed for lack of a consumer. `Sidebar`'s active nav item is that missing consumer — a persistent fill (stone-300) currently **borrowing `surface-raised-hover`**, against the doc's own "never reuse a token across states" rule. Open question 6 there.
- **English nav labels overflow the Sidebar's fixed 198px rail (new, #25).** Dutch rows are pixel-perfect at 40px; English isn't — "Shopping basket" wraps and spills outside its button. Figma only shows Dutch labels, so it offers no guidance. Needs a content/design call.

## Environment still to set up (outside this repo)

**Mac mini (issues #1–#5):** Docker + two Supabase stacks (127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + chat model sized to RAM), hardened self-hosted runner, restic backups + Vault-root-key backup.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links need it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).

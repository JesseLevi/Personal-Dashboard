# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (what infrastructure exists), `Architecture.md` + `docs/decisions/` (why — read the section for the phase you're working), `Vision.md` (product scope).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.
**`docs/design-tokens.md` is the source of truth for state colours** — read it before styling any component. This file does not restate its matrix.

## State (2026-07-22)

- **Every Phase 2 component ticket is now merged.** `main` has Phase 0 (foundation) + Phase 1 login/logout + **all Phase 2 atoms** (incl. `Step`), **all four `Card-content/*` molecules + `Card`**, and **all three organisms** — `CardContainer` (#23), `Carousel` (#24, PR #83), `Sidebar` (#25, PR #84) — plus the token/border rework through #68/#69. Lint/typecheck/test/`check:server-only` all green on `main`; the db job still needs CI (no Docker on this dev machine).
- **`design/figma-map.json` now has zero `nodeId: null` entries** — the component↔node map is complete for Phase 2. Still 29 lines; keep editing it as text.
- Built: `components/atoms/` Button, ButtonToggle, Checkbox, Dropdown, Icon, InputField, Step, Tag · `components/molecules/` Card, CardContentRecipe, CardContentIngredient, CardContentTicket, CardContentStep · `components/organisms/` CardContainer, Carousel, Sidebar.
- **`Step` moved from `components/molecules/` to `components/atoms/` (2026-07-21, user-reported)**: Figma files it under "Atoms"/"Steps"; the old placement note cited ADR-0010's "figma-map.json is canonical" as justification for keeping it in molecules despite that, which was a misreading — ADR-0010 only makes the map canonical for the node-id/path record, not for overriding Figma's own Atomic Design section. `Card` now imports it from `../atoms/Step` (molecule importing atom — the direction CLAUDE.md's dependency rule expects, an improvement over the prior molecule-importing-molecule shape). `figma-map.json` and `Architecture.md` §3.1 updated to match.
- **#66** (ticket #19, `CardContentRecipe`) and **#67** (ticket #20, `CardContentIngredient`) are **merged** (2026-07-21) — see the note below for how the known `figma-map.json` conflict was resolved. `Card.stories.tsx` gained an `AllContentTypes` story composing one `Card` per built `Card-content/*` molecule, so all card content types can be compared side by side in Ladle.
- Board: `#7`, `#12`–`#25`, `#34`, `#35`, `#52`, `#53`, `#56`, `#58`–`#61`, `#68`, `#69` sit in **In review** awaiting the user (now including #24/#25); `#41`–`#45` are in **Done** (auto-closed by a `Fixes #NN` in their PR bodies — reopen any you still wanted to review); the rest is Backlog. Issues stay open until the user closes them.
- **The board's "Ready" column is stale and should not be trusted as work-to-do**: `#69` and `#58` sit there, but both issues are **closed** and their PRs (#71, #64) are **merged**. They need dragging to Done. This cost a session-start detour — verify a Ready card against `gh issue view` before picking it up.
- `feat/phase2-atoms` has been **deleted** (its 9 commits all reached `main` via squash merges). Work on `main`.

### #66 and #67 merge (2026-07-21)

Both branches were rebased onto `6d2be6e` before `#68`/`#69` landed. `#66` merged clean. `#67` then conflicted on `design/figma-map.json` exactly as predicted (adjacent lines 19/20) — resolved by keeping the `"nodeId"`-populated line from each side and discarding both `"nodeId": null` stubs. `docs/design-tokens.md` auto-merged correctly (open question 5 appended, question 1 kept `main`'s newer wording). `messages/en.json`/`nl.json` key sets verified identical post-merge.

## Card-content molecules + a CI gate hole — #19, #20 (2026-07-21)

First two `Card-content/*` molecules, each built by its own Sonnet agent from a live MCP fetch, then reviewed.

- **`Card-content/Ingredient`'s `State` axis is `Default | Active | Delete` — there is no Hover.** `Active` is mapped to CSS `:active` per `docs/design-tokens.md`, consistent with #56/#58 under the same state name. The consequence is deliberate and **needs a design answer**: an ingredient row has *no pointer affordance at all* — hovering does nothing, only pressing does. Recorded as open question 5 in `docs/design-tokens.md`. This is the same gap as `Atom/Button`'s Transparent style (question 3), which **`Atom/Button-toggle`'s segments inherit**, since they render as `Button variant="transparent"`. One design decision, three components.
- **`State=Delete` is structural, not a pointer state.** Its pill (fill/radius/padding) is unconditional and the Trash button is a *sibling outside* it. The first implementation painted the pill only on `hover:`/`focus-within:` — which also meant focusing the delete button never triggered it. Don't collapse the delete and non-delete branches back into one wrapper: their fill semantics genuinely differ.
- **`check:server-only`'s hex gate had a hole: percent-encoded hex.** A story's placeholder data-URI carried `fill='%23A8A29E'` and passed CI, because the gate grepped `#[0-9a-fA-F]{3,8}` only. Now `(#|%23)[0-9a-fA-F]{3,8}` — fixed in #66 and verified by probe (clean → fails on an inserted `%23AABBCC` → clean again). Any future encoded colour is caught.
- **Icons: `Timer`, verified by path-diff, not by name.** The node's time glyph was an *unnamed* IMAGE-SVG. Candidate lucide exports were rendered and their paths compared against the Figma vector (`AlarmClockCheck` ruled out: six elements vs three). This is the fourth time shape-verification mattered — keep doing it.
- **Both molecules pass `<img>` straight through, not `next/image`**, because no image host is registered in `next.config.ts`. ESLint warns; the choice is documented in the component. Revisit when the host exists.

**Process note:** three Sonnet agents hit the account session limit mid-run this round. Their partial work was recoverable in every case because it sat committed or staged in their worktrees — check `git -C <worktree> status` and `log` before assuming a dead agent produced nothing, and tell the resuming agent explicitly what is already done so it doesn't redo it.

**Review note:** a half-applied fix passed `lint`, `typecheck`, `test` *and* `check:server-only` — the Delete pill got its radius and padding but no `bg-surface-raised`, so it rendered invisible. No gate in this project can see a missing colour. That is the third such catch found only by putting the fetched node next to the code by hand. See #6 under Next actions.

## Carousel + Sidebar — #24, #25 (2026-07-22)

Last two Phase 2 organisms, one Sonnet agent each, reviewed by putting the fetched node next to the rendered code. **Both shipped a defect that every CI gate passed.** Both were caught only by measuring the rendered DOM in a browser against the node's own numbers — the fourth and fifth such catch. This is now the rule, not the exception: `lint`/`typecheck`/`test`/`check:server-only` cannot see a wrong colour or a wrong width.

- **`Carousel`'s columns are fixed 280px and are *meant* to overflow.** The node puts `sizing: fixed, width: 280` on all three `Card-container` instances against a root `designedWidth: 644px` — 3×280 + 2×16 = **872px in a 644px frame**. That 228px overflow is the whole reason it is a Carousel and not a row. The first implementation rendered `w-full` equal-fill columns (measured 368px), which can never overflow and so can never scroll; the agent measured 368 itself and rationalised it away as "emergent from `CardContainer`'s `w-full`". Now structural: each child is wrapped in `w-70 shrink-0 [&>*]:h-full`. Verified 280×296 per column, 16px gaps, 644/872/228.
- **`Sidebar`'s active nav item is stone-300, one shade darker than a resting Filled button (stone-200).** The agent read this as a "hover captured mid-snapshot" artifact and shipped stone-200. Pixel-sampling the component set disproves it: the active pill is `#D6D3D1` and the toggle `#E7E5E4` **identically in both the `Collapsed=No` and `Collapsed=Yes` variants** — one stray pointer cannot tint the same item across two independently-rendered variants. Deliberate design.
- **That fix then caused a second defect: `!important` silently killed pointer feedback.** `bg-surface-raised-hover!` outranks `Atom/Button`'s own non-important `active:bg-surface-raised-active`, so the active item went dead on press (measured flat `0.869` across resting/hovered/pressed, while a plain-Filled control ramped `0.923 → 0.869 → 0.709`). Fixed with a compound `bg-surface-raised-hover! active:bg-surface-raised-active!`. **If you ever override a Button fill from a composer, override the state variants too** — `docs/design-tokens.md` calls a selected item still reacting to the pointer a product requirement.
- **Use a control when probing CSS states.** The first probe used an idle sibling as control — but those are `variant="transparent"`, which has no fill in any state by design, so it proved nothing. The sidebar's own collapse toggle (plain `filled`) is the correct control.
- **`Icon/Astroid` is lucide `Sparkle`** — fifth false-friend name. Verified by rendering: `Sparkle` is one four-point path, `Sparkles` adds three elements, `Asterisk` is three lines.

## Design-system state: what is still true

`docs/design-tokens.md` holds the authoritative matrix and the token-change log. Only the load-bearing consequences live here.

- **Token scale is `role` / `role-hover` / `role-active`, plus `border-selected`.** Selected has no fill of its own; on `Atom/Button` it darkens text, and since #68 `Button/Outline`'s Selected also carries a border.
- **Selected must keep composing with Hover/Active.** Since Selected gained a border it now *competes* on `border-color`, solved with compound `aria-pressed:hover:` / `aria-pressed:active:` variants — higher specificity, so they win regardless of stylesheet order. Verified in the compiled stylesheet. **Never** add a bare `aria-pressed:border-*` or `aria-pressed:bg-*` override; it silently kills pointer feedback on selected items.
- **`border-input-active` is the last component-scoped border token** (Input-field stone-600 vs Button stone-800). Hover and Selected were unified in #68. One Figma edit away from deleting it.
- **`accent` has a split history — do NOT blind-delete it.** Its purple was *wrongly* pulled into two component atoms (Checkbox, Input-field) from a Figma canvas artifact — the dashed stroke marking a selected component set — and removed there in #45, so it has **no consumer inside `components/`**. But it *is* used deliberately in the plain Phase-1 login UI (`app/login/page.tsx:72` `bg-accent`, `app/page.tsx:30` `text-accent`), and `Architecture.md` §3.2 lists it as a legitimate named semantic token (`#8A38F5`). So it is a real token with real `app/` consumers, only a *component-level* phantom — deleting it from `tokens.json` would break the login styling. If it should be retired, migrate those two `app/` call sites first.
- **Dark mode is pipeline-only.** `design/tokens.json` carries `{ light, dark }` entries and `app/theme.css` emits a `[data-theme="dark"]` block, but every dark value is this codebase's own pick (no Figma dark frames exist), several collide with their own default, and **nothing in the Next.js app sets `data-theme`** — only Ladle does. An app-level theme switch is an open architectural decision.
- **`"use client"` precedent:** own state only when the behaviour is identical for every caller. `Dropdown` owns its open state; `Checkbox` stayed a Server Component and became interactive by switching its host to `<button role="checkbox">`. Leaf atoms stay presentational.
- **Ladle chrome theming no-ops in `ladle:build`** (`appendToHead` emits an absolute `/@fs/` path) though it works in the dev server. Filed as **#49**; it relates to #6, whose baselines run against the built output.

## Next actions

1. **#6 Playwright + screenshot baselines — now the single highest-value ticket, and overdue.** Every Phase 2 component is merged, and *five* separate defects have now shipped past all four gates and been caught only by a human putting the fetched node next to the rendered DOM (#19/#20's invisible Delete pill; #24's 368px-instead-of-280px columns; #25's stone-200-instead-of-stone-300 active item and its dead pressed state). No gate in this project can see a wrong colour or a wrong width. Playwright *is* available against `pnpm ladle` and was used throughout #24/#25 — what is still missing is a **committed baseline gate in CI**. Note `#49` may need solving first, since baselines run against `ladle:build` output.
2. **Phase 2 component work is complete** — #19–#25 all merged. What remains in the Phase 2 milestone is non-component: `#49` (Ladle chrome theming in the static build), `#59` (surface-coloured preview canvas + trim Button/Checkbox story sets), `#78` (Input-field height without trailing icon + merge the 4 icon stories).
3. **`#1`–`#5`, `#8`–`#11`** are server-side or need user accounts — coordinate with the user, don't start unprompted.

## Open questions for the user

**Figma-authoring gaps** — the ticket or property list promises something the dev-ready node doesn't contain. Each needs a design-side fix before a follow-up ticket can model it; no one should build these from guesswork.

- **No Hover state anywhere in the pointer-affordance family**: `Atom/Button`'s Transparent style, `Button/Toggle`'s segments (which inherit it), and `Card-content/Ingredient` rows all have *no* mouse-over feedback. One decision covers all three. Details in `docs/design-tokens.md` questions 3 and 5.
- **Checkbox "delete" state**: `design/figma-map.json` notes it, the Figma node doesn't contain it.
- **Figma `Input-field` "Text" boolean** can hide the entire input row; not modelled (an input without its input isn't a meaningful state).
- **Toggle-group / shared track**: the `Button/Toggle` node's demo shows 5 chips sharing one grey track. #69 rebuilt the track itself; whether a *grouped* composition needs its own molecule/organism ticket is still open.
- **Token names are hex-derived, not Figma-derived.** The Figma MCP returns resolved hex only, never variable names, so every semantic name in `tokens.json` is us matching a pixel value back to a role. Worth aligning with the real Figma variable names before the vocabulary calcifies further.
- **A persistent "selected" state now needs a real fill token (new, #25).** `docs/design-tokens.md` states there is deliberately **no `role-selected`** because Selected only darkens text, and its log records `surface-raised-selected` as *removed for lack of a consumer*. `Sidebar`'s active nav item is exactly that missing consumer: a persistent selected state carrying a **fill** (stone-300). It currently **borrows `surface-raised-hover`**, which the doc's own "never reuse one role's token across states" rule forbids as a permanent answer. Recorded as open question 6 there. Decide: add a dedicated selected-fill token, or accept the borrow. Knock-on: since the resting colour already equals Filled's hover value, hovering an active item shows nothing — same family as questions 3/5 above.
- **English nav labels overflow the Sidebar's fixed 198px rail (new, #25).** Dutch is pixel-perfect (all six rows exactly 40px, matching Figma). English is not: "Shopping basket" wraps to two lines and spills outside its 40px button. Figma only ever shows the Dutch labels, so it offers no guidance. Needs a content/design call — shorter English label, truncation, wrapping with taller rows, or a wider rail. Not invented in code; flagged here deliberately.

## Session gotchas not covered by CLAUDE.md

- Worktrees created for subagents branch off **`main`, not the branch you have checked out**. If a delegated ticket needs work that only exists on a feature branch, the agent's worktree will not have it — verify before spawning. To have an agent continue an *existing* branch, point it at that branch's existing worktree path explicitly.
- **`main` can move while your PRs are in flight.** #68/#69 landed mid-session and left two just-rebased branches stale again. Re-check `mergeable` before reporting a PR as ready.
- `git config user.name/email` is auto-guessed on this machine (`Jesse@mbp-van-jesse.home`); check before attributing commits.
- Figma spelling variants still live in the file: `Recipi`, `Distructive`, `Trekking-icon` (= trailing). Icon layer names match lucide exports exactly — see `design/figma-map.json`.
- **Parallel agents all edit `design/figma-map.json`** (and often `messages/*.json`), so the last branch to merge always conflicts there. Resolve line-by-line, and when two branches edited the *same* entry, **combine the notes — don't pick a side**, or you silently drop one fix's record.
- **Never rewrite `design/figma-map.json` with `json.dump(indent=2)`.** The file uses compact one-line entries; reformatting turns a two-line conflict into a whole-file one. Edit notes as text. (Sanity check: it is 29 lines.)
- **A `messages/*.json` conflict is dangerous, not routine.** When one branch *replaced* keys (as #65 did, swapping `buttonToggle.defaultLabel` for `groupLabel` + `categories`), taking "theirs" wholesale deletes live keys and resurrects removed ones. Resolve by keeping `main`'s block and adding yours, then verify `en.json` and `nl.json` have identical key sets.
- **`pnpm ladle` is `ladle serve`** — `pnpm ladle build` hangs as a dev server. Use **`pnpm ladle:build`** for a non-interactive build; four separate agents have now hit this trap.
- **Mixing Tailwind logical and physical padding utilities does not override.** `px-3` emits `padding-inline`, `pr-4` emits `padding-right` — different longhands, so which wins depends on emission order. Use the same physical property on both sides (`pr-3` + `active:pr-4`).

## Environment still to set up (outside this repo)

**Mac mini (issues #1–#5):** Docker + two Supabase stacks (ports on 127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + chat model sized to RAM), hardened self-hosted runner, restic backups + separate Vault-root-key backup.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links don't work without it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).

# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (what infrastructure exists), `Architecture.md` + `docs/decisions/` (why — read the section for the phase you're working), `Vision.md` (product scope).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.

## State (2026-07-20)

- `main` has Phase 0 (foundation) + Phase 1 login/logout + **all Phase 2 atoms and the Card molecule**. CI is **green** on both jobs, including the db job (supabase + pgTAP + RLS coverage).
- Merged today: PR #37 (Icon, Tag, Checkbox, Button, InputField, Step), then #38 Card (#17), #39 Dropdown (#34), #40 ButtonToggle (#35) — all squash-merged, CI green on each.
- Built so far: `components/atoms/` Button, ButtonToggle, Checkbox, Dropdown, Icon, InputField, Tag · `components/molecules/` Card, Step.
- Board: #41–#45 auto-moved to **Done** (see process note below); #7, #12–#18, #34, #35, **#52, #53, #56, #58–#61, #68, #69** sit in **In review** awaiting the user; the rest is Backlog. Issues normally stay open until the user closes them.
- `feat/phase2-atoms` is **stale** — its 9 commits all reached `main` via squash merges, so `git log main..feat/phase2-atoms` still lists them. Work on `main`; the branch can be deleted.

## Design-review round #41–#45 — all merged (2026-07-20)

All five fix tickets are on `main` (PRs #46–#48, #50, #51), each CI-green. What the round actually uncovered, beyond the reported symptoms:

- **`accent` is a phantom token.** Its purple entered the codebase from a *Figma canvas artifact* — the dashed stroke marking a selected component set — not from any design intent. Checkbox used it (#45, removed) and InputField nearly adopted it during this round (#44, caught in review). `accent` is still defined in `design/tokens.json` and still points at `purple-figma`. **Nothing uses it now. Decide whether to delete it** before something reaches for it again.
- **The dark-mode pipeline did not exist.** #42 built it: `design/tokens.json` gained `{ light, dark }` semantic entries, `scripts/tokens-lib.mjs` gained a dark emission path, and `app/theme.css` now carries an unlayered `[data-theme="dark"]` block. Only the tokens Button uses have dark values — the rest is a flagged gap for a future token-sync pass. Nothing in the Next.js app sets `data-theme` yet; only Ladle does. An app-level theme switch is an open architectural decision.
- **`Dropdown` is the first `"use client"` atom** (#43), a deliberate exception to the Server-Component default because a disclosure owns its own open state. `Checkbox` (#45) went the other way — stayed a Server Component, gained interactivity by switching its host element to `<button role="checkbox">`, keeping state composer-owned. Those two precedents together are the house pattern now: *own state only when the behaviour is identical for every caller.*
- **Ladle chrome theming works in the dev server but silently no-ops in `ladle:build`** (`appendToHead` emits an absolute `/@fs/` path). Filed as **#49** — it blocks/relates to #6, whose screenshot baselines run against the built output.

**Process note:** the PR bodies used `Fixes #NN`, which auto-closed the issues and moved their cards straight to **Done**, skipping the "In review" step CLAUDE.md reserves for the user. Reopen any of #41–#45 you still want to review.

## Border scale unified — #68 + #69 merged (2026-07-21)

- **`Atom/Button` and `Atom/Input-field` now share their border ramp for 3 of 4 states.** Figma re-authored Outline's borders (Hover stone-400→500, Active stone-700→800, Selected gained a border at stone-400). `border-input-hover` / `border-input-selected` are gone; both components read `border-hover` / `border-selected`. **`border-input-active` (stone-600 vs Button's stone-800) is the one remaining divergence** — one Figma edit away from deleting the last component-scoped border token.
- **`border-selected` is back after #56 removed it.** Legitimate: #56 removed it because Selected carried no colour at all; Outline/Selected has a border again. Not a regression of that decision.
- **Selected now competes with Hover/Active on `border-color`.** The standing requirement is that a selected button still reacts to the pointer. Solved with compound `aria-pressed:hover:` / `aria-pressed:active:` variants — **not** by trusting Tailwind's emission order — and verified in the compiled stylesheet (higher specificity *and* later position). Don't "simplify" those away.
- **The toggle's square is now stated, not emergent.** `compact` was `h-8 pl-1 pr-0`, whose 32px width only *totalled* correctly from icon size + wrapper padding; it is now `size-8 justify-center`, the indicator reuses the same utility, and the 36px step is documented as tied to both. The track asserts its own hug (`w-fit self-start`) so a `flex flex-col` parent can't stretch it — which is exactly what the story was doing.
- **`size="compact"` + `children` is now a type error**, not a comment: a fixed 32px box clips a label.

Process note: both tickets' Sonnet agents hit the session limit mid-run. Their work was reviewed, verified, and finished by the orchestrator; the type guard in #69 was added during that review.

## Button's fourth state — #56 merged (2026-07-20), supersedes #52's matrix

Figma added an **Active** state to `Button/Default` and redistributed the colours. What #52 recorded as Hover is now Active (pressed); Hover took a milder new value; **Selected no longer changes fill or stroke at all** — only the text.

- **Token scale is now `role` / `role-hover` / `role-active`.** The `*-selected` colour tokens #52 added were *removed*, not left as dead names — Selected has no background of its own. `docs/design-tokens.md` is rewritten to match; read it, not #52's version.
- **`active:` is legitimate again.** #42 removed it because it was misused for the *persistent* Selected state. CSS `:active` means "currently being pressed", which is exactly Figma's new state. Both hooks now coexist deliberately — don't "fix" one back into the other.
- **Selected composes with hover/active by construction** (a stated product requirement). It works because Selected touches only `color` while Hover/Active touch only `background-color`/`border-color`. Verified against the compiled stylesheet, not assumed. **Never add an `aria-pressed:bg-*` or `aria-pressed:border-*` override** — that silently kills hover feedback on selected items.
- Button's Ladle stories went 10 → 2 (`StateMatrix`, args-driven `Playground`). Workbench total is 35.

**`Atom/Input-field` was NOT re-authored** (re-fetched to check). It still carries the pre-rework three-state scale, and its Hover stroke is *darker* than its Active one — the reverse of Button/Outline's new ordering. That inversion is the strongest evidence yet that the node was never re-bound to the reworked variables. It now reads two **provisional** tokens, `border-input-hover` / `border-input-focus`, rather than either component being normalised by guesswork. **Once Figma is reconciled: delete those two tokens** and point the component at `border-hover` / `border-active`. **Update (#58, same day): re-fetched again — see the section below.** It's no longer provisional.

Still open from this round: Transparent buttons have no hover/active fill in Figma, so they have no pointer affordance at all — flagged, not invented.

## Input-field's own border scale confirmed, not merged into Button's — #58 (2026-07-20)

Re-fetched `Atom/Input-field` (3705:4402) expecting the #56 provisional tokens above to finally collapse onto Button's shared `border-hover`/`border-active`, since the node grew a fourth state (`Selected`) matching Button's shape. **It did not collapse.** Default matches Button's Default (stone-300, shared `border` token), but Hover (stone-500) and Active (a new value, added this ticket as primitive `stone-600`) are still pixel-different from Button/Outline's Hover (stone-400) / Active (stone-700) — confirmed by fetching both nodes side by side. The #56-era ordering bug (Hover darker than Active) **is** fixed — Hover is now correctly lighter than Active, same direction as Button — so this reads as a deliberate, stable, component-specific ramp, not a stale/unbound node. `border-input-focus` is renamed `border-input-active`; `border-input-hover` is unchanged; neither is "provisional" anymore (`docs/design-tokens.md` open question 1 resolved).

Also found: the new `Selected` state changes both border (stone-400) and content text (stone-950, "typed" look) — but that "typed" tell used to be on `Active` (#53's reasoning for the `:focus-within` mapping). It has moved. `:focus-within` still reads `Active` per the ticket's own fallback rule (no state is literally named "Focus"), but the qualitative signal behind that reading has shifted — flagged again, not silently carried forward. `Selected` itself isn't modelled: no interaction affordance on a plain `<input>` is analogous to `aria-pressed`.

Input-field stories cut 4 → 5 per the ticket's fixed list: `States`, `WithLeadingIcon`, `WithTrailingIcon`, `WithBothIcons`, `WithoutIcons` (`Playground`, `WithIconlessButton`, `WithAndWithoutIcon` deleted).

## Button/Outline and Input-field borders unified, mostly — #68 (2026-07-20)

The user re-authored `Button/Outline`'s borders since #58. Re-fetching both nodes confirmed 3 of the 4 states now match pixel-for-pixel: **Hover** (`border-hover`, stone-500) and **Selected** (new `border-selected`, stone-400 — Outline's Selected gained a border for the first time since #56) are now shared tokens between `Atom/Button` and `Atom/Input-field`; `border-input-hover`/`border-input-selected` are deleted. **Active is the one state that still doesn't line up** (Input-field stone-600 vs Button's new stone-800) — `border-input-active` stays, flagged as the single remaining divergence in `docs/design-tokens.md` open question 1.

Giving Outline's Selected a border for the first time put it in direct competition with Hover/Active on `border-color` — previously impossible, since Selected only ever touched `text`. Verified against the compiled `pnpm ladle:build` stylesheet, not assumed: a naive `aria-pressed:border-*` override is emitted *after* the `hover:`/`active:` border rules at equal specificity, so it would win and silently kill hover/active feedback on a selected button. Fixed with compound variants (`aria-pressed:hover:border-border-hover`, `aria-pressed:active:border-border-active`) that have strictly higher specificity and therefore win regardless of stylesheet order — see `docs/design-tokens.md`'s "Selected must compose with Hover and Active" section for the grepped compiled rules.

## Per-state semantic colours — #52 + #53 merged (2026-07-20)

Figma's semantic **variables** were reworked upstream: every colour role now carries a Default/Hover/Selected variation. Our token layer only had Default plus one ad-hoc `-hover` for two roles, so `Atom/Button` was rendering three wrong colours (Filled hover/selected, White selected, Outline hover/selected, and Destructive had no hover or selected at all).

- **`docs/design-tokens.md` is the new convention doc** — read it before styling any component. Rule: a role is `role` / `role-hover` / `role-selected`; a component reads state colour from the state token, never from a `dark:` prefix, a hex, or a one-off.
- **`Atom/Input-field` finally has a real focus state.** The `focus-within:ring-2` from #44 was invented (Figma had no focus state *then*); it now does — `State=Active`, a stone-400 stroke. The ring is gone, replaced by `focus-within:border-border-selected`.
- **Stories: 10 → 4** for Input-field (`States`, `Playground` with Ladle `args` toggles, `WithIconlessButton`, `WithAndWithoutIcon`). Superseded by #58 (4 → 5, see below) — the user wanted a fixed list of icon-combo stories instead of one args-driven `Playground`.

**Three things needing the user, all recorded in `docs/design-tokens.md`:**

1. ~~**`border-hover` diverged.**~~ Superseded by #56, then #58, then **#68** (see the sections above) — Hover and Selected are now shared tokens between Button/Outline and Input-field; only `border-input-active` remains a deliberate, permanent divergence.
2. **Token names are hex-derived, not Figma-derived.** The Figma MCP returns resolved hex only, never variable names. Every semantic name in `tokens.json` is us matching a pixel value back to a role. Ask the user for the real variable names before the vocabulary calcifies further.
3. ~~**`surface-hover` (stone-300) now has no consumer.**~~ Resolved by #56: it was re-valued to stone-50 and now backs `Button/White`'s Hover.

Smaller, non-blocking:

- `hover:` and `focus-within:` both write `border-color` on the Input-field container. Tailwind orders `focus-within` *before* `hover`, so hovering an already-focused field shows the hover colour, not the focus colour. Figma says nothing about that combination. (Contrast `Atom/Button`, where Selected deliberately uses a *different* property so it composes — see #56 above.)
- Several new dark values collide with their own default (`surface-raised-selected` = `surface-raised` = stone-800; both destructive states = red-950), so those states are invisible in dark mode. All dark values are still placeholders — no Figma dark frames exist — and dark mode isn't wired into the app yet.
- A 1px border-colour change is a weak keyboard-focus affordance. Figma offers nothing stronger; flagged rather than compensated for with an invented ring.

## Next actions

1. **Phase 2 remainder** — #19–#22 Card-content/\* (now unblocked: Card exists and takes them in its `children` slot), then #23 CardContainer, #24 Carousel, #25 Sidebar. Work in issue order; each ticket carries its Figma node-id.
2. **#6 Playwright + screenshot baselines** is the highest-value non-component ticket: it turns "I compared the Figma values by hand" into an automated pixel diff, which is the enforcement mechanism CLAUDE.md's pixel-parity rule currently lacks. Every component merged so far was verified by eyeball against a downloaded Figma PNG — #6 is what makes that repeatable.
3. **#1–#5, #8–#11** are server-side or need user accounts — coordinate with the user, don't start unprompted.

## Open questions for the user

These are **Figma-authoring gaps**: the ticket/property list promises something the dev-ready node doesn't actually contain. Each needs a design-side fix (bind the property to a real layer) before a follow-up ticket can model it — no one should build them from guesswork.

- **Checkbox "delete" state**: `design/figma-map.json` notes it, the Figma node doesn't contain it.
- **`Button/Toggle` has no Hover state** sampled on the component itself (unlike `Atom/Button`, which does). No hover styling was invented in #35.
- **Figma `Input-field` "Text" boolean** can hide the entire input row; not modelled (an input without its input isn't a meaningful state).
- **Toggle-group / shared track**: the `Button/Toggle` node's demo shows 5 chips sharing one grey track. #35 builds one segment only; the grouped composition needs its own molecule/organism ticket if the design calls for it.

## Session gotchas not covered by CLAUDE.md

- Worktrees created for subagents branch off **`main`, not the branch you have checked out**. If a delegated ticket needs work that only exists on a feature branch, the agent's worktree will not have it — verify before spawning, or the agent will (correctly) stop and report.
- `git config user.name/email` is auto-guessed on this machine (`Jesse@mbp-van-jesse.home`); check before attributing commits.
- Figma spelling variants still live in the file: `Recipi`, `Distructive`, `Trekking-icon` (= trailing). Icon layer names were fixed and now match lucide exports exactly — see `design/figma-map.json`.
- **Parallel agents all edit `design/figma-map.json`** (and often `messages/*.json`), so the last branch to merge always conflicts there. Resolve line-by-line, and when two branches both edited the *same* entry (e.g. #42 and #43 both touched `Atom/Button`), **combine the notes — don't pick a side**, or you silently drop one fix's record.
- **Never rewrite `design/figma-map.json` with `json.dump(indent=2)`.** The file uses compact one-line entries; reformatting it turns a two-line conflict into a whole-file one. Edit notes as text.
- **`pnpm ladle` is `ladle serve`** — `pnpm ladle build` hangs as a dev server. Use **`pnpm ladle:build`** for a non-interactive build; three separate agents hit this trap.

## Environment still to set up (outside this repo)

**Mac mini (issues #1–#5):** Docker + two Supabase stacks (ports on 127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + chat model sized to RAM), hardened self-hosted runner, restic backups + separate Vault-root-key backup.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links don't work without it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).

# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (what infrastructure exists), `Architecture.md` + `docs/decisions/` (why — read the section for the phase you're working), `Vision.md` (product scope).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.

## State (2026-07-20)

- `main` has Phase 0 (foundation) + Phase 1 login/logout + **all Phase 2 atoms and the Card molecule**. CI is **green** on both jobs, including the db job (supabase + pgTAP + RLS coverage).
- Merged today: PR #37 (Icon, Tag, Checkbox, Button, InputField, Step), then #38 Card (#17), #39 Dropdown (#34), #40 ButtonToggle (#35) — all squash-merged, CI green on each.
- Built so far: `components/atoms/` Button, ButtonToggle, Checkbox, Dropdown, Icon, InputField, Tag · `components/molecules/` Card, Step.
- Board: #41–#45 auto-moved to **Done** (see process note below); #7, #12–#18, #34, #35, **#52, #53** sit in **In review** awaiting the user; the rest is Backlog. Issues normally stay open until the user closes them.
- `feat/phase2-atoms` is **stale** — its 9 commits all reached `main` via squash merges, so `git log main..feat/phase2-atoms` still lists them. Work on `main`; the branch can be deleted.

## Design-review round #41–#45 — all merged (2026-07-20)

All five fix tickets are on `main` (PRs #46–#48, #50, #51), each CI-green. What the round actually uncovered, beyond the reported symptoms:

- **`accent` is a phantom token.** Its purple entered the codebase from a *Figma canvas artifact* — the dashed stroke marking a selected component set — not from any design intent. Checkbox used it (#45, removed) and InputField nearly adopted it during this round (#44, caught in review). `accent` is still defined in `design/tokens.json` and still points at `purple-figma`. **Nothing uses it now. Decide whether to delete it** before something reaches for it again.
- **The dark-mode pipeline did not exist.** #42 built it: `design/tokens.json` gained `{ light, dark }` semantic entries, `scripts/tokens-lib.mjs` gained a dark emission path, and `app/theme.css` now carries an unlayered `[data-theme="dark"]` block. Only the tokens Button uses have dark values — the rest is a flagged gap for a future token-sync pass. Nothing in the Next.js app sets `data-theme` yet; only Ladle does. An app-level theme switch is an open architectural decision.
- **`Dropdown` is the first `"use client"` atom** (#43), a deliberate exception to the Server-Component default because a disclosure owns its own open state. `Checkbox` (#45) went the other way — stayed a Server Component, gained interactivity by switching its host element to `<button role="checkbox">`, keeping state composer-owned. Those two precedents together are the house pattern now: *own state only when the behaviour is identical for every caller.*
- **Ladle chrome theming works in the dev server but silently no-ops in `ladle:build`** (`appendToHead` emits an absolute `/@fs/` path). Filed as **#49** — it blocks/relates to #6, whose screenshot baselines run against the built output.

**Process note:** the PR bodies used `Fixes #NN`, which auto-closed the issues and moved their cards straight to **Done**, skipping the "In review" step CLAUDE.md reserves for the user. Reopen any of #41–#45 you still want to review.

## Per-state semantic colours — #52 + #53 merged (2026-07-20)

Figma's semantic **variables** were reworked upstream: every colour role now carries a Default/Hover/Selected variation. Our token layer only had Default plus one ad-hoc `-hover` for two roles, so `Atom/Button` was rendering three wrong colours (Filled hover/selected, White selected, Outline hover/selected, and Destructive had no hover or selected at all).

- **`docs/design-tokens.md` is the new convention doc** — read it before styling any component. Rule: a role is `role` / `role-hover` / `role-selected`; a component reads state colour from the state token, never from a `dark:` prefix, a hex, or a one-off.
- **`Atom/Input-field` finally has a real focus state.** The `focus-within:ring-2` from #44 was invented (Figma had no focus state *then*); it now does — `State=Active`, a stone-400 stroke. The ring is gone, replaced by `focus-within:border-border-selected`.
- **Stories: 10 → 4** for Input-field (`States`, `Playground` with Ladle `args` toggles, `WithIconlessButton`, `WithAndWithoutIcon`). `Playground` is the pattern to copy — boolean permutations belong in Ladle controls, not in one story each.

**Three things needing the user, all recorded in `docs/design-tokens.md`:**

1. **`border-hover` diverged.** `Input-field` Hover stroke is stone-500, `Button/Outline` Hover is now stone-700. Two roles that shared one token pulled apart — probably one node wasn't re-bound to the updated variable. Both kept as fetched; `border-hover-strong` was added rather than normalising one to the other.
2. **Token names are hex-derived, not Figma-derived.** The Figma MCP returns resolved hex only, never variable names. Every semantic name in `tokens.json` is us matching a pixel value back to a role. Ask the user for the real variable names before the vocabulary calcifies further.
3. **`surface-hover` (stone-300) now has no consumer.** Not deleted — the user decides. Same open question as the phantom `accent` token above.

Smaller, non-blocking:

- `hover:` and `focus-within:` now both write `border-color` on the Input-field container. Tailwind orders `focus-within` *before* `hover`, so hovering an already-focused field shows the hover colour, not the focus colour. Figma says nothing about that combination.
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

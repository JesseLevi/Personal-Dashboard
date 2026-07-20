# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (what infrastructure exists), `Architecture.md` + `docs/decisions/` (why — read the section for the phase you're working), `Vision.md` (product scope).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.

## State (2026-07-20)

- `main` has Phase 0 (foundation) + Phase 1 login/logout + **all Phase 2 atoms and the Card molecule**. CI is **green** on both jobs, including the db job (supabase + pgTAP + RLS coverage).
- Merged today: PR #37 (Icon, Tag, Checkbox, Button, InputField, Step), then #38 Card (#17), #39 Dropdown (#34), #40 ButtonToggle (#35) — all squash-merged, CI green on each.
- Built so far: `components/atoms/` Button, ButtonToggle, Checkbox, Dropdown, Icon, InputField, Tag · `components/molecules/` Card, Step.
- Board: 10 tickets **In review** (#7 login, #12–#18 components, #34, #35), 19 in Backlog, #26 Done. Issues stay open until the user closes them.

## In flight right now (2026-07-20, design-review round)

The user design-reviewed the merged Phase 2 components in Ladle and filed five fix tickets. **Five Sonnet agents were spawned in worktrees off `main` @ f97df7f**, one per ticket, each pushing a branch but deliberately opening no PR:

| Ticket | Branch | Scope |
|---|---|---|
| #41 | `fix/41-ladle-chrome` | Ladle chrome → surface/primary bg, color/secondary text+icons |
| #42 | `fix/42-button-dark-selected` | dark-mode tokens don't apply; Figma renamed `Active` → `Selected` |
| #43 | `fix/43-dropdown` | option content not left-aligned; no open/close interaction |
| #44 | `fix/44-inputfield` | spacing wrong throughout; input smaller than frame → broken focus ring |
| #45 | `fix/45-checkbox` | check icon renders purple (should be `color/stroke/secondary`); no on-click toggle |

**#42 owns token changes this round** — the other four were told not to edit `design/tokens.json` / `app/theme.css` and to flag gaps instead. #45 may add `color/stroke/secondary` if it is genuinely missing.

Three of these (#43 Dropdown, #45 Checkbox, and possibly #44) force a **deliberate client/server decision**: CLAUDE.md keeps presentational atoms as Server Components with interactivity wired by the composer, but a disclosure and a toggle arguably own their own state. Each agent was told to choose explicitly and justify it — **review those decisions for consistency across the three before merging**, since they set the house precedent.

To resume: check which branches exist (`git ls-remote --heads origin | grep fix/4`), review, open PRs, merge, then move the cards to **In review**. Expect the usual `design/figma-map.json` conflict on whichever merges last.

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
- **Parallel agents all edit `design/figma-map.json`** (and often `messages/*.json`), so the last branch to merge always conflicts there. It resolves line-by-line — keep each agent's own "Built #NN" note, discard the stale placeholder for the components it didn't touch — but expect it and re-run the checks after resolving.
- **`pnpm ladle` is `ladle serve`** — `pnpm ladle build` hangs as a dev server. Use **`pnpm ladle:build`** for a non-interactive build; three separate agents hit this trap.

## Environment still to set up (outside this repo)

**Mac mini (issues #1–#5):** Docker + two Supabase stacks (ports on 127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + chat model sized to RAM), hardened self-hosted runner, restic backups + separate Vault-root-key backup.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links don't work without it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).

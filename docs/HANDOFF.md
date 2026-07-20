# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, conventions, board workflow) — you do not need to be asked to read it.
Read on demand, not by default: `docs/phase-log.md` (what infrastructure exists), `Architecture.md` + `docs/decisions/` (why — read the section for the phase you're working), `Vision.md` (product scope).

**The GitHub Project board is the source of truth for ticket status**, not this file: `gh project item-list 1 --owner JesseLevi`.

## State (2026-07-20)

- `main` has Phase 0 (foundation) + Phase 1 login/logout. CI is **green** on both jobs, including the db job (supabase + pgTAP + RLS coverage).
- Branch `feat/phase2-atoms` → **PR #37**, open and mergeable, CI green. Contains six Phase 2 components: Icon, Tag, Checkbox, Button, InputField, Step.
- Board: 7 tickets **In review** (#7 login, #12 #13 #14 #15 #16 #18 components), 22 in Backlog, #26 Done.

## Next actions

1. **PR #37 awaits the user's review/merge.** Don't merge it yourself.
2. **Phase 2 remainder** — molecules/organisms: #17 Card, #19–#22 Card-content/\*, #23 CardContainer, #24 Carousel, #25 Sidebar. Work in issue order; each ticket carries its Figma node-id.
3. **#6 Playwright + screenshot baselines** is the highest-value non-component ticket: it turns "I compared the Figma values by hand" into an automated pixel diff, which is the enforcement mechanism CLAUDE.md's pixel-parity rule currently lacks.
4. **#1–#5, #8–#11** are server-side or need user accounts — coordinate with the user, don't start unprompted.

## Open questions for the user

- **Checkbox "delete" state**: `design/figma-map.json` notes it, the Figma node doesn't contain it. Needs triage before anyone builds it.
- **Figma `Input-field` "Text" boolean** can hide the entire input row; not modelled (an input without its input isn't a meaningful state).

## Session gotchas not covered by CLAUDE.md

- Worktrees created for subagents branch off **`main`, not the branch you have checked out**. If a delegated ticket needs work that only exists on a feature branch, the agent's worktree will not have it — verify before spawning, or the agent will (correctly) stop and report.
- `git config user.name/email` is auto-guessed on this machine (`Jesse@mbp-van-jesse.home`); check before attributing commits.
- Figma spelling variants still live in the file: `Recipi`, `Distructive`, `Trekking-icon` (= trailing). Icon layer names were fixed and now match lucide exports exactly — see `design/figma-map.json`.

## Environment still to set up (outside this repo)

**Mac mini (issues #1–#5):** Docker + two Supabase stacks (ports on 127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + chat model sized to RAM), hardened self-hosted runner, restic backups + separate Vault-root-key backup.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links don't work without it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).

# Guide: ticket & kanban workflow

Read this when starting, finishing, or delegating a ticket. Referenced from `CLAUDE.md`.

Tickets are issues on `JesseLevi/Personal-Dashboard` (one milestone per phase), tracked on **project 1, owner `JesseLevi`**, Status columns `Backlog → Ready → In progress → In review → Done` (`gh project item-list 1 --owner JesseLevi`). Rules:

- Work tickets in phase/milestone order and honor the dependencies in each ticket body. Process: Fable writes `Architecture.md` + ADRs from `Vision.md`, Opus splits them into tickets, Claude Code executes — so you are not the architecture layer: flag ADR/Figma conflicts (see `CLAUDE.md`).
- **Move the card to "In progress" *before* writing code.** That column is the crash-safe map of what is mid-flight: if a session dies, the next agent resumes from it, and an unmoved card gets dropped or double-started. Check the column before starting anything new and finish what is already there.
- **Delegating counts as starting.** The *orchestrator* owns the card: move it to "In progress" at spawn and to "In review" once you have verified the agent's committed work; keep a ticket↔agent note. **Subagents never touch the board** (they race on board state and often lack the `project` scope).
- **"In review" needs proof the work is reachable**: an open PR link, or the commit already on `origin/main`. Never move a card on an agent's "klaar" alone — confirm with `git branch -r --contains <sha>` / `gh pr list --head <branch>` (#307 and the Winkelmand add button sat "done" on unmerged branches and never reached production). A branch with no PR is not in review.
- **When done** (checks pass, PR opened/pushed), move the card to "In review" via `gh project item-edit`, or flag it if the `project` scope is missing. Leave the issue open; the user reviews and closes. Don't move other cards, reorder the board, or close issues.
- **Verify a ticket's Figma links resolve before planning against them** (nodes cited by a ticket have been deleted from the file).

## Session gotchas

- Subagent worktrees branch off **`main`, not your checked-out branch**. If a ticket needs work that only exists on a feature branch, point the agent at that branch's existing worktree path.
- Figma spelling variants live in the file: `Recipi`, `Trekking-icon` (= trailing). `Distructive` was renamed `Destructive` in Figma (2026-08-12); the repo's `destructive` matches — don't "correct" it back. Icon layer names match lucide exports (`design/figma-map.json`).
- **`design/figma-map.json` is one line per component — keep it that way.** Never rewrite it with `json.dump(indent=2)`; compact entries keep a conflict at two lines. Design notes go in `design/notes/<Component>.md`, one file per component, so parallel agents never race on a shared file.
- **A `messages/*.json` conflict is dangerous, not routine.** Taking "theirs" wholesale deletes live keys and resurrects removed ones. Keep `main`'s block, add yours, then verify `en.json` and `nl.json` have identical key sets.
- **`pnpm ladle` is `ladle serve`** — use `pnpm ladle:build` for a non-interactive build.

## Verifying a subagent's work

Don't take an agent's report at face value:

- **Check the work is committed**: `git -C <worktree> status`/`log`. Agents have reported success with everything uncommitted; a killed agent's work usually survives in its worktree, so check before assuming it produced nothing.
- **Re-run the full visual suite yourself.** An agent regenerates baselines, edits more code, never re-runs.
- **Scoped baseline regeneration is `pnpm exec playwright test --update-snapshots -g <pattern>`** — `pnpm test:visual:update -- -g …` mis-forwards the flag and regenerates everything. `-g` only reaches stories whose *name* matches (`-g tag` misses `card--all-content-types`), so think about which stories *render* the thing.

# Guide: tickets, board and delegation

Tickets are issues on `JesseLevi/Personal-Dashboard`, one milestone per phase. They are tracked on **project 1, owner `JesseLevi`**, with the Status columns `Backlog → Ready → In progress → In review → Done` (`gh project item-list 1 --owner JesseLevi`).

## Roles

- **The user decides** scope, product behaviour and architecture.
- **Opus** turns a decision into an ADR and updates `Architecture.md` (`docs/decisions/README.md` describes how). It splits work into tickets, owns the board, delegates, and verifies.
- **Sonnet subagents** implement. Give each one a self-contained brief: the ticket, the relevant ADRs and guide, the files involved, and what "done" means. Tell it to fetch any named Figma node itself.

## Board rules

- **Move the card to "In progress" before writing code.** That column is the crash-safe map of what is mid-flight. Check it before starting anything new, and finish what is already there.
- **Delegating counts as starting.** The orchestrator moves the card. **Subagents never touch the board**: they race on it and often lack the `project` scope.
- **"In review" needs proof the work is reachable**: an open PR, or the commit on `origin/main`. Confirm with `gh pr list --head <branch>`. A branch with no PR is not in review. Unmerged "done" work has never reached production before (#307).
- **The orchestrator keeps `docs/HANDOFF.md` current.** When a wave of tickets starts, a PR merges, or a hosted action runs, rewrite the affected bullets in a docs PR. Subagents never edit it.
- Leave the issue open; the user reviews and closes. Don't reorder the board or close other people's issues.

## Verifying a subagent's work

- **Check the work is committed** (`git -C <worktree> status`/`log`). Agents have reported success with everything uncommitted. A killed agent's work usually survives in its worktree.
- **Re-run the checks yourself**: lint, typecheck, test, the relevant `pnpm check:*`, and the visual suite through CI. An agent that regenerates baselines and then edits more code never re-runs them.
- **Read the diff against the brief.** Watch for scope creep, invented UI outside ADR-0034's rules, and strings missing from one catalog.

## Parallel work gotchas

- Subagent worktrees branch off **`main`**, not your branch. Point an agent at an existing worktree when it needs unmerged work.
- Never batch a migration across parallel agents: it raced into 250 duplicate rows (#161). Serialize Playwright runs too, because agents share port 4310 and silently screenshot each other's servers.
- **`design/figma-map.json` stays one line per component.** Never `json.dump(indent=2)` it.
- **A `messages/*.json` conflict is dangerous.** Keep `main`'s block, add yours, then verify both catalogs have identical key sets.
- **Figma spelling variants are real**: `Recipi`, `Trekking-icon`. `Destructive` is spelled correctly in both Figma and code; don't "fix" it.

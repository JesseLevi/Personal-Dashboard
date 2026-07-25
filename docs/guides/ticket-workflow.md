# Guide: ticket & kanban workflow

Read this when starting, finishing, or delegating a ticket. Referenced from `CLAUDE.md`.

Tickets live as issues on `JesseLevi/Personal-Dashboard` (one milestone per phase) and are tracked on the user's GitHub Project kanban board: **project 1, owner `JesseLevi`**, Status columns `Backlog → Ready → In progress → In review → Done` (`gh project item-list 1 --owner JesseLevi`). Rules for Claude Code:

- Work tickets in phase/milestone order and honor the dependencies stated in each ticket body.
- **When you start a ticket, move its card to "In progress" *before* writing code.** This is not bookkeeping — the "In progress" column is the single source of truth for *what is mid-flight*. If a session ends abruptly (token/context budget, crash), the next agent reads this column to know exactly which ticket to resume; an unmoved card looks untouched and gets dropped or double-started. So: before starting anything new, check the In-progress column first and finish whatever is already there.
- **Delegating a ticket to a subagent counts as starting it.** The *orchestrator* (parent) owns the card: move it to "In progress" at spawn time and to "In review" once you have verified the agent's committed work — do this for each delegated ticket, and keep a note of which ticket maps to which agent. **Subagents must never touch the board themselves** (parallel agents would race on board state and often lack the `project` token scope). The board move is the orchestrator's job precisely so the In-progress column stays an accurate, crash-safe map of in-flight work.
- **When you finish a ticket** (implementation done, checks pass, PR opened/pushed), **move its card to the "In review" column** — via `gh project item-edit`, or flag it for the user if the `project` token scope is missing. Leave the issue open; the user reviews and moves it to Done/closes it.
- Don't move other cards, reorder the board, or close issues on your own.

## Where this project's process comes from

Prompts get refined with Claude (chat) + Figma MCP → Fable 5 analyzes `Vision.md` and asks questions → Fable produces `Architecture.md` + individual ADRs in `docs/decisions/` → Opus splits architecture into GitHub tickets → **Claude Code (you) executes tickets.**

Implication: you are not the architecture layer. If a ticket seems to conflict with an existing ADR or with the Figma design system, flag it — don't silently redesign. Architectural decisions belong in `docs/decisions/`, not improvised mid-ticket.

## Session gotchas

- Worktrees created for subagents branch off **`main`, not the branch you have checked out**. If a delegated ticket needs work that only exists on a feature branch, the agent's worktree will not have it — verify before spawning. To have an agent continue an *existing* branch, point it at that branch's existing worktree path explicitly.
- **`main` can move while your PRs are in flight.** #68/#69 landed mid-session and left two just-rebased branches stale again. Re-check `mergeable` before reporting a PR as ready.
- `git config user.name/email` is auto-guessed on this machine (`Jesse@mbp-van-jesse.home`); check before attributing commits.
- Figma spelling variants still live in the file: `Recipi`, `Distructive`, `Trekking-icon` (= trailing). Icon layer names match lucide exports exactly — see `design/figma-map.json`.
- **`design/figma-map.json` is a one-line-per-component lookup — keep it that way.** Never rewrite it with `json.dump(indent=2)`: the compact entries are what keep a two-line conflict from becoming a whole-file one. Design notes go in `design/notes/<Component>.md`, one file per component, precisely so parallel agents each touch their own file instead of racing on a shared one.
- **`messages/*.json` is still shared**, so the last branch to merge can conflict there — see the next bullet.
- **A `messages/*.json` conflict is dangerous, not routine.** When one branch *replaced* keys (as #65 did, swapping `buttonToggle.defaultLabel` for `groupLabel` + `categories`), taking "theirs" wholesale deletes live keys and resurrects removed ones. Resolve by keeping `main`'s block and adding yours, then verify `en.json` and `nl.json` have identical key sets.
- **`pnpm ladle` is `ladle serve`** — `pnpm ladle build` hangs as a dev server. Use **`pnpm ladle:build`** for a non-interactive build; four separate agents have now hit this trap.
- **Mixing Tailwind logical and physical padding utilities does not override.** `px-3` emits `padding-inline`, `pr-4` emits `padding-right` — different longhands, so which wins depends on emission order. Use the same physical property on both sides (`pr-3` + `active:pr-4`).

## Verifying a subagent's work

Repeatedly learned the hard way — don't take an agent's report at face value:

- **Check that the work is actually committed.** Agents have finished a ticket, reported success, and left everything uncommitted in the worktree. Tell them to commit before reporting, then verify with `git -C <worktree> status`. The upside: a killed or session-limited agent's work usually *survives* in its worktree — check `status` and `log` there before assuming a dead agent produced nothing, and tell the resuming agent what is already done so it doesn't redo it.
- **Re-run the full visual suite yourself.** The pattern that keeps recurring: an agent regenerates baselines, then makes further code edits that invalidate some, and never re-runs. "Scoped regeneration, then the **full** suite" is a thing to verify, not to trust.
- **Scoped baseline regeneration is `pnpm exec playwright test --update-snapshots -g <pattern>`.** `pnpm test:visual:update -- -g <pattern>` mis-forwards the flag and silently regenerates *everything*.
- **A `-g` pattern only reaches stories whose name matches it.** `-g tag` misses `card--all-content-types`, which renders Tags without "tag" in its story name. After a token change, think about which stories *render* the thing, not which are named after it.
- **`pnpm build | grep …` reports grep's exit code, not the build's** — a failing build passes silently. Never pipe a gate you are checking the result of.
- **Never run two `pnpm build`s against the same `.next` concurrently.** It corrupts the cache and produces a moving prerender error that looks like a code bug.

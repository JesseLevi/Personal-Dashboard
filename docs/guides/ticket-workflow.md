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

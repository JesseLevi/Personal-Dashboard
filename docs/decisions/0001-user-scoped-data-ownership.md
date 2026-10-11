# ADR-0001: user_id-only data ownership (no household scoping yet)

**Status**: Accepted (user decision, 2026-07-20). Still in force. **Direction (2026-10-11, #412):** Atlas is for friends and family, and sharing is a stated future need: shared boards, recipe collections and shopping lists, and sharing a single recipe with another member. A sharing-model ADR will supersede this one when that work starts. Until then, see "Staying sharing-ready" below.

## Context

Vision.md §4 raises the open question how shared household data (e.g. one shopping list per household) fits a per-user RLS model. The alternative — `household_id` + membership table from day one — was proposed and explicitly declined in favor of the simplest model.

## Decision

Every table carries `user_id uuid not null references auth.users(id) on delete cascade`. RLS policies check `user_id = (select auth.uid())` for all four operations. No household/tenant tables exist in this round.

## Consequences

- Simplest possible policies, queries, and mental model; nothing speculative in the schema.
- **Accepted trade-off**: enabling shared household data later requires a real migration (new membership model + rewriting every policy). This partially tensions with Vision.md §2's "multi-user without later migration" fundament — the user accepts that migration cost knowingly.
- Multi-user still works today in the sense of multiple isolated accounts; only *sharing* is deferred.
- Tickets must not invent per-module sharing workarounds; if sharing becomes real, it comes back through a new ADR.

## Staying sharing-ready (2026-10-11)

Rules so the later migration stays a policy change, not a rewrite:

- **Access is decided by RLS.** App code does not re-implement ownership with its own `user_id` filters beyond what a query needs for scoping. Inside RPCs, the ownership guard is the only exception (ADR-0015).
- **New modules keep a clear owning row** that sharing can hang off: a board, a calendar, a recipe collection. Avoid designs where one user's data has no container.
- **`user_id` means "owner", not "the only reader".** Nothing in a UI should assume the viewer is the owner when that is cheap to avoid.


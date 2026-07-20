# ADR-0001: user_id-only data ownership (no household scoping yet)

**Status**: Accepted (user decision, 2026-07-20)

## Context

Vision.md §4 raises the open question how shared household data (e.g. one shopping list per household) fits a per-user RLS model. The alternative — `household_id` + membership table from day one — was proposed and explicitly declined in favor of the simplest model.

## Decision

Every table carries `user_id uuid not null references auth.users(id) on delete cascade`. RLS policies check `user_id = (select auth.uid())` for all four operations. No household/tenant tables exist in this round.

## Consequences

- Simplest possible policies, queries, and mental model; nothing speculative in the schema.
- **Accepted trade-off**: enabling shared household data later requires a real migration (new membership model + rewriting every policy). This partially tensions with Vision.md §2's "multi-user without later migration" fundament — the user accepts that migration cost knowingly.
- Multi-user still works today in the sense of multiple isolated accounts; only *sharing* is deferred.
- Tickets must not invent per-module sharing workarounds; if sharing becomes real, it comes back through a new ADR.

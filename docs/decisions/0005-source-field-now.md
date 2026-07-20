# ADR-0005: Add a `source` field to cards and calendar_events now

**Status**: Accepted

## Context

Vision.md §5 asks whether a `source` field ("manual" vs "mail") on Kanban and Agenda is worth adding now for the future Mail-integratie, or premature abstraction.

## Decision

Add it now, minimally: `source text not null default 'manual'` (enum `manual|sync` on `calendar_events`, `manual|mail` reserved on `cards`) on exactly these two tables. Nothing else mail-related is built — no tables, no credential plumbing, no triage stubs.

## Consequences

- Cost is one column with a default; no migration or backfill later when mail lands, and calendar sync (ADR-0008) needs the same column on `calendar_events` this round anyway — which tips the trade-off decisively.
- UI may ignore the field entirely for now (optionally: sync'd events render read-only, which Phase 9 requires regardless).
- Any further mail-anticipating structure remains explicitly out of scope until the Mail-integratie round.

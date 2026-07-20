# ADR-0004: Build order

**Status**: Accepted

## Context

Vision.md §5 asks for the smartest build order given that Recepten → Boodschappenlijst is the only hard module dependency. Additional constraints from user decisions: Figma designs exist only for Te-Doen, Recepten, Recept-detail and Winkelmand; schemas for undesigned modules (Notities, Agenda, Kleding) are in scope but their UI is not; semantic search, AI-agent and calendar sync (read-only) are all in this round.

## Decision

Phases as specified in `Architecture.md` §10:

0. Foundation (scaffold, tokens, CI, RLS harness, tunnel, backups)
1. Auth + minimal undesigned login (deliberately plain, existing atoms only)
2. Design system core (atoms → molecules → organisms from Figma)
3. Te-Doen (Kanban)
4. Recepten
5. Boodschappenlijst
6. Backend-only schemas: Notities, Agenda, Kleding
7. AI pipeline (jobs, worker, embeddings, semantic + textual search)
8. AI-agent (detectors, signals, minimal surface)
9. Calendar sync backend (ics → caldav → google)

Rationale: auth gates everything; the design system gates all designed UI; Kanban before Recepten because it exercises the full stack on the simplest designed module and is the agent's primary signal source; Recepten strictly before Boodschappenlijst (the one hard dependency); AI phases last because they need real data and their pipeline is independent of module UIs.

## Consequences

- Every phase ends deployable; a stall in later phases never blocks shipping earlier ones.
- The plain login screen is intentional scope, not design debt to "fix" mid-round; a designed login goes through the Figma loop later.
- Opus should map phases to GitHub milestones and keep cross-phase dependencies explicit in ticket descriptions.

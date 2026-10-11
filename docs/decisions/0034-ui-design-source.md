# ADR-0034: Claude designs UI in code by default; a named Figma design is binding

**Status**: Accepted (user decision, 2026-10-11, #412). **Amends** ADR-0010 §2–§4 (Figma is no longer the only source of components) and replaces the "never build UI absent from Figma" rule in `CLAUDE.md` and `docs/guides/ui-components.md`.

## Context

- Until now every screen had to exist in Figma first. Gaps were flagged and left unbuilt, or built as Claude-designed UI only after an explicit request.
- In practice the whole Notities editor round (#329–#342), the admin page (ADR-0020) and many states were Claude-designed on request, and they held up. Waiting for Figma became the bottleneck, and `docs/open-questions.md` filled up with gaps that only needed a sensible design.
- The design system itself (components and semantic tokens on the Tailwind scale) is mature enough to compose new screens from.

## Decision

1. **Default: Claude designs in code.** A screen, state or component that a ticket needs is designed directly in code:
   - compose existing components first;
   - use bound semantic tokens only;
   - add a new component only by exception, when no existing one fits and it adds real value, and record why in its design note.
2. **The token scale stays closed.** A new token or primitive needs the user's consent. A missing token is flagged in the design note, never hardcoded.
3. **A named Figma design is binding.** When the user names a Figma design for a ticket, it is implemented exactly, unless the user says otherwise:
   - fetch the node first;
   - read token bindings from `boundVariables` through the `figma-console` bridge.
   
   Silence means "no Figma design", not "go look for one".
4. **Traceability.**
   - A Figma-sourced component keeps its `figma-map.json` entry and its `// figma: node-id=…` header.
   - A Claude-designed one has the header `// design: Claude-designed (#NNN)` and no map entry.
   - Both get a Ladle story, a visual baseline and a `design/notes/<Component>.md` contract.
   - A new user-facing surface goes to the user as a screenshot for review.
5. **Gaps.** A design gap is no longer a blocker. `docs/open-questions.md` keeps only gaps worth knowing about and decisions that genuinely need the user, such as product behaviour.

## Consequences

- Phase 7 (Agenda) is designed this way: Schedule-X (ADR-0008) themed with semantic tokens, composed from existing components.
- Visual consistency now rests on composition discipline and review screenshots rather than on a Figma frame. The closed token scale and the existing component set are the guardrails.
- `figma-map.json` no longer lists every component, only the Figma-sourced ones.

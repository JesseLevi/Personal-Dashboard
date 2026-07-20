# ADR-0010: Design tokens as a synced artifact; machine-readable Figma↔code traceability

**Status**: Accepted

## Context

The Figma file is deliberately built atomic with primitive → semantic tokens on the Tailwind scale, and the stated goal is that a component update in Figma flows into the platform effortlessly. Prose conventions ("map fills to named tokens") don't achieve that: they depend on whoever executes the ticket re-deriving the mapping. For AI-executed tickets especially, the mapping must be data, not documentation.

## Decision

1. **`design/tokens.json` is the single source of truth for tokens** in the repo, synced from Figma variables via MCP/API (`pnpm sync:tokens`). From it, `app/theme.css` (**Tailwind v4 `@theme`**) is generated. Generated files are never hand-edited; components use semantic token classes, never primitives or raw values. A Figma token change = re-sync + reviewable PR diff, zero component edits.
2. **`design/figma-map.json`** holds the canonical component mapping: Figma component name ↔ code path ↔ Figma node-id. The naming table in `Architecture.md` §3.1 is its human-readable view. Every component file also carries its node-id in a header comment (`// figma: node-id=NNNN:NNNN`).
3. **Ladle** hosts one story per design-system component (atoms/molecules/organisms only — not pages), with Playwright screenshot baselines committed to the repo and diffed in CI.
4. **The update loop is the contract**: Figma change → look up node-id in the map → fetch via Figma MCP → update CVA classes/structure → screenshot diff shows the visual delta → PR. Tickets adding components must add map entry + header annotation + story in the same PR (CI can verify map ↔ filesystem consistency).

## Consequences

- "Update Button from Figma" becomes a mechanical, reviewable operation instead of an interpretive one — exactly what the Figma-MCP-first workflow needs.
- Small fixed overhead per component (map entry, story, baseline) — the price of drift being visible instead of silent.
- Tailwind v4 is thereby fixed as the Tailwind major; its CSS-first `@theme` is what makes the generated-theme approach native instead of config-file templating.
- If Figma variable naming changes structurally, `sync:tokens` breaks loudly in CI rather than silently diverging — intended behavior.

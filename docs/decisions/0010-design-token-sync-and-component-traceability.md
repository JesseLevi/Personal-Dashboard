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

## Note (2026-08-11, ticket #203): "synced from Figma variables via MCP/API" is now literally true

Point 1 above was written assuming `sync:tokens` reads Figma variables directly; in practice the Figma MCP's `get_variable_defs` was believed to return resolved hex only, so every name in `design/tokens.json` up to this point was derived from measured colour, not read from Figma (see the token-changes entries in `docs/incidents.md` for that era). Re-tested on nodes `3623:4346` and `3705:4402`: `get_variable_defs` does return real variable names. That closes the gap between this ADR's intent and the pipeline's actual behaviour, via one intermediate step rather than a live sync:

- `design/figma-variables/*.json` — a committed DTCG export of the three Figma variable collections (Primitives/Tailwind, Semantics/Style Light+Dark, Semantics/Responsive Mobile+Desktop) — is now the source of truth for token names and values.
- `design/tokens.json` is a curated mirror of that export: each semantic colour token carries its Figma path (`figma`) and variable id (`figmaVariableId`) alongside the value `sync:tokens` consumes.
- `pnpm check:tokens-drift` (new CI gate) diffs the mirror against the export on name, id and value, and is the enforcement point 1 didn't yet have — anything not flagged `$pendingFigmaValue` must match exactly.
- Semantic token naming now follows the Figma path rather than being coined per token (`color/` stripped, `Stroke` → `stroke`, trailing `/default` dropped, the `text/base/*` group drops the `base` segment). Product aliases (`priority-*`, `tag-highlight*`) stay a deliberate alias tier on top, per point 1's original design, now pointing at semantic tokens instead of primitives.

## Note (2026-07-22, ticket #86): the token layer now also carries motion

`design/tokens.json`/`app/theme.css` gained a `duration`/`easing` primitive+semantic tier alongside `color` (Sidebar's collapse-slide transition), synced through the exact same `pnpm sync:tokens` pipeline this ADR already describes generically ("tokens", not "colours"). Unlike colour, motion has **no Figma source at all** to sync from (see `docs/open-questions.md#sidebar-motion-timing-unsourced`) — the values are this codebase's own picks, which is a meaningfully different provenance than everything else this ADR covers. This note records that the mechanism absorbed it without a code change to the pipeline's shape; it does **not** decide whether motion deserves its own ADR versus living as a footnote here — that call is left to the user/architecture layer, not made unilaterally by the ticket that needed it.

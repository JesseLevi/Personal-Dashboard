# `design/figma-variables/` — Figma variable export (DTCG format)

Committed as an auditable snapshot (ticket #203). This is now the source of
truth for token *names* and *values*; `design/tokens.json` is a curated
mirror of it (see that file's `$meta.procedure` and ADR-0010). Never hand-edit
these files — regenerate them (see "Refreshing" below) and diff the result.

## What's here

| File | Figma collection | Used for |
|---|---|---|
| `Default.tokens.json` | Primitives / Tailwind | Primitive scale (stone/red/blue/…, radius, spacing, etc.) that `design/tokens.json`'s `primitive.*` mirrors. |
| `Semantics _ Style_Light.tokens.json` | Semantics / Style, Light mode | Semantic colour tokens' light values + `figma` path + `figmaVariableId`. |
| `Semantics _ Style_Dark.tokens.json` | Semantics / Style, Dark mode | Same, dark mode. |
| `Semantics _ Responsive_Desktop.tokens.json` | Semantics / Responsive, Desktop | Radius/spacing responsive tier — not yet consumed by `design/tokens.json` (no ticket has synced it in); kept for when one does. |
| `Semantics _ Responsive_Mobile.tokens.json` | Semantics / Responsive, Mobile | Same, mobile. |

Each variable carries `$extensions."com.figma.variableId"` (stable across
modes/collections — the same ID appears in both `Style_Light` and
`Style_Dark` for a given variable) and, where the variable is itself an alias
onto a primitive, `$extensions."com.figma.aliasData"` naming the target.
`design/tokens.json`'s `figmaVariableId` field on each semantic token is this
ID; `scripts/check-tokens-drift.mjs` diffs against it.

## What's deliberately *not* here

**`Semantics / Color`** (exported earlier to `~/Downloads/Semantics _ Color/`,
`Light.tokens.json` + `Dark.tokens.json`) is **not** included here. It's an
older, superseded collection, confirmed two ways, not just asserted:

- **Coarser paths.** It has 15 flat colour entries (`color/surface/primary`,
  `color/text/primary`, …) with no `/default`, `/hover`, `/active`,
  `/selected` state suffixes at all — it predates the state tier
  `Semantics / Style` (and this repo's `role`/`role-hover`/`role-active`
  convention, `docs/design-tokens.md`) was built around.
- **Same variable IDs, different resolved values.** Several of its entries
  share a `com.figma.variableId` with a `Semantics / Style` variable (e.g.
  `VariableID:3626:4455` is `color/surface/highlight/blue` in both) but
  resolve to a *different* hex — `#E5F3FE` there vs. `#EFF6FF` in
  `Semantics _ Style_Light.tokens.json` here. Same variable, stale captured
  value: exactly the kind of drift `pnpm check:tokens-drift` exists to catch,
  so building on it would import the very problem this export solves.

Figma's Dev Mode `get_variable_defs` on the nodes this repo actually builds
from (3623:4346, 3705:4402) resolves against `Semantics / Style`, not
`Semantics / Color`. If a future ticket finds a live reference to
`Semantics / Color` from an actual component node, that's a reason to
re-investigate, not to silently start pulling values from it.

## Refreshing

1. In Figma Dev Mode, open each collection listed above and export as DTCG
   JSON (or use the Figma MCP variables export flow — same MCP the rest of
   this repo's Figma workflow uses, see `docs/guides/ui-components.md`).
2. Overwrite the corresponding file(s) here under their exact existing
   filenames (the space-separated `Semantics _ Style_Light` naming matches
   Figma's own collection-mode name; keep it so `git diff` on a re-export is
   readable per collection).
3. Run `pnpm check:tokens-drift` — it will fail loudly on any semantic token
   whose name, `figmaVariableId`, or value no longer matches, except values
   marked `$pendingFigmaValue` (an open, ticketed deviation — see
   `design/tokens.json`'s `semantic.$comment`).
4. Update `design/tokens.json` for whatever the drift check flags, run
   `pnpm sync:tokens` to regenerate `app/theme.css`, and run `pnpm
   test:visual` to confirm (or intentionally update, per component) the
   resulting visual diff.

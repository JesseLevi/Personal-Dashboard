# Guide: UI components (Figma → code)

Read this before building or changing anything in `components/` or `app/`'s UI. Referenced from `CLAUDE.md`.

## Design system: Figma → code, Atomic Design

The Figma file ("Notion - V2") is the source of truth for UI, mirrored 1:1 into `components/{atoms,molecules,organisms}/` after Figma's Atomic Design sections (folder ↔ section map: `Architecture.md` §2). Rules:

- **Component names match Figma layer names.** `Atom/Button` → `components/atoms/Button.tsx`; `Card-content/Recipi` → `components/molecules/CardContentRecipe.tsx` (translate NL→EN in code, keep the mapping obvious). This is what keeps the Figma↔code link traceable.
- **Before building or changing a UI component, fetch it from Figma via MCP first** (`get_figma_data` with the relevant node-id). Don't guess spacing, colour, or type scale from memory or a screenshot — pull it from the dev-ready node. Note the node-id in the PR/commit description.
  - **The agent that writes the component does the fetch itself** — first tool call of the build. A second-hand summary pasted into the prompt is not a substitute: it drops fidelity and defeats the point of a live dev-ready pull. When delegating, tell the subagent to call MCP for its node; do not pre-digest the node into the prompt and skip the fetch.
  - **Pixel-parity is verified, not assumed.** Fetch the visual with `download_figma_images`, render the Ladle story, compare, and record the check (and any intentional deviation) in the PR. The ADR-0010 Ladle/Playwright screenshot baseline is the eventual enforcement (ticket #6, **not yet wired into CI** — eyeball until then).
  - **Icons: Figma layer names are the exact lucide export names** (`Icon/Ellipsis`, not `Icon/Dots`), so the `Icon` atom's mapping is a direct lookup and the rendered glyph really is the vector Figma shows. **Never trust the name alone** — render the candidate export (`renderToStaticMarkup` or the Ladle story) and compare its paths against the Figma node. Same-named exports can be "false friends" (lucide's `Cross` is a medical/plus glyph, not an X), and shape-verification has already caught three real mismappings. If no lucide export matches, that's an Architecture-level call (custom SVG vs. exporting Figma's vector) — flag it, never hand-draw an approximation.
- **Never build a component that doesn't exist in Figma yet.** If a ticket needs undesigned UI, stop and flag it rather than inventing a layout — send it back through the Fable/Figma loop instead of freelancing.
- **Compose exactly as Figma nests.** If Figma builds `Card-container` out of `Card` instances wrapping `Card-content/*` in a slot, the React tree mirrors that composition — don't flatten it. Dependencies flow one way only: atoms ← molecules ← organisms ← `app/`; an atom never imports a molecule.
- **Variants via CVA**: Figma variant properties (Style, Type) → CVA props; **State (Hover/Active/pressed) → CSS pseudo-classes, never props**; Figma booleans (`With icon`) → optional props; Figma SLOT nodes → `children`/named slots.

The full component update loop (node-id → fetch → update → Ladle screenshot diff → PR) lives in `Architecture.md` §3.3 / ADR-0010.

## Component code conventions (house style — locked in by the Phase 2 atoms)

These exist because the first parallel component work diverged on each of the points below. Follow them so components read as one hand:

- **Server Component by default.** A presentational atom/molecule (no event handlers, no hooks) must NOT carry `"use client"`. Interactivity is wired by the composing molecule/organism, not baked into the leaf atom. Add `"use client"` only when the component itself owns state/handlers.
- **`className` merging is not ad-hoc.** Variant components use `cva()` and pass caller `className` through its `class`/`className` arg. Non-variant components merge with **`clsx`** (already a dependency). Never concatenate class strings by hand, and never drop a caller's `className` on the floor.
- **Icons go through the `Icon` atom only.** `Icon` is the single module that imports `lucide-react`; every other component renders icons as `<Icon name="…" />`. The `IconName` union is the Figma vocabulary (spelling-corrected, e.g. `Calendar` not `Calandar`), kept identical to lucide's export names so each entry is a direct PascalCase lookup to the identically-named export (see `Icon.tsx`'s header and the icon rule above). Because `Icon.tsx` is the only place lucide is imported, a lucide-side rename is absorbed there in one edit rather than rippling through call sites. Decorative icons get `aria-hidden`; an icon that IS the control's label gets its accessible name on the wrapping control.
- **Accessibility is part of the atom.** Form-shaped presentational atoms expose semantics: e.g. `Checkbox` renders `role="checkbox"` + `aria-checked` rather than a bare styled `<div>` or a misleading `readOnly` native input. Decide input-vs-role deliberately and note it in the PR.
- **Ladle stories use Tailwind utility classes, never inline `style={{…}}`** — even though stories are dev-only, they showcase the design system and must model correct usage (token classes, not raw px/hex).
- **Raw hex never appears in `components/`, not even in comments.** `check:server-only` greps the whole file, so documenting a mapping as `bg #E7E5E4` fails the build. Describe colours by their primitive/token name (`stone-200` → `surface-raised`); the exact Figma hex belongs in `design/figma-map.json`, which is the design-source record and is not grepped.
- **A token gap is flagged, never papered over.** If Figma uses a value that has no matching *semantic* token (e.g. a hover fill that happens to equal the `border` token), reuse the existing token for the correct pixels **and** record the gap in the component doc comment + `design/figma-map.json`, so the token sync can add a real token later. Never hardcode the hex, and never silently normalise the design to a different colour.
- **Don't invent Figma states that aren't in the fetched node.** If `design/figma-map.json` notes a variant/state the dev-ready node doesn't actually contain (e.g. Checkbox's "delete"), build only what Figma exposes and leave the gap flagged in the map note for triage — never freelance the missing state (reinforces the "never build what isn't in Figma" rule above).

## Design tokens (ADR-0010)

Pipeline: Figma variables → `design/tokens.json` (`pnpm sync:tokens`) → generated `app/theme.css` (Tailwind v4 `@theme`) → utility classes (full detail in `Architecture.md` §3.2). Never hand-edit generated theme files; never use a raw value where a semantic token exists (enforced by `check:server-only`).

- **Figma text styles are Tailwind-native**: `text-xl/semibold` → `text-xl font-semibold`. Translate a returned `textStyle` directly into that class pair — don't re-derive size/line-height/weight by hand.
- **The token scale is closed.** If a Figma value has no Tailwind-scale/semantic equivalent, check with the user before inventing a one-off — never hardcode the hex.
- **`design/figma-map.json` is the canonical component↔node-id map**; every component carries `// figma: node-id=...` in its header. Adding a component = map entry + header annotation + Ladle story, all in the same PR.
- **Per-state colour convention (#52, #56):** `docs/design-tokens.md` is the authoritative spec — every colour role gets `role` / `role-hover` / `role-active` tokens, never one token reused across states, and a component reads those colours from tokens, never from a `dark:` prefix, raw hex, or one-off value. Selected is deliberately **not** a colour token: it only darkens text (`aria-pressed:text-text`), which lets it compose with hover/active instead of overriding them. Read the doc before adding state styling to any component.

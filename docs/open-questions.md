# Open questions awaiting a decision

Design-side gaps where the ticket, the property list, or the token scale promises something the dev-ready Figma node doesn't contain. **Each needs a design or product answer before a follow-up ticket can model it — nobody builds these from guesswork** (`CLAUDE.md`: never build what isn't in Figma).

This is the single canonical list. `docs/design-tokens.md` and `docs/HANDOFF.md` link here rather than restate it, and code comments reference the **slug**, never a number — questions get resolved and removed, and numbering silently reassigns itself to the wrong question when they do.

Reference one as `docs/open-questions.md#<slug>`.

---

## no-pointer-affordance

**No Hover state anywhere in the pointer-affordance family.** `Atom/Button`'s Transparent style, `Button/Toggle`'s segments, and `Card-content/Ingredient` rows all have *no* mouse-over feedback. One decision covers all three.

- **Transparent**: Figma defines no fill for its Hover or Active nodes, so none was invented. A transparent button currently gives no visual feedback on hover.
- **`Button/Toggle`'s segments inherit it**, since they render as `Button variant="transparent"`.
- **`Card-content/Ingredient`** (node `3727:4021`) defines no Hover state at all — only `Default | Active | Delete`. Fixed in #67: `Active` now maps to `:active` (not `:hover`/`:focus-within`, which #20 had wrongly used), consistent with the `Active` = "currently being pressed" reading that #56 (`Atom/Button`) and #58 (`Atom/Input-field`) already established for this exact state name. That still leaves an ingredient row where hovering does nothing and only pressing does.

Needs a design answer, not a code guess.

## button-vs-input-active-border

**Only Active still diverges between `Atom/Button`/Outline and `Atom/Input-field`.** Tickets #56 and #58 left three states open pending Figma reconciliation. #68 re-fetched both nodes (3623:4346, 3705:4402) and confirmed directly rather than assuming: Hover now matches (both stone-500) and Selected now matches (both stone-400, Outline's Selected having gained a border for the first time) — `border-input-hover` and `border-input-selected` are deleted, and `InputField.tsx` reads the shared `border-hover` / `border-selected` tokens.

**Active is the one state that still does not line up**: Input-field's Active is stone-600, Button/Outline's moved to stone-800 (from stone-700) — confirmed side by side in the same fetch, a real, deliberate pixel difference, not a stale or unbound node. `border-input-active` stays under its own name until a future re-fetch either aligns the two values or the user confirms input borders are a genuinely distinct role from button borders. Don't guess: re-fetch and compare exact hex, the way #58 and #68 both did.

Both components' Selected → `:focus-within` (Input-field) / `aria-pressed` (Button) mappings remain each atom's own interpretation of Figma's state *names*, not something Figma's data asserts — still flagged for design confirmation, unchanged from #58.

## token-names-are-hex-derived

**Figma MCP returns resolved hex only, never variable names.** Every semantic token name in `design/tokens.json` is derived by matching a pixel value back to a role, not read from Figma's own variables. The names may need aligning with the real Figma variable names — worth doing before more components are built on this vocabulary and it calcifies further.

## dark-mode-is-placeholder-only

**No Figma dark frames exist for any component**, so every `dark` value in `design/tokens.json` is this codebase's own pick. Known collision: `priority-urgent-bg-hover` and `-active` both resolve to red-950, so the destructive states are invisible in dark mode. Nothing in the Next.js app sets `data-theme` yet — only Ladle does. An app-level theme switch is an open architectural decision.

## checkbox-delete-state

**`Checkbox` "delete" state**: `design/notes/Checkbox.md` records it, the Figma node doesn't contain it. Built only what the node exposes, per `CLAUDE.md`.

## input-field-text-boolean

**Figma `Input-field`'s "Text" boolean** can hide the entire input row. Not modelled — an input without its input isn't a meaningful state. Confirm the boolean is a Figma-authoring artifact rather than an intended variant.

## toggle-group-shared-track

**Toggle-group / shared track**: the `Button/Toggle` node's demo shows 5 chips sharing one grey track. #69 rebuilt the track itself; whether a *grouped* composition needs its own molecule/organism ticket is still open.

## english-nav-labels-overflow

**English nav labels overflow the Sidebar's fixed 198px rail (#25).** Dutch is pixel-perfect — all six rows exactly 40px, matching Figma. English is not: "Shopping basket" wraps to two lines and spills outside its 40px button. Figma only ever shows the Dutch labels, so it offers no guidance. Needs a content or design call — shorter English label, truncation, wrapping with taller rows, or a wider rail. Deliberately not invented in code.

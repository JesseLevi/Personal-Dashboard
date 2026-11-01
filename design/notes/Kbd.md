# Kbd
Figma: none, designed in code (ADR-0034) · Code: `components/atoms/Kbd.tsx` (+ `.stories.tsx`)

## Why a component
The key chip lived inline in `AgendaMoreMenu`'s shortcuts list. The command palette needs it in its field, its highlighted row and its footer (ADR-0048), so it is now one atom. The agenda menu renders the same classes: no visual change.

## Anatomy
A `<kbd>`: `inline-flex min-w-6 justify-center`, `rounded-control-inner`, 1 px `border-stroke-primary`, `px-component-xs`, `text-sm font-semibold text-text-primary`, no fill. `children` is the key label (a letter, a symbol such as ↵ or a short word such as esc); the chip grows with it.

## Contract
- Props: `className` (merged with `cn`) plus any `<kbd>` attribute (the palette passes `aria-hidden` on its decorative chips).
- Server Component; no state.

## Deliberate decisions
- No fill, so it sits on any surface (white body, `surface-primary` strip, highlighted row) without a colour of its own.
- The label is not translated: key caps (↑ ↓ ↵ esc) are the same in every language.

## Token gaps and flags
None; all semantic tokens.

## Gotchas
- A chip that only decorates (a hint next to a button that already has a name) should be `aria-hidden`; the atom does not decide that.

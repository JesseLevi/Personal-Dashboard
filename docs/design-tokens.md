# Design tokens: per-state colour convention (ADR-0010)

Read on demand from `CLAUDE.md` → "Design tokens". This file records the convention
every component's state colours follow, plus the concrete matrix behind it.

History: ticket #52 introduced a three-state tier (Default/Hover/Selected).
**Ticket #56 supersedes it** — Figma added a fourth state and redistributed the
values. What follows is the current state of the world.

## The convention

For every semantic colour **role** with Figma-defined state variation, model it as
separate tokens — never one token reused across states:

```
role          — Default
role-hover    — Hover   (pointer over)
role-active   — Active  (being pressed)
```

There is deliberately **no `role-selected`**. In the reworked Figma set, Selected
does not change the background or border at all — it only darkens the text to
`text`. A `*-selected` colour token would have no value to hold.

How a component reads them:

- base case → `role`
- `:hover` → `hover:bg-role-hover` / `hover:border-role-hover`
- `:active` → `active:bg-role-active` / `active:border-role-active`
- Selected → `aria-pressed:text-text`

### Selected must compose with Hover and Active

A selected button still reacts to the pointer. This is a product requirement, and
it works only because the two concerns touch **disjoint CSS properties**: Selected
sets `color`, Hover/Active set `background-color`/`border-color`. Never add an
`aria-pressed:bg-*` or `aria-pressed:border-*` override — that re-introduces the
conflict and silently kills the hover feedback on selected items.

### `:active` vs `aria-pressed` — both, for different things

CSS `:active` means "currently being pressed" (transient). `aria-pressed` means
"is the chosen one" (persistent). Figma's `Active` state is the former and its
`Selected` state the latter, so both hooks are used, deliberately.

Ticket #42 once removed `active:` from `Atom/Button`; that was correct *at the
time* because it was being misused for the persistent state. Don't read that
history as a ban on `:active`.

### Other rules

- **Never** use a `dark:` utility, a raw hex, or a one-off value for a state
  colour. Light values come from the fetched Figma node; dark values are picked
  from Tailwind's stock stone/red scale and flow through the `[data-theme="dark"]`
  pipeline ticket #42 built.
- If Figma defines no variation for a role in some state, **don't invent one**.
  See Transparent below, which has no hover affordance at all, and Distructive,
  whose text never changes.

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-07-20 for #56)

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface-raised` (stone-200) | `surface-raised-hover` (stone-300) | `surface-raised-active` (stone-400) | bg unchanged, text → `text` |
| White | `surface` (white) | `surface-hover` (stone-50) | `surface-active` (stone-100) | bg unchanged, text → `text` |
| Transparent | no fill | no fill | no fill | text → `text` |
| Outline | `border` (stone-300) | `border-hover` (stone-400) | `border-active` (stone-700) | border unchanged, text → `text` |
| Distructive | `priority-urgent-bg` (red-50) | `priority-urgent-bg-hover` (red-100) | `priority-urgent-bg-active` (red-200) | identical to Default |

Text is `text-muted` in Default/Hover/Active for every style except Distructive,
which is `priority-urgent` throughout.

## What #56 changed in `design/tokens.json`

- `surface-hover`: stone-300 → **stone-50**. It had no consumer after #52; it now
  backs White's Hover.
- `surface-active` (stone-100): **new**. Shares its primitive with `surface-muted`
  but kept as a separate name — it is a state colour, a different role.
- `surface-raised-hover`: stone-400 → **stone-300** (that value is now Active).
- `surface-raised-active` (stone-400): **new**.
- `border-hover`: stone-500 → **stone-400** (Button/Outline's Hover). See the open
  question below for why Input-field no longer shares this token.
- `border-active` (stone-700): **new**, replacing `border-hover-strong`.
- `priority-urgent-bg-hover`: red-200 → **red-100**;
  `priority-urgent-bg-active` (red-200): **new**.
- **Removed** (no consumer left once Selected became text-only): `surface-selected`,
  `surface-raised-selected`, `border-selected`, `border-hover-strong`,
  `priority-urgent-bg-selected`.
- **Provisional, delete on reconciliation**: `border-input-hover` (stone-500) and
  `border-input-focus` (stone-400), scoped to `Atom/Input-field` — see below.

## Open questions (recorded, not resolved by guessing)

1. **`Atom/Input-field` was not re-authored along with `Atom/Button`.** Re-fetched
   for #56 (node 3705:4402) and confirmed unchanged: still three states, strokes
   stone-300 / stone-500 / stone-400. Note the ordering — its **Hover is darker
   than its Active**, the reverse of Button/Outline (stone-400 → stone-700). That
   inversion is the strongest signal yet that this node was simply never re-bound
   to the reworked variables. Until someone confirms, the two components keep
   their own fetched values and Input-field's live behind names that announce
   themselves as temporary. **Action for the design side:** re-bind Input-field's
   strokes, then delete `border-input-hover` / `border-input-focus` and point the
   component at `border-hover` / `border-active`.
2. **Figma MCP returns resolved hex only, never variable names.** Every semantic
   token name in `design/tokens.json` is derived by matching a pixel value back to
   a role, not read from Figma's own variables. The names may need aligning with
   the real Figma variable names — worth doing before more components are built
   on this vocabulary.
3. **Transparent has no pointer affordance.** Figma defines no fill for its Hover
   or Active nodes, so none was invented. A transparent button currently gives no
   visual feedback on hover — probably worth a design decision rather than a
   code-side guess.
4. **Dark mode is placeholder-only.** No Figma dark frames exist for any
   component, so every `dark` value is this codebase's own pick. Known collision:
   `priority-urgent-bg-hover` and `-active` both resolve to red-950, so the
   destructive states are invisible in dark mode. Nothing in the Next.js app sets
   `data-theme` yet — only Ladle does.

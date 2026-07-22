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

A selected button still reacts to the pointer. This is a product requirement.
For every style except `Atom/Button`'s Outline, it works only because the two
concerns touch **disjoint CSS properties**: Selected sets `color`, Hover/Active
set `background-color`/`border-color`. Never add an `aria-pressed:bg-*`
override to Filled/White/Transparent/Distructive — that re-introduces the
conflict and silently kills the hover feedback on selected items.

**Outline is the one deliberate exception (ticket #68).** Figma re-authored
Outline's Selected state to carry a real border colour (`border-selected`),
which is the same property Hover/Active already use there — the disjoint-
properties trick no longer applies to this one style. A plain
`aria-pressed:border-border-selected` override is **not** safe on its own:
verified against the compiled `pnpm ladle:build` stylesheet (not assumed),
Tailwind emits that rule *after* the `hover:`/`active:` border rules, and all
three have equal specificity (one class + one pseudo-class/attribute
selector), so the later rule wins per the cascade — a selected button being
hovered or pressed would silently lose its hover/active border. The fix is two
**compound variants** that fire only when Selected combines with Hover/Active:
`aria-pressed:hover:border-border-hover` and
`aria-pressed:active:border-border-active`. Each compiles to a selector with
one extra pseudo-class/attribute term (three vs two), giving it strictly
higher specificity than the plain `aria-pressed:border-*` rule — so it wins
**regardless of emission order**, a guarantee from CSS specificity rules
rather than an assumption about Tailwind's internal variant sort. Grepped
compiled selectors, before and after the fix:

```
# naive (plain aria-pressed:border-* only) — aria-pressed emitted LAST, wins over hover/active:
.hover\:border-border-hover:hover{border-color:var(--color-border-hover)}
.active\:border-border-active:active{border-color:var(--color-border-active)}
.aria-pressed\:border-border-selected[aria-pressed=true]{border-color:var(--color-border-selected)}

# fixed (+ compound variants) — the two extra rules have higher specificity and win unconditionally:
.aria-pressed\:hover\:border-border-hover[aria-pressed=true]:hover{border-color:var(--color-border-hover)}
.aria-pressed\:active\:border-border-active[aria-pressed=true]:active{border-color:var(--color-border-active)}
```

Any future component that gives Selected a colour on the same property Hover/
Active already use must apply this same compound-variant pattern — don't
assume Tailwind's variant order will save you; verify against the compiled
stylesheet, per this ticket and #56 before it.

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

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-07-20, latest for #68)

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface-raised` (stone-200) | `surface-raised-hover` (stone-300) | `surface-raised-active` (stone-400) | bg unchanged, text → `text` |
| White | `surface` (white) | `surface-hover` (stone-50) | `surface-active` (stone-100) | bg unchanged, text → `text` |
| Transparent | no fill | no fill | no fill | text → `text` |
| Outline | `border` (stone-300) | `border-hover` (stone-500) | `border-active` (stone-800) | border → `border-selected` (stone-400), text → `text` |
| Distructive | `priority-urgent-bg` (red-50) | `priority-urgent-bg-hover` (red-100) | `priority-urgent-bg-active` (red-200) | identical to Default |

Text is `text-muted` in Default/Hover/Active for every style except Distructive,
which is `priority-urgent` throughout.

`Atom/Input-field`'s border ramp (node 3705:4402), for comparison — as of #68,
three of its four states are the exact same tokens as Button/Outline:

| State | Token | Value | Shared with Button/Outline? |
|---|---|---|---|
| Default | `border` | stone-300 | yes (always was) |
| Hover | `border-hover` | stone-500 | **yes, since #68** |
| Active | `border-input-active` | stone-600 | **no — the one remaining divergence** |
| Selected | `border-selected` | stone-400 | **yes, since #68** |

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

## What #68 changed in `design/tokens.json`

The user re-authored `Atom/Button`'s Outline borders; re-fetching both nodes
(3623:4346, 3705:4402) confirmed three of the four states now match between
Button/Outline and Input-field, pixel-for-pixel:

- `border-hover`: stone-400 → **stone-500** (Button/Outline's Hover moved to
  meet Input-field's existing value). `border-input-hover` **deleted** —
  `InputField.tsx` now reads the shared `border-hover`.
- `border-selected`: **new**, stone-400. Outline's Selected gained a border
  for the first time since #56 (previously "border unchanged, text only") —
  and it lands on exactly the value Input-field's Selected already used.
  `border-input-selected` **deleted** — `InputField.tsx` now reads the shared
  `border-selected`. This is **not** the same removal #56 did to the old
  `border-selected` name (that one had no consumer once Selected went
  text-only everywhere); this is a fresh, independently-fetched Figma fact
  that happens to reuse the retired name because Outline's Selected border is
  back, for real, in the current node.
- `border-active`: stone-700 → **stone-800** (Button/Outline only). Its dark
  counterpart moves stone-300 → **stone-200** — this codebase's own pick (no
  Figma dark frames exist), shifted one stone step in the opposite direction
  from the light value's shift, consistent with how `border`/`border-hover`
  already pair light/dark shades in this file.
- `border-input-active` (stone-600): **unchanged, kept** — see the rewritten
  open question below.

Button.tsx's Outline variant also gains `aria-pressed:border-border-selected`
plus two compound-variant overrides (`aria-pressed:hover:border-border-hover`,
`aria-pressed:active:border-border-active`) so Selected's new border doesn't
silently suppress Hover/Active feedback — see "Selected must compose with
Hover and Active" above for the full mechanism and the compiled-CSS evidence.

## Open questions (recorded, not resolved by guessing)

1. **MOSTLY RESOLVED (ticket #68, 2026-07-20): only Active still diverges
   between `Atom/Button`/Outline and `Atom/Input-field`.** Tickets #56 and #58
   left three states open pending Figma reconciliation. #68 re-fetched both
   nodes (3623:4346, 3705:4402) again, per the premise that the user had
   re-authored Outline's borders, and confirmed it directly rather than
   assuming: Hover now matches (both stone-500) and Selected now matches (both
   stone-400, Outline's Selected having gained a border for the first time) —
   `border-input-hover` and `border-input-selected` are deleted, and
   `InputField.tsx` now reads the shared `border-hover` / `border-selected`
   tokens Button/Outline itself uses.

   **Active is the one state that still does not line up**: Input-field's
   Active is stone-600, Button/Outline's moved to stone-800 (from stone-700) —
   confirmed side by side in the same fetch, a real, deliberate pixel
   difference, not a stale/unbound node. `border-input-active` stays under its
   own name, permanently, until a future re-fetch either aligns the two values
   or the user confirms input borders are meant to be a genuinely distinct
   role from button borders. Don't guess at this one; re-fetch and compare
   exact hex, the same way #58 and #68 both did.

   Both components' Selected → `:focus-within` (Input-field) / `aria-pressed`
   (Button) mappings remain each atom's own interpretation of Figma's state
   *names*, not something Figma's data itself asserts — still flagged for
   design confirmation, unchanged from #58.

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
5. **`Molecule/Card-content/Ingredient` (node `3727:4021`) defines no Hover
   state at all — only `Default | Active | Delete`.** Fixed in #67: `Active`
   now maps to `:active` (not `:hover`/`:focus-within`, which #20 had wrongly
   used), consistent with the `Active` = "currently being pressed" reading
   tickets #56 (`Atom/Button`) and #58 (`Atom/Input-field`) already
   established for this exact state name. But that still leaves an ingredient
   row with **no pointer (mouse-over) affordance** — hovering does nothing,
   only pressing does. This is the same class of gap already recorded above
   for `Atom/Button`'s Transparent style (open question 3), which
   `Atom/Button-toggle`'s segments inherit since they render as
   `Button variant="transparent"`. Needs a design answer, not a code guess.
6. **Sidebar (node `3674:5664`, ticket #25) invalidates this doc's own
   "no `role-selected`" assumption above.** The convention section states
   Selected deliberately gets no colour token because it only ever darkens
   text, and the change log for #56 records `surface-raised-selected` as
   *removed for lack of any consumer*. `Organism/Sidebar`'s active nav item
   is exactly that missing consumer: independently pixel-sampling the fetched
   component SET (not a single instance) shows the active item's fill sits
   at stone-300 (`surface-raised-hover`) while the sibling toggle button
   stays at stone-200 (`surface-raised`) — identically, in *both* the
   `Collapsed=No` and `Collapsed=Yes` variant components. Two independently-
   rendered variants agreeing rules out a stray hover-pointer capture (a
   theory this file's first draft floated and had to retract); it is real,
   deliberate design, and it carries a persistent **fill**, not just a text
   colour. `Sidebar.tsx` currently ships this by reusing
   `surface-raised-hover` for that persistent state (`Atom/Button` +
   Tailwind's `!` important modifier, since composing an unmodified atom
   still needs *some* way to win the specificity tie against the variant's
   own default fill) — a stopgap that produces the right pixels, not a
   permanent answer, since it means "resting" and "hovering" render
   identically for that one item (see open questions 3/5 above for the same
   missing-hover-affordance family). The real fix is a dedicated
   selected-fill token (e.g. something in a `role-selected` family this doc
   currently says shouldn't exist) — needs a design decision on whether
   Selected-with-fill is a one-off for nav-style components or means the
   "no `role-selected`" rule above needs qualifying, not a code-side guess.

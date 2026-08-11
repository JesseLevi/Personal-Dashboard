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
`text-primary`. A `*-selected` colour token would have no value to hold.

How a component reads them:

- base case → `role`
- `:hover` → `hover:bg-role-hover` / `hover:border-role-hover`
- `:active` → `active:bg-role-active` / `active:border-role-active`
- Selected → `aria-pressed:text-text-primary`

### Selected must compose with Hover and Active

A selected button still reacts to the pointer. This is a product requirement.
For every style except `Atom/Button`'s Outline, it works only because the two
concerns touch **disjoint CSS properties**: Selected sets `color`, Hover/Active
set `background-color`/`border-color`. Never add an `aria-pressed:bg-*`
override to Filled/White/Transparent/Distructive — that re-introduces the
conflict and silently kills the hover feedback on selected items.

**Outline is the one deliberate exception (ticket #68).** Figma re-authored
Outline's Selected state to carry a real border colour (`stroke-primary-selected`),
which is the same property Hover/Active already use there — the disjoint-
properties trick no longer applies to this one style. A plain
`aria-pressed:border-stroke-primary-selected` override is **not** safe on its own:
verified against the compiled `pnpm ladle:build` stylesheet (not assumed),
Tailwind emits that rule *after* the `hover:`/`active:` border rules, and all
three have equal specificity (one class + one pseudo-class/attribute
selector), so the later rule wins per the cascade — a selected button being
hovered or pressed would silently lose its hover/active border. The fix is two
**compound variants** that fire only when Selected combines with Hover/Active:
`aria-pressed:hover:border-stroke-primary-hover` and
`aria-pressed:active:border-stroke-secondary-active`. Each compiles to a selector with
one extra pseudo-class/attribute term (three vs two), giving it strictly
higher specificity than the plain `aria-pressed:border-*` rule — so it wins
**regardless of emission order**, a guarantee from CSS specificity rules
rather than an assumption about Tailwind's internal variant sort. Grepped
compiled selectors, before and after the fix:

```
# naive (plain aria-pressed:border-* only) — aria-pressed emitted LAST, wins over hover/active:
.hover\:border-stroke-primary-hover:hover{border-color:var(--color-stroke-primary-hover)}
.active\:border-stroke-secondary-active:active{border-color:var(--color-stroke-secondary-active)}
.aria-pressed\:border-stroke-primary-selected[aria-pressed=true]{border-color:var(--color-stroke-primary-selected)}

# fixed (+ compound variants) — the two extra rules have higher specificity and win unconditionally:
.aria-pressed\:hover\:border-stroke-primary-hover[aria-pressed=true]:hover{border-color:var(--color-stroke-primary-hover)}
.aria-pressed\:active\:border-stroke-secondary-active[aria-pressed=true]:active{border-color:var(--color-stroke-secondary-active)}
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
  See Distructive below, whose text never changes.

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-07-27/28, latest for #112)

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface-secondary` (stone-200) | `surface-secondary-hover` (stone-300) | `surface-secondary-active` (stone-400) | bg unchanged, text → `text-primary` |
| White | `surface-highlight-white` (white) | `surface-highlight-white-selected` (stone-100, borrowed — see #112 below) | `surface-secondary` (stone-200, borrowed) | bg unchanged, text → `text-primary` |
| Transparent | no fill | `surface-secondary` (stone-200, borrowed) | `surface-secondary-hover` (stone-300, borrowed) | no fill, text → `text-primary` |
| Outline | `stroke-primary` (stone-300) | `stroke-primary-hover` (stone-500) | `stroke-secondary-active` (stone-800) | border → `stroke-primary-selected` (stone-400), text → `text-primary` |
| Distructive | `priority-urgent-bg` (red-50) | `priority-urgent-bg-hover` (red-100) | `priority-urgent-bg-active` (red-200) | identical to Default |

**#107 (2026-07-26):** Transparent gained real Hover/Active fills in Figma — previously it had none at all (`docs/open-questions.md#no-pointer-affordance` predates this and is updated accordingly). At the time the two exact pixels (stone-100, stone-200) were already named tokens for *other* roles (White's Active, Filled's Default) — per the token-gap rule above, reused as-is rather than given dedicated names.

**#112 (2026-07-27/28), supersedes #107's White/Transparent values only** (Filled/Outline/Distructive re-diffed against a fresh hex table and confirmed unchanged): White and Transparent both moved one step darker on Hover/Active — White Hover `stone-50→stone-100`, White Active `stone-100→stone-200`; Transparent Hover `stone-100→stone-200`, Transparent Active `stone-200→stone-300`. Same reuse rule applied again (`hover:bg-surface-highlight-white-selected active:bg-surface-secondary` for White, `hover:bg-surface-secondary active:bg-surface-secondary-hover` for Transparent) rather than editing `surface-hover`/`surface-highlight-white-selected`'s own values, which also back `CardDetailPanel.tsx`'s unrelated option-row hover states. **New flagged gap**: `surface-highlight-white-selected`'s dark value (stone-700) is now lighter than `surface-secondary`'s (stone-800), so White's dark-mode Hover reads lighter than its Active — backwards from the light-mode direction. No Figma dark frames exist for this node (`docs/open-questions.md#dark-mode-is-placeholder-only`), so this is a side effect of this round's token reuse, not a Figma fact — flagged, not fixed. Whether Transparent/White warrant their own dedicated token pairs remains the open token-scale question for the user. Full evidence: `design/notes/Button.md`.

Text is `text-secondary` in Default/Hover/Active for every style except Distructive,
which is `priority-urgent` throughout.

`Atom/Input-field`'s border ramp (node 3705:4402), for comparison — as of #68,
three of its four states are the exact same tokens as Button/Outline:

| State | Token | Value | Shared with Button/Outline? |
|---|---|---|---|
| Default | `stroke-primary` | stone-300 | yes (always was) |
| Hover | `stroke-primary-hover` | stone-500 | **yes, since #68** |
| Active | `stroke-primary-active` | stone-600 | **no — the one remaining divergence** |
| Selected | `stroke-primary-selected` | stone-400 | **yes, since #68** |

## Token change log

Per-ticket records of what changed in `design/tokens.json` and why live in
`docs/incidents.md` (see the "Token changes" entries). They are history: read
them when a token's current value looks wrong or arbitrary, not before every
styling task.

## Open questions

The canonical list is `docs/open-questions.md`. One bears directly on this
doc's rules —
[`button-vs-input-active-border`](open-questions.md#button-vs-input-active-border),
which is why `stroke-primary-active` still exists as a component-scoped token.
Reference it by slug, never by number.

(`selected-needs-a-fill-token` used to be listed here too: `Organism/Sidebar`'s
active nav item was believed to be a deliberate persistent fill on top of
Selected, requiring a token the "no `role-selected`" rule above doesn't allow.
Re-fetching the node 2026-07-22 showed the active instance had been authored
on Button's Hover state by mistake; corrected in Figma, it resolves to
Button's ordinary Selected state — text-only, no fill — so the question is
resolved and removed. See `docs/incidents.md`.)

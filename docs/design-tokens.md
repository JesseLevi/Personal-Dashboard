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
  See Distructive below, whose text never changes.

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-07-26, latest for #107)

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface-raised` (stone-200) | `surface-raised-hover` (stone-300) | `surface-raised-active` (stone-400) | bg unchanged, text → `text` |
| White | `surface` (white) | `surface-hover` (stone-50) | `surface-active` (stone-100) | bg unchanged, text → `text` |
| Transparent | no fill | `surface-active` (stone-100, borrowed — see #107 below) | `surface-raised` (stone-200, borrowed) | no fill, text → `text` |
| Outline | `border` (stone-300) | `border-hover` (stone-500) | `border-active` (stone-800) | border → `border-selected` (stone-400), text → `text` |
| Distructive | `priority-urgent-bg` (red-50) | `priority-urgent-bg-hover` (red-100) | `priority-urgent-bg-active` (red-200) | identical to Default |

**#107 (2026-07-26):** Transparent gained real Hover/Active fills in Figma — previously it had none at all (`docs/open-questions.md#no-pointer-affordance` predates this and is updated accordingly). The two exact pixels (stone-100, stone-200) are already named tokens for *other* roles (White's Active, Filled's Default) — per the token-gap rule above, they're reused as-is (`hover:bg-surface-active active:bg-surface-raised`) rather than given dedicated names; whether Transparent warrants its own `surface-transparent-*` pair is an open token-scale question for the user, not decided here. Full evidence: `design/notes/Button.md`.

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

## Token change log

Per-ticket records of what changed in `design/tokens.json` and why live in
`docs/incidents.md` (see the "Token changes" entries). They are history: read
them when a token's current value looks wrong or arbitrary, not before every
styling task.

## Open questions

The canonical list is `docs/open-questions.md`. One bears directly on this
doc's rules —
[`button-vs-input-active-border`](open-questions.md#button-vs-input-active-border),
which is why `border-input-active` still exists as a component-scoped token.
Reference it by slug, never by number.

(`selected-needs-a-fill-token` used to be listed here too: `Organism/Sidebar`'s
active nav item was believed to be a deliberate persistent fill on top of
Selected, requiring a token the "no `role-selected`" rule above doesn't allow.
Re-fetching the node 2026-07-22 showed the active instance had been authored
on Button's Hover state by mistake; corrected in Figma, it resolves to
Button's ordinary Selected state — text-only, no fill — so the question is
resolved and removed. See `docs/incidents.md`.)

# Design tokens: per-state colour convention (ADR-0010)

Read on demand from `CLAUDE.md` → "Design tokens". This file records the convention
every component's state colours follow, plus the concrete matrix behind it.

History: ticket #52 introduced a three-state tier (Default/Hover/Selected).
Ticket #56 superseded it — Figma added a fourth state and redistributed the
values, and Selected stopped carrying any colour (text-only). **Ticket #204
supersedes that in turn**: Figma's own variables prove Selected has a real
fill/border on most styles after all — the earlier "no `role-selected`" reading
came from a state-binding bug (see below), not from Figma's actual design.
What follows is the current state of the world, on **variable names**, not hex
— every value here traces to a `figmaVariableId` in `design/tokens.json`.

## The convention

For every semantic colour **role** with Figma-defined state variation, model it as
separate tokens — never one token reused across states:

```
role            — Default
role-hover      — Hover     (pointer over)
role-active     — Active    (being pressed)
role-selected   — Selected  (persistently chosen, aria-pressed / :focus-within)
```

`role-selected` is real where Figma's variable graph defines one (see the
matrix below); a style whose Selected state has no Figma variable of its own
(Distructive's *text*, Transparent's fill) still gets no token invented for it
— "no colour" is itself a fact worth modelling accurately, same as "has a
colour."

How a component reads them:

- base case → `role`
- `:hover` → `hover:bg-role-hover` / `hover:border-role-hover`
- `:active` → `active:bg-role-active` / `active:border-role-active`
- Selected → `aria-pressed:bg-role-selected` / `aria-pressed:border-role-selected` /
  `aria-pressed:text-text-primary` (`Atom/Input-field` uses `:focus-within` in
  place of `aria-pressed` — see the matrix below)

### Selected must compose with Hover and Active

A selected button still reacts to the pointer. This is a product requirement.
Where Selected and Hover/Active touch **disjoint CSS properties** (Distructive's
text, Transparent generally), no special handling is needed. Where Selected
lands on the **same property** Hover/Active already use — `Atom/Button`'s
Outline (`border-color`, since #68) and, as of #204, White and Distructive
(`background-color`) — a plain `aria-pressed:bg-*`/`border-*` override is
**not safe on its own**: verified against the compiled `pnpm ladle:build`
stylesheet each time (not assumed), Tailwind emits that plain rule *after*
the `hover:`/`active:` rules, and all three have equal specificity (one class
+ one pseudo-class/attribute selector), so the later rule wins per the
cascade — a selected control being hovered or pressed would silently lose its
hover/active feedback. The fix is always the same two **compound variants**,
firing only when Selected combines with Hover/Active — e.g. for White:
`aria-pressed:hover:bg-surface-highlight-white-hover` and
`aria-pressed:active:bg-surface-highlight-white-active`. Each compiles to a
selector with one extra pseudo-class/attribute term (three class-level terms
vs two), giving it strictly higher specificity than the plain
`aria-pressed:*` rule — so it wins **regardless of emission order**, a
guarantee from CSS specificity rules rather than an assumption about
Tailwind's internal variant sort. Grepped compiled selectors (`Atom/Button`
White, #204 — Outline's border-color case from #68 follows the identical
shape, just on `border-*`):

```
# plain rules — hover:/active:/aria-pressed: emitted in that order, plain aria-pressed LAST, would win over hover/active:
.hover\:bg-surface-highlight-white-hover:hover{background-color:var(--color-surface-highlight-white-hover)}
.active\:bg-surface-highlight-white-active:active{background-color:var(--color-surface-highlight-white-active)}
.aria-pressed\:bg-surface-highlight-white-selected[aria-pressed=true]{background-color:var(--color-surface-highlight-white-selected)}

# + compound variants — the two extra rules have higher specificity and win unconditionally:
.aria-pressed\:hover\:bg-surface-highlight-white-hover[aria-pressed=true]:hover{background-color:var(--color-surface-highlight-white-hover)}
.aria-pressed\:active\:bg-surface-highlight-white-active[aria-pressed=true]:active{background-color:var(--color-surface-highlight-white-active)}
```

Any future component that gives Selected a colour on the same property Hover/
Active already use must apply this same compound-variant pattern — don't
assume Tailwind's variant order will save you; verify against the compiled
stylesheet, per #204, #68 and #56 before them.

### `:active` vs `aria-pressed` — both, for different things

CSS `:active` means "currently being pressed" (transient). `aria-pressed` means
"is the chosen one" (persistent). Figma's `Active` state is the former and its
`Selected` state the latter, so both hooks are used, deliberately.

Ticket #42 once removed `active:` from `Atom/Button`; that was correct *at the
time* because it was being misused for the persistent state. Don't read that
history as a ban on `:active`.

### Other rules

- **Never** use a `dark:` utility, a raw hex, or a one-off value for a state
  colour. Every light AND dark value now traces to a real Figma variable
  (`figmaVariableId` in `design/tokens.json`, cross-checked against
  `design/figma-variables/Semantics _ Style_{Light,Dark}.tokens.json` —
  `pnpm check:tokens-drift` enforces the match). Where Figma's own dark data
  produces something that looks wrong (a state collapsing to its Default, an
  escalation reading backwards), that's Figma's fact, not this codebase's —
  see `docs/open-questions.md#dark-mode-is-placeholder-only` for the two
  currently-accepted cases.
- If Figma defines no variation for a role in some state, **don't invent one**.
  See Distructive's text below, which never changes.

## The state matrix (`Atom/Button`, node 3623:4346, re-fetched 2026-08-11 for #204 — per-state node-by-node, not read off the component set as a whole)

Named by Figma variable path (`design/tokens.json`'s `figma` field), not hex —
resolve a name against that file for its current value.

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface/secondary/default` | `surface/secondary/hover` | `surface/secondary/active` | bg unchanged, text → `text/base/primary` |
| White | `surface/highlight/white/default` | `surface/highlight/white/hover` | `surface/highlight/white/active` | bg → `surface/highlight/white/selected`, text → `text/base/primary` |
| Transparent | no fill | `surface/highlight/white/hover` | `surface/highlight/white/active` | no fill, text → `text/base/primary` |
| Outline | `Stroke/primary/default` | `Stroke/primary/hover` | `Stroke/secondary/active` | border → `Stroke/primary/selected`, text → `text/base/primary` |
| Distructive | `surface/highlight/red/default` | `surface/highlight/red/hover` | `surface/highlight/red/active` | bg → `surface/highlight/red/selected`, text unchanged |

**#204 (2026-08-11) — state-binding fix, supersedes #112's White/Distructive column.** #112 (and #107 before it) diffed a hex table read off the fetched component set as a whole and got White/Distructive's Hover/Active/Selected one column wrong: Figma's own per-node variable binding proves the ramp is `default -> selected -> hover -> active`, and the two mis-bound nodes were shifted — what #112 recorded as White's "Hover" (stone-100) is actually Figma's `selected` variable's value; what it recorded as "Active" (stone-200) is `hover`'s value. Confirmed per state, per style, by fetching each of the 8 individual `Style=X, State=Y` nodes with `get_variable_defs` rather than reading a batch hex table — see `design/notes/Button.md`'s #204 entry for the full node-by-node table and the cross-check against `design/figma-variables/`. White and Distructive both gain real dedicated Hover/Active/Selected tokens for the first time (`surface-highlight-white-hover/-active`, `surface-highlight-red-selected`/`priority-urgent-bg-selected`) instead of borrowing another role's token pixel-for-pixel — the borrowing is *why* the bug was invisible in light mode (the borrowed pixels happened to be numerically correct even though the wrong variable backed them; dark mode is where the borrow and the correct binding diverge, see `design/notes/Button.md`).

**Transparent measured independently, not assumed from matching pixels**: its own fetched Hover/Active nodes are bound to the same `surface/highlight/white/hover|active` variables Button/White reads (not `surface/secondary/*`, which shares only the light-mode hex) — real rebind, dark values differ (`design/notes/Button.md`).

Text is `text-secondary` in Default/Hover/Active for every style except Distructive
(`priority-urgent` throughout, including Selected — its text never changes, only
the fill is new as of #204).

`Atom/Input-field`'s border ramp (node 3705:4402) — three of its four states are
the exact same Figma variable as Button/Outline (confirmed #68, reconfirmed #204):

| State | Variable | Shared with Button/Outline? |
|---|---|---|
| Default | `Stroke/primary/default` | yes (always was) |
| Hover | `Stroke/primary/hover` | **yes, since #68** |
| Active | `Stroke/primary/active` | **no — Button/Outline's Active is `Stroke/secondary/active`, a different variable** |
| Selected | `Stroke/primary/selected` | **yes, since #68** |

Active is not a stale/unbound node and not a mistake to reconcile — #204
confirmed both nodes side by side: `Stroke/primary/*` and `Stroke/secondary/*`
are genuinely two different Figma variable collections, each correctly bound
where it's used. See the closed `button-vs-input-active-border` entry in
`docs/open-questions.md`'s "Resolved and removed" section.

## Token change log

Per-ticket records of what changed in `design/tokens.json` and why live in
`docs/incidents.md` (see the "Token changes" entries). They are history: read
them when a token's current value looks wrong or arbitrary, not before every
styling task.

## Open questions

The canonical list is `docs/open-questions.md`. `dark-mode-is-placeholder-only`
bears directly on this doc's dark-value rule above — reference it by slug,
never by number.

(`selected-needs-a-fill-token` used to be listed here too: `Organism/Sidebar`'s
active nav item was believed to be a deliberate persistent fill on top of
Selected, requiring a token the old "no `role-selected`" rule — since #204,
no longer this file's rule — didn't allow. Re-fetching the node 2026-07-22
showed the active instance had been authored on Button's Hover state by
mistake; corrected in Figma, it resolves to Button's ordinary Selected state
— text-only, no fill — so the question was resolved and removed at the time.
See `docs/incidents.md`. `button-vs-input-active-border` is the more recent
entry in that same "resolved and removed" list, closed by #204 above.)

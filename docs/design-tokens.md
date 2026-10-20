# Design tokens: per-state colour convention (ADR-0010)

Read on demand from `docs/guides/ui-components.md` → "Tokens". This file records the convention
every component's state colours follow, plus the concrete matrix behind it.

History: ticket #52 introduced a three-state tier (Default/Hover/Selected).
Ticket #56 superseded it — Figma added a fourth state and redistributed the
values, and Selected stopped carrying any colour (text-only). Ticket #204
believed Figma's own variables proved Selected had gained a real fill/border
on White and Distructive too (Outline already had one, since #68) — **ticket
#213 corrects that: #204 was itself the bug.** #204 assumed a ramp step's
*name* (`default`/`selected`/`hover`/`active`) always matches the CSS *state*
it renders in; true for Filled/Outline/Transparent, false for White and
Distructive, whose Hover/Active nodes are genuinely bound to the `selected`/
`hover` steps respectively (see "Ramp step name ≠ CSS state name" below).
#204 "fixed" a shift that never existed and introduced a real one, which
shipped past every gate — see `docs/incidents.md`'s corrected #204 entry.
What follows is the current, #213-verified state of the world, on **variable
names**, not hex — every value here traces to a `figmaVariableId` in
`design/tokens.json`, and every White/Distructive binding below was measured
per individual state node via the figma-console-mcp bridge (`figma.variables`
+ `boundVariables`), not read off a swatch order or a batch report.

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
matrix below — today, only Outline's border); a style whose Selected state
has no Figma variable of its own (White/Distructive's *fill*, as corrected by
#213; Distructive's *text*; Transparent's fill) still gets no token invented
for it — "no colour" is itself a fact worth modelling accurately, same as
"has a colour." White and Distructive *do* still have dedicated
`-hover`/`-active`/`-selected` tokens in `design/tokens.json` (added #204) —
the `-selected` one is real, it's just that no CSS *state* on these two
styles reads it as its own Selected fill; see "Ramp step name ≠ CSS state
name" below for which state actually consumes it.

How a component reads them:

- base case → `role`
- `:hover` → `hover:bg-role-hover` / `hover:border-role-hover`
- `:active` → `active:bg-role-active` / `active:border-role-active`
- Selected → `aria-pressed:bg-role-selected` / `aria-pressed:border-role-selected` /
  `aria-pressed:text-text-primary` (`Atom/Input-field` uses `:focus-within` in
  place of `aria-pressed` — see the matrix below)

### Ramp step name ≠ CSS state name

A Figma colour ramp's step names (`default`/`selected`/`hover`/`active`) are
not guaranteed to line up with the CSS state that renders them. For Filled,
Outline and Transparent they do — each state's fetched node binds the
like-named step. **White and Distructive are the exception, confirmed
#213 by fetching each state's own node and reading its `boundVariables`
directly**, not inferred from position in a swatch strip or a batch report:
their Selected node binds the `default` step (no colour change at all, same
as every other state's Default), their **Hover** node binds the `selected`
step, and their **Active** node binds the `hover` step. That is the one
genuine offset in this file — every other role/style/state combination binds
its own like-named variable.

Because token *names* stay the Figma mirror (`docs/guides/ui-components.md`,
#203 — never renamed to fake an alignment with the CSS state), the offset
lives in the **consumer**: `Button.tsx`'s White/Distructive entries bind
`hover:` to the `-selected` token and `active:` to the `-hover` token, with a
comment pointing back here. Don't "fix" this into name-matches-state — that
is exactly the mistake #204 made (see `docs/incidents.md`'s corrected entry)
and #213 reverted.

### Selected must compose with Hover and Active

A selected button still reacts to the pointer. This is a product requirement.
Where Selected and Hover/Active touch **disjoint CSS properties** — Distructive's
text (unaffected by Hover/Active, which are background-only), Transparent
generally, and, as of #213's correction above, White and Distructive too
(neither has a Selected fill at all, so there is nothing on `background-color`
to conflict with Hover/Active) — no special handling is needed. Where Selected
lands on the **same property** Hover/Active already use — today that is only
`Atom/Button`'s Outline (`border-color`, since #68) — a plain
`aria-pressed:bg-*`/`border-*` override is **not safe on its own**: verified
against the compiled `pnpm ladle:build` stylesheet each time (not assumed),
Tailwind emits that plain rule *after* the `hover:`/`active:` rules, and all
three have equal specificity (one class + one pseudo-class/attribute
selector), so the later rule wins per the cascade — a selected control being
hovered or pressed would silently lose its hover/active feedback. The fix is
always the same two **compound variants**, firing only when Selected combines
with Hover/Active — for Outline:
`aria-pressed:hover:border-stroke-primary-hover` and
`aria-pressed:active:border-stroke-secondary-active`. Each compiles to a
selector with one extra pseudo-class/attribute term (three class-level terms
vs two), giving it strictly higher specificity than the plain
`aria-pressed:*` rule — so it wins **regardless of emission order**, a
guarantee from CSS specificity rules rather than an assumption about
Tailwind's internal variant sort. Grepped compiled selectors (`Atom/Button`
Outline, re-verified #213 against the post-fix `pnpm ladle:build` output):

```
# plain rules — hover:/active:/aria-pressed: emitted in that order, plain aria-pressed LAST, would win over hover/active:
.hover\:border-stroke-primary-hover:hover{border-color:var(--color-stroke-primary-hover)}
.active\:border-stroke-secondary-active:active{border-color:var(--color-stroke-secondary-active)}
.aria-pressed\:border-stroke-primary-selected[aria-pressed=true]{border-color:var(--color-stroke-primary-selected)}

# + compound variants — the two extra rules have higher specificity and win unconditionally:
.aria-pressed\:hover\:border-stroke-primary-hover[aria-pressed=true]:hover{border-color:var(--color-stroke-primary-hover)}
.aria-pressed\:active\:border-stroke-secondary-active[aria-pressed=true]:active{border-color:var(--color-stroke-secondary-active)}
```

**#204 believed White and Distructive needed this same pattern on
`background-color` and shipped compound variants for them — #213 removed
those**: their Selected state has no fill at all (see "Ramp step name ≠ CSS
state name" above), so there was never a same-property conflict to guard
against on those two styles. Any future component that gives Selected a
colour on the same property Hover/Active already use must apply this
compound-variant pattern — measured per state node, never assumed from a
name match — and verify against the compiled stylesheet, per #213, #68 and
#56 before them.

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
  currently-accepted cases. **One user-directed exception, #222:**
  `stroke-primary`'s dark value deliberately overrides Figma's own stone-700
  with stone-600 (Checkbox's border was invisible against its dark surface),
  recorded via `$pendingFigmaValue.dark` + a `$comment` on the token itself —
  a permanent departure, not an open re-sync item. See
  `design/notes/Checkbox.md`'s #222 entry. **Second user-directed exception
  (2026-10-20):** the red/blue/green/yellow `text-highlight-*` and
  `surface-highlight-*` tokens (Tag, Destructive button, error text) take
  the agenda alert palette in dark (surface 950, text 200; red ramp
  950 → 900 → 800) instead of Figma's light pastels, same
  `$pendingFigmaValue.dark` shape. Separately, #222 also added
  `overlay` — a codebase-only scrim token (`figma: null`, no per-state
  variation) backing `SidePanel`/`AppShellNav`'s dark scrims; out of this
  file's per-state scope, see `design/notes/SidePanel.md` and
  `design/notes/Sidebar.md`'s own #222 entries.
- If Figma defines no variation for a role in some state, **don't invent one**.
  See Distructive's text below, which never changes.

## The state matrix (`Atom/Button`, node 3623:4346, re-measured 2026-08-12 for #213 and 2026-08-13 for #238 via the figma-console-mcp bridge — per-state node, not read off the component set as a whole or off a batch report)

Named by Figma variable path (`design/tokens.json`'s `figma` field), not hex —
resolve a name against that file for its current value. Where a style's Hover/
Active *state* binds a differently-named ramp *step* (White, Distructive —
see "Ramp step name ≠ CSS state name" above), both are shown: `state ← step`.

| Style | Default | Hover | Active | Selected |
|---|---|---|---|---|
| Filled | `surface/secondary/default` | `surface/secondary/hover` | `surface/secondary/active` | bg unchanged, text → `text/base/primary` |
| White | `surface/highlight/white/default` | Hover ← `.../selected` (stone-100) | Active ← `.../hover` (stone-200) | bg unchanged (reads `.../default`), text → `text/base/primary` |
| Transparent | no fill | `surface/secondary/hover` | `surface/secondary/active` | no fill, text → `text/base/primary` |
| Outline | `Stroke/primary/default` | `Stroke/primary/hover` | `Stroke/secondary/active` | border → `Stroke/primary/selected`, text → `text/base/primary` |
| Distructive | `surface/highlight/red/default` | Hover ← `.../selected` (red-100) | Active ← `.../hover` (red-200) | bg unchanged (reads `.../default`), text unchanged |

**#213 (2026-08-12) — corrects #204's state-binding regression.** #204
assumed a ramp step's name always equals the CSS state it's used in and
"corrected" White/Distructive's Hover/Active/Selected onto that assumption —
which was wrong. Re-measured per individual state node via the
figma-console-mcp plugin bridge (`figma.variables` + `boundVariables`,
WebSocket, local, no Starter-plan rate limit), not a swatch order or a
report: White and Distructive's Selected node binds the **`default`** step
(no fill change at all — identical to every other state's own Default), their
Hover node binds the **`selected`** step, and their Active node binds the
**`hover`** step. `git show 565a43d:components/atoms/Button.tsx` (pre-#204)
already had this right; #204 shifted it and shipped the shift as a fix. Token
*names* are unchanged from #204 (`surface-highlight-white-hover/-active/-selected`,
`surface-highlight-red-hover/-active/-selected` all still exist, still trace
to their own like-named Figma path) — only `Button.tsx`'s class list, which
now binds `hover:` to the `-selected` token and `active:` to the `-hover`
token for these two styles, changed. See `design/notes/Button.md`'s #213
entry for the full node-by-node table and `docs/incidents.md`'s corrected
#204 entry for why the original mistake shipped past every gate.

**#204 (2026-08-11) — original (incorrect) state-binding change, historical context only.** #204 believed #112's (and #107's) hex table had misread a `default -> selected -> hover -> active` ramp as `default -> hover -> active`, and rebound White/Distructive's Hover/Active/Selected accordingly. It also added the dedicated `surface-highlight-white-hover/-active` and `surface-highlight-red-selected`/`priority-urgent-bg-selected` tokens, which #213 keeps (the tokens are real and correctly named — see the matrix above for which state now actually reads which one).

**Transparent's Hover/Active fill binding changed again in #238 (2026-08-13)** — the Figma authors rebound it a second time, off the White ramp #204 found and onto the Filled/`surface/secondary/hover|active` ramp instead (measured per-node via the figma-console-mcp bridge, not inferred from pixels — both light and dark values genuinely differ between the two ramps, confirmed against `design/tokens.json`, so this is a real visual change, not a no-op rename). Historical note, no longer current: #204 originally found Transparent's own fetched Hover/Active nodes bound to the same `surface/highlight/white/hover|active` variables Button/White reads (not `surface/secondary/*`, which back then shared only the light-mode hex) — that binding held through #213 and was superseded by #238. Full node table: `design/notes/Button.md`'s #238 entry.

Text is `text-secondary` in Default/Hover/Active for every style except Distructive
(`priority-urgent` throughout, including Selected — its text never changes,
and, as corrected by #213, neither does its Selected fill).

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

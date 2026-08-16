# Button/Toggle

- **Code:** `components/molecules/ButtonToggle.tsx` (moved from `components/atoms/`, #265)
- **Node ID:** `4160:33335` (moved from `3623:4345`, #265 — the old node is now orphaned in Figma, no parent)

## TICKET #265 (2026-08-16): rebuilt from scratch as a molecule

The ticket was explicit: **do not reuse or adapt the old atom** (below,
history kept for the record). New Figma node `4160:33335`
(Development > Molecules > Toggles) is a different component: an optional
`Titel#4160:0` boolean + a `Container` holding an `ActiveBackground`
rectangle and a `Slot` of nested `Button` instances that carry **visible
text labels** (`Systeem`/`Licht`/`Donker`, the real Kleurenthema caller —
`SettingsPanel.tsx`), not the old atom's icon-only, uniform-32px segments.
That single fact invalidates the old mechanism: variable-width text segments
mean the indicator's per-step offset can't be a static lookup table anymore
(there is no fixed step size), so it's measured off the DOM at runtime
instead — `containerRef`/`indicatorRef`, `useLayoutEffect` (not a plain
effect, so the first position is computed before paint, no flash-at-0×0),
plus a `ResizeObserver` on the row for reflows the value/items effect
wouldn't catch (font load, a responsive parent resize). Both the indicator's
position (`transform: translate(x, y)`) and its size (`width`/`height`) are
written imperatively via `indicatorRef.current.style.*` — the same pattern
`SidePanel.tsx`'s drag-to-close already uses for a genuinely continuous,
Tailwind-JIT-unrepresentable value (arbitrary runtime pixels can't be a
static class string), not a new exception to the "Tailwind utilities only"
house style.

**Measured via `figma_execute`/`boundVariables`, not the hosted MCP** (rate-limited, per `docs/guides/ui-components.md`):

| Element | Node | Binding | Class |
|---|---|---|---|
| Root gap (Titel → Container) | `4160:33335` | `itemSpacing` → `spacing/stack/stack-sm` | `gap-stack-sm` |
| Container padding/gap | `4160:33296` | `padding*`/`itemSpacing` → `spacing/component/padding-xs` | `p-component-xs` (gap: see below) |
| Container radius | `4160:33296` | `topLeftRadius` etc → `radius/card` | `rounded-card` (**not** `radius/control-outer` — different token, same 12px value; verified per-node, not inferred, per the "two pairs alias the same primitive" trap `docs/design-tokens.md` already documents) |
| Container fill | `4160:33296` | `fills` → `color/surface/highlight/white/default` | `bg-surface-highlight-white` |
| ActiveBackground radius | `4160:33297` | `topLeftRadius` etc → `radius/control` | `rounded-control` |
| ActiveBackground fill | `4160:33297` | **unbound** — `rgb(217,217,217)` / `#D9D9D9` | `bg-surface-secondary` (flagged, see below) |
| Title text style | `4160:33295` | `text-base/semibold`, fill `#79716B` (stone-500) | `text-base font-semibold text-text-secondary` (matches `InputField`/`Dropdown`'s own label styling) |

**ActiveBackground's fill is a flagged gap, not a Figma design decision.**
`rgb(217,217,217)`/`#D9D9D9` binds no variable and matches no Tailwind stone
step (`stone-200` is `#E7E5E4`, `stone-300` is `#D6D3D1` — neither is exact).
`#D9D9D9` is Figma's own default fill for a newly drawn shape with no
style/variable ever applied — strong circumstantial evidence this rectangle
was never actually styled, not that grey is the deliberate design. Reused
`surface-secondary` (stone-200) as the nearest existing "static neutral
surface" role token per the "correct-pixels-or-flag, never invent" rule —
close enough visually (a few percent off per channel) that the difference
would not be noticed without a colour picker, and semantically the right
role (a static, non-hover, non-selected background) versus the pixel-closer
but role-mismatched `surface-secondary-hover` (stone-300, a hover-state
token with no business backing a permanently-rendered element). Flag stands
until Figma applies a real fill.

**The Slot's own inter-segment gap (4px, x-positions 0/121.33/242.67 in the
one measured instance) has no bound Figma variable either** — the Slot is
`layoutMode: NONE` (children manually positioned, not itemSpacing-driven),
so there is no node whose `boundVariables` this could read. Modelled as a
real flex `gap-inline-xs` (4px) between `Button` instances so segments lay
out and reflow like actual flex children (required for variable-width
labels) rather than Figma's static absolute positions.

**Accessibility unchanged from the old atom**: `role="radiogroup"` +
`role="radio"`/`aria-checked` with roving `tabIndex` and Left/Right/Up/Down/
Home/End arrow-key selection (WAI-ARIA Radio Group pattern,
https://www.w3.org/WAI/ARIA/apg/patterns/radio/) — still "exactly one of N",
still not the `aria-pressed`/toolbar idiom. `defaultValue` is still required
(no Figma sample shows an all-unselected track). Segments still render
`variant="transparent"` with the same `hover:bg-transparent!
active:bg-transparent!` suppression and the same reasoning as the old atom's
#107 entry below (segments must stay fill-less so they never paint over the
indicator) — Figma's new node still gives segments no State axis of their
own (`Style=Transparent, State=Default` on every sampled instance, no
hover/active override visible), so the same suppression trap applies
unchanged. `motion-reduce:transition-none` on the indicator's
transform/width/height transition, same precedent.

**Title is optional, type-coupled to the accessible name** — same
required-one-of idiom as `Dropdown`'s `label`/`id`: `title` (visible,
generates its own id via `useId()`, radiogroup gets `aria-labelledby`) XOR
`aria-label` (no visible title). Figma's `Titel` boolean defaults on but the
component still needs a no-title path (matches the old atom's own
`aria-label`-only story precedent, `TeDoenHeader`-style toolbar usage).

**Full-width/equal-segment bugfix (post-#265, `fix/account-dropdown-clicks`).**
Shipped with the old atom's `w-fit self-start` reasoning left on the root and
`role="radiogroup"` container, plus no width rule on the segments — measured
in the running app (SettingsPanel, 400px panel/368px content column): the
track rendered 318px against the `InputField` below it at 368px, and the
three segments were unequal (114/86/103px, i.e. hug-width per label). Root
cause: `4160:33335` is a genuinely different component from the retired
`3623:4345` — `boundVariables` confirmed the component root is
`layoutSizingHorizontal: FIXED` w=368 with `layoutGrow: 1`, `Container` (the
track) is `hSize: FILL`/`layoutAlign: STRETCH`, and each of the three
`Button/Default` segments in the Slot is `layoutGrow: 1`, rendering exactly
117px regardless of label length — same values confirmed on both panel
instances (`4160:33400` in `4160:33196`, `4160:34265` in `4160:34064`). Fix:
root and track both go `w-full` (track also drops `inline-flex`/`self-start`
for plain `flex`), each segment gets `grow basis-0`. `grow`/`basis-0` were
chosen over the shorthand `flex-1` specifically to avoid contesting
`Button.tsx`'s own `shrink-0` (#80) — same shorthand-vs-longhand
emission-order hazard `docs/guides/ticket-workflow.md` records for
`px-3`/`pr-4`, sidestepped entirely since neither `grow` nor `basis-0`
touches `flex-shrink`. Re-measured after the fix in the running app: track
368px (matches `InputField`), all three segments 117.33px (three equal
thirds after the 2×4px inline gap), indicator still lands exactly on the
active segment. `ButtonToggle.stories.tsx` wraps each story in a
`w-[368px]` box (the real caller's content width) instead of a bare
`items-start` flex-col, since a FILL-designed component stretching to an
unconstrained canvas width demonstrates nothing.

**New Ladle story, new baselines.** `ButtonToggle.stories.tsx`:
`WithTitle` (NL+EN, real `settingsPanel` catalog strings — the real
Kleurenthema caller), `WithoutTitle` (aria-label only), and
`VariableWidthSegments` (deliberately mismatched label lengths — the concrete
proof the runtime-measured indicator actually scales per segment, which a
uniform demo wouldn't exercise). Old story (`CategoryFilter`, the food-icon
demo) and its one baseline are deleted, not renamed — the new molecule has
zero real callers that need that exact demo shape, and it duplicated the
new story's `WithTitle` coverage anyway.

**`design/figma-map.json`**: `Button/Toggle` moved from `atoms` to
`molecules`, node-id `4160:33335`. `components/atoms/ButtonToggle.tsx`, its
story, and its baseline are deleted — zero consumers outside its own story
(grepped before deleting), and node `3623:4345` is now orphaned in the
Figma file (no parent, confirmed via the bridge).

---

## History (pre-#265, `components/atoms/ButtonToggle.tsx`, node `3623:4345`)

The sections below are the old atom's full ticket history, carried forward
per the ticket's own instruction not to lose the record even though the code
itself is gone.

REBUILT #60 2026-07-20, retiring #35's 'grouped composition not modelled' flag. Re-fetching 3623:4345 (plus Atom/Button, 3623:4346) confirmed the ticket's premise: this node IS the whole track, not one segment — a single root frame (row, 4px padding, 4px gap, fill stone-200/surface-raised, radius 8) containing one 'Active' rectangle (32x32, white/surface, radius 6, inset 4px, painted behind everything else) plus five fixed-32-wide, transparent, icon-only Atom/Button instances (Infinity/Croissant/Sandwich/Broccoli/Cake-slice). Per CLAUDE.md ('mirror Figma's own nesting') this file is now the track itself: a role=radiogroup composing real Button instances as segments, with one shared absolutely-positioned indicator that slides between them (translate-x, 44px per step = the segment's actual rendered width + the 4px gap; capped lookup table of 8 literal Tailwind classes since no inline style is allowed — see the component's own doc comment for the full reasoning).

## FLAGGED GAP

Atom/Button's fetched component set has no Size property, so it cannot render at Figma's overridden 32x32 instance size — Button.tsx is out of scope for this ticket (owned in parallel), and fighting its own h-10/padding classes via a conflicting className would depend on Tailwind's utility-generation order, not the caller's intent, which is exactly the ad-hoc className-fighting CLAUDE.md's house style forbids. So segments render at Button.tsx's native 40x40 icon-only footprint instead, and the track (whose own Figma sizing is contextual/hug on both axes — i.e. already meant to grow to fit its children) grows to 48px tall instead of the fetched node's 40px. A future ticket adding a compact Size variant to Atom/Button would let this file drop the workaround and match the fetched pixels exactly. No per-segment colour/state variation exists in the fetched node (same finding #35 recorded for this exact node) — no aria-checked colour override was added. Accessibility: role=radiogroup + role=radio/aria-checked with roving tabindex and Left/Right/Up/Down/Home/End arrow-key selection (WAI-ARIA 'Radio Group' pattern), deliberately not the aria-pressed/toolbar idiom Atom/Button's own Selected state and #35's version used — that idiom fits an independent toggle, not this control's 'exactly one of N' exclusivity; layered onto unmodified Button instances purely via the standard props it already spreads (role/aria-checked/tabIndex/onClick/onKeyDown), zero Button.tsx changes. Button.tsx isn't forwardRef, so roving focus after an arrow key walks the DOM from the keyboard event's own currentTarget rather than using a component ref. Remains a Client Component: which segment is selected is the group's own identical-for-every-caller behaviour, the same reasoning Dropdown (#43) used. Story count: the six single-segment stories (#35) are gone; one story, CategoryFilter, matches the fetched 5-icon demo via the message catalog (`components.buttonToggle.groupLabel` + `.categories.*`, replacing the retired `.defaultLabel` key).

## REVIEW CORRECTION (orchestrator, same ticket)

the first pass shipped segments at Button's native 40x40 because Button.tsx was out of scope, leaving the track 48px tall against Figma's 40px. Closed properly instead of flagged: Atom/Button gained a `size=compact` variant (h-8, 4px/24px/4px = 32) carrying exactly the fetched instance override's numbers, and the segments use it - so track height (40px) and the five-segment hug width (184px) now match the node. Figma's Button set has no Size property, so the variant's API shape is ours while its pixels are Figma's; `compact` is verified for the icon-only case only, which is all Figma samples - pairing it with text is untested against any node and flagged here.

## TICKET #69 (2026-07-20)

two reported geometry defects fixed. (1) The story wrapped both demo tracks in a plain `flex flex-col` div; flex columns default `align-items: stretch`, which stretched each `inline-flex` track to the wrapper's full width instead of hugging its five segments — fixed in both places, the story (now `flex flex-col items-start`) and the component itself (root gained `w-fit self-start` so a caller cannot reproduce the same stretch by accident). (2) The 32x32 segment footprint was verified by rendering both `Button` and `ButtonToggle` to static markup (`react-dom/server`'s `renderToStaticMarkup`, no headless browser available) and reading the resolved class list plus the icon `<svg>`'s literal width/height attributes — confirmed the pre-fix math (`h-8 pl-1 pr-0` root + `pr-1` icon wrapper + Icon's 24px default) did total to 32x32 today, but only by three numbers summing correctly, exactly the fragility the ticket flagged. `Button.tsx`'s `size=compact` now reads `size-8 justify-center` — one Tailwind utility stating width equal to height directly, content centred by flex alignment instead of by padding arithmetic — and the icon wrapper's `pr-1` is now conditional on `children` being present (it only exists to open a gap before a label), so the icon-only box has no asymmetric padding fighting the centring. Re-measured after the fix: still 32x32 per segment (unchanged pixels, now structural), 40px track height, 184px five-segment hug width — all re-verified against the fetched node's own numbers (root: 4px padding, 4px gap, hug/hug; "Active" rectangle: 32x32). The indicator span was also switched from `h-8 w-8` to `size-8`, tying its size to the same utility as the segments so the two can't drift independently; the `INDICATOR_OFFSETS` step (36px = 32 segment + 4 gap) doc comment now states that derivation explicitly.

## TICKET #80 (2026-07-21)

re-fetched 3623:4345 fresh (the 32x32/40x40 number had already flip-flopped once, per #60's history above) rather than trusting either the recorded note or a user report that read it as 40x40 per segment — root: 4px padding, 4px gap, hug/hug, designedHeight 40px; Active rectangle {width:32, height:32} at (4,4); each Atom/Button instance fixed-width 32, sizing.vertical fill. All three numbers match this file's existing size-8 segments/indicator/gap-1 track unchanged — no code change needed here. Verified pixel-for-pixel in a real browser this ticket (Playwright against `pnpm ladle`, first ticket with a headless browser available): rendered CategoryFilter story measures track 184x40, indicator 32x32 at (4,4), all five segments 32x32 with 24x24 icons, matching a downloaded render of the fetched node (368x80 at 2x = 184x40 at 1x) pixel-for-pixel. The user's 40x40 reading was most likely the track's own 40px designedHeight being attributed to the segments/indicator it contains. Separately, this ticket removed the segment's local `shrink-0` (now redundant — see Atom/Button's note for where that defence moved) but kept `relative` (still load-bearing for indicator stacking order).

## Motion, stacking, and state-ownership details not covered above

- **Duration/easing are not Figma-sourced.** The fetched node is a single static frame with no transition/timing property Figma could encode — the *fact* the indicator should move is the ticket's own explicit product requirement, but the concrete `duration-200 ease-out` values reuse Tailwind's stock scale, the same honestly-flagged non-Figma choice `Dropdown`'s own open/close animation makes (no project motion token exists yet). `motion-reduce:transition-none` follows the same precedent.
- **Indicator stacking order.** The indicator `span` is absolutely positioned but deliberately left un-`z-index`ed, and each segment gets `relative`, so normal DOM/paint order (indicator first, segments after) puts the segments visually on top — reproducing the fetched node's own layer order. A plain `absolute` indicator among `static` siblings would otherwise always paint above them regardless of source order, since positioned elements stack above normal flow irrespective of DOM order.
- **`"use client"` contrast.** The reasoning for owning `isOpen`/selection state internally is the same `Dropdown` (#43) used, contrasted directly with `Checkbox` (#45): `Checkbox`'s `checked` stays composer-owned because it varies meaningfully per call site, whereas which segment is selected here is the group's own behaviour, identical for every caller.
- **`defaultValue` is required, not optional**, because the fetched node never samples an "all unselected" track — this group always starts with exactly one segment active.
- **WAI-ARIA reference:** the Radio Group pattern followed is https://www.w3.org/WAI/ARIA/apg/patterns/radio/.

## Segments stay fill-less in every state (#107, 2026-07-26)

`Atom/Button`'s Transparent variant gained real Hover/Active fills in Figma (#107).
Those reached these segments by composition, because a segment *is* a
`Button variant="transparent"`. That is a regression here, not a feature:
each segment carries `relative` specifically to paint above the absolutely-
positioned white "Active" indicator, so any segment background covers it.
Measured in a real browser on the selected segment (Playwright,
`button-toggle--category-filter`, computed `backgroundColor`):

| state | before suppression | effect |
| --- | --- | --- |
| resting | `rgba(0,0,0,0)` | indicator visible (correct) |
| hover | `oklch(0.97 …)` = stone-100 | white pill greyed out |
| active | `oklch(0.923 …)` = `surface-raised` | pill gone — identical to the track |

Figma supports suppressing rather than inheriting: `Button/Toggle`
(`3623:4345`) is a single COMPONENT with **no** State axis, its five nested
segments are instances of `Atom/Button/Icon/Default/No` with `fills: []`, and
the indicator is a real `#FFFFFF` 32x32 rectangle node. Figma therefore
specifies no segment hover/active at all, and does specify the indicator.

Suppressed with the `!` important modifier (`hover:bg-transparent!`
`active:bg-transparent!`) because a plain `hover:bg-transparent` from
`className` and the cva variant's own `hover:bg-surface-active` are both
single-class `background-color` utilities under the same variant — equal
specificity, so which wins depends on emission order in the generated
stylesheet, the same trap `docs/guides/ticket-workflow.md` records for
physical vs. logical padding. Re-verified after the change: transparent in
all three states.

Whether these segments should have *any* pointer affordance is a real open
question, tracked at `docs/open-questions.md#no-pointer-affordance` — not
answered here, and deliberately not invented.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on `Button/Toggle` (3623:4345)
directly, not its instances. Track root: `itemSpacing` (4px) →
`spacing/inline/gap-xs` (`gap-1` → `gap-inline-xs`); `paddingLeft`/`Right`
(4px) → `spacing/component/padding-xs` (`p-1` → `p-component-xs`);
`topLeftRadius` (8px) → `radius/control` (`rounded-lg` → `rounded-control`).
The sliding indicator (`Active`, node 3649:384, a RECTANGLE not a frame):
`topLeftRadius` (6px) → `radius/control-inner` (`rounded-md` →
`rounded-control-inner`). Its `top-1 left-1` inset — 4px, matching the
track's own padding exactly, both by value and by role (it sits inset from
the track edge by that padding) — moves to `top-component-xs
left-component-xs`; `--spacing-component-xs` is emitted under the
`--spacing-*` namespace like every step/component/inline/stack token, so it
backs inset utilities the same way it backs `p-`/`gap-`.

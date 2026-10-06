# Atom/Button

- **Code:** `components/atoms/Button.tsx`
- **Node ID:** `3623:4346` (40 variants: 5 styles x 4 states x 2 alignments). Section frame `3760:6184`.

Current-state record. History lives in `git log`; the #204/#213 mis-binding write-up in `docs/incidents.md`.

## API mapping

- **Style -> `variant`** = `filled | outline | white | transparent | destructive` (Figma spells it "Distructive"; the code key is `destructive`).
- **State is CSS, never a prop.** Hover = `hover:`, Active (pressed) = `active:`, Selected = caller-set `aria-pressed` (`aria-pressed:` utility, same idiom as Atom/Button-Toggle). Not `active:` for Selected: CSS :active is non-persistent. Figma's "Selected" was renamed from "Active" upstream (#42); no pixel change.
- **`With icon` / `With text` / `Trekking icon`** (Figma's misnomer for *trailing*) -> presence of `icon` / `children` / `trailingIcon`. Icon-only requires `aria-label` (type-enforced).
- **`trailingIcon`, `align` and `size="compact"` are not representable on the icon-only branch** (`?: never`): Figma never samples them together, so the layout is undefined. A type error, not a guess.
- **`size`**: no Figma Size property. `default` = `h-10 px-component-sm`; `compact` = `size-8 justify-center` (the 32x32 that Button-Toggle (`3623:4345`) forces via instance override; icon-only only, a label would clip); `iconOnlyDefault` = `size-10 justify-center`, internal-only, resolved when `size` is default/omitted and there are no `children`. Width = height is stated directly, never emergent from padding + icon arithmetic (the 36x40 icon-only bug #75 and the fragile 32px #69 were both that class). Measured Figma icon-only instances are 40x40 (`3623:4346` Distructive/Default with text off, plus nodes `3650:1297`, `3727:4378`).
- **`shrink-0` on the base class** (#80): the atom defends its stated footprint in any flex row (a destructive icon-only Trash Button rendered 35.1x40 in a width-constrained row without it).
- **`align`** (`center` default | `left`), resolved in JS (`resolvedAlign`) only for `size=default`, so it never coexists with icon-only's own `justify-center` (two `justify-*` utilities in one string = winner decided by Tailwind stylesheet order). `center` -> `justify-center`; `left` -> `justify-between` (leading group at the start; a `trailingIcon` goes to the far right edge; with none it degenerates to flex-start). This mapping is the user's call, not Figma's: Figma's root frame carries no `justifyContent`/`primaryAxisAlignItems` on any of the 40 variants (the `center` values seen earlier belong to the Icon/Text sub-frames) and every variant is hug-sized, so Center and Left are pixel-identical in Figma. Product rule: all buttons default `center`; only Dropdown triggers/options and nav (Sidebar) buttons use `left`. Dropdown option rows are stretched (`sizing.horizontal: fill` in `3705:4446`, no `justifyContent`), which is why `justify-center` was wrong for them (#43).
- **Layout:** root `h 40, radius 8 (rounded-control), padding 0 8 (px-component-sm)`; a `"Leading + Text"` span (`gap-inline-sm` = 8px; icon right edge to text start measured 8px) and the trailing `Icon` frame. Root `gap-1` (4px) is unconditional so center/left differ only in `justify-*`.
- **Collapsed Sidebar rail arithmetic** (`sidebar--variants`, rail 73px = 16 + 40 + 16 + 1 border): the nav Button is stretched to 40px with `align="left"`: `8 padding + 24 icon + 8 gap = 40`, so the label starts exactly at the clipped right edge (0px visible, measured with `Range.getBoundingClientRect()`). This relies on the 8px leading gap and `align="left"`; changing either leaks a label sliver.
- **`ButtonToggle`'s segments** use `variant="transparent"` with a local `hover:bg-transparent! active:bg-transparent!` override so the white sliding indicator is not painted over. The `!important` override is variant-value-independent; it holds whatever Transparent's fills are.
- **`CardDetailPanel` Dropdown option rows** are `Button/Default` instances bound to `surface/highlight/white/default`, i.e. `Button variant="white"`; their hover follows White's binding below (`hover:bg-surface-highlight-white-selected`). See `design/notes/CardDetailPanel.md`.

## Colour state matrix (#213 / #238 — bound variables, read via `boundVariables` node by node)

Rule: **ramp step name != CSS state name** (`docs/design-tokens.md`). White and Destructive Hover/Active nodes bind one step off their state label (Hover node -> `selected` variable, Active node -> `hover` variable). Token *names* are right and untouched; `buttonVariants` binds each CSS state to the token holding the pixel that state's node actually uses. Never "fix" this by binding Hover -> `hover`: that was the #204 regression, reverted in #213.

| Style | State | Node | Bound fill/stroke variable | Bound text variable |
|---|---|---|---|---|
| Filled | Default | `3623:4344` | `color/surface/secondary/default` | `color/text/base/secondary` |
| Filled | Hover | `3674:6522` | `color/surface/secondary/hover` | `color/text/base/secondary` |
| Filled | Active | `3782:4800` | `color/surface/secondary/active` | `color/text/base/secondary` |
| Filled | Selected | `3822:6637` | `color/surface/secondary/default` | `color/text/base/primary` |
| White | Default | `3674:6515` | `color/surface/highlight/white/default` | `color/text/base/secondary` |
| White | Hover | `3784:4076` | `color/surface/highlight/white/selected` | `color/text/base/secondary` |
| White | Active | `3782:4908` | `color/surface/highlight/white/hover` | `color/text/base/secondary` |
| White | Selected | `3822:6642` | `color/surface/highlight/white/default` | `color/text/base/primary` |
| Transparent | Default | `3782:4793` | no fill | `color/text/base/secondary` |
| Transparent | Hover | `3784:4081` | `color/surface/secondary/hover` (same variable IDs as Filled's; #238 rebind off the White ramp) | `color/text/base/secondary` |
| Transparent | Active | `3782:4913` | `color/surface/secondary/active` | `color/text/base/secondary` |
| Transparent | Selected | `3822:6652` | no fill | `color/text/base/primary` |
| Outline | Default | `3782:4154` | stroke `color/Stroke/primary/default` | `color/text/base/secondary` |
| Outline | Hover | `3784:4086` | stroke `color/Stroke/primary/hover` | `color/text/base/secondary` |
| Outline | Active | `3782:4918` | stroke `color/Stroke/secondary/active` | `color/text/base/secondary` |
| Outline | Selected | `3822:6647` | stroke `color/Stroke/primary/selected` | `color/text/base/primary` |
| Destructive | Default | `3693:3386` | `color/surface/highlight/red/default` | `color/text/highlight/red` |
| Destructive | Hover | `3784:4091` | `color/surface/highlight/red/selected` | `color/text/highlight/red` |
| Destructive | Active | `3782:4923` | `color/surface/highlight/red/hover` | `color/text/highlight/red` |
| Destructive | Selected | `3822:6657` | `color/surface/highlight/red/default` | `color/text/highlight/red` |

Transparent Hover/Active also spot-checked on `Alignment=Left` (`3917:24944` / `3917:24936`): same bind (Style-level, not per-alignment drift). Destructive's text never changes across states.

Resolved values (light / dark; all match `design/tokens.json`):

| Variable | Light | Dark |
|---|---|---|
| `surface/secondary/hover` | stone-300 | stone-700 |
| `surface/secondary/active` | stone-400 | stone-600 |
| `surface/highlight/white/hover` | stone-200 | stone-500 |
| `surface/highlight/white/active` | stone-300 | stone-400 |
| `surface/highlight/white/selected` | stone-100 | stone-600 |
| `surface/highlight/red/*` | default red-50, selected red-100, hover red-200, active red-300 | all red-50 |

Outline stroke ramp (light): Default stone-300 (`border`), Hover stone-500 (`border-hover`, same value Input-field's Hover uses), Active stone-800 (`border-active`), Selected stone-400 (`border-selected`, same value Input-field's Selected uses). Input-field's Active is `Stroke/primary/active` (stone-600) vs Button/Outline's `Stroke/secondary/active` (stone-800): two distinct, correctly bound variables, not drift (this closed `button-vs-input-active-border`).

## Selected must compose with Hover/Active

A selected button must still react to the pointer (product requirement). Selected therefore sets only `color` on Filled, White, Transparent and Destructive (disjoint from Hover/Active's background): **never add `aria-pressed:bg-*` to those.** Outline is the exception: its Selected has a border, sharing `border-color` with Hover/Active. Tailwind emits the plain `aria-pressed:border-*` rule after `hover:`/`active:` at equal specificity, which would kill hover/active feedback, so Outline carries the compound variants `aria-pressed:hover:border-stroke-primary-hover` and `aria-pressed:active:border-stroke-secondary-active` (one more term, win by specificity regardless of stylesheet order). Load-bearing; do not replace with a bare `aria-pressed:border-*`. Full rule: `docs/design-tokens.md`.

## Token facts and gaps

- Dedicated tokens exist for the White ramp (`surface-highlight-white-hover/-active/-selected`) and Destructive (`priority-urgent-bg-selected/-hover/-active`, `surface-highlight-red-*`). `surface-highlight-white-active` has no component consumer today (White's Active reads `-hover`, Transparent reads `surface-secondary-active`); it stays because it traces to a live Figma variable and is `text.test.ts`-covered.
- `surface-hover` also backs `CardDetailPanel`'s Prioriteit/Grootte option rows: do not change its value for Button's sake.
- **Dark mode:** values come from Figma's `Semantics / Style, Dark` export (token pipeline emits a `[data-theme="dark"]` block in `app/theme.css`; no `dark:` utilities). Two accepted Figma facts, deliberately not fixed: (1) every red-highlight state resolves to red-50 in dark, so Destructive has no visible hover/press/selected feedback there; (2) `surface-highlight-white-active` dark (stone-400) is lighter than `-hover` (stone-500), backwards from light mode. See also `docs/open-questions.md#dark-mode-is-placeholder-only`.
- Figma's Filled/Selected instance has drifted padding (uniform 8px vs 4px/8px elsewhere): treated as auto-layout drift, not modelled.
- Transparent originally had no pointer affordance in Figma (`docs/open-questions.md#no-pointer-affordance`); it now has Hover/Active fills, as in the matrix.

## #205 — radius/spacing token binding

Measured via `boundVariables` across the component set: root `rounded-control` (`radius/control`), `px-component-sm` (`spacing/component/padding-sm`), leading frame `gap-inline-sm` (`spacing/inline/gap-sm`).

**Left raw, flagged:** root `gap-1` (4px). Figma is internally inconsistent: root `itemSpacing` is **unbound** (value 4) on every `Alignment=Center` variant and bound to `spacing/component/padding-xs` (4) on every `Alignment=Left` variant. Both render 4px, so `gap-1` is pixel-correct; picking the majority is a design call -> `docs/open-questions.md#button-root-gap-binding-split`. Carries a `spacing-flag:` marker in the component (`check:raw-spacing`). Lesson: measure the whole set, never generalise from one variant.

## Open flags

- `button-root-gap-binding-split` (above).
- Node `4003:5441` ("Button is anders in design", #166) no longer exists in Figma; the component set `3623:4346` was re-fetched and matches the code. The reporter must re-link; nothing to fix here.
- Dropdown rows with `align="left"` + `trailingIcon`: Left in Figma is packed, not distributed; the code's `justify-between` pushes the chevron to the far right (the wanted behaviour for a full-width row), but that is emergent from the mapping, not stated per variant in Figma.

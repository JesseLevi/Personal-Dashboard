# Dropdown
Figma: `Dropdown` · node `3705:4446` (single COMPONENT, no State/variant axis; child `Slot` `3705:4471`) · Code: `components/atoms/Dropdown.tsx`

## Anatomy
Outer wrapper (`flex w-full flex-col gap-stack-sm rounded-control-outer`, merges `className`) holding an optional label and the bordered panel (`rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs`).

- `label` (inert `<span id>`, `text-base font-semibold text-text-secondary`, same as `InputField`) requires `id`, type-enforced like `InputField`. `defaultOpen` (default `true`) exists only on the labelled branch.
- `children` is the Figma SLOT. **Labelled:** the first child is both the current selection and the disclosure trigger; the rest are collapsible options. **Labelless:** a static always-open `role="group"` panel with `gap-inline-xs`; every child fills.
- Labelled layout: trigger row (`flex w-full cursor-pointer items-center gap-3`) = `min-w-0 flex-1` trigger + Dropdown's own `ChevronDown` (`mr-2`, rotates 180 deg off `isOpen`); below it the collapsible rest-list (CSS-grid `0fr`/`1fr` row trick, `flex flex-col gap-1 pt-1`, panel id `${id}-panel`, `aria-labelledby={id}`).
- Closed state is this atom's interpretation (Figma only samples fully-open): the bordered panel always renders and the first child always stays visible; only the rest collapse. (#61)
- Client Component: open/close is intrinsic and identical for every caller, unlike `InputField`'s caller-varying `button` slot. (#43)

## Deliberate decisions
- The caller supplies the trigger; Dropdown never wraps it. The first child is already a real interactive element (`Button`, or a caller's `<button>` around a `Tag`), and `<button>` inside `<button>` is invalid. Dropdown `cloneElement`s it and injects only `id` (`${id}-trigger`), `aria-expanded`, `aria-controls`. The caller's trigger must NOT render its own trailing icon. (#100, #108)
- The chevron lives in Dropdown's own fixed trailing column, outside the pill, because that is Figma's shape (`Input-field` instance: `Container` fill with `Content` + `Trekking-icon-container`; the pill stays hug-sized, filled, left-packed). It is decorative and `aria-hidden`. Rejected: `align="left"` + `trailingIcon` in a stretched transparent trigger (Figma's pill is never stretched), and a non-interactive lookalike pill. `gap-3` and `mr-2` reproduce Figma's `gap: 12` and `pr-2`. The old `[&>svg]` sibling-selector rotation was removed along with it. (#108)
- The whole trigger row is a mouse click target: `onClick` sits on the row div, with no `role` / `tabIndex`, so there is still exactly one focusable control (the real trigger). A trigger's own `onClick` fires first, then the row's via bubbling, one toggle per click; Enter/Space on the native button bubbles the same way. Making the row itself an interactive element (`role="button"` div or nested buttons) was rejected as an ARIA / tab-order anti-pattern. (#108)
- `rounded-control-outer` is on the outer wrapper too, otherwise a caller's `shadow-sm` (TeDoenHeader) paints square corners behind the rounded panel. In labelled mode the radius now lands on the label+panel group as a whole (currently invisible). (#108)
- Panel is not `items-start`: the trigger row supplies its own `w-full` and the trigger hugs by ordinary block-child sizing. `self-stretch` on the rest-list wrapper is a no-op today, kept so open option rows (Figma `alignSelf: stretch`) never start hugging if the default changes. (#100, #112)
- Escape (labelled, open) closes and refocuses the trigger via `document.getElementById(`${id}-trigger`)`, since the trigger is caller JSX with no ref. Motion respects `motion-reduce:transition-none`; the chevron uses `--duration-base` / `ease-base`. (#43, #100)
- Labelled panel carries the `InputField` border ramp: `transition-colors hover:border-stroke-primary-hover active:border-stroke-primary-active focus-within:border-stroke-primary-selected`. Labelled Dropdown is a field; labelless is a floating menu (`NutritionalDataRow` popover, `PasAanPanel` unit menu, `TeDoenHeader` sort / board-switcher) where a panel hover border would fire anywhere inside and fight the option rows' own hover. The input-specific active border (not Button/Outline's) is deliberate. (#166)
- Token bindings read from `boundVariables`: root `gap-stack-sm`, panel `rounded-control-outer` + `p-component-xs`, labelless `gap-inline-xs` (`Slot` is VERTICAL yet binds `spacing/inline/gap-xs`: the binding wins over the axis heuristic). (#205)
- Label+`id` contract kept identical to `InputField` although this is a client component and could use `useId()`: one labelling idiom across the design system.

## Token gaps and flags
- `gap-3` (trigger row), `mr-2` (chevron), and `gap-1 pt-1` (rest-list) stay raw, each with a `spacing-flag:` in the code: they are Dropdown's own composition around the SLOT, and Slot's Figma children (plain `Button/Default` instances) have no wrapper frame whose `boundVariables` could be read. (#205, #218)
- No chevron was ever fetched on the Dropdown node itself; its chevron comes from the `Input-field` shape in `3779:4938` (AddItem desktop).
- Labelless mode has no trigger of its own (labelless Figma sample shows no header); `TeDoenHeader` supplies its own open/close `Button` outside the Dropdown. A labelless real disclosure needs a Figma header/trigger first.

## Gotchas
- `gap-1` is applied only to the labelless panel. With a label the rest-list supplies its own `pt-1`: a parent flex gap survives the `0fr` collapse, leaving 4 px dead space when closed and 8 px above the second option when open. (#61)
- The collapsed rest-list needs `inert` as well as `aria-hidden`: `aria-hidden` alone leaves focusable options in the tab order. The first/selected child sits outside the wrapper and is never hidden.
- Labelless usages in `TeDoenHeader` cannot render under Ladle (`useRouter()` throws) and `/te-doen` needs a live Supabase session; the labelled mechanics are covered through the `Dropdown` stories (Closed, Open, Animated) and `CardDetailPanel`'s Status / Prioriteit / Grootte fields.
- `CardDetailPanel` triggers must not render a chevron or the `gap-2` that used to space one (Status: no `trailingIcon="ChevronDown"`; Prioriteit / Grootte: no manual `<Icon>`). (#108)

## Open
- `docs/open-questions.md#dropdown-row-not-fully-clickable`
- `docs/open-questions.md#sidebar-motion-timing-unsourced` (rest-list grid-rows still hardcodes `duration-200 ease-out`)

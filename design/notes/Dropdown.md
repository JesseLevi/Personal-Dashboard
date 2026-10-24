# Dropdown
Figma: `Dropdown` · node `3705:4446` (single COMPONENT, no State/variant axis; child `Slot` `3705:4471`) · Code: `components/atoms/Dropdown.tsx`

## Anatomy
Outer wrapper (`flex w-full flex-col gap-stack-sm rounded-control-outer`, merges `className`) holding an optional label and the bordered panel (`rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs`).

- `label` (inert `<span id>`, `text-base font-semibold text-text-secondary`, same as `InputField`) requires `id`, type-enforced like `InputField`. `defaultOpen` (default `true`) exists only on the labelled branch.
- `children` is the Figma SLOT. **Labelled:** the first child is the current selection, rendered inside Dropdown's own trigger button; the rest are collapsible options. **Labelless:** a static always-open `role="group"` panel with `gap-inline-xs`; every child fills.
- Labelled layout: trigger row = one `<button type="button" id={id}-trigger>` (`flex min-h-10 w-full cursor-pointer items-center gap-3 text-left`) holding a `min-w-0 flex-1` span with the selection + Dropdown's own `ChevronDown` (`mr-2`, rotates 180 deg off `isOpen`); below it the collapsible rest-list (CSS-grid `0fr`/`1fr` row trick, `flex flex-col gap-1 pt-1`, panel id `${id}-panel`, `aria-labelledby={id}`).
- Closed state is this atom's interpretation (Figma only samples fully-open): the bordered panel always renders and the first child always stays visible; only the rest collapse. (#61)
- Client Component: open/close is intrinsic and identical for every caller, unlike `InputField`'s caller-varying `button` slot. (#43)

## Deliberate decisions
- The trigger row is at least 40 px (`min-h-10`, a Button's height), so a labelled Dropdown is as tall as `InputField` whatever the selection is: a compact 24 px `Tag` does not collapse the field. (#604)
- Dropdown owns the trigger: one `<button>` spans the whole row (label, selection, chevron); there is no nested button and no `role="button"` wrapper. The first child must therefore be inert: a `Tag`, or `<Button presentational>`, which renders Button's exact classes on a `<span>` so the pill looks the same and still hovers on its own. The button carries `aria-expanded`, `aria-controls` (the panel) and `aria-labelledby="{id} {id}-trigger"` (field label plus selection). It is a disclosure, so no `aria-haspopup`. The label is a native `<label for>` of the button: a click on it opens the list through the browser's own label activation, with no extra handler. Rejected: nested buttons and a `role="button"` div (ARIA / tab-order anti-patterns), `cloneElement` onto the caller's element (what this replaced, which left only the pill focusable and the row div a mouse-only target).
- The chevron lives in Dropdown's own fixed trailing column, outside the pill, because that is Figma's shape (`Input-field` instance: `Container` fill with `Content` + `Trekking-icon-container`; the pill stays hug-sized, filled, left-packed). It is decorative and `aria-hidden`. `gap-3` and `mr-2` reproduce Figma's `gap: 12` and `pr-2`. The caller's selection must not render its own trailing icon.
- `rounded-control-outer` is on the outer wrapper too, otherwise a caller's `shadow-sm` (TeDoenHeader) paints square corners behind the rounded panel. In labelled mode the radius now lands on the label+panel group as a whole (currently invisible). (#108)
- Panel is not `items-start`: the trigger row supplies its own `w-full` and the trigger hugs by ordinary block-child sizing. `self-stretch` on the rest-list wrapper is a no-op today, kept so open option rows (Figma `alignSelf: stretch`) never start hugging if the default changes. (#100, #112)
- Escape (labelled, open) closes and refocuses the trigger via `document.getElementById(`${id}-trigger`)`, since the trigger is caller JSX with no ref. Motion respects `motion-reduce:transition-none`; the chevron uses `--duration-base` / `ease-base`. (#43, #100)
- Labelled panel carries the `InputField` border ramp: `transition-colors hover:border-stroke-primary-hover active:border-stroke-primary-active focus-within:border-stroke-primary-selected`. Labelled Dropdown is a field; labelless is a floating menu (`NutritionalDataRow` popover, `PasAanPanel` unit menu, `TeDoenHeader` sort / board-switcher) where a panel hover border would fire anywhere inside and fight the option rows' own hover. The input-specific active border (not Button/Outline's) is deliberate. (#166)
- The labelless panel carries `data-menu-surface`. In dark, `surface-highlight-white` (the panel) equals `surface-secondary-hover` (a Transparent row's hover), so `app/globals.css` remaps the hover/active vars inside it to Button/White's ramp (`-selected` / `-hover`). Light is unchanged.
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
- Selections must not render a chevron or the `gap-2` that used to space one (Status: no `trailingIcon="ChevronDown"`; Prioriteit / Grootte: no manual `<Icon>`). (#108)
- Tests: `tests/dropdown-trigger.test.ts` renders the labelled markup and asserts exactly one `<button>`, none nested, and the ARIA wiring.

## Open
- `docs/open-questions.md#sidebar-motion-timing-unsourced` (rest-list grid-rows still hardcodes `duration-200 ease-out`)

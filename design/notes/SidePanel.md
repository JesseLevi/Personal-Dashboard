# SidePanel
Figma: `Te doen/Mobile/AddItem` node `3779:4846` · `Te doen/Desktop/AddItem` node `3779:4938` (layer is literally named "y" in Figma; confirmed by content it is the desktop AddItem pane). AddBoard `3878:9047` / `3878:9060` share the chrome. Dev Mode annotations: "Slides in from bottom" (mobile `3779:4847`/`3878:9048`), "Slides in from right" (desktop `3779:4939`/`3878:9061`) · Code: `components/organisms/SidePanel.tsx`

## Anatomy
Empty shell: `children` (fields) and `footer` (actions) are composer-supplied. One markup serves both shapes through `md:` classes only; no JS breakpoint read for markup (a client match check would desync from the CSS breakpoint on first paint).
- Mobile (<md): bottom sheet, `inset-x-0 bottom-0 max-h-[90vh]`, `rounded-tl-2xl rounded-tr-control-outer` (Figma 16/12 asymmetric).
- Desktop: right drawer, `md:w-[400px] md:h-full`, `md:rounded-bl-control-outer`, right corners square.
- Header strip `h-14`: mobile pull-handle pill (48x4, `bg-stroke-primary`, `md:hidden`) + `Button filled` icon-only X, right-aligned on both shapes.
- Fields column `gap-stack-xl`, scrolls (`overflow-y-auto`). Footer ("Bottom"): mobile has a white strip (`bg-surface-highlight-white`) and a top divider; desktop has neither (`md:bg-transparent md:border-t-0`), a real Figma difference between the two nodes.
- Panel fill `bg-surface-primary` (`#F5F5F4`). Mobile width is the real viewport (Figma's 402 is the artboard); desktop 400px is a deliberate drawer width with no sizing token. Figma's desktop height 874 is a canvas artifact, rendered `md:h-full`.

## Deliberate decisions
- `title` is required and rendered as an `sr-only` `<h2>`: `role="dialog"` needs `aria-labelledby` to resolve and Figma has no visible title. `className` is exposed like every other organism. (#89)
- The panel stays mounted while closed (`inert` + `aria-hidden`) so both open and close transitions animate; hand-rolled focus trap (no library), focus moves to the first focusable on open and back to the previously focused element on close. Overlay click and Escape call `onClose`. (#89)
- Motion reuses `--duration-base` / `--ease-base` via the arbitrary form `duration-[var(--duration-base)]` (a bare `duration-base` compiles to nothing and silently falls back to 150ms); `motion-reduce:transition-none` on both layers. (#89)
- The scrim is `bg-overlay/60`, a codebase-only token pinned to stone-950 in both themes. It was `bg-text-primary/60`, which inverted to a light wash in dark mode. Same token as the mobile drawer scrim in `AppShellNav`. (#222)
- Footer container is a column (`flex-col`), so a lone button or the delete-confirm text row stretches to full width without SidePanel knowing the content. Footer buttons opt in to an equal row share with `grow basis-0` (composer's job), deliberately not `flex-1`: its `flex-shrink` collides with `Button`'s own `shrink-0` and the outcome would depend on stylesheet emission order. Rule: 1 button = 100%, 2 buttons = 50% each. (#103)
- Mobile drag-to-close is a codebase decision (Figma models no gesture; user decision 2026-07-25). Pointer events on the header strip only, never the scrolling fields area; ignores presses on a `<button>`; inert at >= 768px via `matchMedia` at drag start (the one deliberate runtime exception to "no JS breakpoint"); imperative `style.transform` writes with the transition disabled for the drag. Thresholds: slop 8px, close at 120px distance OR 0.5 px/ms velocity; `pointercancel` always snaps back; upward jitter cancels. The gesture still works under `prefers-reduced-motion` (only the CSS transition is gated). (#103)
- `level?: 1 | 2` (default 1): level 2 uses `z-[60]` scrim / `z-[70]` panel so a second panel (`StepIngredientPanel`, `IngredientSearchPanel` over `RecipePanel`) dims the first one too, as Figma's full-screen overlay on `StepIngredientPanel` (`3749:3241`) shows. Scoped to two levels on purpose; the `AppShellNav` drawer mirrors level 1 (`z-40`/`z-50`). (#149)
- Scrim uses `invisible` + `transition-discrete` besides `opacity-0`, so a closed scrim no longer stays composited (suspected cause of a stale tinted strip on iOS Safari); the fade-out still plays because the visibility flip is deferred. (#113)
- Popovers inside a panel stay `position: absolute` in a `relative` wrapper (see `lib/dom/use-popover-position.ts`): the open panel has a non-`none` `translate` and `overflow-hidden`, so `fixed` buys nothing, and portalling would break the focus trap.

## Token gaps and flags
- `rounded-tl-2xl` (16px): the fetched `topLeftRadius` binds the SPACING variable `spacing/component/padding-lg`, not a radius one, and 16px has no step in the radius scale. Stays raw, marked `spacing-flag:` (the gate regex covers per-corner `rounded-*`). (#205, #218)
- `md:w-[400px]`, `z-[60]` / `z-[70]`: no token layer for these.
- Safe-area padding stays raw: `md:pt-[env(safe-area-inset-top)]` (only the desktop shape reaches the viewport top) and the mobile footer `pb-[max(1rem,env(safe-area-inset-bottom))]` (`max()` only ever adds space). (#113, #172)
- Bound tokens: footer `gap-inline-sm`, `p-component-lg`, `md:pb-component-lg`; handle strip and fields `px-component-lg`; `rounded-*-control-outer` = 12px. (#205)

## Gotchas
- A drag interrupted without pointerup/cancel (e.g. Escape mid-drag) leaves an inline `transform` that composes with the class-driven `translate` (separate CSS property in Tailwind v4); a `useLayoutEffect` clears it on every open/close. Keep it. (#111)
- The first-open animation glitched when a composer remounted `SidePanel` on target change (fresh DOM node, no closed frame to interpolate from, on every never-before-mounted key). Composers must keep one persistent SidePanel element and reset state inside it, not `key` the panel itself. See `CardDetailPanel.md`. (#103)
- `viewportFit: "cover"` (in `app/layout.tsx`) is what makes the safe-area `env()` values non-zero; the iOS stale-strip and edge-gap fixes are unverified on a real device. (#113)
- Mobile bottom-sheet shape is not baselined: the visual project is a single desktop chromium viewport and `position: fixed` follows the real viewport, so baselines only capture the desktop drawer (`AddItem`, `AddBoard`, closed `Interactive`). The mobile shape was verified by hand at 402px. A mobile baseline needs a second Playwright project.
- SidePanel must not be mounted under an ancestor with `transform`/`filter`/`contain` (breaks `fixed`). `AppShellNav`'s drawer is a sibling of `main`, and `PageHeader` only uses `sticky`. (#101, #102)

## Open
- `docs/open-questions.md#sidebar-motion-timing-unsourced`

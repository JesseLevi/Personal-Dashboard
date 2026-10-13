# Toast
Figma: none (Claude-designed on request, #466) · Code: `components/organisms/Toast.tsx` (+ `.stories.tsx`)

## Anatomy
Composes the labelless `Dropdown` atom (`className="shadow-sm"`), so it looks like the Te doen "Sorteer" popover. Inside, one inert row that matches a `Button variant="white"` row: `h-10 px-component-sm rounded-control text-base font-semibold text-text-secondary`. It is a `<p>`, not a button: not focusable, no icon. Fixed at the top centre of the viewport.

## Contract
- Props: `message: string | null`, `onDismiss: () => void`, optional `durationMs` (default 3000; `Infinity` keeps it on screen).
- A non-null `message` slides down from above, stays `durationMs`, slides up, then calls `onDismiss`; the caller sets `message` to `null`. A new message string restarts the timer.
- `role="status"` and `aria-live="polite"`. The wrapper ignores pointer events.
- Reduced motion (`motion-reduce:`): no slide, only an opacity fade.
- Stacking: `z-[1000]`, above the popovers (`z-[999]`) and the `SidePanel` levels (`z-50`/`z-[70]`). Top offset respects `env(safe-area-inset-top)`.

## Deliberate decisions
- New component by exception (ADR-0034): no toast existed. No new token. Built from `Dropdown`, not hand-rolled chrome; the slide transition sits on the wrapper around it.
- Errors are not toasts; callers keep them as text lines.

## Token gaps and flags
- The `0.75rem` offset below the safe area is a raw value; no spacing token matches.

## Gotchas
- Stories: `Visible`.

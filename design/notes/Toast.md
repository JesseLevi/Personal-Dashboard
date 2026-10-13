# Toast
Figma: none (Claude-designed on request, #466) · Code: `components/organisms/Toast.tsx` (+ `.stories.tsx`)

## Anatomy
One rounded panel with a single line of text, fixed at the top centre of the viewport. Same chrome as `Dropdown`'s panel: `rounded-control-outer`, `border-stroke-primary`, `bg-surface-highlight-white`, `shadow-sm`; text `text-base font-semibold text-text-primary`.

## Contract
- Props: `message: string | null`, `onDismiss: () => void`, optional `durationMs` (default 3000; `Infinity` keeps it on screen).
- A non-null `message` slides down from above, stays `durationMs`, slides up, then calls `onDismiss`; the caller sets `message` to `null`. A new message string restarts the timer.
- `role="status"` and `aria-live="polite"`. The wrapper ignores pointer events.
- Reduced motion (`motion-reduce:`): no slide, only an opacity fade.
- Stacking: `z-[1000]`, above the popovers (`z-[999]`) and the `SidePanel` levels (`z-50`/`z-[70]`). Top offset respects `env(safe-area-inset-top)`.

## Deliberate decisions
- New component by exception (ADR-0034): no toast existed. No new token.
- Errors are not toasts; callers keep them as text lines.

## Token gaps and flags
- The `0.75rem` offset below the safe area is a raw value; no spacing token matches.

## Gotchas
- Stories: `Visible`.

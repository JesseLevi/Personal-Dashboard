# OtpInput

- **Code:** `components/atoms/OtpInput.tsx` (client), wrapping `input-otp`.
- **Origin:** Claude-designed on request (#492, ADR-0034), no Figma node. Built
  from existing components and semantic tokens only.
- **Used by:** `app/login/code/LoginCodeForm.tsx`.

## Contract

`value` / `onChange` (controlled), `onComplete` (all slots filled, also on
paste and OS autofill), `name` (the real input submits with its form),
`invalid`, `disabled`, `autoFocus`, `length` (default 6), required
`aria-label`. Digits only (`REGEXP_ONLY_DIGITS`), `inputMode="numeric"`, the
library's default `autoComplete="one-time-code"` so iOS and Android offer the
code from the e-mail or SMS.

The caller owns the error message and passes `aria-describedby`; `invalid`
only recolours the slots and sets `aria-invalid`.

## Slot anatomy (same box as `InputField`)

| Part | Classes |
| --- | --- |
| Row | `flex w-full gap-inline-sm` |
| Slot | `h-12 flex-1 rounded-control-outer border border-stroke-primary bg-surface-highlight-white text-base font-semibold text-text-primary transition-colors` |
| Active slot | `border-stroke-primary-selected` (InputField's `focus-within` border) |
| Error | `border-priority-urgent text-priority-urgent` (the colour of the login error lines) |
| Disabled | `opacity-50`, `cursor-not-allowed` on the row |
| Fake caret | `h-5 w-px bg-text-primary animate-breathe motion-reduce:animate-none` |

No hover or active border on the slots: the whole row is one input, so a
per-slot hover would suggest six fields.

## Gaps and deviations

- `h-12` (48 px) is a plain size utility, not a token: InputField's box is
  content-sized (about 50 px) and there is no height token. A slot needs a
  definite height, so 48 px was picked to sit close to it.
- The caret reuses `animate-breathe` (skeleton opacity pulse, 1.6 s). It is
  the only existing looping motion; a real caret blink would need a new
  keyframe.
- There is no error border on `InputField` yet; the slots borrow
  `priority-urgent`, the only red used for field errors (`ErrorLine`). If
  InputField gets an error state, align the two.
- Slots show no placeholder character: an empty box reads clearer than dots
  next to a text field without placeholders.

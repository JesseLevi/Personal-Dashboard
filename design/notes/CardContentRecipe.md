# Card-content/Recipi

- **Code:** `components/molecules/CardContentRecipe.tsx`
- **Node ID:** `3628:67`

Built #19. Figma spelling 'Recipi' corrected to Recipe in code. Row: Thumbnail (96x96 IMAGE fill, radius 4px) -> `imageUrl`/`imageAlt` plain `<img>` (not next/image — no remotePatterns host configured yet, out of scope for a leaf molecule); 'Name + time' column -> `name` (text-base/semibold, text) + Time row (Icon + `duration`, text-sm/semibold, text-muted). No Tag instance in the fetched node, so ticket #19's 'Tag/Icon atoms as the design dictates' resolves to Icon-only. Icon child is an unnamed IMAGE-SVG, verified by rendered path (two lines + a circle, no checkmark) against lucide exports — matches `Timer` exactly, not `AlarmClockCheck`; `Timer` added to the Icon atom's IconName union/map for this ticket.

## DEVIATION flagged

the '20 min' TEXT node has an authored fixed width (92px) sized to that sample string — rendered at natural width instead since a fixed width would clip longer durations; not modelled. No token gaps: name fill stone-950->text, duration+icon stroke stone-500->text-muted, both existing tokens. No i18n keys added — name/duration are caller-supplied recipe content (same pattern as Card's `title`), not fixed UI strings.

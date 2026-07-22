# Card-content/Recipi

- **Code:** `components/molecules/CardContentRecipe.tsx`
- **Node ID:** `3628:67`

Built #19. Figma spelling 'Recipi' corrected to Recipe in code. Row: Thumbnail (96x96 IMAGE fill, radius 4px) -> `imageUrl`/`imageAlt` plain `<img>` (not next/image — no remotePatterns host configured yet, out of scope for a leaf molecule); 'Name + time' column -> `name` (text-base/semibold, text) + Time row (Icon + `duration`, text-sm/semibold, text-muted). No Tag instance in the fetched node, so ticket #19's 'Tag/Icon atoms as the design dictates' resolves to Icon-only. Icon child is an unnamed IMAGE-SVG, verified by rendered path (two lines + a circle, no checkmark) against lucide exports — matches `Timer` exactly, not `AlarmClockCheck`; `Timer` added to the Icon atom's IconName union/map for this ticket.

## DEVIATION flagged

the '20 min' TEXT node has an authored fixed width (92px) sized to that sample string — rendered at natural width instead since a fixed width would clip longer durations; not modelled. No token gaps: name fill stone-950->text, duration+icon stroke stone-500->text-muted, both existing tokens. No i18n keys added — name/duration are caller-supplied recipe content (same pattern as Card's `title`), not fixed UI strings.

## RE-VERIFIED 2026-07-22 (user review of #24: "placeholder image background not visible in Ladle")

re-fetched node 3628:67 to check whether the Thumbnail FRAME carries its own background fill (a skeleton/placeholder colour) distinct from the recipe photo, since `CardContentRecipe.stories.tsx` / `Carousel.stories.tsx` / `CardContainer.stories.tsx` all pass a transparent 1x1 SVG as the dev-only `imageUrl`, which renders as literally nothing without a fill of some kind. Confirmed: the Thumbnail frame has exactly one fill entry, `{"type":"IMAGE", "imageRef": "b7c1747c...", "scaleMode":"FILL"}` — no separate solid-colour fill layered under it. Figma only defines what renders when a real photo is present; it gives no placeholder/skeleton colour for the empty state. So `CardContentRecipe.tsx`'s plain `<img>` (no background class) is correct as built — the fix belongs entirely in the consuming stories, not the component. `CardContentRecipe.stories.tsx`/`Card.stories.tsx` had already solved this correctly (a `bg-surface-muted` `ThumbnailBackdrop` div stacked behind the transparent placeholder via CSS grid) — `Carousel.stories.tsx` and `CardContainer.stories.tsx` were the two files that had NOT adopted that convention; both now do.

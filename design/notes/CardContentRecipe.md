# Card-content/Recipi

- **Code:** `components/molecules/CardContentRecipe.tsx`
- **Node ID:** `3628:67`

Built #19. Figma spelling 'Recipi' corrected to Recipe in code. Row: Thumbnail (96x96 IMAGE fill, radius 4px) -> `imageUrl`/`imageAlt` plain `<img>` (not next/image — no remotePatterns host configured yet, out of scope for a leaf molecule); 'Name + time' column -> `name` (text-base/semibold, text) + Time row (Icon + `duration`, text-sm/semibold, text-muted). No Tag instance in the fetched node, so ticket #19's 'Tag/Icon atoms as the design dictates' resolves to Icon-only. Icon child is an unnamed IMAGE-SVG, verified by rendered path (two lines + a circle, no checkmark) against lucide exports — matches `Timer` exactly, not `AlarmClockCheck`; `Timer` added to the Icon atom's IconName union/map for this ticket.

## DEVIATION flagged

the '20 min' TEXT node has an authored fixed width (92px) sized to that sample string — rendered at natural width instead since a fixed width would clip longer durations; not modelled. No token gaps: name fill stone-950->text, duration+icon stroke stone-500->text-muted, both existing tokens. No i18n keys added — name/duration are caller-supplied recipe content (same pattern as Card's `title`), not fixed UI strings.

## RE-VERIFIED 2026-07-22 (user review of #24: "placeholder image background not visible in Ladle")

re-fetched node 3628:67 to check whether the Thumbnail FRAME carries its own background fill (a skeleton/placeholder colour) distinct from the recipe photo, since `CardContentRecipe.stories.tsx` / `Carousel.stories.tsx` / `CardContainer.stories.tsx` all pass a transparent 1x1 SVG as the dev-only `imageUrl`, which renders as literally nothing without a fill of some kind. Confirmed: the Thumbnail frame has exactly one fill entry, `{"type":"IMAGE", "imageRef": "b7c1747c...", "scaleMode":"FILL"}` — no separate solid-colour fill layered under it. Figma only defines what renders when a real photo is present; it gives no placeholder/skeleton colour for the empty state. So `CardContentRecipe.tsx`'s plain `<img>` (no background class) is correct as built — the fix belongs entirely in the consuming stories, not the component. `CardContentRecipe.stories.tsx`/`Card.stories.tsx` had already solved this correctly (a `bg-surface-muted` `ThumbnailBackdrop` div stacked behind the transparent placeholder via CSS grid) — `Carousel.stories.tsx` and `CardContainer.stories.tsx` were the two files that had NOT adopted that convention; both now do.

## Additional fact (moved from the component doc comment, comment-shrink pass)

Thumbnail `alt` defaults to `""` (decorative), not `name`: the recipe name is already rendered as adjacent visible text, so defaulting `alt` to it would make a screen reader announce the name twice. `imageAlt` remains an explicit override for a call site that needs a real accessible name on the image itself (e.g. the photo conveys information the name text does not).

## `duration` made optional for ticket #124 (recipe overview kanban)

`recipes.time_minutes` (schema, #119) is nullable — not every recipe has a
duration. The fetched node `3628:67` never models a "no duration" state (it
always draws the icon+text row), so rather than inventing placeholder text
for the missing case, `duration` became `duration?: string` and the
icon+text row is omitted entirely when absent — the same "omit the optional
row" treatment `TeDoenBoard.tsx` already applies to `card.size`/`due_at`
(design/notes/TeDoenBoard.md), applied here to keep this molecule itself
`clsx`-simple and prop-driven rather than baking recipe-specific null
handling into it. No visual change for the existing (always-supplied)
Ladle stories.

## `imageUrl` made optional for ticket #124 — placeholder moved INTO the molecule

First pass of #124 kept `imageUrl` required and pushed a `ThumbnailBackdrop`-
style grid-stacking hack (transparent data-URI `<img>` + a `bg-surface-muted`
square layered behind it via CSS grid) into the composing route file
(`app/(app)/recepten/ReceptenBoard.tsx`). Corrected on review: that leaked an
image-rendering concern out of the one component that owns the Thumbnail
slot, and reproduced a stacking trick that exists nowhere in the fetched
node. `imageUrl` is now `imageUrl?: string`; when absent, the component
itself renders a plain `bg-surface-muted` `h-24 w-24 rounded` box
(`aria-hidden`, no image semantics to fake) in the Thumbnail's own place —
same "omit/replace the optional slot inside the molecule" treatment as
`duration` above, kept consistent rather than solving the two nullable props
two different ways.

**This is a real deviation, flagged not silently resolved:** the fetched
node `3628:67` always draws a photo — "no photo yet" is not a state Figma
models, only a state this codebase's data genuinely has (`recipes.
thumbnail_path` is nullable, and no recipe can have a real one today — see
below). No token gap: the placeholder reuses the existing `surface-muted`
role, not a new colour.

**`recipes.thumbnail_path` is not consulted at all yet — every card renders
the placeholder unconditionally**, even a recipe with a stored path. Not an
oversight: #121 (private `recipe-thumbnails` bucket) isn't built, and per
`Architecture.md` §7 the bucket is private and only ever served via
short-lived signed URLs — never a public URL a client component like
`ReceptenBoard.tsx` could construct itself. Resolving a real `thumbnail_path`
into an `imageUrl` needs a server-side signed-URL step that doesn't exist
yet; wiring it is a follow-up once #121 lands, not this ticket's job. The
Ladle stories (`CardContentRecipe.stories.tsx`, still passing an explicit
placeholder `imageUrl`) and `CardContainer.stories.tsx`/`Carousel.stories.tsx`
are unaffected — they keep demonstrating the filled-image case.

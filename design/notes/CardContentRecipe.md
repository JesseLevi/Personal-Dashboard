# Card-content/Recipe
Figma: `Card-content/Recipi` node `3628:67` (Figma spelling "Recipi" corrected to Recipe in code) · Code: `components/molecules/CardContentRecipe.tsx`

## Anatomy
Row: Thumbnail (96x96, `rounded-card-inner`) -> `imageUrl`/`imageFallbackUrl`/`imageAlt` as a plain `<img>`; "Name + time" column -> `name` (`text-base font-semibold text-text-primary`) + optional Time row (`Timer` icon + `duration`, `text-sm font-semibold text-text-secondary`). No variant/state axis, no Tag instance in the node, so Icon-only. `Timer` was identified by comparing the rendered SVG path against lucide exports (not `AlarmClockCheck`). Name and duration are caller-supplied content, not fixed UI strings, so no i18n keys here.

## Deliberate decisions
- Duration renders at natural width, not Figma's authored 92px on "20 min": the fixed width was sized to that sample string and would clip longer durations (#19).
- `duration` is optional: `recipes.time_minutes` is nullable and Figma never draws a "no duration" state, so the whole Time row is omitted rather than showing invented text (#124).
- `imageUrl` is optional, and the no-photo placeholder lives inside the molecule: an `aria-hidden` `bg-surface-primary` `h-24 w-24 rounded-card-inner` box in the Thumbnail's place. A first pass pushed a grid-stacking backdrop hack into `ReceptenBoard`; rejected because it leaked image rendering out of the one component that owns the slot. "No photo yet" is a real data state (`thumbnail_path` is nullable) that Figma does not model (#124).
- `alt` defaults to `""` (decorative), not `name`: the name is already adjacent visible text and would be announced twice. `imageAlt` is an explicit override and is ignored when the placeholder renders.
- Plain `<img>`, never `next/image`: thumbnails live in private R2 (ADR-0024), and the optimizer's cookie-less server-side fetch cannot authenticate a read. The only alternatives (a `service_role` read, or long-lived public signed URLs) violate ADR-0002/0003 (#171).
- Presigned URLs with route fallback: `app/(app)/recepten/page.tsx` presigns every card (`presignRecipeThumbnails`, `lib/recipes/thumbnails.ts`) and `ReceptenBoard` passes it as `imageUrl`, so a normal load makes no `/api/recipe-thumbnail` request. `imageFallbackUrl` (`recipeThumbnailRouteUrl`, `lib/recipes/thumbnail-url.ts`) is swapped in once on `<img>` `onError` (`useImageFallback`, `lib/ui/image-fallback.ts`; a failing fallback does not loop) for tabs left open past the 2 h presign expiry. The fallback's `v` is the stem uuid, so it changes only when the photo does. This is why the component carries `"use client"`. The R2 origin is preconnected via react-dom `preconnect` (ADR-0024 section 5) (#391).
- Stored variants (`lib/recipes/thumbnail-processing.ts`): `card` is 288x288 cover (3x the 96 CSS px slot, for Retina); `full` caps the **long edge** at 1280 with aspect preserved. Width-only capping shipped about 40% cropped-away bytes for portrait photos (hero is `aspect-[2/1]`), a measured 29% cut. A 2:1 crop baked in at encode time was rejected: originals are discarded, so a later hero ratio change would be unrecoverable (#174, #171).
- A recipe with no `thumbnail_path` never requests the route; the caller passes `undefined` and the placeholder renders (#171).

## Token gaps and flags
- Root gap `gap-inline-lg` (`spacing/inline/gap-lg`), thumbnail `rounded-card-inner` (`radius/card-inner`), column `gap-stack-sm` (`spacing/stack/stack-sm`), all bound in Figma (#205).
- The Time row's `gap-2` (8px) has no bound variable in the node and stays raw behind a `spacing-flag:` comment (#205, #218).

## Gotchas
- Stories that pass a transparent 1x1 `imageUrl` render nothing: Figma defines no empty-photo fill, so stories need their own `bg-surface-muted` backdrop (`CardContentRecipe`/`Card` stories have it, `Carousel`/`CardContainer` stories adopted it). The fix belongs in stories, not this component (#24).

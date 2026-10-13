# SharedRecipeOffer
Figma: none (Claude-designed, ADR-0034; visual reference was a card list with a tinted container and a coloured strip) · Code: `components/organisms/SharedRecipeOffer.tsx` (+ `.stories.tsx`)

## Anatomy
One visual unit: a wrapper `flex w-full flex-col rounded-card bg-priority-medium-bg` (the blue `Tag` "medium" background; no border, no padding, no gap) holding two rows:
- The normal recipe `Card` > `CardContentRecipe`, flush against the wrapper's top and sides (both use `rounded-card`, so the corners line up) (thumbnail, title, duration). Not clickable, no link to the source recipe.
- A thin strip (`px-component-md py-component-sm`): `sharing.recipeOffer.sharedBy` ("Gedeeld door {name}", `text-base font-semibold text-priority-medium`) left, then `ml-auto`, two icon-only compact `white` `Button`s: `Check` (aria `acceptLabel`) and `X` (aria `declineLabel`).

## Contract
- Generic and server-free. Props: `name`, `imageUrl?`, `duration?` (already formatted), `inviterName` (first name; the caller resolves the "unnamed" fallback), `onAccept`, `onDecline`, `pending?` (disables both buttons while a request runs).
- The caller does the work. `ReceptenBoard` renders one per `pendingRecipeShares()` row through `BoardView.renderColumnTop` on the first category column. Accept calls `acceptRecipeOffer` (`acceptRecipeShare`, ADR-0036), decline calls `declineRecipeOffer` (`declineShare({ resource: "recipe" })`); both end in `router.refresh()`. Errors render above the board from `sharing.errors.*`.
- Strings: `sharing.recipeOffer.sharedBy`, `acceptLabel`, `declineLabel` (both locales).

## Deliberate decisions
- New organism by exception (ADR-0034): it composes existing parts but carries the sharing copy and the tinted wrapper, and is reused per offer.
- The blue comes from the same tokens as the blue `Tag` (`bg-priority-medium-bg`, `text-priority-medium`). No new token, no border.
- The buttons are `white` so they stand out on the tint; `compact` (32 px) keeps the strip low.
- Not draggable: it lives outside the sortable list (`BoardView.renderColumnTop`).
- No category yet (empty board): `page.tsx` passes no offers, because `accept_recipe_share` needs a first category and would fail.

## Token gaps and flags
- Dark mode: `priority-medium-bg` keeps its light value in dark mode (as the `Tag` does), so the block stays light blue around a dark card. Accepted.

## Gotchas
- Stories: `Default`, `Pending`, `NoThumbnail`.
- A thumbnail URL is presigned on the server (ADR-0036 point 5); there is no route fallback, so a failed image shows the browser's broken image.

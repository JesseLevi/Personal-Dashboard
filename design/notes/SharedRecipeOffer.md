# SharedRecipeOffer
Figma: none (Claude-designed, ADR-0034; visual reference was a card list with a tinted container and a coloured strip) · Code: `components/organisms/SharedRecipeOffer.tsx` (+ `.stories.tsx`)

## Anatomy
A tinted container (`rounded-card border border-priority-medium bg-surface-highlight-blue p-component-sm`) holding two rows, `gap-stack-sm`:
- The normal recipe `Card` > `CardContentRecipe` (thumbnail, title, duration). Not clickable, no link to the source recipe.
- A strip: `sharing.recipeOffer.sharedBy` ("Gedeeld door {name}", `text-base font-semibold text-text-highlight-blue`) left, then `ml-auto`, two icon-only compact `white` `Button`s: `Check` (aria `acceptLabel`) and `X` (aria `declineLabel`).

## Contract
- Generic and server-free. Props: `name`, `imageUrl?`, `duration?` (already formatted), `inviterName` (first name; the caller resolves the "unnamed" fallback), `onAccept`, `onDecline`, `pending?` (disables both buttons while a request runs).
- The caller does the work. `ReceptenBoard` renders one per `pendingRecipeShares()` row through `BoardView.renderColumnTop` on the first category column. Accept calls `acceptRecipeOffer` (`acceptRecipeShare`, ADR-0036), decline calls `declineRecipeOffer` (`declineShare({ resource: "recipe" })`); both end in `router.refresh()`. Errors render above the board from `sharing.errors.*`.
- Strings: `sharing.recipeOffer.sharedBy`, `acceptLabel`, `declineLabel` (both locales).

## Deliberate decisions
- New organism by exception (ADR-0034): it composes existing parts but carries the sharing copy and the tinted wrapper, and is reused per offer.
- The blue family comes from existing tokens: `bg-surface-highlight-blue` (blue-50), `text-text-highlight-blue` (blue-400) and the border `border-priority-medium` (the same blue-400, the Tag "medium" colour). No new token. If a dedicated `stroke-highlight-blue` is ever wanted, that is a token request.
- The buttons are `white` so they stand out on the tint; `compact` (32 px) keeps the strip low.
- Not draggable: it lives outside the sortable list (`BoardView.renderColumnTop`).
- No category yet (empty board): `page.tsx` passes no offers, because `accept_recipe_share` needs a first category and would fail.

## Token gaps and flags
- No blue stroke token; `border-priority-medium` stands in (see above).
- Dark mode: `surface-highlight-blue` keeps its light value (the dark token set has no blue override), so the container stays light blue around a dark card. Accepted, same as the other highlight surfaces.

## Gotchas
- Stories: `Default`, `Pending`, `NoThumbnail`.
- A thumbnail URL is presigned on the server (ADR-0036 point 5); there is no route fallback, so a failed image shows the browser's broken image.

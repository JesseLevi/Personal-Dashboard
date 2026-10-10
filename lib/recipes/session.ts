import "server-only";

// #122 mirrors lib/boards/'s file layout (queries/schemas/types/enums/
// positioning/session), but getAuthenticatedUserId/requireUserId themselves
// are framework-free and table-less -- neither knows about boards, recipes,
// or any other domain, they just resolve/require the signed-in user id the
// same way for all of them. Duplicating them here would create a second copy
// with no behavioural difference, so this file re-exports lib/boards/
// session.ts's implementations instead (see #122's ticket body, which calls
// this out explicitly for getAuthenticatedUserId; #168 added requireUserId
// alongside it for the same reason -- app/(app)/recepten/actions.ts and
// app/(app)/winkelmand/actions.ts used to each define their own copy of
// requireUserId too). lib/recipes/queries.ts, lib/recipes/thumbnails.ts,
// lib/shopping/queries.ts, app/api/recipe-thumbnail/[recipeId]/route.ts and
// both action files import from here, not from lib/boards/session.ts
// directly, so the mirrored layout still holds and a future split (if
// recipes ever need session logic boards doesn't) has an obvious home.
export { getAuthenticatedUserId, isAdmin, requireUserId } from "@/lib/boards/session";

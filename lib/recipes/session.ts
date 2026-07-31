import "server-only";

// #122 mirrors lib/boards/'s file layout (queries/schemas/types/enums/
// positioning/session), but getAuthenticatedUserId itself is framework-free
// and table-less -- it doesn't know about boards, recipes, or any other
// domain, it just resolves the signed-in user id the same way for all of
// them. Duplicating it here would create a second copy of the exact same
// three lines with no behavioural difference, so this file re-exports
// lib/boards/session.ts's implementation instead (see #122's ticket body,
// which calls this out explicitly). lib/recipes/queries.ts and
// app/(app)/recepten/actions.ts both import from here, not from
// lib/boards/session.ts directly, so the mirrored layout still holds and a
// future split (if recipes ever need session logic boards doesn't) has an
// obvious home.
export { getAuthenticatedUserId } from "@/lib/boards/session";

import "server-only";

// #228 mirrors lib/recipes/session.ts exactly: getAuthenticatedUserId/
// requireUserId are framework-free and table-less (lib/boards/session.ts's
// own header comment), so this module re-exports that shared implementation
// rather than defining a fourth near-identical copy for notes. lib/notes/
// queries.ts and app/(app)/notities/actions.ts import from here, not from
// lib/boards/session.ts directly, matching the mirrored per-domain layout
// every other module in this codebase already uses.
export { getAuthenticatedUserId, requireUserId } from "@/lib/boards/session";

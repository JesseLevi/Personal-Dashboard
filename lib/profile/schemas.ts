import { z } from "zod";

// Validates every server-action input in lib/profile/actions.ts (#162), same
// pattern as lib/notes/schemas.ts / lib/recipes/schemas.ts.

// Mirrors profiles.locale's check constraint exactly
// (supabase/migrations/20260720000001_profiles.sql: `check (locale in
// ('nl', 'en'))`) -- z.enum rejects anything else at the action boundary
// before it ever reaches the database, rather than relying on the DB
// constraint to reject it (which would surface as an opaque 23514 error).
export const updateLocaleSchema = z.object({
  locale: z.enum(["nl", "en"]),
});

// profiles.display_name is a bare `text` column with no DB constraint
// (20260720000001_profiles.sql), so the 40-char cap is an app-level choice
// (#398): long enough for any name, short enough for the sidebar account row.
// Trimmed; an empty/whitespace-only string becomes null (= "no name", the
// sidebar then shows its fallback name).
export const DISPLAY_NAME_MAX_LENGTH = 40;
// #404: display_name now holds the FIRST name; last_name sits next to it and
// follows the same rules. Both are written in one update.
const nameField = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX_LENGTH)
  .transform((value) => (value === "" ? null : value));
export const updateNameSchema = z.object({
  firstName: nameField,
  lastName: nameField,
});

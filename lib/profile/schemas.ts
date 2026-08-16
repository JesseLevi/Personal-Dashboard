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

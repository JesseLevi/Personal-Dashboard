"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/profile/session";
import { updateDisplayNameSchema, updateLocaleSchema } from "@/lib/profile/schemas";
import type { ActionResult } from "@/lib/profile/types";

// Write side of #162 -- deliberately its own module with no page/component
// dependency (unlike app/(app)/*/actions.ts, which sit next to the page that
// composes them) because the caller here is #265's Settings panel, which
// hadn't landed yet when this was written. Follows every other actions.ts in
// this codebase exactly:
//   1. parses its input with the matching lib/profile/schemas.ts schema;
//   2. resolves the signed-in user via requireUserId() and writes only that
//      user's own row (on top of RLS -- don't trust the client for
//      ownership, #92's original note, applied here the same way);
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `<namespace>.errors.${error}` in the message catalog.
//
// Interface contract for #265: updateLocale(input: unknown) =>
// Promise<ActionResult>. `input` must parse as { locale: "nl" | "en" }
// (updateLocaleSchema) -- pass e.g. { locale: "en" }.

export async function updateLocale(input: unknown): Promise<ActionResult> {
  const parsed = updateLocaleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ locale: parsed.data.locale })
    .eq("id", auth.userId);

  if (error) {
    console.error("[profile] updateLocale failed:", error.code, error.message);
    return { success: false, error: "generic" };
  }

  // The locale feeds the root layout (i18n/request.ts -> getUserLocale),
  // not just one page -- a bare revalidatePath("/") would not also
  // re-render other route segments that read the same layout-level data,
  // same "layout" type argument reasoning as every other write action in
  // this codebase that must invalidate more than its own page (e.g.
  // app/(app)/notities/actions.ts's revalidatePath("/notities", "layout")).
  revalidatePath("/", "layout");

  return { success: true, data: undefined };
}

// #398: same pattern as updateLocale. `input` must parse as
// { displayName: string } (updateDisplayNameSchema); empty -> null.
export async function updateDisplayName(input: unknown): Promise<ActionResult> {
  const parsed = updateDisplayNameSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", auth.userId);

  if (error) {
    console.error("[profile] updateDisplayName failed:", error.code, error.message);
    return { success: false, error: "generic" };
  }

  // The name feeds the sidebar account row in the app layout.
  revalidatePath("/", "layout");

  return { success: true, data: undefined };
}

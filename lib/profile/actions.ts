"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/profile/session";
import { updateNameSchema, updateLocaleSchema, setAiEnabledSchema } from "@/lib/profile/schemas";
import { clearAvatar, storeAvatar } from "@/lib/profile/avatar";
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

// #398/#404: same pattern as updateLocale. `input` must parse as
// { firstName: string, lastName: string } (updateNameSchema); empty -> null.
// First name -> profiles.display_name, last name -> profiles.last_name, one
// update. Fails with "generic" until the #404 migration is applied.
export async function updateName(input: unknown): Promise<ActionResult> {
  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.firstName, last_name: parsed.data.lastName })
    .eq("id", auth.userId);

  if (error) {
    console.error("[profile] updateName failed:", error.code, error.message);
    return { success: false, error: "generic" };
  }

  // The name feeds the sidebar account row in the app layout.
  revalidatePath("/", "layout");

  return { success: true, data: undefined };
}

// ADR-0043 §2 (#579): set_ai_enabled() is the only writer of the ai_* columns;
// switching off deletes the member's embeddings in the same transaction.
export async function setAiEnabled(input: unknown): Promise<ActionResult> {
  const parsed = setAiEnabledSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_ai_enabled", { p_enabled: parsed.data.enabled });

  if (error) {
    console.error("[profile] setAiEnabled failed:", error.code, error.message);
    return { success: false, error: "generic" };
  }

  revalidatePath("/", "layout");

  return { success: true, data: undefined };
}

// #434: profile photo. `formData` carries the picked image under "file"; the
// server re-encodes it (the browser never talks to R2). The layout
// revalidation refreshes the Sidebar avatar.
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const result = await storeAvatar(formData.get("file"));
  if (result.success) revalidatePath("/", "layout");
  return result;
}

export async function removeAvatar(): Promise<ActionResult> {
  const result = await clearAvatar();
  if (result.success) revalidatePath("/", "layout");
  return result;
}

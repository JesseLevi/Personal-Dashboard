"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/profile/session";
import { createWidgetTokenSchema, deleteWidgetTokenSchema } from "@/lib/widget/schemas";
import { createWidgetToken, deleteWidgetToken } from "@/lib/widget/tokens";
import type { WidgetActionResult } from "@/lib/widget/types";

/** Returns the plaintext token once; the client shows it and never gets it again. */
export async function createWidgetTokenAction(input: unknown): Promise<WidgetActionResult<{ token: string }>> {
  const parsed = createWidgetTokenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: "unauthenticated" };

  const result = await createWidgetToken(parsed.data.label);
  if ("error" in result) return { success: false, error: result.error };

  revalidatePath("/", "layout");
  return { success: true, data: { token: result.token } };
}

export async function deleteWidgetTokenAction(input: unknown): Promise<WidgetActionResult> {
  const parsed = deleteWidgetTokenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: "unauthenticated" };

  const result = await deleteWidgetToken(parsed.data.id);
  if (result) return { success: false, error: result.error };

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

"use server";

import { redirect } from "next/navigation";
import { clearLoginEmail } from "@/lib/auth/login-email-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMagicLinkOtpType } from "./otp-types";

const SIGNED_IN_TARGET = "/te-doen";
const INVALID_LINK_TARGET = "/login?error=magic-link-invalid";
const MAX_TOKEN_HASH_LENGTH = 512;

// The only place the mailed link signs anyone in. GET /auth/confirm just renders the
// screen with a form; this runs when that form is posted (ADR-0003, ADR-0038).
// The form fields are untrusted: `type` is checked against an allow-list here.
export async function confirmMagicLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  if (
    typeof tokenHash !== "string" ||
    tokenHash.length === 0 ||
    tokenHash.length > MAX_TOKEN_HASH_LENGTH ||
    !isMagicLinkOtpType(type)
  ) {
    redirect(INVALID_LINK_TARGET);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect(INVALID_LINK_TARGET);

  await clearLoginEmail();
  redirect(SIGNED_IN_TARGET);
}

import type { EmailOtpType } from "@supabase/supabase-js";

// The mail template only ever links `type=email`; `magiclink` is the legacy name for the
// same flow. Recovery, invite, signup and e-mail change have no sign-in-by-link flow here.
export const MAGIC_LINK_OTP_TYPES = ["email", "magiclink"] as const satisfies readonly EmailOtpType[];
export type MagicLinkOtpType = (typeof MAGIC_LINK_OTP_TYPES)[number];

export function isMagicLinkOtpType(value: unknown): value is MagicLinkOtpType {
  return typeof value === "string" && (MAGIC_LINK_OTP_TYPES as readonly string[]).includes(value);
}

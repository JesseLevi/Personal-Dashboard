import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLoginEmail } from "@/lib/auth/login-email-cookie";
import { maskEmail } from "@/lib/auth/mask-email";
import { confirmMagicLink } from "./actions";
import { ConfirmForm } from "./ConfirmForm";
import { isMagicLinkOtpType } from "./otp-types";

// The link carries a one-time token: keep the page out of search indexes and keep the
// URL out of the Referer header of anything the page loads.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Magic-link landing (ADR-0003, ADR-0038). A GET has no side effects: it only shows who
// would be signed in. The sign-in itself is the POST to `confirmMagicLink`.
export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  if (typeof tokenHash !== "string" || !tokenHash || !isMagicLinkOtpType(type)) {
    redirect("/login?error=magic-link-invalid");
  }

  // httpOnly cookie from the browser that asked for the mail; absent when the link
  // is opened elsewhere.
  const email = await getLoginEmail();

  return (
    <ConfirmForm
      maskedEmail={email ? maskEmail(email) : null}
      tokenHash={tokenHash}
      type={type}
      confirmAction={confirmMagicLink}
    />
  );
}

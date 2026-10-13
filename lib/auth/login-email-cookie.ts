import "server-only";
import { cookies } from "next/headers";
import { magicLinkSchema } from "@/lib/auth/schemas";

// The address of a pending e-mail-code login travels in this cookie, never in
// the URL or a form field: /login/code reads it server-side, so the verify
// action cannot be pointed at another account's address (#492).
export const LOGIN_EMAIL_COOKIE = "atlas_login_email";
export const LOGIN_EMAIL_MAX_AGE_SECONDS = 600;

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/login",
} as const;

export async function setLoginEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(LOGIN_EMAIL_COOKIE, email, { ...BASE_OPTIONS, maxAge: LOGIN_EMAIL_MAX_AGE_SECONDS });
}

/** The pending address, or null when absent or no longer a valid e-mail. */
export async function getLoginEmail(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(LOGIN_EMAIL_COOKIE)?.value;
  const parsed = magicLinkSchema.safeParse({ email: raw });
  return parsed.success ? parsed.data.email : null;
}

export async function clearLoginEmail(): Promise<void> {
  const store = await cookies();
  store.set(LOGIN_EMAIL_COOKIE, "", { ...BASE_OPTIONS, maxAge: 0 });
}

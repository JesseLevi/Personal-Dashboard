"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginCodeSchema, magicLinkSchema, passwordLoginSchema } from "@/lib/auth/schemas";
import { clearLoginEmail, getLoginEmail, setLoginEmail } from "@/lib/auth/login-email-cookie";
import { consumeLoginAttempt } from "@/lib/auth/login-rate-limit";
import { checkLoginTurnstile, getRequestContext } from "@/lib/auth/turnstile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// #158 rewrote both actions from redirect-with-querystring to the
// `useActionState` shape `(prevState, formData) => Promise<State>` so
// LoginForm.tsx's two-step animation can keep its step client-side across a
// submission instead of losing it on a full navigation. Password success
// returns `{ status: "success" }`: LoginForm plays its exit animation,
// then navigates, so the session cookie is already set when it does.

export type PasswordLoginState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; errorKey: "invalid-input" | "invalid-credentials" | "rate-limited" };

export type LoginCodeSendState =
  | { status: "idle" }
  | { status: "error"; errorKey: "invalid-input" | "rate-limited" | "send-failed" }
  | { status: "sent" };

export type VerifyLoginCodeState =
  | { status: "idle" }
  | { status: "error"; errorKey: "invalid-input" | "invalid-code" | "rate-limited" }
  | { status: "success" };

// Step 3's password form. Unknown email and wrong password deliberately
// collapse into the same "invalid-credentials" error (#158) — a distinct
// "no such account" message would make this screen a user-enumeration
// oracle, since step 1 never checks whether the address exists.
export async function signInWithPassword(
  _prevState: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "error", errorKey: "invalid-input" };

  // Bot check, then a per-address/client/global attempt budget (identical answer
  // for known and unknown addresses). Every attempt counts.
  const ctx = await getRequestContext();
  if (!(await checkLoginTurnstile(formData.get("turnstileToken"), ctx))) {
    return { status: "error", errorKey: "rate-limited" };
  }
  if (!(await consumeLoginAttempt("password", parsed.data.email, ctx.clientKey))) {
    return { status: "error", errorKey: "rate-limited" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", errorKey: isRateLimited(error) ? "rate-limited" : "invalid-credentials" };
  }

  return { status: "success" };
}

// Step 3's login-code form. Sends to the address carried over from step 1
// (hidden field, LoginForm.tsx), remembers it in the httpOnly cookie that
// /login/code reads, and answers "sent" so LoginForm can play its exit and
// navigate there (#492).
export async function sendLoginCode(
  _prevState: LoginCodeSendState,
  formData: FormData,
): Promise<LoginCodeSendState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", errorKey: "invalid-input" };
  const ctx = await getRequestContext();
  if (!(await checkLoginTurnstile(formData.get("turnstileToken"), ctx))) {
    return { status: "error", errorKey: "rate-limited" };
  }
  return deliverLoginCode(parsed.data.email, ctx.clientKey);
}

// Same as sendLoginCode, but for an address already in the cookie and without
// leaving /login/code.
export async function resendLoginCode(): Promise<LoginCodeSendState> {
  const email = await getLoginEmail();
  if (!email) return { status: "error", errorKey: "invalid-input" };
  // No Turnstile here: /login/code has no widget, and the address comes from
  // the cookie a bot-checked send set.
  return deliverLoginCode(email, (await getRequestContext()).clientKey);
}

async function deliverLoginCode(email: string, clientKey: string): Promise<LoginCodeSendState> {
  // Same answer for known and unknown addresses; a granted send also resets
  // that address's verify budget (the new code is a new secret).
  if (!(await consumeLoginAttempt("send", email, clientKey))) {
    return { status: "error", errorKey: "rate-limited" };
  }
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // shouldCreateUser defaults to true — without this flag a code request
    // self-provisions an account, and there is no self-signup flow.
    // emailRedirectTo: the mail also carries a link that lands on /auth/confirm.
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: false },
  });
  if (error && isRateLimited(error)) return { status: "error", errorKey: "rate-limited" };
  // Anti-enumeration (ADR-0031): with shouldCreateUser=false GoTrue refuses an
  // address that has no account. Answering anything but "sent" would turn this
  // screen into an oracle for which addresses exist, so that case looks sent,
  // and the code page then simply never accepts a code.
  if (error && !isUnknownUser(error)) return { status: "error", errorKey: "send-failed" };

  await setLoginEmail(email);
  return { status: "sent" };
}

// Reads the address from the cookie, never from the form, so a code can only
// be redeemed for the address it was requested for.
export async function verifyLoginCode(
  _prevState: VerifyLoginCodeState,
  formData: FormData,
): Promise<VerifyLoginCodeState> {
  const parsed = loginCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { status: "error", errorKey: "invalid-input" };
  const email = await getLoginEmail();
  if (!email) return { status: "error", errorKey: "invalid-code" };

  // Budget per address, counted whatever cookie or session the guess comes from.
  const { clientKey } = await getRequestContext();
  if (!(await consumeLoginAttempt("verify", email, clientKey))) {
    return { status: "error", errorKey: "rate-limited" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  if (error) {
    return { status: "error", errorKey: isRateLimited(error) ? "rate-limited" : "invalid-code" };
  }

  await clearLoginEmail();
  return { status: "success" };
}

// "Ander e-mailadres" on /login/code.
export async function changeLoginEmail() {
  await clearLoginEmail();
  redirect("/login");
}

function isRateLimited(error: { status?: number; code?: string }) {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  );
}

function isUnknownUser(error: { code?: string }) {
  return error.code === "otp_disabled" || error.code === "user_not_found";
}

// No UI calls this since #158 removed the placeholder homepage's sign-out
// button and no replacement entry point exists yet (undesigned) — kept as a
// real, working server action for whichever future ticket adds one.
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

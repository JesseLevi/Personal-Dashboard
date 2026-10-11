"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { magicLinkSchema, passwordLoginSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// #158 rewrote both actions from redirect-with-querystring to the
// `useActionState` shape `(prevState, formData) => Promise<State>` so
// LoginForm.tsx's two-step animation can keep its step client-side across a
// submission instead of losing it on a full navigation. Password success
// returns `{ status: "success" }` (#413): LoginForm plays its exit animation,
// then navigates, so the session cookie is already set when it does.

export type PasswordLoginState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; errorKey: "invalid-input" | "invalid-credentials" };

export type MagicLinkState =
  | { status: "idle" }
  | { status: "error"; errorKey: "invalid-input" | "magic-link-failed" }
  | { status: "sent" };

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", errorKey: "invalid-credentials" };

  return { status: "success" };
}

// Step 3's magic-link form. Sends to the address carried over from step 1
// (hidden field, LoginForm.tsx) — never redirects on success, since the
// button itself becomes the confirmation ("Inlog link verstuurd", #158).
export async function sendMagicLink(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", errorKey: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // shouldCreateUser defaults to true — without this flag a magic-link
    // request self-provisions an account, and there is no self-signup flow.
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: false },
  });
  if (error) return { status: "error", errorKey: "magic-link-failed" };

  return { status: "sent" };
}

// No UI calls this since #158 removed the placeholder homepage's sign-out
// button and no replacement entry point exists yet (undesigned) — kept as a
// real, working server action for whichever future ticket adds one.
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { magicLinkSchema, passwordLoginSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid-input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid-credentials");

  redirect("/");
}

export async function sendMagicLink(formData: FormData) {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/login?error=invalid-input");

  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // shouldCreateUser defaults to true — without this flag a magic-link
    // request self-provisions an account, and there is no self-signup flow.
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: false },
  });
  if (error) redirect("/login?error=magic-link-failed");

  redirect("/login?notice=magic-link-sent");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

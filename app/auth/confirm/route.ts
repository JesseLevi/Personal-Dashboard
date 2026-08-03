import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Magic-link landing: GoTrue mails a link to /auth/confirm?token_hash=…&type=email;
// verifying the OTP here sets the session cookie server-side (ADR-0003).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/te-doen", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=magic-link-invalid", request.url));
}

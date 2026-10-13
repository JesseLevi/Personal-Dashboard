import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLoginEmail } from "@/lib/auth/login-email-cookie";
import { shouldRedirectAuthenticated } from "@/lib/auth/login-redirect";
import { maskEmail } from "@/lib/auth/mask-email";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { changeLoginEmail, resendLoginCode, verifyLoginCode } from "../actions";
import { LoginCodeFormClient } from "./LoginCodeFormClient";

// Second step of login by e-mail code (#492). Frame and visual come from
// ../layout.tsx; the address is read from the httpOnly cookie the send action set.
export default async function LoginCodePage() {
  const userId = await getAuthenticatedUserId();
  // Same rule as /login: a verify action re-renders this route with the fresh session,
  // and the form must stay mounted to play its exit and navigate itself.
  const isServerAction = (await headers()).has("next-action");
  if (shouldRedirectAuthenticated({ userId, isServerAction })) redirect("/te-doen");

  const email = await getLoginEmail();
  // Cookie expired or never set (direct visit): start over. After a successful verify the
  // cookie is gone while the exit plays, so a server action re-render must not bounce here.
  if (!email && !isServerAction) redirect("/login");

  return (
    <LoginCodeFormClient
      maskedEmail={email ? maskEmail(email) : ""}
      verifyLoginCodeAction={verifyLoginCode}
      resendLoginCodeAction={resendLoginCode}
      changeLoginEmailAction={changeLoginEmail}
    />
  );
}

import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "@/lib/profile/queries";

// #162: locale now comes from the signed-in user's profiles.locale.
// getRequestConfig runs on *every* request -- including /login and every
// other signed-out route -- and next-intl requires it to never throw and
// never redirect, so a hard failure here would break the whole app. The
// try/catch is defense in depth on top of getUserLocale's own internal
// fallbacks (signed out / missing profile / DB error / invalid value all
// already resolve to "nl" inside that function).
//
// It must NOT swallow everything, though: reading profiles.locale reads
// cookies, and during `next build`'s static probe Next signals "this route
// cannot be static" by THROWING DYNAMIC_SERVER_USAGE. That is control flow,
// not a failure -- catching it both spams the build log with stack traces
// and hides the bailout from Next, so it is rethrown untouched.
const DYNAMIC_SERVER_USAGE = "DYNAMIC_SERVER_USAGE";

function isNextDynamicUsage(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { digest?: unknown }).digest === DYNAMIC_SERVER_USAGE
  );
}

export default getRequestConfig(async () => {
  let locale: "nl" | "en" = "nl";
  try {
    locale = await getUserLocale();
  } catch (error) {
    if (isNextDynamicUsage(error)) throw error;
    console.error("[i18n] getUserLocale failed, falling back to nl:", error);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "@/lib/profile/queries";

// #162: locale now comes from the signed-in user's profiles.locale.
// getRequestConfig runs on *every* request -- including /login and every
// other signed-out route -- and next-intl requires it to never throw and
// never redirect, so a hard failure here would break the whole app. The
// try/catch is defense in depth on top of getUserLocale's own internal
// fallbacks (signed out / missing profile / DB error / invalid value all
// already resolve to "nl" inside that function) -- this catches anything
// unexpected (e.g. a cookies()/auth call throwing outside those known
// cases) so this function itself keeps the same "never throw" guarantee.
export default getRequestConfig(async () => {
  let locale: "nl" | "en" = "nl";
  try {
    locale = await getUserLocale();
  } catch (error) {
    console.error("[i18n] getUserLocale failed, falling back to nl:", error);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

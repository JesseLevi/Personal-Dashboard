import { getRequestConfig } from "next-intl/server";

// Locale comes from profiles.locale once auth lands (Phase 1); until then NL.
export default getRequestConfig(async () => {
  const locale = "nl";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

import { getTranslations } from "next-intl/server";

// Served by the service worker for any page it cannot fetch (ADR-0054). Cached
// once at install, so it must not depend on a session.
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-stack-md bg-surface-primary p-component-lg text-center">
      <h1 className="text-2xl font-bold text-text-primary">{t("title")}</h1>
      <p className="max-w-sm text-base font-medium text-text-secondary">{t("body")}</p>
    </main>
  );
}

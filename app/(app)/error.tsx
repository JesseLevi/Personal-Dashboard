"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";

// #170: route-group-level error boundary for unhandled (app) errors —
// catches anything a page/layout throws below AppShellNav (e.g. a query
// that throws in queries.ts, per that module's own comment) so the sidebar
// shell stays mounted around a real error state instead of a blank screen.
// No Figma error state exists; reuses the same plain-text, no-toast
// convention already used for drag-persist/move failures elsewhere
// (TeDoenBoard.tsx, ReceptenBoard.tsx: `text-priority-urgent`, a `Button` to
// retry) rather than inventing a new look.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common.errorBoundary");

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xl font-semibold text-text-primary">{t("title")}</p>
        <p className="text-base text-priority-urgent">{t("body")}</p>
      </div>
      <Button variant="outline" onClick={reset}>
        {t("retryLabel")}
      </Button>
    </div>
  );
}

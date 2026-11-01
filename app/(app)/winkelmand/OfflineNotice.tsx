"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

/** "Offline: laatst bijgewerkt om …" above a basket served from the service worker cache (ADR-0054). */
export function OfflineNotice({ renderedAt }: { renderedAt: string }) {
  const t = useTranslations("shopping.offline");
  const format = useFormatter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p role="status" className="text-base font-semibold text-priority-urgent">
      {t("notice", { time: format.dateTime(new Date(renderedAt), { hour: "2-digit", minute: "2-digit" }) })}
    </p>
  );
}

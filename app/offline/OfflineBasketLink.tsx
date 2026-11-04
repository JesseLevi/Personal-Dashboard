"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { hasCachedBasket } from "@/lib/pwa/offline-cache";

/** "Naar je mand" on the offline page, only when a basket is stored on this device (ADR-0054). Needs no session. */
export function OfflineBasketLink() {
  const t = useTranslations("offline");
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void hasCachedBasket().then((found) => {
      if (active) setAvailable(found);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;
  // A full navigation (not next/link), so the worker serves the stored basket.
  return <Button onClick={() => window.location.assign("/winkelmand")}>{t("basket")}</Button>;
}

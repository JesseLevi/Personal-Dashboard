"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hasNewParam, withoutNewParam } from "@/lib/dom/new-param";

/**
 * Runs `onNew` once per `?nieuw=1` visit, on first mount and on a soft
 * navigation to the same page, then drops the param from the URL.
 */
export function useNewParam(onNew: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  });

  // Survives strict mode's second effect run; reset once the param is gone.
  const handled = useRef(false);
  const present = hasNewParam(searchParams);
  useEffect(() => {
    if (!present) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    latest.current();
    router.replace(withoutNewParam(pathname, searchParams), { scroll: false });
  }, [present, pathname, router, searchParams]);
}

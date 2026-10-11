"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { blurFadeStagger, blurInTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { clearEnterFromLogin, hasEnterFromLogin } from "@/lib/ui/login-enter";
import { cn } from "@/lib/ui/cn";

// Blur-in for one page region, only right after a login. Record: design/notes/TeDoenBoard.md.
export function EnterFromLogin({ index, children }: { index: number; children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [entering, setEntering] = useState(false);

  // Layout effects run before the first paint, so a marked arrival never shows the
  // region un-hidden; the first render matches the server HTML (no hydration mismatch).
  useLayoutEffect(() => {
    if (hasEnterFromLogin()) setEntering(true);
  }, []);

  // The class goes away afterwards: its fill keeps `filter`, a containing block for fixed panels.
  useEffect(() => {
    if (!entering) return;
    const id = window.setTimeout(() => {
      setEntering(false);
      clearEnterFromLogin();
    }, blurInTotalMs(index + 1, reduced) + 50);
    return () => window.clearTimeout(id);
  }, [entering, index, reduced]);

  return (
    <div className={cn("min-w-0", entering && ["animate-blur-in", blurFadeStagger(index)])}>
      {children}
    </div>
  );
}

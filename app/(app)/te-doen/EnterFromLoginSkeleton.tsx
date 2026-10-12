"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { blurInTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { claimSkeletonEnter } from "@/lib/ui/login-enter";
import { cn } from "@/lib/ui/cn";

// Loading fallback right after a login: the first skeleton blurs in, so the exit of the
// login form is followed by one enter instead of a bare skeleton cut and then a second
// enter on the content. Later skeletons (stages) and the content stay static. Record:
// design/notes/TeDoenBoard.md.
export function EnterFromLoginSkeleton({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [entering, setEntering] = useState(false);

  useLayoutEffect(() => {
    if (claimSkeletonEnter()) setEntering(true);
  }, []);

  // The class goes away afterwards: its fill keeps `filter` on the wrapper.
  useEffect(() => {
    if (!entering) return;
    const id = window.setTimeout(() => setEntering(false), blurInTotalMs(1, reduced) + 50);
    return () => window.clearTimeout(id);
  }, [entering, reduced]);

  return <div className={cn("min-w-0", entering && "animate-blur-in")}>{children}</div>;
}

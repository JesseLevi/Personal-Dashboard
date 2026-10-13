"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { blurFadeStagger } from "@/lib/ui/blur-fade";
import { cn } from "@/lib/ui/cn";

// Carries LoginForm's exit to the page's visual as React state. A CSS `:has([data-exiting])`
// hook did not restart the animation reliably in iOS Safari, so the image stayed while
// Te doen already showed. Record: design/notes/LoginForm.md.
const LoginExitContext = createContext<{ exiting: boolean; startExit: () => void }>({
  exiting: false,
  startExit: () => {},
});

export function LoginExitProvider({ children }: { children: ReactNode }) {
  const [exiting, setExiting] = useState(false);
  return (
    <LoginExitContext.Provider value={{ exiting, startExit: () => setExiting(true) }}>
      {children}
    </LoginExitContext.Provider>
  );
}

export function useLoginExit() {
  return useContext(LoginExitContext);
}

/** The page's decorative visual: blurs out last (stagger `index`) once the form exits. */
export function LoginVisual({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  const { exiting } = useLoginExit();
  return (
    <div className={cn(className, exiting && ["animate-blur-out", blurFadeStagger(index)])}>{children}</div>
  );
}

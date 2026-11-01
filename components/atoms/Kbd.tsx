// design: Claude-designed (#686)
import { cn } from "@/lib/ui/cn";
import type { HTMLAttributes } from "react";

/** Atom/Kbd: a key chip. `children` is the key label. Contract: design/notes/Kbd.md. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 justify-center rounded-control-inner border border-stroke-primary px-component-xs font-sans text-sm font-semibold text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

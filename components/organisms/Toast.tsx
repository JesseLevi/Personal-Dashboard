"use client";

// design: Claude-designed on request (#466), design/notes/Toast.md.
import { useEffect, useState } from "react";
import { Dropdown } from "@/components/atoms/Dropdown";
import { cn } from "@/lib/ui/cn";

const TRANSITION_MS = 300;

export interface ToastProps {
  /** Text to show; `null` shows nothing. A new string restarts the timer. */
  message: string | null;
  /** Called once the toast has slid out; the caller then sets `message` to `null`. */
  onDismiss: () => void;
  /** How long the toast stays before sliding out. `Infinity` keeps it (static stories). */
  durationMs?: number;
}

/**
 * Organism/Toast — a short status message fixed at the top centre of the
 * viewport. Slides down, stays `durationMs`, slides up, then calls
 * `onDismiss`. See design/notes/Toast.md.
 */
export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message === null) {
      setText(null);
      setVisible(false);
      return;
    }
    setText(message);
    setVisible(false);
    const enter = requestAnimationFrame(() => setVisible(true));
    const timers: number[] = [];
    if (Number.isFinite(durationMs)) {
      timers.push(
        window.setTimeout(() => setVisible(false), durationMs),
        window.setTimeout(onDismiss, durationMs + TRANSITION_MS),
      );
    }
    return () => {
      cancelAnimationFrame(enter);
      timers.forEach((id) => window.clearTimeout(id));
    };
    // onDismiss is intentionally not a dependency: a new callback identity must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, durationMs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[1000] flex justify-center px-component-sm pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      {text !== null && (
        <div
          className={cn(
            "w-fit max-w-full transition duration-300 ease-out motion-reduce:transition-opacity",
            visible ? "translate-y-0 opacity-100" : "-translate-y-[200%] opacity-0 motion-reduce:translate-y-0",
          )}
        >
          <Dropdown className="shadow-sm">
            {/* Looks like a `Button variant="white"` row but is inert text. */}
            <p
              role="status"
              aria-live="polite"
              className="flex h-10 items-center rounded-control px-component-sm text-base font-semibold text-text-secondary"
            >
              {text}
            </p>
          </Dropdown>
        </div>
      )}
    </div>
  );
}

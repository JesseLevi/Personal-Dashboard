"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BLUR_FADE, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { clearTitleMorph, peekTitleMorph, registerLiveTitle } from "@/lib/ui/title-morph";
import { cn } from "@/lib/ui/cn";

/**
 * The page title inside PageHeader. When `title` changes (or the header mounts
 * right after a board switch), the old name blurs out, the new one blurs in
 * and the h1's width animates between the two, so the adornments glide.
 * Record: design/notes/PageHeader.md.
 */
interface Morph {
  out: string | null;
  fromWidth: number;
  toWidth: number;
  step: "from" | "to";
}

// Slack after the width transition, so the cleanup never cuts it short.
const SETTLE_MS = 60;

export function PageHeaderTitle({ title, pending = false }: { title: string; pending?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<{ text: string; width: number } | null>(null);
  const [morph, setMorph] = useState<Morph | null>(null);
  const [fading, setFading] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const animating = useRef(false);

  // A loading skeleton keeps showing the outgoing name instead of a placeholder.
  useLayoutEffect(() => {
    if (pending) setHeld(peekTitleMorph()?.text ?? null);
  }, [pending]);

  useLayoutEffect(() => {
    const h1 = h1Ref.current;
    const text = textRef.current;
    if (pending || !h1 || !text) return;
    const toWidth = text.getBoundingClientRect().width;
    const last = previous.current;
    let from: { text: string; width: number } | null = null;
    if (last && last.text !== title) {
      from = { text: last.text, width: animating.current ? h1.getBoundingClientRect().width : last.width };
    } else if (!last) {
      from = peekTitleMorph();
      if (from?.text === title) {
        clearTitleMorph();
        from = null;
      }
    }
    previous.current = { text: title, width: toWidth };
    if (!from) return;
    animating.current = true;
    setFading(true);
    if (reduced) {
      setMorph(null);
      return;
    }
    h1.style.setProperty("--title-w", `${from.width}px`);
    setMorph({ out: from.text, fromWidth: from.width, toWidth, step: "from" });
  }, [title, pending, reduced]);

  // Lets an armed board switch read the visible name and its current width.
  useEffect(() => {
    if (pending) return;
    return registerLiveTitle(() => {
      const text = textRef.current;
      const current = previous.current;
      return text && current ? { text: current.text, width: text.getBoundingClientRect().width } : null;
    });
  }, [pending]);

  // from -> to on the next frames, then back to the natural width.
  useEffect(() => {
    const h1 = h1Ref.current;
    if (!fading || !h1) return;
    let frame = 0;
    if (morph?.step === "from") {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          h1.style.setProperty("--title-w", `${morph.toWidth}px`);
          setMorph({ ...morph, step: "to" });
        });
      });
      return () => cancelAnimationFrame(frame);
    }
    const ms = (reduced ? BLUR_FADE.reducedMs : BLUR_FADE.inMs) + SETTLE_MS;
    const timer = window.setTimeout(() => {
      animating.current = false;
      h1.style.removeProperty("--title-w");
      clearTitleMorph();
      setMorph(null);
      setFading(false);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [fading, morph, reduced]);

  const shown = pending ? (held ?? title) : title;
  return (
    <h1
      ref={h1Ref}
      className={cn(
        "relative text-xl font-semibold text-text-primary",
        pending && held === null && "invisible",
        morph &&
          "w-[var(--title-w)] shrink-0 overflow-hidden whitespace-nowrap transition-[width] duration-[var(--blur-fade-in-duration)] ease-[var(--blur-fade-ease)]",
      )}
    >
      {morph?.out != null && (
        <span aria-hidden className="absolute top-0 left-0 animate-blur-out">
          {morph.out}
        </span>
      )}
      <span key={shown} ref={textRef} className={cn(fading && !pending && "animate-blur-in")}>
        {shown}
      </span>
    </h1>
  );
}

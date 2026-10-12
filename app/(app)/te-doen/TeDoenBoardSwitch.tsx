"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { armTitleMorph } from "@/lib/ui/title-morph";
import { blurOutTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";

// Board switch = exit fade, then navigation, then enter fade on the
// new board's mount. Reasoning: design/notes/TeDoenBoard.md.
interface TeDoenBoardSwitchApi {
  /** True from the click until the page shows another board; the columns stay hidden. */
  exiting: boolean;
  /** Fades the current board out, then navigates to `href` (a different board). */
  switchTo: (targetBoardId: string, href: string) => void;
}

const TeDoenBoardSwitchContext = createContext<TeDoenBoardSwitchApi | null>(null);

export function useTeDoenBoardSwitch(): TeDoenBoardSwitchApi {
  const api = useContext(TeDoenBoardSwitchContext);
  if (!api) throw new Error("useTeDoenBoardSwitch must be used inside TeDoenBoardSwitchProvider");
  return api;
}

// Module scope so it survives the route change: tells the new board it
// arrived via a switch. A first load or reload never sets it. The age cap
// drops a flag left by a navigation that never landed.
const ENTER_FLAG_MAX_AGE_MS = 8000;
let pendingEnter: { boardId: string; at: number } | null = null;

/** Pure read (safe twice under strict mode); `clearBoardEnter` consumes it. */
export function wantsBoardEnter(boardId: string): boolean {
  return (
    pendingEnter !== null &&
    pendingEnter.boardId === boardId &&
    Date.now() - pendingEnter.at < ENTER_FLAG_MAX_AGE_MS
  );
}

export function clearBoardEnter() {
  pendingEnter = null;
}

export function TeDoenBoardSwitchProvider({
  boardId,
  columnCount,
  children,
}: {
  boardId: string;
  columnCount: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  // Keyed by board, so it resets by itself once the page shows another board.
  const [exitingFor, setExitingFor] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api: TeDoenBoardSwitchApi = {
    exiting: exitingFor === boardId,
    switchTo: (targetBoardId, href) => {
      if (timer.current) return;
      router.prefetch(href);
      setExitingFor(boardId);
      timer.current = setTimeout(() => {
        timer.current = null;
        armTitleMorph();
        pendingEnter = { boardId: targetBoardId, at: Date.now() };
        router.push(href);
      }, blurOutTotalMs(columnCount, reduced));
    },
  };

  return (
    <TeDoenBoardSwitchContext.Provider value={api}>{children}</TeDoenBoardSwitchContext.Provider>
  );
}

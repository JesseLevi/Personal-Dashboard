"use client";

import { useCallback, useEffect, useRef } from "react";

// ADR-0031: invisible Cloudflare Turnstile widget for the login greeting
// lookup. Loaded only when the login page passes a site key; any failure
// (script blocked, widget error, timeout) resolves to `null`, which the
// caller treats as "skip the lookup". Tokens are single-use, so every
// `getToken()` resets the widget before executing it.

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 10_000;
export const TURNSTILE_ACTION = "login_greeting";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      execution: "execute" | "render";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.turnstile ?? null));
    script.addEventListener("error", () => resolve(null));
  });
}

export function useTurnstile(siteKey: string | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const api = useRef<TurnstileApi | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    void loadScript().then((turnstile) => {
      const container = containerRef.current;
      if (cancelled || !turnstile || !container) return;
      api.current = turnstile;
      widgetId.current = turnstile.render(container, {
        sitekey: siteKey,
        action: TURNSTILE_ACTION,
        execution: "execute",
        callback: (token) => pending.current?.(token),
        "error-callback": () => pending.current?.(null),
        "expired-callback": () => pending.current?.(null),
      });
    });
    return () => {
      cancelled = true;
      if (api.current && widgetId.current) api.current.remove(widgetId.current);
      api.current = null;
      widgetId.current = null;
    };
  }, [siteKey]);

  const getToken = useCallback((): Promise<string | null> => {
    const turnstile = api.current;
    const id = widgetId.current;
    if (!turnstile || !id) return Promise.resolve(null);
    pending.current?.(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(null), TOKEN_TIMEOUT_MS);
      function settle(token: string | null) {
        clearTimeout(timer);
        pending.current = null;
        resolve(token);
      }
      pending.current = settle;
      try {
        turnstile.reset(id);
        turnstile.execute(id);
      } catch {
        settle(null);
      }
    });
  }, []);

  return { containerRef, getToken };
}

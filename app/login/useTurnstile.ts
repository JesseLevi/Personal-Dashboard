"use client";

import { useCallback, useEffect, useRef } from "react";

// Invisible Cloudflare Turnstile for the login greeting lookup (ADR-0031).
// Site key arrives as a prop from page.tsx (server-read env); with no key the
// script never loads and getToken() resolves null (the backend fails closed).

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 5000;
const SCRIPT_TIMEOUT_MS = 5000;

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      execution: "execute" | "render";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi | null>((resolve) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      scriptPromise = null; // a later lookup may retry
      resolve(null);
    };
    const timer = window.setTimeout(fail, SCRIPT_TIMEOUT_MS);
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      resolve(window.turnstile ?? null);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Returns a ref for the hidden container and `getToken()` (fresh single-use token, or null). */
export function useTurnstile(siteKey: string | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const readyRef = useRef<Promise<boolean> | null>(null);
  const pendingRef = useRef<((token: string | null) => void) | null>(null);
  const callIdRef = useRef(0);
  const aliveRef = useRef(false);

  const settle = useCallback((token: string | null) => {
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(token);
  }, []);

  // Loads the script and renders the widget once; a failed attempt clears the
  // cached promise so the next getToken() tries again.
  const ensureReady = useCallback((): Promise<boolean> | null => {
    if (!siteKey) return null;
    if (readyRef.current) return readyRef.current;
    const attempt: Promise<boolean> = loadTurnstile().then((api) => {
      const container = containerRef.current;
      if (readyRef.current !== attempt) return false; // superseded or torn down
      if (!aliveRef.current || !api || !container) {
        readyRef.current = null;
        return false;
      }
      apiRef.current = api;
      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        action: "login_greeting",
        execution: "execute",
        callback: (token) => settle(token),
        "error-callback": () => settle(null),
        "expired-callback": () => settle(null),
        "timeout-callback": () => settle(null),
      });
      return true;
    });
    readyRef.current = attempt;
    return attempt;
  }, [siteKey, settle]);

  useEffect(() => {
    if (!siteKey) return;
    aliveRef.current = true;
    void ensureReady();
    return () => {
      aliveRef.current = false;
      settle(null);
      if (apiRef.current && widgetIdRef.current) apiRef.current.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      apiRef.current = null;
      readyRef.current = null;
    };
  }, [siteKey, ensureReady, settle]);

  const getToken = useCallback(async (): Promise<string | null> => {
    const ready = ensureReady();
    if (!ready) return null;
    const callId = ++callIdRef.current;
    try {
      if (!(await ready)) return null;
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      if (!api || !widgetId || callId !== callIdRef.current) return null;
      settle(null);
      const token = await new Promise<string | null>((resolve) => {
        const timer = window.setTimeout(() => settle(null), TOKEN_TIMEOUT_MS);
        pendingRef.current = (value) => {
          window.clearTimeout(timer);
          resolve(value);
        };
        api.execute(widgetId);
      });
      // Only reset if no newer lookup has started meanwhile; resetting would
      // cancel its challenge.
      if (callId === callIdRef.current) api.reset(widgetId);
      return token;
    } catch {
      return null;
    }
  }, [ensureReady, settle]);

  return { containerRef, getToken };
}

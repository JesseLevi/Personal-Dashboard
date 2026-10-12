// Single-use Turnstile tokens, fetched ahead of time. The challenge runs off the
// critical path (`warm`), the finished token waits in a one-slot cache until
// `take` hands it out, and the next challenge starts right after. A token is
// never handed out twice. Driver and timing are injected so this stays testable.

export interface TokenDriver {
  /** Starts one challenge; the result comes back through `onToken` or `onError`. */
  start: () => void;
  /** Clears the widget's held token so the next `start` begins clean. */
  reset: () => void;
}

export interface TokenSource {
  /** Starts a challenge when none is cached or running. */
  warm: () => void;
  /** A fresh token (cached, or the next to arrive), or null on error or timeout. */
  take: () => Promise<string | null>;
  onToken: (token: string) => void;
  onError: () => void;
  /** The widget's own expiry: a cached token is no longer valid. */
  onExpired: () => void;
  dispose: () => void;
}

interface Waiter {
  resolve: (token: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createTokenSource(driver: TokenDriver, waitMs: number): TokenSource {
  let cached: string | null = null;
  let running = false;
  let disposed = false;
  let waiter: Waiter | null = null;

  function launch() {
    if (disposed || running || cached !== null) return;
    running = true;
    driver.start();
  }

  function settleWaiter(token: string | null) {
    if (!waiter) return;
    const current = waiter;
    waiter = null;
    clearTimeout(current.timer);
    current.resolve(token);
  }

  return {
    warm: launch,
    take() {
      // A newer lookup supersedes an older one still waiting: its answer would be dropped anyway.
      settleWaiter(null);
      if (disposed) return Promise.resolve(null);
      if (cached !== null) {
        const token = cached;
        cached = null;
        driver.reset();
        launch();
        return Promise.resolve(token);
      }
      const pending = new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => {
          if (waiter?.timer === timer) waiter = null;
          resolve(null);
        }, waitMs);
        waiter = { resolve, timer };
      });
      launch();
      return pending;
    },
    onToken(token) {
      running = false;
      if (disposed) return;
      if (waiter) {
        settleWaiter(token);
        driver.reset();
        launch();
      } else {
        cached = token;
      }
    },
    onError() {
      running = false;
      settleWaiter(null);
    },
    onExpired() {
      cached = null;
      // The widget still holds the expired token; a later start must begin clean.
      if (!disposed && !running) driver.reset();
    },
    dispose() {
      disposed = true;
      cached = null;
      settleWaiter(null);
    },
  };
}

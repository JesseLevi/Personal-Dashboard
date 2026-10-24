import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/net/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/net/safe-fetch")>()),
  safeFetch: vi.fn(),
}));

import { isCronAuthorized } from "@/lib/agenda/cron-auth";
import { isStale, normalizeIcsUrl, readSyncState } from "@/lib/agenda/calendars";
import {
  fetchFeed,
  syncAccount,
  syncAllStaleAccounts,
  syncStaleAccounts,
  type FeedResult,
} from "@/lib/agenda/sync";
import { safeFetch, SafeFetchError } from "@/lib/net/safe-fetch";

const NOW = new Date("2026-10-14T12:00:00Z");
const SECRET_URL = "https://calendar.example.com/ical/geheim-token-123/basic.ics";
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a
SUMMARY:Tandarts
DTSTART:20261020T100000Z
DTEND:20261020T110000Z
END:VEVENT
END:VCALENDAR`;

const fetched = vi.mocked(safeFetch);
const body = (text: string) => ({ url: SECRET_URL, status: 200, contentType: "text/calendar", body: Buffer.from(text) });

afterEach(() => {
  vi.restoreAllMocks();
  fetched.mockReset();
});

type RpcCall = { fn: string; args: Record<string, unknown> };

// A minimal stand-in for the Supabase client: rpc by name, and the one select the sync module makes.
function fakeClient(options: {
  secret?: string | null;
  secretError?: boolean;
  accounts?: Array<{ id: string; last_synced_at: string | null; sync_state: unknown }>;
}) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "get_calendar_account_secret") {
        return options.secretError
          ? { data: null, error: { code: "42501" } }
          : { data: options.secret === undefined ? SECRET_URL : options.secret, error: null };
      }
      return { data: { status: "ok" }, error: null };
    },
    from: () => ({
      select: () => ({ eq: async () => ({ data: options.accounts ?? [], error: null }) }),
    }),
  };
  return { client: client as never, calls };
}

describe("fetchFeed", () => {
  it("parses a fetched calendar", async () => {
    fetched.mockResolvedValue(body(ICS));
    const feed = await fetchFeed(SECRET_URL, NOW);
    expect(feed.ok && feed.events.map((e) => e.title)).toEqual(["Tandarts"]);
  });

  it("asks safe-fetch for calendar content types", async () => {
    fetched.mockResolvedValue(body(ICS));
    await fetchFeed(SECRET_URL, NOW);
    expect(fetched.mock.calls[0][1]).toMatchObject({ contentTypes: expect.arrayContaining(["text/calendar"]) });
  });

  it("turns a safe-fetch error into a code", async () => {
    fetched.mockRejectedValue(new SafeFetchError("blocked_address", "x"));
    expect(await fetchFeed(SECRET_URL, NOW)).toEqual({ ok: false, error: "fetch_blocked_address" });
  });

  it("calls an HTML login page unparsable", async () => {
    fetched.mockResolvedValue(body("<html>Sign in</html>"));
    expect(await fetchFeed(SECRET_URL, NOW)).toEqual({ ok: false, error: "unparsable" });
  });
});

describe("syncAccount", () => {
  it("fetches with the secret and applies the events", async () => {
    const { client, calls } = fakeClient({});
    const feed: FeedResult = { ok: true, events: [] };
    const fetcher = vi.fn().mockResolvedValue(feed);
    await syncAccount(client, "acc-1", NOW, fetcher);
    expect(fetcher).toHaveBeenCalledWith(SECRET_URL, NOW);
    expect(calls.map((c) => c.fn)).toEqual(["get_calendar_account_secret", "apply_calendar_sync"]);
    expect(calls[1].args).toMatchObject({ p_account_id: "acc-1", p_failure: undefined });
  });

  it("reports a failed fetch as a failure with no events", async () => {
    const { client, calls } = fakeClient({});
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: "fetch_timeout" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await syncAccount(client, "acc-1", NOW, fetcher);
    expect(calls[1].args).toMatchObject({ p_events: [], p_failure: "fetch_timeout" });
  });

  it("reports a missing secret as a failure and never fetches", async () => {
    const { client, calls } = fakeClient({ secretError: true });
    const fetcher = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await syncAccount(client, "acc-1", NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(calls[1].args).toMatchObject({ p_failure: "no_secret" });
  });

  it("sends the window the parser used", async () => {
    const { client, calls } = fakeClient({});
    await syncAccount(client, "acc-1", NOW, async () => ({ ok: true, events: [] }));
    expect(calls[1].args).toMatchObject({
      p_window_from: "2026-09-14T12:00:00.000Z",
      p_window_to: "2027-11-18T12:00:00.000Z",
    });
  });

  it("never lets the secret URL reach the apply call or the logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetched.mockRejectedValue(new SafeFetchError("http_error", "HTTP 403", 403));
    const { client, calls } = fakeClient({});
    await syncAccount(client, "acc-1", NOW);
    const applied = JSON.stringify(calls[1].args);
    expect(applied).not.toContain("geheim-token-123");
    expect(JSON.stringify(log.mock.calls)).not.toContain("geheim-token-123");
    expect(applied).toContain("fetch_http_error");
  });
});

describe("which accounts are synced", () => {
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
  const accounts = [
    { id: "fresh", last_synced_at: hoursAgo(0.5), sync_state: { status: "ok", attempted_at: hoursAgo(0.5) } },
    { id: "old", last_synced_at: hoursAgo(3), sync_state: { status: "ok", attempted_at: hoursAgo(3) } },
    { id: "never", last_synced_at: null, sync_state: {} },
    // A failing feed is not retried on every page view: the attempt counts.
    { id: "failed-just-now", last_synced_at: hoursAgo(30), sync_state: { status: "failed", error: "empty", attempted_at: hoursAgo(0.2) } },
  ];

  it("lazy: syncs accounts whose last attempt is over an hour old", async () => {
    const { client, calls } = fakeClient({ accounts });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await syncStaleAccounts(client, NOW);
    const ids = calls.filter((c) => c.fn === "get_calendar_account_secret").map((c) => c.args.p_account_id);
    expect(ids.sort()).toEqual(["never", "old"]);
  });

  it("cron: syncs accounts idle for 20 hours, oldest first, and stops at the budget", async () => {
    const idle = [
      { id: "b", last_synced_at: hoursAgo(25), sync_state: {} },
      { id: "a", last_synced_at: hoursAgo(40), sync_state: {} },
      { id: "recent", last_synced_at: hoursAgo(5), sync_state: {} },
    ];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, calls } = fakeClient({ accounts: idle });
    fetched.mockResolvedValue(body(ICS));
    const result = await syncAllStaleAccounts(client, { now: NOW, budgetMs: 60_000 });
    expect(calls.filter((c) => c.fn === "get_calendar_account_secret").map((c) => c.args.p_account_id)).toEqual(["a", "b"]);
    expect(result).toEqual({ synced: 2, failed: 0, skipped: 0, remaining: 0 });

    const none = fakeClient({ accounts: idle });
    const out = await syncAllStaleAccounts(none.client, { now: NOW, budgetMs: 0 });
    expect(out.remaining).toBe(2);
    expect(none.calls).toEqual([]);
  });
});

describe("syncAllStaleAccounts ordering", () => {
  it("queues a failing account behind accounts that were not tried yet", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const attempted = new Date(NOW.getTime() - 21 * 3600_000).toISOString();
    const { client, calls } = fakeClient({
      accounts: [
        // Never succeeded, but tried 21 hours ago: it must not keep the front of the queue.
        { id: "failing", last_synced_at: "2026-09-01T00:00:00Z", sync_state: { status: "failed", error: "fetch_timeout", attempted_at: attempted } },
        { id: "untried", last_synced_at: new Date(NOW.getTime() - 30 * 3600_000).toISOString(), sync_state: null },
      ],
    });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, events: [] });
    // Only time for one account: the untried one gets it.
    let tick = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (tick++ < 2 ? 0 : 1000));
    const result = await syncAllStaleAccounts(client, { now: NOW, budgetMs: 500, fetcher });
    const order = calls.filter((c) => c.fn === "get_calendar_account_secret").map((c) => c.args.p_account_id);
    expect(order).toEqual(["untried"]);
    expect(result.remaining).toBe(1);
  });

  it("fetches with the shorter cron timeout", async () => {
    const { client } = fakeClient({ accounts: [{ id: "a", last_synced_at: null, sync_state: null }] });
    fetched.mockResolvedValue(body(ICS));
    await syncAllStaleAccounts(client, { now: NOW, budgetMs: 60_000 });
    expect(fetched.mock.calls[0][1]).toMatchObject({ timeoutMs: 8_000 });
  });
});

describe("isCronAuthorized", () => {
  const secret = "0123456789abcdef0123";
  it("accepts only the exact bearer secret", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
  });
  it("fails closed without a usable secret", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer short", "short")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});

describe("calendars helpers", () => {
  it("normalizes webcal links and refuses anything but https", () => {
    expect(normalizeIcsUrl(" webcal://p01-caldav.icloud.com/published/2/abc ")).toBe(
      "https://p01-caldav.icloud.com/published/2/abc",
    );
    expect(normalizeIcsUrl("https://calendar.google.com/calendar/ical/x/basic.ics")).toContain("https://");
    expect(normalizeIcsUrl("http://example.com/a.ics")).toBeNull();
    expect(normalizeIcsUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeIcsUrl("geen url")).toBeNull();
  });

  it("reads sync_state defensively", () => {
    expect(readSyncState({})).toMatchObject({ status: "never" });
    expect(readSyncState(null)).toMatchObject({ status: "never" });
    expect(readSyncState({ status: "failed", error: "empty" })).toMatchObject({ status: "failed", errorCode: "empty" });
    expect(readSyncState({ status: "failed", error: "Zie https://geheim" })).toMatchObject({ status: "never" });
    expect(readSyncState({ status: "ok" })).toMatchObject({ status: "ok", errorCode: null });
  });

  it("isStale counts the latest of attempt and success", () => {
    const at = (iso: string) => ({ last_synced_at: iso, sync_state: {} });
    expect(isStale(at("2026-10-14T11:30:00Z"), NOW, 3_600_000)).toBe(false);
    expect(isStale(at("2026-10-14T10:30:00Z"), NOW, 3_600_000)).toBe(true);
  });
});

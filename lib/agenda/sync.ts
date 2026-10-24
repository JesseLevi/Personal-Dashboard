import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isStale, lastAttemptMs } from "@/lib/agenda/calendars";
import { IcsError, parseIcs, syncWindow, type SyncEvent } from "@/lib/agenda/ics";
import type { Database } from "@/lib/database.types";
import { safeFetch, SafeFetchError } from "@/lib/net/safe-fetch";

// The one sync path both triggers call (ADR-0039): fetch (safe-fetch), parse
// (ical.js), apply (the database decides what is written or deleted). The
// client decides who runs it: the user's RLS-bound client on the lazy path, the
// service client in the cron route. This module never logs, throws or returns
// the secret URL; every failure is reduced to a code first.

type Client = SupabaseClient<Database>;

const ICS_TYPES = ["text/calendar", "application/ics", "text/x-vcalendar", "text/plain", "application/octet-stream"];
const ICS_MAX_BYTES = 8 * 1024 * 1024;
const ICS_TIMEOUT_MS = 20_000;
/** The cron works through many accounts in one budget, so a slow feed gets less time there. */
const CRON_ICS_TIMEOUT_MS = 8_000;

/** Lazy trigger: a feed is fresh for an hour. Cron: it syncs what is older than 20 hours. */
export const LAZY_MAX_AGE_MS = 60 * 60 * 1000;
export const CRON_MAX_AGE_MS = 20 * 60 * 60 * 1000;
const LAZY_ACCOUNT_LIMIT = 5;

export type FeedResult = { ok: true; events: SyncEvent[] } | { ok: false; error: string };
export type FeedFetcher = (url: string, now: Date) => Promise<FeedResult>;

export async function fetchFeed(url: string, now: Date, timeoutMs: number = ICS_TIMEOUT_MS): Promise<FeedResult> {
  try {
    const response = await safeFetch(url, {
      contentTypes: ICS_TYPES,
      accept: "text/calendar, text/plain;q=0.8, */*;q=0.1",
      maxBytes: ICS_MAX_BYTES,
      timeoutMs,
    });
    const events = parseIcs(response.body.toString("utf8"), syncWindow(now));
    return { ok: true, events };
  } catch (error) {
    if (error instanceof SafeFetchError) return { ok: false, error: `fetch_${error.code}` };
    if (error instanceof IcsError) return { ok: false, error: error.code };
    return { ok: false, error: "fetch_failed" };
  }
}

const applyResultSchema = z.object({
  status: z.enum(["ok", "failed", "skipped"]),
  error: z.string().optional(),
});

export type SyncOutcome = z.infer<typeof applyResultSchema>;

/** Hands a feed result to the database, which applies the deletion rules. */
export async function applyFeed(client: Client, accountId: string, feed: FeedResult, now: Date): Promise<SyncOutcome> {
  const window = syncWindow(now);
  const { data, error } = await client.rpc("apply_calendar_sync", {
    p_account_id: accountId,
    p_events: feed.ok
      ? feed.events.map((e) => ({
          external_id: e.externalId,
          title: e.title,
          starts_at: e.startsAt,
          ends_at: e.endsAt,
          all_day: e.allDay,
          location: e.location,
          description: e.description,
          content_hash: e.contentHash,
        }))
      : [],
    p_window_from: window.from.toISOString(),
    p_window_to: window.to.toISOString(),
    p_failure: feed.ok ? undefined : feed.error,
  });
  const parsed = applyResultSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("[agenda] apply_calendar_sync failed:", accountId, error?.code ?? "bad-result");
    return { status: "failed", error: "apply_failed" };
  }
  return parsed.data;
}

/** Syncs one account: secret, fetch, parse, apply. */
export async function syncAccount(
  client: Client,
  accountId: string,
  now: Date = new Date(),
  fetcher: FeedFetcher = fetchFeed,
): Promise<SyncOutcome> {
  const { data: secret, error } = await client.rpc("get_calendar_account_secret", { p_account_id: accountId });
  const feed: FeedResult =
    error || typeof secret !== "string" || secret === ""
      ? { ok: false, error: "no_secret" }
      : await fetcher(secret, now);
  if (!feed.ok) console.error("[agenda] feed not synced:", accountId, feed.error);
  return applyFeed(client, accountId, feed, now);
}

type AccountRow = { id: string; last_synced_at: string | null; sync_state: unknown };

async function listIcsAccounts(client: Client): Promise<AccountRow[]> {
  const { data, error } = await client
    .from("calendar_accounts")
    .select("id, last_synced_at, sync_state")
    .eq("provider", "ics");
  if (error) {
    console.error("[agenda] list accounts failed:", error.code);
    return [];
  }
  return data;
}

/**
 * Least recently attempted first, so a long list is worked through over several runs.
 * A failed attempt counts too: a feed that keeps failing queues behind untried accounts.
 */
function byLeastRecent(a: AccountRow, b: AccountRow): number {
  return lastAttemptMs(a) - lastAttemptMs(b);
}

/** Lazy trigger (ADR-0039 §1): the signed-in user's own stale accounts, with their client. */
export async function syncStaleAccounts(client: Client, now: Date = new Date()): Promise<SyncOutcome[]> {
  const stale = (await listIcsAccounts(client))
    .filter((account) => isStale(account, now, LAZY_MAX_AGE_MS))
    .sort(byLeastRecent)
    .slice(0, LAZY_ACCOUNT_LIMIT);
  const outcomes: SyncOutcome[] = [];
  for (const account of stale) outcomes.push(await syncAccount(client, account.id, now));
  return outcomes;
}

export interface BackstopResult {
  synced: number;
  failed: number;
  skipped: number;
  /** Stale accounts left for the next run. */
  remaining: number;
}

/** Cron backstop (ADR-0039 §5): every account idle for 20 hours, within a time budget. */
export async function syncAllStaleAccounts(
  client: Client,
  options: { now?: Date; budgetMs: number; fetcher?: FeedFetcher },
): Promise<BackstopResult> {
  const now = options.now ?? new Date();
  const deadline = Date.now() + options.budgetMs;
  const stale = (await listIcsAccounts(client))
    .filter((account) => isStale(account, now, CRON_MAX_AGE_MS))
    .sort(byLeastRecent);
  const fetcher = options.fetcher ?? ((url, at) => fetchFeed(url, at, CRON_ICS_TIMEOUT_MS));
  const result: BackstopResult = { synced: 0, failed: 0, skipped: 0, remaining: 0 };
  for (const [index, account] of stale.entries()) {
    if (Date.now() >= deadline) {
      result.remaining = stale.length - index;
      break;
    }
    const outcome = await syncAccount(client, account.id, now, fetcher);
    if (outcome.status === "ok") result.synced++;
    else if (outcome.status === "skipped") result.skipped++;
    else result.failed++;
  }
  return result;
}

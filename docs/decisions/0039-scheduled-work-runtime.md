# ADR-0039: Runtime for scheduled work

**Status**: Accepted (user decision, 2026-10-14, #482). Amends ADR-0002 for request paths.

## Context

- Calendar sync (ADR-0037 §5) is the first work that must run without a user request: deletions at the source, and the basket notice, must also reach users who do not open the Agenda.
- Atlas runs on the **Vercel Hobby** plan. Hobby cron jobs run at most once a day, at an imprecise moment within the configured hour; a more frequent expression fails the deploy.
- ADR-0033 keeps `service_role` out of every request made on behalf of a user. ADR-0002 still described decryption through `service_role` in server actions.
- Candidates weighed (`Architecture.md` §6, open decision 1):
  - a lazy "sync when stale" on page load, as ADR-0017 and ADR-0019 do;
  - Vercel Cron calling a route handler;
  - Supabase Cron with an Edge Function: close to the data, but a second runtime (Deno) and a second deploy path next to Next.js.

## Decision

1. **Two triggers, one sync path.**
   - **Lazy**: opening the Agenda checks the user's own `calendar_accounts`. An account whose `last_synced_at` is older than one hour is synced in `after()`, with the user's RLS-bound client. The page renders what is stored and never waits for a fetch.
   - **Daily backstop**: one Vercel Cron job (`vercel.json`) calls a route handler once a day. It syncs every account not synced in the last 20 hours.
   - Supabase Cron and Edge Functions are not used.
2. **The rules live in the database.** One `security definer` function applies a parsed feed to one account in a single transaction: the upsert on `(calendar_account_id, external_id)`, the content hash, `missing_since`, the two-miss deletion, the failure guards and the basket notice (ADR-0037 §5–6).
   - When called by `authenticated`, it acts only on an account the caller owns (`auth.uid()`).
   - Trust boundary: `apply_calendar_sync` and `create_ics_calendar` are EXECUTE for `authenticated`, so a signed-in user can write events into their own calendar without the safe-fetch path. That reaches only their own account, so it is accepted.
   - Fetching and parsing (`safe-fetch`, `ical.js`) run in Node, in one server-only module that both triggers call.
3. **Overlap is harmless.** An account claims its sync with a transaction-scoped advisory lock. A second run that cannot take the lock skips the account.
4. **Secrets per trigger** (amends ADR-0002):
   - On the lazy path the secret URL is read through a `security definer` function. It returns the decrypted value only for an account owned by `auth.uid()`, and only to server code. `service_role` never runs there (ADR-0033).
   - The cron route is not a user request. It uses `service_role` from a server-only module, reads `vault.decrypted_secrets`, and calls the same apply function.
5. **The cron route is closed.** It accepts only `Authorization: Bearer $CRON_SECRET` (a Vercel env var of at least 16 random characters) and answers 401 otherwise. It works through accounts one by one within a time budget below the function's duration limit, oldest `last_synced_at` first. What is left over waits for the next run or the lazy path.
6. **Later scheduled work uses the same shape**: a lazy trigger where a user is present, and the daily cron as a backstop. Work that needs more than one run a day, or more than one function run, needs a new ADR (Vercel Pro, or a queue).

## Consequences

- No new infrastructure and no cost. `CRON_SECRET` is the only new production setting.
- An active user sees changes from a feed within the hour after opening the Agenda.
- Without a visit, a feed is synced once a day. Under the two-miss rule (ADR-0037 §5), an event that disappears at the source is removed after one to two days.
- Two lazy syncs can follow each other within the hour; the "drop of more than half" guard still protects against a broken feed.
- Sync writes only through the definer function, which keeps the column grants of #483 intact: clients still cannot write sync fields directly.
- Cron runs have no user context, so the apply function cannot rely on RLS there. It must take the account id and derive every write from that account's owner.

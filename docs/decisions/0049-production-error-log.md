# ADR-0049: Production errors go to a private table

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 5: option a). Extends ADR-0031 and ADR-0033.

## Context

- Server errors only reach `console.error`, and Vercel Hobby keeps runtime logs briefly. The admin learns of a failure only when a member reports it. `app/(app)/error.tsx` catches the error but reports nothing.
- Weighed: a private table in Supabase, an external service (server SDK only, ADR-0033 forbids a browser SDK), nothing.
- Priorities: secure, cheap, portable (plain Postgres), no third party with user data.

## Decision

1. **`instrumentation.ts` `onRequestError`** (Next 15) reports every server request error in the Node runtime. Next's control-flow throws (`NEXT_*` digests: redirect, not found) are skipped.
2. **Storage is `private.app_errors`**: not exposed by PostgREST, RLS on, no client grants. A row holds the time, the route pattern (`/notities/[noteId]`, never the concrete URL or query string), method, kind (`render`/`route`/`action`), digest, error name and the first 300 characters of the message. No user id, body, cookies, headers or e-mail.
3. **Writes go through `public.report_app_error()`**: `security definer`, executable by `anon` only, called from server code with the stateless anon client (as ADR-0031). It writes only when its secret argument equals the Vault secret `app_error_report_secret`, which Atlas holds as `APP_ERROR_REPORT_SECRET`. Without either, reporting is a silent no-op. No `service_role`.
4. **Bounded**: at most 60 rows per minute; only the newest 1000 rows are kept.
5. **Reporting never affects the request**: any failure is swallowed; `console.error` stays the first record.
6. **Reading** is a SQL query in the Supabase dashboard for now (`docs/operations.md`). A daily summary or an admin screen is a later decision.

## Consequences

- Error messages can still contain fragments of data (for example a Postgres message quoting a value). The 300-character cap and the 1000-row window limit that exposure; the table is readable only by the database owner.
- Client-side errors (in the browser) are not captured; that would need a new endpoint and its own decision.
- Setting the Vault secret and the Vercel env var are hosted actions that need the user's go.

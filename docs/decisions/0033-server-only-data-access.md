# ADR-0033: All data access goes through server code

**Status**: Accepted (2026-10-11, #412). Gives the rule a current home. It was stated in ADR-0003 (superseded by ADR-0018) and ADR-0002, and was cited from both.

## Context

ADR-0003 made the browser reach data only through Next.js because Supabase sat unexposed on a home server. That topology is gone, but the rule outlived it for its own reasons, and code, guides and ADR-0017/0031 still cited the superseded ADR as its authority.

## Decision

- The browser talks only to the Atlas app. It never calls Supabase, R2, an inference provider or any other third-party data service directly.
- Supabase is reached only from server code (Server Components, Server Actions, route handlers, `after()` work, future job handlers) through the request-scoped, RLS-bound client in `lib/supabase/server.ts`.
- No Supabase variable has a `NEXT_PUBLIC_` prefix. The anon key is a server secret too.
- `service_role` exists only in server-only modules (`import "server-only"`) that cannot run in a request on behalf of a user. Request paths use the user's own RLS-bound client.
- Every other external seam has one server-only module: `lib/storage/` (R2, ADR-0024), `lib/ai/` (inference, ADR-0018), `lib/net/safe-fetch` (user-supplied URLs).
- `pnpm check:server-only` enforces the boundaries in CI.

## Consequences

- RLS stays the access-control layer for every user request. That is what lets a future sharing model change policies instead of every query (see ADR-0001).
- Every user-triggered mutation is a Server Action with zod validation. A multi-statement write is an RPC (ADR-0015).
- ADR-0031's anon-callable RPC is reachable only through a server action, because the anon key never reaches the browser.

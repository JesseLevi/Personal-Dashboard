# ADR-0045: Login rate limit and bot check on submit

**Status**: Accepted (user go on the login-hardening ticket, 2026-10-23). Extends ADR-0031 and ADR-0038.

## Context

- The login actions (password, code send and resend, code verify) relied only on Supabase Auth's own limits. Those are keyed per IP, and behind Vercel that IP is a shared egress address, not the visitor.
- ADR-0031 already throttles the greeting lookup in the database and gates it with Turnstile. The same approach fits the login actions.

## Decision

1. **One limiter for the login actions**: `public.login_rate_limit(p_action, p_email, p_client_key)`, writing to `private.login_rate_events (key, created_at)`.
   - Same shape and exceptions as the greeting (ADR-0031): `private` schema, RLS on with no policies and no client grants, `security definer` with `set search_path = ''`, execute for `anon` only, called only through the stateless anon client from `lib/auth/login-rate-limit.ts`. No `user_id` (ADR-0009 exception, asserted by pgTAP).
   - Keys are `<action>|email:<sha256 of the lowercased address>`, `<action>|ip:<client key>` and `<action>|global`. The client key is `sha256(ip + LOGIN_GREETING_SALT)`, as in ADR-0031; without a usable salt the login limits fall back to a fixed pepper in the code instead of failing closed, which makes the stored client key effectively unsalted.
   - Rows older than one hour are purged on each call.
2. **Every attempt counts, in one locked step.** The function checks and records under advisory locks, so parallel calls cannot slip under a limit. It only adds events, apart from the hourly purge and the send reset in point 3; there is no way to give an attempt back, so a successful login also counts. A blocked call records nothing.
3. **Limits per 15 minutes**:

   | Action | Per address | Per client | Global |
   | --- | --- | --- | --- |
   | `password` | 8 | 20 | 1000 |
   | `verify` | 5 | 20 | 1000 |
   | `send` (incl. resend) | 3 | 10 | 100 |

   A granted `send` clears that address's `verify` events: a new code is a new secret.
4. **Anti-enumeration holds** (ADR-0038): limits key on the address string, never on whether an account exists, and a limit answers with the existing `rate-limited` message.
5. **Turnstile gates the password submit and the code send**, not only the greeting. Siteverify, the hostname check and the production rule for the test secret move to `lib/auth/turnstile.ts`, shared with the greeting. The widget action is `login`. Resend and verify on `/login/code` have no widget; the limiter is their gate.
6. **Failure modes**:
   - Limiter function missing (code deployed before its migration): fail open and log an error, so login keeps working in that window.
   - Any other limiter error: fail closed (`rate-limited`).
   - No `TURNSTILE_SECRET_KEY`: skipped outside production, fail closed in production.

## Consequences

- Anyone can still exhaust the per-address limit for one address, which blocks that address for 15 minutes. The other login method and every other address keep working, because the global ceilings sit far above the per-client limits.
- Production needs `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel before this code is promoted; without them nobody can log in with a password or request a code.
- The migration goes to hosted before the code reaches production (ADR-0032).
- Hosted Auth settings that complement this (minimum password length, leaked-password protection, e-mail rate limit) are listed in `docs/operations.md` and change only with the user's go.

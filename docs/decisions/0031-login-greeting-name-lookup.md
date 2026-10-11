# ADR-0031: Login greeting looks up the first name by e-mail — a deliberate enumeration trade-off

**Status**: Accepted (decided by the user on 2026-10-11, issue #407)

**Authored by**: Claude Code (Opus 5.5), recording a decision the user made after being shown the alternatives. This is a conscious exception to priority 1 ("secure from the ground up") and to #158's rule that step 1 of the login never checks whether an address exists.

## Context

The login concept (Figma `4221:14942`) opens with "Hey, welkom bij Atlas". Once the visitor's e-mail is recognised, their first name fades in between "Hey" and "welkom bij Atlas". Doing that on the server for any typed address is a user-enumeration oracle: anyone who knows an address learns that it has an account and what the owner's first name is.

Alternatives offered to the user:
- (a) Remember e-mail and first name on the device after a successful login (no server oracle).
- (b) Show the name only after the password succeeds.
- (c) Server lookup for every address, hardened.
- (d) Server lookup gated by a signed known-device cookie.

The user chose (c): Atlas is a small app for friends and family, and the feature is worth the leak. This ADR limits that leak to "one human can check one address at a time" and keeps it from becoming a bulk-harvesting endpoint.

## Decision

1. **One RPC, the only path to the name**: `public.login_greeting_name(p_email text, p_client_key text) returns text`.
   - `security definer` with `set search_path = ''`. It reads `auth.users` and `public.profiles`, so it cannot be `invoker`; it is the repo's first definer function callable by `anon`.
   - It returns only the first word of `profiles.display_name`, trimmed, or `null`.
   - `null` is returned for an unknown address, a null or empty name, and an exceeded rate limit. The caller cannot tell these apart.
   - `revoke execute ... from public`; grant execute to `anon` only.
2. **The rate limit lives in the database, not in the app**, so a direct PostgREST call is throttled too.
   - Table `private.login_greeting_attempts (key text, attempted_at timestamptz)` sits in a `private` schema that PostgREST does not expose. RLS is enabled with no policies, and everything is revoked from `anon` and `authenticated`. Only the definer function writes to it.
   - This is the one table without `user_id`: it holds no user data, only hashed keys. It is outside `public`, so the completeness gate (ADR-0009) does not see it. Its isolation is asserted by an explicit test instead (below).
   - Each call records one attempt under three keys and refuses (returns `null`) when any of them is over its limit:
     - `ip:<p_client_key>`, 10 per 15 min;
     - `email:<sha256(lower(email))>`, 5 per 15 min;
     - `global`, 200 per 15 min.
   - Rows older than 1 hour are deleted on each call.
   - The address is stored only as a hash, never in clear text.
3. **The server action is the only caller.** The browser never talks to Supabase (ADR-0003).
   - The anon key is server-only in this app (no `NEXT_PUBLIC_` Supabase vars), which is what makes granting `anon` acceptable.
   - The action derives `p_client_key` as `sha256(<client IP from x-forwarded-for, first entry> + LOGIN_GREETING_SALT)`. The IP itself is never stored.
4. **Cloudflare Turnstile** (invisible / non-interactive widget, so no new UI) guards the action.
   - Siteverify runs server-side with the secret, the expected `action` and the hostname checked.
   - The integration **fails closed**: with no `TURNSTILE_SECRET_KEY` or a failed verify, the action returns `null` and never calls the RPC.
   - Local, CI and Ladle use Cloudflare's documented test keys.
5. **Uniform response.**
   - The action always resolves to `{ name: string | null }` and pads its total duration to a fixed minimum (500 ms), so timing does not separate known from unknown addresses.
   - The login flow itself (password, magic link) is unchanged and still never reveals existence.
6. **No new user-facing strings carry the name.** It is rendered as text (React escapes it).

## Consequences

- An attacker who knows a specific address can learn whether it has an Atlas account and the owner's first name. This is accepted. Bulk harvesting is throttled by Turnstile, the per-IP, per-address and global limits, and the uniform response.
- A legitimate user who mistypes repeatedly may stop seeing their name for 15 minutes. The login itself is unaffected.
- `display_name` is not yet editable in the UI (#9). Until it is, names must be filled in by hand for the feature to show anything.
- New environment variables (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `LOGIN_GREETING_SALT`) must be set in Vercel. Until then, production fails closed and shows the generic greeting.
- Tests:
  - `supabase/tests` asserts that `anon` cannot read or write `private.login_greeting_attempts`;
  - only `anon` can execute the RPC;
  - the RPC returns `null` past each limit;
  - the RPC returns a known user's first name.

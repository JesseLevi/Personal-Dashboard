# ADR-0047: iPhone day widget through Scriptable and a widget token

**Status**: Accepted (user decisions, 2026-10-30). Extends ADR-0033 and ADR-0037.

## Context

- Members want a home-screen and lock-screen widget with the rest of their day: events, meals and planned cards or deadlines. Tapping it opens the Agenda.
- A native widget needs an app, and an app needs a paid Apple Developer account. A free Apple ID re-signs every 7 days. Neither is acceptable.
- Weighed: Scriptable, Scripting, web-snapshot widget apps (Widget Web, Glimpse), an ICS feed for the built-in Calendar widget, a sideloaded SwiftUI app.
- A widget runs outside the browser, so it has no Atlas session. ADR-0033 keeps `service_role` off every user request and leaves access to RLS.
- Device test on the user's iPhone (2026-10-30):
  - a widget link to `https://heyatlas.nl/agenda` opens Safari, never the home-screen web app;
  - a widget link to `webapp://heyatlas.nl/agenda` opens Scriptable, not Atlas;
  - a widget link that runs a Shortcut, which opens `webapp://heyatlas.nl/agenda`, opens the home-screen web app on the Agenda, cold and warm.

## Decision

1. **The widget is a Scriptable script.** It is free, has a Keychain, and reads `config.widgetFamily`, so one script serves small, medium, large and the three lock-screen families. Atlas serves the script as a static file (`public/widget/atlas-widget.js`). The script never loads or evaluates remote code; updating means copying it again.
2. **It reads one endpoint**: `GET /api/widget/today?tz=<IANA>` with `Authorization: Bearer <widget token>`.
   - The response is versioned JSON validated with zod before sending.
   - It holds the rest of today and a preview of tomorrow.
   - It carries display-ready strings in the member's `profiles.locale` and calendar colours as light and dark hex values. The script holds no copy and no palette.
   - It answers `Cache-Control: no-store`, 401 for a missing, malformed or unknown token, and 429 over the limit.
3. **A widget token is a personal, read-only credential.**
   - `public.widget_tokens`: `id`, `user_id`, `label`, `token_hash`, `created_at`, `last_used_at`. RLS, grants and a pgTAP test ship with it (ADR-0009). Members can list, create and delete their own rows. `token_hash` is not readable or updatable by `authenticated`.
   - The plaintext is 32 random bytes (base64url, prefix `atlas_wgt_`), made in server code, shown once, and stored only as its SHA-256 hash. At most 5 tokens per member.
   - A token lives until its owner deletes it. Settings shows `last_used_at` per token.
4. **RLS decides what the widget sees, through a dedicated role.**
   - A `nologin` role `atlas_widget` is a member of `authenticated` and does not bypass RLS.
   - `public.widget_today(p_token text, p_from timestamptz, p_to timestamptz, p_time_zone text)` is `security definer`, owned by `atlas_widget`, and executable by `anon` only.
   - It hashes the plaintext in the database. The endpoint never sends a hash, so a leaked hash is not a credential.
   - A `private` helper owned by the migration role resolves the hash to a `user_id`, applies the rate limit and stamps `last_used_at`. Only `atlas_widget` may execute it.
   - With an owner found, the function sets `request.jwt.claims` for this transaction only (`sub` = owner, `role` = `authenticated`), then reads through the existing `agenda_items()` and `calendars`, plus the member's locale. Policies and sharing role functions apply unchanged, so no access logic is copied (ADR-0035).
   - It only reads. pgTAP proves that a token sees its owner's and shared items only, and that an unknown or deleted token sees nothing.
   - If hosted Supabase refuses the role or its ownership, the work stops and comes back to the user. There is no `service_role` fallback.
5. **Rate limit**: 120 calls per token per hour, in `private.widget_rate_events`, with the shape and purge of ADR-0045. Unknown tokens are not throttled: 256 bits cannot be guessed, and an unknown token costs one index lookup.
6. **Tapping opens Atlas through a Shortcut.**
   - The script's default link is `shortcuts://run-shortcut?name=Open%20Atlas&input=text&text=<encoded webapp URL>`.
   - The shared Shortcut "Open Atlas" opens its input only when it starts with `webapp://heyatlas.nl/`.
   - A tap on the widget opens `/agenda`. Later deep links reuse the same Shortcut.
   - The widget parameter `safari` switches to `https://heyatlas.nl/agenda` for members without the Shortcut.
7. **What it shows**:
   - Items whose end lies in the future. When none are left: an empty line plus tomorrow's first items.
   - Lock-screen widgets show titles (user's choice).
   - Calendars hidden on a device (ADR-0040) still appear, since the widget is a device of its own.

## Consequences

- No Apple fee and no app to maintain. Members install Scriptable, add one Shortcut from an iCloud link, paste the script and paste a token.
- A tap passes Scriptable and Shortcuts before Atlas opens, about a second. That is the cost of not shipping an app.
- iOS decides how often the widget refreshes, roughly every 15 to 30 minutes. The script asks for a refresh when the next item ends.
- A lost phone keeps reading the day until its owner deletes the token. The token cannot write, and it reaches nothing but this one function.
- `atlas_widget` is a second way to act as a member, kept inside one read-only function. Any new function owned by it needs a new ADR.
- The migration reaches hosted only with the user's go (ADR-0032). Until then the endpoint answers 503 when the function is missing.

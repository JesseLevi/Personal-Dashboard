# ADR-0038: Login by e-mail code

**Status**: Accepted (user decision, 2026-10-13, #10).

## Context

- Magic links need SMTP on hosted, and Supabase's built-in mailer is rate-limited to a few mails per hour and not meant for production.
- A link opened on another device or in a mail app's in-app browser often fails to log the user in. A short code typed into the page that asked for it does not.

## Decision

1. **Login by a 6-digit e-mail code (OTP)**, entered on `/login/code`, plus a fallback link in the same mail (`{{ .SiteURL }}/auth/confirm?token_hash=…&type=email`). Self-signup stays disabled.
2. **Resend is the SMTP provider** (free tier): `smtp.resend.com`, user `resend`, password = API key, port 465.
3. **Hosted config is scripted, not clicked.** `pnpm auth:email` PATCHes the Supabase Management API (`/v1/projects/{ref}/config/auth`): SMTP, the magic-link subject and template from `supabase/templates/magic_link.html`, OTP expiry and length, and the e-mail rate limit.
   - It is a dry run by default (masked diff against `GET`); only `--apply` writes, and that needs the user's go (ADR-0032).
   - `--templates-only` skips SMTP when Resend is linked through its Supabase integration.
4. The template is bilingual (NL, then EN) and table-based. Email clients have no CSS variables, so it is the one place hex is allowed; each value is commented with the token it mirrors (light theme).

## Consequences

- The e-mail address is held in an httpOnly cookie between the request step and the code step, not in the URL.
- No account enumeration: the request step answers the same for known and unknown addresses.
- The OTP expires after 10 minutes (`otp_expiry = 600`, `mailer_otp_exp`).
- The template mirrors the light theme only and must be updated by hand when those token values change.
- Local dev keeps Inbucket; the Resend block in `supabase/config.toml` stays commented out.

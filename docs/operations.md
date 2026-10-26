# Operations: what lives outside the repo

Hosted settings that code review cannot see. Every change here is a hosted write. The user does it, or Claude does it after an explicit go for that specific action (ADR-0032). Update this file in the same PR that starts depending on a new setting.

## Vercel (project `personal-dashboard`, region `fra1`)

- `vercel.json`:
  - builds `main` only (`ignoreCommand`, #408);
  - `github.autoAlias: false`, so no build goes live by itself;
  - `crons`: three daily calls, `/api/cron/calendar-sync` (04:00 UTC, also settles cooked meals, ADR-0044), `/api/cron/embeddings` (05:00 UTC) and `/api/cron/assistant` (05:30 UTC, rhythm signals for every member, ADR-0046); Hobby allows 100 cron jobs, each at most once a day (ADR-0039, ADR-0043). Vercel runs them on production only, and only once `CRON_SECRET` is set.
- Promote by hand: dashboard "Promote to Production" or `vercel promote <url>`. Apply pending migrations first.
- **Deployment Protection**: Standard Protection (Vercel Authentication) is on. Every build keeps its own URL and runs against the production database, so only the production domain is public. Check: `curl -I` on an old `personal-dashboard-<hash>-…vercel.app/login` gives a 302 to Vercel login or a 410, never a 200.
- Production env vars (no `NEXT_PUBLIC_` prefix on any of them; mark secrets Sensitive). `SUPABASE_SERVICE_ROLE_KEY`, the production R2 keys and `CRON_SECRET` exist in the Production environment only, not in Preview or Development:

| Var | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `lib/supabase/server.ts` | The anon key is server-only too (ADR-0033) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only maintenance modules | Never on a user's request path |
| `ANTHROPIC_API_KEY` | `lib/ai/` | Unset = recipe import runs degraded |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN` | `lib/ai/cloudflare.ts` | Token with Workers AI scope only. Either unset = keyword search only. Check that Workers Paid stays off: the free allocation is the spend cap (ADR-0043) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | `lib/storage/` | Production bucket + its bucket-scoped token |
| `CRON_SECRET` | `app/api/cron/calendar-sync`, `app/api/cron/embeddings`, `app/api/cron/assistant` | At least 16 random characters (`openssl rand -hex 32`). Vercel Cron sends it as `Authorization: Bearer`. Unset = all three routes answer 401 and the daily backstops do nothing (the lazy paths still work) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `LOGIN_GREETING_SALT` | login greeting (ADR-0031) and login submits | Set before deploying the login rate-limit change: without the secret, password and code-send submits fail closed in production. Missing salt = greeting fails closed; the login limits fall back to an unsalted hash |
| `TURNSTILE_ALLOWED_HOSTNAMES` | `lib/auth/turnstile.ts` | Comma-separated; the production domain. Unset = the token's hostname must match the request host |

## Supabase Cloud (one project, production)

- **Data API → Exposed schemas**: `public, graphql_public, reference`.
  - Never set `pgrst.db_schemas` on the `authenticator` role: it shadows the dashboard setting.
  - Check with `scripts/check-reference-exposed.sh`.
- **Auth**:
  - self-signup disabled;
  - URL Configuration: the redirect allow-list holds the production domain only, no wildcards such as `https://*.vercel.app/**`;
  - run Advisors → Security Advisor after each migration wave; it should report nothing;
  - login by e-mail code needs Resend SMTP (ADR-0038, steps: "Resend / auth e-mail" below);
  - admins have `app_metadata.role = 'admin'` (ADR-0020). The first grant was made 2026-10-10.
- **Migrations**: before debugging a data-shaped bug, check `supabase_migrations.schema_migrations`. A migration applied outside `db push` needs its ledger version corrected to the filename (ADR-0032).
- **Backups**: Supabase Cloud's own backups, plan-dependent.

## Resend / auth e-mail (ADR-0038, #10, #493)

Login by 6-digit e-mail code. The only manual part is connecting Resend; hosted writes need the user's go (ADR-0032).

1. Create a Resend account (free tier) and add your domain. Add the DNS records Resend shows (SPF, DKIM) and wait for "Verified".
2. Create an API key (sending access). It is the SMTP password.
3. Put in `.env`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (an address on the verified domain), `AUTH_EMAIL_SENDER_NAME`.
4. `pnpm auth:email` is a dry run: it prints a masked diff against hosted. Then `pnpm auth:email --apply` writes SMTP, the template, a 10 minute / 6 digit OTP and the e-mail rate limit.
   - Using Resend's Supabase integration for SMTP instead: `pnpm auth:email --templates-only --apply` (needs only the two Supabase vars).
5. In Supabase, Authentication, URL Configuration: Site URL is the production URL and it is in the redirect allow-list (the fallback link is `{{ .SiteURL }}/auth/confirm`).
6. Test end to end: request a code on the production login, check the mail (code, link, NL then EN), log in with the code, then with the link.

## GitHub

- **Environments**:
  - `supabase-production` holds `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`;
  - `vercel-production` holds `VERCEL_TOKEN` (account-scoped), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`;
  - both are restricted to `main`, with no required reviewer.
- **Workflows**:
  - `ci.yml`, `ci-db.yml` and `ci-visual.yml` run on pull requests and by hand, each with its own `paths:` filter, and cancel in-progress runs;
  - `deploy.yml` (`target` = `both|migrate|deploy`) and `visual-update.yml` run by hand only.
  - Free plan: about 2000 CI minutes a month. Two `ci-db` runs cannot overlap (fixed ports); rerun with `gh run rerun <id> --failed`.
- **Pinning**: every `uses:` is a full commit SHA with the version as a trailing comment, and `deploy.yml` installs an exact Vercel CLI version. Dependabot (`.github/dependabot.yml`, `github-actions`, weekly) proposes the bumps; bump the Vercel CLI by hand.
- **Board**: project 1, owner `JesseLevi`.

## Cloudflare R2 (ADR-0024)

Two private buckets, `…-production` and `…-development`:
- no `r2.dev` subdomain, no custom domain, no CORS;
- a lifecycle rule aborts incomplete multipart uploads after 1 day;
- one token per bucket with *Object Read & Write* on that bucket only.

Local `.env` uses the development bucket. To verify a bucket (dry run first, then `--apply`):

```
pnpm exec tsx --env-file=.env scripts/verify-r2-buckets.ts --bucket <own> --other <other> [--apply]
```

Expect anonymous GETs to fail, a PUT to the other bucket to return 403, and PUT + DELETE in the own bucket to work. R2 has no off-site copy (accepted, ADR-0024).

## Cloudflare Turnstile

Needed for the login greeting and the password and code-send submits:
- an invisible widget with production site and secret keys, widget action `login`, and a hostname allow-list with the production domain only (`TURNSTILE_ALLOWED_HOSTNAMES` matches it);
- local, CI and Ladle use Cloudflare's documented test keys.

## Login hardening (hosted, set by hand)

Auth → Providers → Email and Auth → Rate limits, in the dashboard:
- minimum password length 12 or more;
- leaked-password protection on;
- e-mail send rate limit set explicitly (`pnpm auth:email`, dry run first).

The app's own login limits need `20261023000005_login_rate_limit.sql` applied first; until then they are skipped with an error log.

## Anthropic

API key in Vercel. A hard monthly spend cap is set in the Anthropic Console (ADR-0018 §3).

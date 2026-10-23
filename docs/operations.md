# Operations: what lives outside the repo

Hosted settings that code review cannot see. Every change here is a hosted write. The user does it, or Claude does it after an explicit go for that specific action (ADR-0032). Update this file in the same PR that starts depending on a new setting.

## Vercel (project `personal-dashboard`, region `fra1`)

- `vercel.json`:
  - builds `main` only (`ignoreCommand`, #408);
  - `github.autoAlias: false`, so no build goes live by itself;
  - `crons`: one daily call to `/api/cron/calendar-sync` (04:00 UTC, Hobby allows once a day; ADR-0039). Vercel runs it on production only, and only once `CRON_SECRET` is set.
- Promote by hand: dashboard "Promote to Production" or `vercel promote <url>`. Apply pending migrations first.
- Production env vars (no `NEXT_PUBLIC_` prefix on any of them; mark secrets Sensitive):

| Var | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `lib/supabase/server.ts` | The anon key is server-only too (ADR-0033) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only maintenance modules | Never on a user's request path |
| `ANTHROPIC_API_KEY` | `lib/ai/` | Unset = recipe import runs degraded |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN` | `lib/ai/cloudflare.ts` | Token with Workers AI scope only. Either unset = keyword search only. Check that Workers Paid stays off: the free allocation is the spend cap (ADR-0043) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | `lib/storage/` | Production bucket + its bucket-scoped token |
| `CRON_SECRET` | `app/api/cron/calendar-sync` | At least 16 random characters (`openssl rand -hex 32`). Vercel Cron sends it as `Authorization: Bearer`. Unset = the route answers 401 and the daily backstop does nothing (lazy sync still works) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `LOGIN_GREETING_SALT` | login greeting (ADR-0031, PR #411) | Missing = greeting fails closed |

## Supabase Cloud (one project, production)

- **Data API → Exposed schemas**: `public, graphql_public, reference`.
  - Never set `pgrst.db_schemas` on the `authenticator` role: it shadows the dashboard setting.
  - Check with `scripts/check-reference-exposed.sh`.
- **Auth**:
  - self-signup disabled;
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

Not set up yet. It is needed for the login greeting (PR #411):
- an invisible widget with production site and secret keys;
- local, CI and Ladle use Cloudflare's documented test keys.

## Anthropic

API key in Vercel. A hard monthly spend cap is set in the Anthropic Console (ADR-0018 §3).

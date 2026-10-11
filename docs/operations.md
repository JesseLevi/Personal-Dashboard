# Operations: what lives outside the repo

Hosted settings that code review cannot see. Every change here is a hosted write. The user does it, or Claude does it after an explicit go for that specific action (ADR-0032). Update this file in the same PR that starts depending on a new setting.

## Vercel (project `personal-dashboard`, region `fra1`)

- `vercel.json`:
  - builds `main` only (`ignoreCommand`, #408);
  - `github.autoAlias: false`, so no build goes live by itself.
- Promote by hand: dashboard "Promote to Production" or `vercel promote <url>`. Apply pending migrations first.
- Production env vars (no `NEXT_PUBLIC_` prefix on any of them; mark secrets Sensitive):

| Var | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `lib/supabase/server.ts` | The anon key is server-only too (ADR-0033) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only maintenance modules | Never on a user's request path |
| `ANTHROPIC_API_KEY` | `lib/ai/` | Unset = recipe import runs degraded |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | `lib/storage/` | Production bucket + its bucket-scoped token |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `LOGIN_GREETING_SALT` | login greeting (ADR-0031, PR #411) | Missing = greeting fails closed |

## Supabase Cloud (one project, production)

- **Data API → Exposed schemas**: `public, graphql_public, reference`.
  - Never set `pgrst.db_schemas` on the `authenticator` role: it shadows the dashboard setting.
  - Check with `scripts/check-reference-exposed.sh`.
- **Auth**:
  - self-signup disabled;
  - magic link needs SMTP, which is not configured yet (#10: Resend free tier);
  - admins have `app_metadata.role = 'admin'` (ADR-0020). The first grant was made 2026-10-10.
- **Migrations**: before debugging a data-shaped bug, check `supabase_migrations.schema_migrations`. A migration applied outside `db push` needs its ledger version corrected to the filename (ADR-0032).
- **Backups**: Supabase Cloud's own backups, plan-dependent.

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

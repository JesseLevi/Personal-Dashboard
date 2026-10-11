# ADR-0024: Object storage on Cloudflare R2

**Status**: Accepted (2026-10-10, user decision). Amends ADR-0009 (storage part) and ADR-0022 §2/§4; supersedes the `recipe-thumbnails` Supabase bucket (#121, #171/#174).

## Context

- The user added a Cloudflare R2 account for cheap image storage: no egress fees, and a free tier (10 GB storage, 1M writes, 10M reads per month) that covers a single user.
- Today one Supabase Storage bucket exists (`recipe-thumbnails`, private, RLS on `storage.objects`). `note-images` (ADR-0022, #338) is planned but not built.
- Supabase Storage egress counts against the plan quota. Streaming images through a Vercel function also costs Vercel bandwidth and invocation time.
- R2 has no RLS. Authorization for objects moves from Postgres policies to server code.

## Decision

1. **R2 holds the bytes of user-uploaded binary objects** (images now; PDFs and other files when a feature needs them, which is out of scope for now). All other data stays in Supabase Postgres. The row that owns an object (`recipes.thumbnail_path`, the `image` node in `notes.content`) stays the source of truth for ownership.
2. **One seam, `lib/storage/`** (`import "server-only"`): `put`, `get`, `delete`, `deletePrefix` and `presignGet`. It talks to R2 through the S3-compatible API, so another S3-compatible host can be swapped in. No other module imports the S3 client or reads the `R2_*` env vars. The `check:server-only` gate covers them.
3. **Keys always start with the session's `user_id`**: `<user_id>/<module>/…`. The key builder takes the user id from the authenticated session, never from client input. Every read, write and delete first checks that the owning row belongs to the caller through the RLS-bound Supabase client, so Postgres RLS still decides ownership indirectly. These checks replace the `storage.objects` RLS test. Each consumer ships Vitest coverage proving that user B cannot reach user A's key (ADR-0009, adapted).
4. **Uploads go through server code.** `sharp` stays the authority: magic-byte check, re-encode to WebP and metadata stripping before `put`. The browser never talks to R2 directly.
5. **Delivery**: the app route (for example `/api/recipe-thumbnail/<id>`) checks the session and ownership, then answers `302` to a presigned R2 GET URL. The signing time is rounded down to the hour and the URL expires after 2 hours, so the same URL is reused within an hour and the browser can cache it. The redirect itself gets `Cache-Control: private, max-age=1800`. Bytes never pass through Vercel. Stored documents keep the stable app-route URL, never a presigned URL (ADR-0022 §4 still holds).
6. **Buckets**: one per environment (`production`, `development` for local and preview). Neither is public (no `r2.dev`, no custom domain). Each bucket has its own API token with *Object Read & Write* on that bucket only. A lifecycle rule aborts incomplete multipart uploads after 1 day.
7. **Migration**: existing `recipe-thumbnails` objects are copied to R2 by a one-off script (dry run by default, one object at a time). During the transition the route reads from R2 first and falls back to Supabase. After the user verifies the copy, a migration drops the bucket, its policies and its RLS test, and the fallback code is removed.

## Consequences

- RLS no longer guards the bytes themselves. A bug in a route's ownership check is the failure mode, so the shared delivery helper and the key builder are the only allowed paths and each has tests.
- `note-images` (#338) is built on R2 from the start: it gets no Supabase bucket and no `storage.objects` policies.
- Backups (decided 2026-10-10, Option B): accept R2's durability, no off-site sync. Supabase Cloud backups do not include R2. Recipe thumbnails can be re-imported from their source URL, and the cost and upkeep of a second copy (credentials, scheduled job, extra storage) outweigh that for a single-user app. Known trade-off: note images have no second copy and cannot be re-created. Revisit with a scheduled `rclone sync` of the production bucket to an off-site S3-compatible target if note images become important.
- Four new server-only env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) in `.env.example` and Vercel.
- Vercel's 4.5 MB request-body limit still caps server-side uploads. Images stay below it through the client pre-resize (`lib/images/downscale-client.ts`). Large files would need presigned PUT uploads, decided when files come into scope.

## Alternatives considered

- **Stay on Supabase Storage**: keeps RLS on objects, but egress and storage count against the Supabase plan.
- **Stream R2 bytes through the app route**: simpler and same-origin, but every view costs Vercel bandwidth and function time, which removes R2's free egress.
- **Public bucket or custom domain with unguessable keys**: leaks private images to anyone holding a URL, and URLs end up in history and logs.
- **Presigned PUT straight from the browser for images**: skips `sharp` validation and stores whatever the client sends.

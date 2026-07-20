# ADR-0002: Per-user secrets in Supabase Vault, accessed server-side only

**Status**: Accepted

## Context

Vision.md §5 asks: store per-account AI API keys fully via Supabase Vault, or add an application layer — and what are the RLS implications? The same pattern is needed for calendar credentials (ADR-0008) and, later, mail credentials.

## Decision

Vault for storage, **plus** a thin server-only access layer:

- Secrets live in `vault.secrets` (encrypted at rest). A user-facing table (e.g. `user_ai_keys`, `calendar_accounts`) stores only metadata + the `vault_secret_id`, with normal user_id RLS.
- Decryption happens exclusively in server code (server actions / worker) using the `service_role` connection reading `vault.decrypted_secrets`, filtered by the metadata row the requesting user owns. The decrypted value never reaches the client, is never logged, and never appears in error messages.
- No RLS is placed on Vault views themselves (Supabase does not support that reliably); isolation is enforced by the metadata table's RLS + the server-only code path. This *is* the "extra application layer", kept as thin as one data-access function per secret type (`lib/secrets.ts`).

## Consequences

- RLS story stays simple: policies live on ordinary metadata tables only.
- The `service_role` key must never be importable into client bundles — enforce via server-only module boundaries (`import "server-only"`) and CI grep.
- Key rotation = update Vault secret via the same server function; metadata row unchanged.

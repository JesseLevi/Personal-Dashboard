# ADR-0048: Note saves refuse an outdated copy

**Status**: Accepted (2026-11-01, user's improvement brief, package 1). Extends ADR-0023.

## Context

- The note editor autosaves the full document one second after typing stops (`SaveController`). The write is a full replacement (`save_note_content`).
- A tab that stayed open on a second device still holds the old text. One keystroke there replaced the newer document from the first device without warning.
- The image sweep (`sweepNoteImages`) then treated pictures that only the newer version referenced as orphans and deleted them from R2 after the grace period.
- `notes.updated_at` also moves when a note changes category or position (`move_note`), so it cannot tell a content change apart.

## Decision

1. **`notes.content_version`** (`integer not null default 0`) is bumped by every content save and by nothing else.
2. **`public.save_note_content_versioned(…, p_expected_version)`** writes only when the stored version equals the expected one, returns the new version, and raises `NL409` otherwise (`NL404` stays "not found or not owned"). Same `security invoker` shape and grants as `save_note_content` (ADR-0015/0030).
3. **The editor carries the version it last saw.** `getNote` returns it; `SaveController` sends it and advances it after each successful save. On `NL409` it stops writing and keeps the local text. The status line shows "Elders gewijzigd" with "Herladen", which drops the local copy and loads the server's. No merge and no "save anyway".
4. **Rollout is additive** (ADR-0032 §5). The 5-argument `save_note_content` stays and also bumps the version, so production code from before the migration keeps working, and a versioned tab still notices its saves. A page rendered before the migration sends `null` and takes the old path. Dropping the old function is a later migration once nothing calls it.

## Consequences

- A stale tab can no longer overwrite newer text, and the image sweep no longer runs after a refused save.
- Two tabs on one note: the second one to save after the other has saved sees the conflict and must reload, losing what was typed there since its last successful save. Accepted: the case is rare and the text on screen stays until the user reloads.

# ADR-0023: Links between notes and backlinks

**Status**: Accepted (2026-10-10, user decision). Extends ADR-0021.

## Context

- The dashboard is a "second brain". What separates it from Apple Notes is connecting notes to each other: typing `[[` to link another note, and seeing on a note which notes point to it.
- Notes are stored as TipTap JSON (`notes.content`) with server-derived `title`/`content_text`, written together in one action (`updateNoteContent`, #228).
- Backlinks need a query "which notes link to X" that should not scan every document's jsonb.

## Decision

1. **Inline node** `noteLink`, built on the official `Mention` node and `@tiptap/suggestion`, triggered by `[[`. Attributes: `noteId` (uuid) and `label` (the target's title at insert time, as a fallback). Suggestions come from the existing `searchNotes` server action (`pg_trgm`).
2. **Rendering**: the displayed label is the target's *current* title, resolved server-side for the note being opened (one RLS-scoped query by ids). A link whose target no longer exists renders as a "deleted note" state and is not clickable. Clicking navigates to `/notities/<noteId>`.
3. **Table** `note_links (user_id, source_note_id, target_note_id)`, primary key `(source_note_id, target_note_id)`, both FKs to `notes(id) on delete cascade`, `user_id` FK + RLS + an RLS test in the same PR (ADR-0009). It is derived data: rebuilt from the document on every save, never written by the UI directly.
4. **Atomic save**: content, `title`, `content_text` and the link set are written in one transaction via a `security invoker` RPC (`save_note_content`), following the ADR-0015 pattern. RLS ensures a link can only target the caller's own notes; unknown or foreign ids are dropped, not errored.
5. **Backlinks**: a "Gelinkt vanuit" section below the editor lists source notes (title + category). It is hidden when there are none.
6. **Plain text**: `toPlainText` emits the label, so search and embeddings see the linked title.
7. **Scope**: note → note only. Linking to recipes or board cards later is a new node type or attribute, not part of this ADR.

## Consequences

- One new table and one RPC; `updateNoteContent` switches to the RPC.
- A renamed note updates everywhere without rewriting other documents, because labels resolve at read time.
- The embed trigger (ADR-0006) is unaffected: it watches `notes`, and `note_links` is derived.

## Alternatives considered

- **Query backlinks from jsonb** (`content @> …` / jsonpath): no clean index for nested inline nodes, and it gets slower with every note.
- **Plain URL links to `/notities/<id>`**: no titles, no backlinks, breaks silently when a note is deleted.
- **A database trigger extracting links**: puts TipTap document parsing in SQL; the app already owns derivation in `lib/notes/document.ts`.

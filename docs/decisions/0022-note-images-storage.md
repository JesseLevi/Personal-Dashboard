# ADR-0022: Images in notes

**Status**: Accepted (2026-10-10, user decision). Extends ADR-0021. Mirrors the `recipe-thumbnails` pattern (#121, #171/#174): private bucket, RLS on `storage.objects`, server-side re-encode, delivery through an app route.

## Context

- Mobile Figma already draws an "Afbeelding" button on the EditingBar (`notes-editingbar-mobile-image-button-out-of-scope`); no image extension is installed.
- Images are the one editor capability with storage cost and a security surface (uploads, private delivery, orphaned files).
- The browser never talks to Supabase directly (ADR-0002/0003). `recipe-thumbnails` already solves upload, validation, WebP re-encoding (`sharp`) and private delivery (`app/api/recipe-thumbnail/[recipeId]/route.ts`).

## Decision

1. **Scope: images only** (JPEG, PNG, WebP, GIF in; still images out). Arbitrary file attachments (PDF etc.) are out of scope until there is a concrete need.
2. **Bucket**: private `note-images`, object key `<user_id>/<note_id>/<image_id>.webp`. `storage.objects` policies check `(storage.foldername(name))[1] = auth.uid()` on all four operations, like `recipe-thumbnails`. The RLS test lives in `supabase/tests`, same PR (ADR-0009). Bucket `file_size_limit` matches the server-side cap.
3. **Upload**: a server action using the request-scoped RLS-bound client (never `service_role`). It validates type by magic bytes, caps size at 10 MiB input, and re-encodes with `sharp` to WebP, max 2000 px on the long side. That strips EXIF/GPS metadata and keeps storage cheap. The action also verifies that the note belongs to the caller.
4. **Stored document**: the `image` node's `src` is the app route `/api/note-image/<note_id>/<image_id>`, never a signed URL. A signed URL would expire inside a stored document. The route checks the session, reads through the RLS-bound client and streams with `Cache-Control: private`. `alt` is a node attribute, editable, and included in `toPlainText` so search finds it.
5. **Input paths**: EditingBar/slash-menu "Afbeelding" (file picker), plus paste and drag-drop via `FileHandler`. While uploading, a placeholder node shows; on failure it is removed with a visible error (an optimistic success is never shown for a failed write).
6. **Orphans**: deleting a note deletes its `<user_id>/<note_id>/` prefix in the same server action. Images removed from a document are swept lazily on save (the same idea as ADR-0017): `updateNoteContent` compares the image ids in the saved document with the objects under the note's prefix and deletes the unreferenced ones. Undo within the session re-uploads nothing; an image deleted by the sweep and then restored by undo shows a broken-image state. This is accepted, and the sweep runs at most once per minute per note to make it rare.

## Consequences

- Storage cost grows with use. Supabase's included storage is ample for one user at ≤ 2000 px WebP.
- A second bucket follows the first one's pattern exactly, so `rls-recipe-thumbnails-storage.sql` is the template for the test.
- Image bytes never pass through the client-side Supabase SDK, and never leave the server unauthenticated.

## Alternatives considered

- **Public bucket or long-lived signed URLs in the document**: leaks private notes' images or expires inside stored content.
- **Base64 data URIs in `notes.content`**: bloats the jsonb row, `content_text` triggers and the embedding pipeline.
- **Keeping originals**: more storage, keeps EXIF location data; no use case needs them.

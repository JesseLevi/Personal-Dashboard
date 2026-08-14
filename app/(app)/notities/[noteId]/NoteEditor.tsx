"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { Button } from "@/components/atoms/Button";
import { noteExtensions } from "@/lib/notes/extensions";
import type { NoteRow } from "@/lib/notes/types";
import { deleteNote, updateNoteContent } from "../actions";

// #233 note-editor page body — Figma "Desktop/Notes/Edit" (3934:33463) /
// "Mobile/Notes/Edit" (3934:33422). One client component for the whole page
// body (same precedent as RecipeDetailPage.tsx): back button, "Verwijderen"
// (two-step confirm reused from RecipeDetailPage.tsx/NoteCategoryPanel.tsx,
// #233's own choice — see design/notes/NoteEditor.md), the TipTap editor
// itself, and a reserved-but-unbuilt EditingBar slot (#234). No title field,
// no save button, no category picker — Figma draws none, ticket confirms it.
// Full measurements, autosave debounce rationale, every spacing-flag: see
// design/notes/NoteEditor.md.

// Autosave debounce (see design/notes/NoteEditor.md for the full rationale):
// coalesces a typing burst into one write without feeling laggy. Flushed
// unconditionally (not just on the timer) on unmount/route-leave and on
// `visibilitychange`, so a debounce window can never eat the last keystroke.
const AUTOSAVE_DEBOUNCE_MS = 1000;

export interface NoteEditorProps {
  note: NoteRow;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const t = useTranslations("components.noteEditor");
  const tErrors = useTranslations("notes.errors");
  const router = useRouter();

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Holds the latest full document snapshot awaiting a write, and the
  // pending debounce timer -- refs, not state, because neither should ever
  // trigger a render on its own (see design/notes/NoteEditor.md's "never an
  // optimistic success indicator" section for why this stays render-silent
  // on the happy path too).
  const pendingContentRef = useRef<unknown>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const pending = pendingContentRef.current;
    if (pending === null) return;
    pendingContentRef.current = null;
    // Fire-and-forget from the unmount/visibilitychange paths -- there's no
    // component left to show an error on. The debounced path below awaits
    // the same call and surfaces a failure via `saveError`.
    void updateNoteContent({ noteId: note.id, content: pending }).then((result) => {
      setSaveError(!result.success);
    });
  }, [note.id]);

  const editor = useEditor({
    extensions: [
      ...noteExtensions,
      // Editor-only UI copy, not part of the fixed content-rendering
      // whitelist (lib/notes/extensions.ts's own header explains the split).
      Placeholder.configure({ placeholder: t("placeholder") }),
    ],
    content: note.content,
    // Required in the App Router -- without it the server render and the
    // client's first paint disagree, and React logs a hydration mismatch
    // (confirmed via Context7, TipTap's own Next.js install guide).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "text-base font-semibold text-text-primary focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      pendingContentRef.current = current.getJSON();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  // Flushes on `visibilitychange` (tab switch, app backgrounding, browser
  // close -- none of which reliably unmount a React tree) and on this
  // component's own unmount (in-app route navigation, which visibilitychange
  // never fires for). Together the two cover every way this page can be
  // left, so a pending debounce can never silently lose the last edit.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush();
    };
  }, [flush]);

  function handleDelete() {
    setDeleteError(null);
    // Drops any pending autosave first -- the note is about to stop
    // existing, and a write racing the delete would otherwise resolve
    // `not-found` and show a confusing save-error right as the page
    // navigates away.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingContentRef.current = null;
    startTransition(async () => {
      const result = await deleteNote({ noteId: note.id });
      if (!result.success) {
        setDeleteError(tErrors(result.error));
        setDeleteConfirming(false);
        return;
      }
      router.push("/notities");
    });
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-page-stack pr-page-right-equal">
      {/* spacing-flag: gap-4 -- Header's itemSpacing (16) has no bound Figma
          variable on either breakpoint (SPACE_BETWEEN layout, same reading
          as RecipeDetailPage.tsx's own header) -- design/notes/NoteEditor.md */}
      <div className="flex w-full items-center justify-between gap-4">
        <Button icon="ArrowLeft" aria-label={t("backLabel")} onClick={() => router.push("/notities")} />

        {deleteConfirming ? (
          // spacing-flag: gap-2 -- transient confirm-row state, no Figma node
          // for it (same precedent as RecipeDetailPage.tsx/
          // NoteCategoryPanel.tsx) -- design/notes/NoteEditor.md
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirming(false)} disabled={isPending}>
              {t("cancelLabel")}
            </Button>
            <Button variant="destructive" icon="Trash" onClick={handleDelete} disabled={isPending}>
              {isPending ? t("deletingLabel") : t("deleteConfirmButtonLabel")}
            </Button>
          </div>
        ) : (
          <Button variant="destructive" icon="Trash" onClick={() => setDeleteConfirming(true)}>
            {t("deleteLabel")}
          </Button>
        )}
      </div>

      {deleteError && <p className="text-base font-semibold text-priority-urgent">{deleteError}</p>}
      {saveError && <p className="text-base font-semibold text-priority-urgent">{t("saveErrorLabel")}</p>}

      {/* EditingBar slot (#234) -- not built here, see design/notes/NoteEditor.md. */}

      {/* spacing-flag: pb-[calc(4rem+env(safe-area-inset-bottom))] reserves
          room for #234's not-yet-built fixed-bottom EditingBar on mobile
          (Figma node 3978:14870 measures 48px tall) plus the safe-area inset
          -- a code-only reservation, not a Figma value, since the bar itself
          isn't rendered by this ticket. md:py-2 mirrors the desktop Content
          frame's own itemSpacing/paddingY (node 4067:20020, 8px), a real
          measured value that Figma leaves unbound -- design/notes/
          NoteEditor.md */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

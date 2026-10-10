"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { EditingBar } from "@/components/organisms/EditingBar";
import { NoteSaveStatus } from "@/components/molecules/NoteSaveStatus";
import { NoteWordCount } from "@/components/molecules/NoteWordCount";
import { TableMenu } from "@/components/organisms/TableMenu";
import { noteExtensions } from "@/lib/notes/extensions";
import { countWords, readingMinutes, typographyForLocale } from "@/lib/notes/writing-comfort";
import type { NoteRow } from "@/lib/notes/types";
import { deleteNote } from "../actions";
import { useNoteSave } from "./useNoteSave";

// #233 note-editor page body — Figma "Desktop/Notes/Edit" (3934:33463) /
// "Mobile/Notes/Edit" (3934:33422). One client component for the whole page
// body (same precedent as RecipeDetailPage.tsx): back button, "Verwijderen"
// (two-step confirm reused from RecipeDetailPage.tsx/CategoryPanel.tsx,
// #233's own choice — see design/notes/NoteEditor.md), the TipTap editor
// itself, and a reserved-but-unbuilt EditingBar slot (#234). No title field,
// no save button, no category picker — Figma draws none, ticket confirms it.
// Full measurements, autosave debounce rationale, every spacing-flag: see
// design/notes/NoteEditor.md.

export interface NoteEditorProps {
  note: NoteRow;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const t = useTranslations("components.noteEditor");
  const tErrors = useTranslations("notes.errors");
  const locale = useLocale();
  const router = useRouter();

  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { status, change, retry, discard } = useNoteSave(note.id);

  const editor = useEditor({
    extensions: [
      ...noteExtensions,
      // Editor-only UI copy, not part of the fixed content-rendering
      // whitelist (lib/notes/extensions.ts's own header explains the split).
      Placeholder.configure({ placeholder: t("placeholder") }),
      typographyForLocale(locale),
      CharacterCount.configure({ wordCounter: countWords }),
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
    onUpdate: ({ editor: current }) => change(current.getJSON()),
  });

  const words = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.storage.characterCount.words() ?? 0,
  }) ?? 0;

  function handleDelete() {
    setDeleteError(null);
    // Drops any pending autosave first: a write racing the delete would show a confusing save error.
    discard();
    startTransition(async () => {
      const result = await deleteNote({ noteId: note.id });
      if (!result.success) {
        setDeleteError(tErrors(result.error));
        cancelDelete();
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

        {!deleteConfirming && <NoteSaveStatus status={status} onRetry={retry} />}

        {deleteConfirming ? (
          <DeleteConfirm
            layout="inline"
            isPending={isPending}
            onCancel={cancelDelete}
            onConfirm={handleDelete}
            labels={{ prompt: t("deleteConfirmLabel"), cancel: t("cancelLabel"), confirm: t("deleteConfirmButtonLabel"), deleting: t("deletingLabel") }}
          />
        ) : (
          <Button variant="destructive" icon="Trash" onClick={() => askDelete()}>
            {t("deleteLabel")}
          </Button>
        )}
      </div>

      {deleteError && <p className="text-base font-semibold text-priority-urgent">{deleteError}</p>}

      {/* Desktop: in-flow, directly under the header (EditingBar.tsx's own
          `md:static`). Mobile: EditingBar.tsx renders it `fixed` to the
          viewport bottom regardless of where it sits in this tree -- see
          design/notes/EditingBar.md. */}
      <EditingBar editor={editor} />

      {/* spacing-flag: pb-[calc(4rem+env(safe-area-inset-bottom))] reserves
          mobile clearance for EditingBar.tsx's own fixed-bottom bar (48px
          measured, Figma node 3978:14870) -- #234 positions that bar at
          `bottom-[env(safe-area-inset-bottom)]` itself, so this reservation
          only needs to clear the bar's own height, not double-add the inset
          again. md:py-2 mirrors the desktop Content frame's own itemSpacing/
          paddingY (node 4067:20020, 8px), a real measured value that Figma
          leaves unbound -- design/notes/NoteEditor.md */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-2">
        <EditorContent editor={editor} />
        <TableMenu editor={editor} />
        <div className="pt-stack-md">
          <NoteWordCount words={words} minutes={readingMinutes(words)} />
        </div>
      </div>
    </div>
  );
}

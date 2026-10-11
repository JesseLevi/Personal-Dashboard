"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { EditingBar } from "@/components/organisms/EditingBar";
import { NoteSaveStatus } from "@/components/molecules/NoteSaveStatus";
import { NoteWordCount } from "@/components/molecules/NoteWordCount";
import { LinkPopover } from "@/components/organisms/LinkPopover";
import { NoteBubbleMenu } from "@/components/organisms/NoteBubbleMenu";
import { NoteBlockHandle } from "@/components/organisms/NoteBlockHandle";
import { TableMenu } from "@/components/organisms/TableMenu";
import { noteExtensionsWith } from "@/lib/notes/extensions";
import { buildNoteLinkResolution } from "@/lib/notes/note-link"; // #341
import { NoteLinkSuggestion } from "@/lib/notes/note-link-suggestion"; // #341
import { NoteLinkMenu } from "@/components/organisms/NoteLinkMenu"; // #341
import { NoteBacklinks, type NoteBacklink } from "@/components/organisms/NoteBacklinks"; // #341
import { setDetailsToggleLabels } from "@/lib/notes/details-labels";
import { countWords, readingMinutes, typographyForLocale } from "@/lib/notes/writing-comfort";
import { SlashMenu } from "@/components/organisms/SlashMenu";
import { NoteMarkdownMenu } from "@/components/organisms/NoteMarkdownMenu"; // #337
import { MarkdownPaste } from "@/lib/notes/markdown-paste"; // #337
import { downloadMarkdown, markdownFilename } from "@/lib/notes/markdown-export"; // #337
import { deriveTitle, type TipTapDocument } from "@/lib/notes/document"; // #337
import { SlashCommand } from "@/lib/notes/slash-command";
import { SLASH_ITEMS } from "@/lib/notes/slash-items";
import type { NoteRow } from "@/lib/notes/types";
import { NoteImageUpload } from "@/lib/notes/image-upload"; // #339
import { downscaleImageFile } from "@/lib/images/downscale-client"; // #339
import { deleteNote, searchNoteLinkTargets, uploadNoteImage } from "../actions";
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
  /** #341: current title per linked note id; a linked id absent here is a deleted note. */
  linkTitles: Record<string, string>;
  /** #341: notes that link to this one ("Gelinkt vanuit"). */
  backlinks: NoteBacklink[];
}

export function NoteEditor({ note, linkTitles, backlinks }: NoteEditorProps) {
  const t = useTranslations("components.noteEditor");
  const tSlash = useTranslations("components.slashMenu");
  const tErrors = useTranslations("notes.errors");
  const tDetails = useTranslations("components.noteDetails");
  const tMarkdown = useTranslations("components.noteMarkdownMenu"); // #337
  const tImage = useTranslations("components.noteImage"); // #339
  const locale = useLocale();
  // #336: the collapsible-section toggle is plain DOM; give it translated labels.
  setDetailsToggleLabels({ open: tDetails("expand"), close: tDetails("collapse") });
  const router = useRouter();

  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { status, change, retry, discard } = useNoteSave(note.id);

  // #339: a failed or rejected image upload shows its error here; nothing is inserted.
  const [imageError, setImageError] = useState<string | null>(null);

  // #341: note links show their target's current title (resolved on the server
  // when the note opened); a click navigates client-side. Built once per mount.
  const [extensions] = useState(() => [
    ...noteExtensionsWith({
      ...buildNoteLinkResolution(note.content, linkTitles),
      navigate: (href) => router.push(href),
    }),
    NoteLinkSuggestion.configure({
      search: async (query) => {
        const result = await searchNoteLinkTargets({ noteId: note.id, query });
        return result.success ? result.data : [];
      },
    }),
  ]);

  const editor = useEditor({
    extensions: [
      ...extensions,
      // Editor-only UI copy, not part of the fixed content-rendering
      // whitelist (lib/notes/extensions.ts's own header explains the split).
      Placeholder.configure({ placeholder: t("placeholder") }),
      typographyForLocale(locale),
      MarkdownPaste, // #337: plain-text markdown paste -> rich blocks
      NoteImageUpload.configure({
        upload: (file) => uploadNoteImage(note.id, file),
        prepare: downscaleImageFile,
        onError: (code) => setImageError(tErrors(code)),
        uploadingLabel: tImage("uploading"),
      }),
      CharacterCount.configure({ wordCounter: countWords }),
      // "/" block menu (#332): labels are searchable in the active language.
      SlashCommand.configure({
        items: SLASH_ITEMS,
        labelsFor: (item) => [tSlash(`items.${item.id}`)],
      }),
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

  // #337: client-side only. The serializer is a lazy chunk (lib/notes/markdown.ts).
  const [markdownNotice, setMarkdownNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!markdownNotice) return;
    const timer = setTimeout(() => setMarkdownNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [markdownNotice]);

  useEffect(() => {
    if (!imageError) return;
    const timer = setTimeout(() => setImageError(null), 8000);
    return () => clearTimeout(timer);
  }, [imageError]);

  async function serializeNote() {
    if (!editor) return null;
    const { docToMarkdown } = await import("@/lib/notes/markdown");
    return docToMarkdown(editor.getJSON());
  }

  async function handleCopyMarkdown() {
    try {
      const markdown = await serializeNote();
      if (markdown === null) return;
      await navigator.clipboard.writeText(markdown);
      setMarkdownNotice(tMarkdown("copied"));
    } catch {
      setMarkdownNotice(tMarkdown("copyFailed"));
    }
  }

  async function handleExportMarkdown() {
    try {
      const markdown = await serializeNote();
      if (markdown === null || !editor) return;
      const title = deriveTitle(editor.getJSON() as TipTapDocument);
      downloadMarkdown(markdown, markdownFilename(title, tMarkdown("untitled")));
    } catch {
      setMarkdownNotice(tMarkdown("copyFailed"));
    }
  }

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
          <div className="flex items-center gap-inline-sm">
            <NoteMarkdownMenu onCopy={handleCopyMarkdown} onExport={handleExportMarkdown} disabled={!editor} />
            <Button variant="destructive" icon="Trash" onClick={() => askDelete()}>
              {t("deleteLabel")}
            </Button>
          </div>
        )}
      </div>

      {markdownNotice && (
        <p role="status" className="text-sm font-semibold text-text-secondary">
          {markdownNotice}
        </p>
      )}

      {imageError && (
        <p role="alert" className="text-base font-semibold text-priority-urgent">
          {imageError}
        </p>
      )}

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
        {backlinks.length > 0 && (
          <div className="pt-stack-lg">
            <NoteBacklinks backlinks={backlinks} onNavigate={(href) => router.push(href)} />
          </div>
        )}
        <SlashMenu editor={editor} />
        <NoteLinkMenu editor={editor} />
        <NoteBubbleMenu editor={editor} />
        <NoteBlockHandle editor={editor} />
        <LinkPopover editor={editor} />
      </div>
    </div>
  );
}

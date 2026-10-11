"use client";

// design: Claude-designed on request (#341)
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/ui/cn";
import { resolveNoteLink, type NoteLinkResolution } from "@/lib/notes/note-link";

/**
 * Node view of the notes editor's `noteLink`: a chip showing the target's
 * CURRENT title (the stored label is only the fallback), or, when the target
 * is gone, a muted "Verwijderde notitie" that is not a link. A click opens
 * `/notities/<id>` (client-side when the editor was given `navigate`; a
 * modified click keeps the browser's own new-tab behaviour). The anchor is a
 * real focusable link, so Tab + Enter work inside the document too. Chip
 * styling: `.tiptap .note-link*` in app/globals.css; rationale and states:
 * design/notes/NoteEditor.md (#341).
 */
export function NoteLinkView({ node, extension, selected }: NodeViewProps) {
  const t = useTranslations("components.noteRef");
  const resolution = extension.options.resolution as NoteLinkResolution;
  const link = resolveNoteLink(resolution, String(node.attrs.noteId ?? ""), String(node.attrs.label ?? ""));

  if (link.state === "deleted") {
    return (
      <NodeViewWrapper as="span" data-selected={selected ? "" : undefined}>
        <span className={cn("note-link note-link-deleted", selected && "note-link-selected")}>{t("deleted")}</span>
      </NodeViewWrapper>
    );
  }

  const { href, title } = link;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (resolution.navigate) resolution.navigate(href);
    else window.location.assign(href);
  }

  return (
    <NodeViewWrapper as="span" data-selected={selected ? "" : undefined}>
      <a
        href={href}
        contentEditable={false}
        draggable={false}
        className={cn("note-link", selected && "note-link-selected")}
        onClick={handleClick}
      >
        {title || t("untitled")}
      </a>
    </NodeViewWrapper>
  );
}

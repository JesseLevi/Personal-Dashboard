"use client";

// design: Claude-designed on request (#339)
import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { cn } from "@/lib/ui/cn";

/**
 * Node view of the notes editor's `image`: the picture, or a "not available"
 * block when the object is missing (`onError`), and, while the node is
 * selected in an editable document, an alt-text field plus a delete button.
 * Enter on a selected image moves focus to the field (lib/notes/extensions.ts);
 * Enter or Escape in it returns focus to the document. Rationale and states:
 * design/notes/NoteEditor.md (#339).
 */
export function NoteImageView({ node, selected, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const t = useTranslations("components.noteImage");
  const fieldId = useId();
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState(alt);
  const broken = failedSrc === src;
  const showTools = selected && editor.isEditable;

  useEffect(() => setDraft(alt), [alt]);

  function commit() {
    const next = draft.trim();
    if (next !== alt) updateAttributes({ alt: next === "" ? null : next });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      editor.commands.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(alt);
      editor.commands.focus();
    }
  }

  return (
    <NodeViewWrapper
      data-selected={selected ? "" : undefined}
      className={cn("note-image", selected && "note-image-selected")}
    >
      {broken ? (
        <div
          role="img"
          aria-label={alt ? `${alt}. ${t("broken")}` : t("broken")}
          className="note-image-broken flex items-center gap-inline-sm"
        >
          <Icon name="Image" />
          <span>{t("broken")}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin, auth-gated route; next/image would proxy it
        <img src={src} alt={alt} draggable={false} onError={() => setFailedSrc(src)} />
      )}
      {showTools && (
        <div
          contentEditable={false}
          onKeyDown={handleKeyDown}
          className="flex items-end gap-inline-sm pt-stack-sm"
        >
          <InputField
            id={fieldId}
            type="text"
            label={t("altLabel")}
            placeholder={t("altPlaceholder")}
            value={draft}
            className="flex-1"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
          />
          <Button variant="destructive" icon="Trash" aria-label={t("deleteLabel")} onClick={() => deleteNode()} />
        </div>
      )}
    </NodeViewWrapper>
  );
}

"use client";

// design: Claude-designed on request (#336)
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import {
  CODE_LANGUAGE_IDS,
  isCodeLanguageId,
  loadCodeLanguage,
  rehighlightCodeBlocks,
  type CodeLanguageId,
} from "@/lib/notes/code-languages";

/**
 * Node view of the notes editor's `codeBlock`: a language selector (the
 * `Dropdown` atom) and a copy button above the editable code. The stored
 * `language` attribute is a CodeLanguageId, or null for plain text. Loads the
 * grammar for the block's language on demand (lib/notes/code-languages.ts) so
 * old blocks highlight on open. Rationale: design/notes/NoteEditor.md (#336).
 */
const COPIED_RESET_MS = 2000;

export function CodeBlockView({ node, editor, updateAttributes }: NodeViewProps) {
  const t = useTranslations("components.codeBlock");
  const labelId = useId();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stored = node.attrs.language as string | null;
  const current: CodeLanguageId | string = stored && stored !== "plain" ? stored : "plain";
  const currentLabel = isCodeLanguageId(current) ? t(`languages.${current}`) : current;

  useEffect(() => {
    let cancelled = false;
    loadCodeLanguage(stored).then((registered) => {
      if (registered && !cancelled) rehighlightCodeBlocks(editor);
    });
    return () => {
      cancelled = true;
    };
  }, [stored, editor]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(node.textContent);
    } catch {
      return;
    }
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  function choose(id: CodeLanguageId) {
    updateAttributes({ language: id === "plain" ? null : id });
    editor.commands.focus();
  }

  return (
    <NodeViewWrapper className="code-block">
      <div contentEditable={false} className="flex items-start justify-between gap-inline-md pb-stack-sm">
        {editor.isEditable ? (
          // Re-keyed on the language so choosing an option collapses the list.
          <Dropdown key={current} id={`${labelId}-language`} label={t("languageLabel")} defaultOpen={false} className="w-56">
            <Button variant="filled" align="left">
              {currentLabel}
            </Button>
            {CODE_LANGUAGE_IDS.map((id) => (
              <Button key={id} variant="white" align="left" onClick={() => choose(id)} aria-pressed={id === current}>
                {t(`languages.${id}`)}
              </Button>
            ))}
          </Dropdown>
        ) : (
          <span className="text-base font-semibold text-text-secondary">{currentLabel}</span>
        )}
        <Button variant="outline" icon={copied ? "Check" : undefined} onClick={copy}>
          {copied ? t("copied") : t("copy")}
        </Button>
        <span className="sr-only" role="status">
          {copied ? t("copied") : ""}
        </span>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

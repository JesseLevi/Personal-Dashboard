"use client";

// design: Claude-designed on request (#342)
import { useId } from "react";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { TocItem } from "@/lib/notes/toc";

/**
 * "Inhoud": the table-of-contents rail of a long note (ADR-0021 s3), listing its
 * H1-H3. Presentational: the open note supplies the items and the active heading
 * (lib/notes/use-note-toc.ts). Plain links on the existing text and surface
 * tokens; no new component. The active item is `aria-current="location"`. A
 * plain click goes through `onSelect` (scroll + focus the heading), a modified
 * click keeps the browser's own behaviour. Rationale: design/notes/NoteEditor.md (#342).
 */
export interface NoteTableOfContentsProps {
  items: TocItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const LEVEL_ITEM: Record<number, string> = { 1: "", 2: "ml-component-md", 3: "ml-component-md" };
const LEVEL_LINK: Record<number, string> = { 1: "pl-component-sm", 2: "pl-component-sm", 3: "pl-component-lg" };

export function NoteTableOfContents({ items, activeId, onSelect }: NoteTableOfContentsProps) {
  const t = useTranslations("components.noteTableOfContents");
  const headingId = useId();

  function handleClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onSelect(id);
  }

  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-stack-sm border-l border-stroke-lines pl-component-sm">
      <p id={headingId} className="px-component-sm text-sm font-semibold text-text-secondary">
        {t("title")}
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className={LEVEL_ITEM[item.level] ?? ""}>
              <a
                href={`#${item.id}`}
                onClick={(event) => handleClick(event, item.id)}
                aria-current={active ? "location" : undefined}
                className={`block truncate rounded-control py-component-xs pr-component-sm text-sm font-semibold ${LEVEL_LINK[item.level] ?? ""} ${
                  active
                    ? "bg-surface-secondary text-text-primary"
                    : "text-text-secondary hover:bg-surface-secondary-hover hover:text-text-primary active:bg-surface-secondary-active"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

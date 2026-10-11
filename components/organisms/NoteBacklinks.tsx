"use client";

// design: Claude-designed on request (#341)
import { useId } from "react";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { noteLinkHref } from "@/lib/notes/note-link";

/**
 * "Gelinkt vanuit": the notes that link to the open note, below the editor
 * (ADR-0023 s5). Hidden when there are none. Plain links (title, category
 * muted) on the existing text and surface tokens; no new component. A plain
 * click goes through `onNavigate` (client-side) when given, a modified click
 * keeps the browser's own behaviour. Rationale: design/notes/NoteEditor.md (#341).
 */
export interface NoteBacklink {
  id: string;
  title: string;
  category_name: string;
}

export interface NoteBacklinksProps {
  backlinks: NoteBacklink[];
  onNavigate?: (href: string) => void;
}

export function NoteBacklinks({ backlinks, onNavigate }: NoteBacklinksProps) {
  const t = useTranslations("components.noteBacklinks");
  const headingId = useId();
  if (backlinks.length === 0) return null;

  function handleClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(href);
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-stack-sm">
      <h2 id={headingId} className="text-sm font-semibold text-text-secondary">
        {t("title")}
      </h2>
      <ul className="flex flex-col">
        {backlinks.map((backlink) => {
          const href = noteLinkHref(backlink.id);
          return (
            <li key={backlink.id}>
              <a
                href={href}
                onClick={(event) => handleClick(event, href)}
                className="flex min-w-0 items-baseline gap-inline-sm rounded-control px-component-sm py-component-xs text-base font-semibold text-text-primary hover:bg-surface-secondary-hover active:bg-surface-secondary-active"
              >
                <span className="truncate">{backlink.title.trim() || t("untitled")}</span>
                {backlink.category_name && (
                  <span className="shrink-0 text-sm font-semibold text-text-secondary">
                    {backlink.category_name}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

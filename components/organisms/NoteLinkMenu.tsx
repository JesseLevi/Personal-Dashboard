"use client";

// design: Claude-designed on request (#341)
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { getNoteLinkStore, NoteLinkStore } from "@/lib/notes/note-link-suggestion";
import { optionId, panelClasses, usePlacement } from "./SlashMenu";

/**
 * The "[[" note-link menu: `NoteLinkMenuPanel` is the presentational listbox
 * (a labelless `Dropdown` of transparent `Button` rows: title, category
 * muted), `NoteLinkMenu` connects it to the editor's `NoteLinkStore`
 * (lib/notes/note-link-suggestion.ts) and positions it with the slash menu's
 * placement (caret, inside the visual viewport). Focus never leaves the
 * editor; the editor carries the combobox attributes, the list is a
 * `listbox` of `option`s. Contract: design/notes/NoteEditor.md (#341).
 */
export interface NoteLinkMenuRow {
  id: string;
  title: string;
  category: string;
}

export interface NoteLinkMenuPanelProps {
  rows: NoteLinkMenuRow[];
  selectedIndex: number;
  loading?: boolean;
  onSelect: (index: number) => void;
  onHover?: (index: number) => void;
  label: string;
  noResultsLabel: string;
  searchingLabel: string;
  untitledLabel: string;
  /** Prefix of the option ids, for aria-activedescendant. */
  idPrefix: string;
}

export function NoteLinkMenuPanel({
  rows,
  selectedIndex,
  loading = false,
  onSelect,
  onHover,
  label,
  noResultsLabel,
  searchingLabel,
  untitledLabel,
  idPrefix,
}: NoteLinkMenuPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, rows]);

  return (
    <Dropdown role="listbox" aria-label={label} aria-busy={loading} className="shadow-sm">
      <div ref={listRef} className="contents">
        {rows.length === 0 ? (
          <p role="status" className="px-component-sm py-component-xs text-base font-semibold text-text-placeholder">
            {loading ? searchingLabel : noResultsLabel}
          </p>
        ) : (
          rows.map((row, index) => (
            <Button
              key={row.id}
              id={optionId(idPrefix, row.id)}
              role="option"
              aria-selected={index === selectedIndex}
              variant="transparent"
              align="left"
              icon="Notebook"
              tabIndex={-1}
              className="aria-selected:bg-surface-secondary-hover aria-selected:text-text-primary"
              onMouseMove={() => onHover?.(index)}
              onClick={() => onSelect(index)}
            >
              <span className="flex min-w-0 items-baseline gap-inline-sm">
                <span className="truncate">{row.title.trim() || untitledLabel}</span>
                {row.category && (
                  <span className="shrink-0 text-sm font-semibold text-text-secondary">{row.category}</span>
                )}
              </span>
            </Button>
          ))
        )}
      </div>
    </Dropdown>
  );
}

const EMPTY_STORE = new NoteLinkStore();

export interface NoteLinkMenuProps {
  editor: Editor | null;
}

export function NoteLinkMenu({ editor }: NoteLinkMenuProps) {
  const t = useTranslations("components.noteRef");
  const idPrefix = useId();
  const listId = `${idPrefix}-list`;
  const store = getNoteLinkStore(editor) ?? EMPTY_STORE;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const rows: NoteLinkMenuRow[] = state.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category_name,
  }));

  const list = usePlacement(() => state.anchor?.() ?? null, state.open, state.items);

  // Combobox semantics on the editor itself, which keeps DOM focus.
  const selectedRow = rows[state.selectedIndex];
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom || !state.open) return;
    dom.setAttribute("aria-haspopup", "listbox");
    dom.setAttribute("aria-expanded", "true");
    dom.setAttribute("aria-controls", listId);
    if (selectedRow) dom.setAttribute("aria-activedescendant", optionId(idPrefix, selectedRow.id));
    return () => {
      for (const name of ["aria-haspopup", "aria-expanded", "aria-controls", "aria-activedescendant"]) {
        dom.removeAttribute(name);
      }
    };
  }, [editor, state.open, listId, idPrefix, selectedRow]);

  if (!state.open) return null;
  return createPortal(
    // Mouse/touch on the list must not blur the editor (iOS keeps its keyboard).
    <div
      ref={list.panelRef}
      id={listId}
      style={list.placement?.style}
      className={panelClasses(list.placement)}
      onMouseDown={(event) => event.preventDefault()}
    >
      <NoteLinkMenuPanel
        rows={rows}
        selectedIndex={state.selectedIndex}
        loading={state.loading}
        onSelect={(index) => state.items[index] && store.select(state.items[index])}
        onHover={(index) => index !== state.selectedIndex && store.set({ selectedIndex: index })}
        label={t("menuLabel")}
        noResultsLabel={t("noResults")}
        searchingLabel={t("searching")}
        untitledLabel={t("untitled")}
        idPrefix={idPrefix}
      />
    </div>,
    document.body,
  );
}

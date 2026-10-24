"use client";

// design: Claude-designed (#581)
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { NOTES_SEARCH_MIN_QUERY_LENGTH } from "@/lib/notes/search";
import {
  flattenGroups,
  groupResults,
  moveActive,
  SEARCH_PANEL_DEBOUNCE_MS,
  showSmartSearchHint,
  type SearchPanelAction,
} from "@/lib/search/panel";
import type { SearchType } from "@/lib/search/merge";
import type { SearchResponse, SearchResult } from "@/lib/search/query";
import { Icon, type IconName } from "../atoms/Icon";
import { InputField } from "../atoms/InputField";
import { Card } from "../molecules/Card";
import { SidePanel } from "./SidePanel";

/**
 * Organism/SearchPanel: the one search field of Atlas (ADR-0043 §10). A `SidePanel` with an
 * `InputField` on top and the results below, grouped per module. Knows nothing about routing or
 * settings: the composer passes `onSearch`, `onOpen` and `onOpenSettings`. Contract and rationale:
 * design/notes/SearchPanel.md.
 */
const MAX_QUERY_LENGTH = 200;
const LISTBOX_ID = "search-panel-results";
const optionId = (index: number) => `search-panel-option-${index}`;

const TYPE_ICON: Record<SearchType, IconName> = {
  note: "Notebook",
  recipe: "ChefHat",
  card: "Columns3",
  calendar_event: "Calendar",
  shopping_list_item: "ShoppingBasket",
};

interface ResultRowProps {
  id: string;
  result: SearchResult;
  active: boolean;
  untitled: string;
  date?: string;
  onActivate: () => void;
  onOpen: () => void;
}

// Focus stays in the field; the row only shows the arrow-key position (`aria-activedescendant`).
function ResultRow({ id, result, active, untitled, date, onActivate, onOpen }: ResultRowProps) {
  return (
    <Card contentClassName={active ? "border-stroke-primary-selected" : undefined}>
      <button
        id={id}
        type="button"
        role="option"
        aria-selected={active}
        tabIndex={-1}
        onPointerMove={active ? undefined : onActivate}
        onClick={onOpen}
        className="flex w-full items-start gap-inline-lg text-left"
      >
        <Icon name={TYPE_ICON[result.type]} className="shrink-0 text-text-secondary" />
        <span className="flex min-w-0 flex-1 flex-col gap-stack-sm">
          <span className="break-words text-base font-semibold text-text-primary">{result.title.trim() || untitled}</span>
          {date && <span className="text-sm font-semibold text-text-secondary">{date}</span>}
          {result.snippet && <span className="line-clamp-2 break-words text-sm text-text-secondary">{result.snippet}</span>}
        </span>
      </button>
    </Card>
  );
}

type View =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "done"; response: SearchResponse };

export interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  /** Takes the trimmed query. Pass a stable reference: it is a dependency of the debounce effect. */
  onSearch: SearchPanelAction;
  /** Fired with a result's `href` on click or Enter; the panel closes itself first. */
  onOpen: (href: string) => void;
  /** Opens Settings, where the member can switch on smart search. */
  onOpenSettings: () => void;
  /** The member could switch smart search on (a provider exists, and they have not opted in): shows the calm hint on keyword answers. */
  canEnableSmartSearch: boolean;
  /** Focus the field on open. The composer passes false below `lg`, so a phone keeps its keyboard down. */
  autoFocusField: boolean;
  /** Pre-fills the field on open (also keeps the Ladle baselines deterministic). */
  initialQuery?: string;
}

export function SearchPanel({
  open,
  onClose,
  onSearch,
  onOpen,
  onOpenSettings,
  canEnableSmartSearch,
  autoFocusField,
  initialQuery,
}: SearchPanelProps) {
  const t = useTranslations("components.searchPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const format = useFormatter();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [view, setView] = useState<View>({ status: "idle" });
  const [active, setActive] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  // A pre-filled query searches at once: there is no typing to wait out (and the Ladle baselines stay deterministic).
  const searchNow = useRef(initialQuery !== undefined);

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= NOTES_SEARCH_MIN_QUERY_LENGTH;
  const response = view.status === "done" ? view.response : null;
  const groups = useMemo(() => groupResults(response?.results ?? []), [response]);
  const flat = useMemo(() => flattenGroups(groups), [groups]);

  // Debounced search-as-you-type; `cancelled` drops a response that a newer keystroke has outdated.
  useEffect(() => {
    if (!open || !searchable) {
      setView({ status: "idle" });
      return;
    }
    let cancelled = false;
    const delay = searchNow.current ? 0 : SEARCH_PANEL_DEBOUNCE_MS;
    searchNow.current = false;
    setView({ status: "loading" });
    const timeoutId = setTimeout(() => {
      onSearch(trimmedQuery)
        .then((result) => {
          if (cancelled) return;
          setActive(0);
          setView(result.success ? { status: "done", response: result.data } : { status: "failed" });
        })
        .catch(() => {
          if (!cancelled) setView({ status: "failed" });
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, searchable, trimmedQuery, onSearch]);

  // After SidePanel's own focus move (its effect runs first), the field takes over from `lg`.
  useEffect(() => {
    if (open && autoFocusField) fieldRef.current?.querySelector("input")?.focus();
  }, [open, autoFocusField]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [open, active, flat]);

  function handleClose() {
    setQuery("");
    setView({ status: "idle" });
    setActive(0);
    onClose();
  }

  function handleOpen(href: string) {
    handleClose();
    onOpen(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      const result = flat[active];
      if (!result) return;
      event.preventDefault();
      handleOpen(result.href);
      return;
    }
    const next = moveActive(active, event.key, flat.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  function dateLabel(date: string) {
    return format.dateTime(new Date(`${date}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  }

  const hasResults = flat.length > 0;
  const showHint = response !== null && showSmartSearchHint(response.mode, canEnableSmartSearch);
  let offset = 0;

  return (
    <SidePanel open={open} onClose={handleClose} title={t("title")} closeLabel={tSidePanel("closeLabel")}>
      <div ref={fieldRef}>
        <InputField
          id="search-panel-query"
          role="combobox"
          aria-label={t("searchLabel")}
          aria-expanded={hasResults}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={hasResults ? optionId(active) : undefined}
          aria-autocomplete="list"
          placeholder={t("searchPlaceholder")}
          trailingIcon="Search"
          value={query}
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div aria-live="polite" className="flex w-full flex-col gap-stack-xl">
        {view.status === "idle" && <p className="text-base font-semibold text-text-secondary">{t("promptLabel")}</p>}
        {view.status === "loading" && <p className="text-base font-semibold text-text-secondary">{t("searchingLabel")}</p>}
        {view.status === "failed" && <p className="text-base font-semibold text-text-secondary">{t("unavailableLabel")}</p>}
        {response !== null && !hasResults && (
          <p className="text-base font-semibold text-text-secondary">{t("noResultsLabel", { query: trimmedQuery })}</p>
        )}

        <div id={LISTBOX_ID} role="listbox" aria-label={t("resultsLabel")} className="flex w-full flex-col gap-stack-xl">
          {groups.map((group) => {
            const start = offset;
            offset += group.items.length;
            return (
              <section key={group.type} className="flex w-full flex-col gap-stack-sm">
                <h3 className="text-sm font-semibold text-text-secondary">{t(`groups.${group.type}`)}</h3>
                <ul role="presentation" className="flex w-full flex-col gap-stack-md">
                  {group.items.map((result, index) => (
                    <li key={`${result.type}:${result.id}`} role="presentation">
                      <ResultRow
                        id={optionId(start + index)}
                        result={result}
                        active={start + index === active}
                        untitled={t("untitled")}
                        date={result.date ? dateLabel(result.date) : undefined}
                        onActivate={() => setActive(start + index)}
                        onOpen={() => handleOpen(result.href)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {showHint && (
          <p className="text-sm text-text-secondary">
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenSettings();
              }}
              className="text-left underline underline-offset-2"
            >
              {t("smartOffLabel")}
            </button>
          </p>
        )}
      </div>
    </SidePanel>
  );
}

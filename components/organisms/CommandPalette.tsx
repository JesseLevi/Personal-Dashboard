"use client";

// design: Claude-designed (#686)
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  matchingActions,
  matchingBoards,
  matchingProjects,
  boardPercent,
  pinnedBoards,
  pinnedProjects,
  type PaletteGroup,
  type PaletteRow,
} from "@/lib/command/palette";
import type { CommandAction, CommandBoard, CommandProject } from "@/lib/command/types";
import { NOTES_SEARCH_MIN_QUERY_LENGTH } from "@/lib/notes/search";
import { groupResults, moveActive, SEARCH_PANEL_DEBOUNCE_MS, showSmartSearchHint, type SearchPanelAction } from "@/lib/search/panel";
import type { SearchType } from "@/lib/search/merge";
import type { SearchResponse } from "@/lib/search/query";
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms/Button";
import { Icon, type IconName } from "../atoms/Icon";
import { Kbd } from "../atoms/Kbd";
import { ProgressRing } from "../atoms/ProgressRing";

/**
 * Organism/CommandPalette: the centred ⌘K modal (ADR-0048). Field on top, grouped rows (boards,
 * actions, search results), a key footer. Knows nothing about routing: the composer passes the
 * callbacks. Not a `SidePanel`, but it keeps its conventions. Contract: design/notes/CommandPalette.md.
 */
const MAX_QUERY_LENGTH = 200;
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TYPE_ICON: Record<SearchType, IconName> = {
  note: "Notebook",
  recipe: "ChefHat",
  card: "Columns3",
  calendar_event: "Calendar",
  shopping_list_item: "ShoppingBasket",
};

type View =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "done"; response: SearchResponse };

type BoardsResult = { success: true; data: CommandBoard[] } | { success: false; error: string };
type ProjectsResult = { success: true; data: CommandProject[] } | { success: false; error: string };

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Takes the trimmed query. Pass a stable reference: it is a dependency of the debounce effect. */
  onSearch: SearchPanelAction;
  /** Fired with a result's or board's `href`; the palette closes itself first. */
  onOpen: (href: string) => void;
  /** Fired with the chosen action; the palette closes itself first. */
  onRunAction: (action: CommandAction) => void;
  /** Opens Settings, where the member can switch on smart search. */
  onOpenSettings: () => void;
  /** The member could switch smart search on: shows the footer hint on keyword answers. */
  canEnableSmartSearch: boolean;
  /** Focus the field on open. The composer passes false on a phone, so its keyboard stays down. */
  autoFocusField: boolean;
  actions: readonly CommandAction[];
  /** Called on every open; pass a stable reference. The last loaded list is kept so it does not flash. */
  loadBoards: () => Promise<BoardsResult>;
  /** Like `loadBoards`, for the Projecten group (cards with subtasks, ADR-0053). */
  loadProjects: () => Promise<ProjectsResult>;
  /** Pre-fills the field and searches at once (keeps the Ladle baselines deterministic). */
  initialQuery?: string;
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
}

interface RowProps {
  id: string;
  icon: IconName;
  title: string;
  meta?: string;
  active: boolean;
  trailing?: ReactNode;
  onActivate: () => void;
  onChoose: () => void;
}

// Focus stays in the field; the row only shows the arrow-key position (`aria-activedescendant`).
function PaletteOption({ id, icon, title, meta, active, trailing, onActivate, onChoose }: RowProps) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onPointerMove={active ? undefined : onActivate}
      onClick={onChoose}
      className={cn(
        "flex w-full items-center gap-inline-lg rounded-control-outer border border-transparent p-component-sm text-left",
        active && "border-stroke-primary bg-surface-primary",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-control border border-stroke-primary text-text-secondary",
          active ? "bg-surface-highlight-white" : "bg-surface-primary",
        )}
      >
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold text-text-primary">{title}</span>
        {meta && <span className="truncate text-sm text-text-secondary">{meta}</span>}
      </span>
      {trailing}
      <Kbd aria-hidden="true" className={cn("shrink-0 max-md:hidden", !active && "invisible")}>
        ↵
      </Kbd>
    </button>
  );
}

function FooterHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-inline-sm text-sm text-text-secondary">
      <span className="inline-flex items-center gap-inline-xs">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
      {label}
    </span>
  );
}

export function CommandPalette({
  open,
  onClose,
  onSearch,
  onOpen,
  onRunAction,
  onOpenSettings,
  canEnableSmartSearch,
  autoFocusField,
  actions,
  loadBoards,
  loadProjects,
  initialQuery,
}: CommandPaletteProps) {
  const t = useTranslations("components.commandPalette");
  const format = useFormatter();
  const titleId = useId();
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const [query, setQuery] = useState(initialQuery ?? "");
  const [view, setView] = useState<View>({ status: "idle" });
  const [boards, setBoards] = useState<CommandBoard[] | null>(null);
  const [projects, setProjects] = useState<CommandProject[] | null>(null);
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // A pre-filled query searches at once: there is no typing to wait out.
  const searchNow = useRef(initialQuery !== undefined);

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= NOTES_SEARCH_MIN_QUERY_LENGTH;
  const response = view.status === "done" ? view.response : null;

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

  // Boards load on every open; the previous list stays visible meanwhile, a failure drops it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadBoards()
      .then((result) => {
        if (!cancelled) setBoards(result.success ? result.data : null);
      })
      .catch(() => {
        if (!cancelled) setBoards(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadBoards]);

  // Projects load on every open, like boards.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadProjects()
      .then((result) => {
        if (!cancelled) setProjects(result.success ? result.data : null);
      })
      .catch(() => {
        if (!cancelled) setProjects(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadProjects]);

  // Focus returns to the trigger on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    } else {
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  // Focus moves in on open: the field, or the dialog itself on a phone. It retries for a few frames,
  // because the `visibility` transition starts hidden and a hidden element cannot take focus.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let tries = 0;
    const focusTarget = () => {
      const target = autoFocusField ? inputRef.current : dialogRef.current;
      target?.focus();
      if (target && document.activeElement !== target && ++tries < 10) frame = requestAnimationFrame(focusTarget);
    };
    frame = requestAnimationFrame(focusTarget);
    return () => cancelAnimationFrame(frame);
  }, [open, autoFocusField]);

  const groups = useMemo<PaletteGroup[]>(() => {
    const actionRow = (action: CommandAction): PaletteRow => ({ kind: "action", key: `action:${action.id}`, action });
    const boardRow = (board: CommandBoard): PaletteRow => ({ kind: "board", key: `board:${board.id}`, board });
    const projectRow = (project: CommandProject): PaletteRow => ({ kind: "project", key: `project:${project.id}`, project });
    const result: PaletteGroup[] = [];
    const add = (key: string, rows: PaletteRow[]) => {
      if (rows.length > 0) result.push({ key, label: t(`groups.${key}`), rows });
    };

    // Empty field: one `add` per group, in display order.
    if (trimmedQuery === "") {
      add("projects", pinnedProjects(projects ?? []).map(projectRow));
      add("boards", pinnedBoards(boards ?? []).map(boardRow));
      add("quickActions", actions.filter((action) => action.pinned).map(actionRow));
      return result;
    }
    const labelOf = (action: CommandAction) => t(`actions.${action.id}.label`);
    add("actions", matchingActions(actions, labelOf, trimmedQuery).map(actionRow));
    const matchedProjects = matchingProjects(projects ?? [], trimmedQuery);
    add("projects", matchedProjects.map(projectRow));
    add("boards", matchingBoards(boards ?? [], trimmedQuery).map(boardRow));
    // A card hit that is already a project row is shown once.
    const projectIds = new Set(matchedProjects.map((project) => project.id));
    const hits = (response?.results ?? []).filter((item) => !(item.type === "card" && projectIds.has(item.id)));
    for (const group of groupResults(hits)) {
      add(
        group.type,
        group.items.map((item) => ({ kind: "result", key: `result:${item.type}:${item.id}`, result: item })),
      );
    }
    return result;
  }, [trimmedQuery, boards, projects, actions, response, t]);

  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const rowsKey = rows.map((row) => row.key).join("|");

  // The first row is highlighted on every content change, so Enter right after typing opens the best hit.
  const [seenRowsKey, setSeenRowsKey] = useState(rowsKey);
  if (seenRowsKey !== rowsKey) {
    setSeenRowsKey(rowsKey);
    setActive(0);
  }

  useEffect(() => {
    if (!open) return;
    if (active === 0) listRef.current?.scrollTo({ top: 0 });
    else document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `optionId` only derives from `listboxId`
  }, [open, active, rowsKey]);

  function handleClose() {
    setQuery("");
    setView({ status: "idle" });
    setActive(0);
    onClose();
  }

  function choose(row: PaletteRow) {
    handleClose();
    if (row.kind === "action") onRunAction(row.action);
    else if (row.kind === "board") onOpen(row.board.href);
    else if (row.kind === "project") onOpen(row.project.href);
    else onOpen(row.result.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleClose();
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      const row = rows[active];
      if (!row) return;
      event.preventDefault();
      choose(row);
      return;
    }
    const next = moveActive(active, event.key, rows.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  function describe(row: PaletteRow): { icon: IconName; title: string; meta?: string; trailing?: ReactNode } {
    if (row.kind === "action") {
      const { action } = row;
      return { icon: action.icon, title: t(`actions.${action.id}.label`), meta: t(`actions.${action.id}.meta`) };
    }
    if (row.kind === "board" || row.kind === "project") {
      const item = row.kind === "board" ? row.board : row.project;
      const percent = boardPercent(item);
      const meta =
        row.kind === "board"
          ? t(row.board.isFavorite ? "boardMetaFavorite" : "boardMeta", { total: item.total, done: item.done })
          : t("projectMeta", { total: item.total, done: item.done, boardName: row.project.boardName });
      return {
        icon: row.kind === "board" ? "Columns3" : "ListTodo",
        title: row.kind === "board" ? row.board.name : row.project.title,
        meta,
        trailing: percent !== null && (
          <span className="flex shrink-0 items-center gap-inline-sm">
            <ProgressRing value={percent} tone={percent === 100 ? "green" : "blue"} label={t("progressLabel", { percent })} />
            <span aria-hidden="true" className="w-10 text-right text-sm tabular-nums text-text-secondary">
              {percent}%
            </span>
          </span>
        ),
      };
    }
    const { result } = row;
    const date = result.date
      ? format.dateTime(new Date(`${result.date}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" })
      : null;
    const snippet = result.snippet?.replace(/\s+/g, " ").trim();
    return {
      icon: TYPE_ICON[result.type],
      title: result.title.trim() || t("untitled"),
      meta: [date, snippet].filter(Boolean).join(" · ") || undefined,
    };
  }

  // A state line only shows when nothing matched locally or in the search.
  let stateLine: string | null = null;
  if (rows.length === 0) {
    if (!searchable) stateLine = t("promptLabel");
    else if (view.status === "loading") stateLine = t("searchingLabel");
    else if (view.status === "failed") stateLine = t("unavailableLabel");
    else if (response !== null) stateLine = t("noResultsLabel", { query: trimmedQuery });
  }

  const showHint = response !== null && showSmartSearchHint(response.mode, canEnableSmartSearch);
  let offset = 0;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={cn(
          "fixed inset-0 z-40 bg-overlay/40 transition-[opacity,visibility] transition-discrete duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          open ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
        )}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto w-full origin-top outline-none transition-[opacity,translate,scale,visibility] transition-discrete duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          // spacing-flag: 640 px width and 12vh offset have no sizing token; safe-area `max()` only adds space — design/notes/CommandPalette.md
          "max-md:p-component-lg max-md:pt-[max(1rem,env(safe-area-inset-top))] md:top-[12vh] md:w-[640px]",
          open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-95 opacity-0",
        )}
      >
        <h2 id={titleId} className="sr-only">
          {t("title")}
        </h2>
        <div className="pointer-events-auto relative isolate">
          <div aria-hidden="true" className="absolute inset-x-component-lg -top-component-sm bottom-0 -z-10 rounded-container bg-surface-secondary" />
          <div className="rounded-container border border-stroke-primary bg-surface-primary p-component-sm">
            <div className="flex flex-col overflow-hidden rounded-card border border-stroke-primary bg-surface-highlight-white">
              <div className="border-b border-stroke-lines p-component-sm">
                <div className="flex items-center gap-inline-md rounded-control-outer bg-surface-primary px-component-md">
                  <Icon name="Search" className="shrink-0 text-text-secondary" />
                  <input
                    ref={inputRef}
                    role="combobox"
                    aria-label={t("searchLabel")}
                    aria-expanded={rows.length > 0}
                    aria-controls={listboxId}
                    aria-activedescendant={rows.length > 0 ? optionId(active) : undefined}
                    aria-autocomplete="list"
                    placeholder={t("placeholder")}
                    value={query}
                    maxLength={MAX_QUERY_LENGTH}
                    autoComplete="off"
                    enterKeyHint="search"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    className="h-12 min-w-0 flex-1 bg-transparent text-base font-semibold text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
                  />
                  <Kbd className="shrink-0 max-md:hidden">esc</Kbd>
                  <Button variant="transparent" size="compact" icon="X" aria-label={t("closeLabel")} onClick={handleClose} className="md:hidden" />
                </div>
              </div>

              {/* spacing-flag: list height cap min(60vh, 560px) has no sizing token — design/notes/CommandPalette.md */}
              <div ref={listRef} className="max-h-[min(60vh,560px)] overflow-y-auto p-component-sm">
                <div aria-live="polite" className="flex w-full flex-col gap-stack-lg">
                  {stateLine && <p className="px-component-sm py-component-sm text-base font-semibold text-text-secondary">{stateLine}</p>}
                  <div id={listboxId} role="listbox" aria-label={t("resultsLabel")} className="flex w-full flex-col gap-stack-lg">
                    {groups.map((group) => {
                      const start = offset;
                      offset += group.rows.length;
                      const headingId = `${listboxId}-${group.key}`;
                      return (
                        <section key={group.key} role="group" aria-labelledby={headingId} className="flex w-full flex-col gap-stack-xs">
                          <div className="flex items-baseline justify-between px-component-sm">
                            <h3 id={headingId} className="text-sm font-semibold text-text-secondary">
                              {group.label}
                            </h3>
                            <span aria-hidden="true" className="text-sm text-text-placeholder">
                              {group.rows.length}
                            </span>
                          </div>
                          <ul role="presentation" className="flex w-full flex-col gap-stack-xs">
                            {group.rows.map((row, index) => (
                              <li key={row.key} role="presentation">
                                <PaletteOption
                                  id={optionId(start + index)}
                                  {...describe(row)}
                                  active={start + index === active}
                                  onActivate={() => setActive(start + index)}
                                  onChoose={() => choose(row)}
                                />
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-center gap-inline-lg border-t border-stroke-lines bg-surface-primary px-component-md py-component-sm",
                  !showHint && "max-md:hidden",
                )}
              >
                <div className="flex items-center gap-inline-lg max-md:hidden">
                  <FooterHint keys={["↑", "↓"]} label={t("hintMove")} />
                  <FooterHint keys={["↵"]} label={t("hintOpen")} />
                  <FooterHint keys={["esc"]} label={t("hintClose")} />
                </div>
                {showHint && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenSettings();
                    }}
                    className="min-w-0 truncate text-left text-sm text-text-secondary underline underline-offset-2 md:ml-auto"
                  >
                    {t("smartOffLabel")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

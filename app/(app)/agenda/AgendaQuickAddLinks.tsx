// design: Claude-designed (#745)
"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import {
  LINK_SEARCH_MAX,
  LINK_SEARCH_MIN,
  QUICK_ADD_LINK_KINDS,
  type AgendaLinkCandidate,
} from "@/lib/agenda/links";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { LINK_KIND_ICON } from "./AgendaEventLinks";
import { linkKey } from "./AgendaLinkSearchPanel";

// The "Koppelen" section of quick add (ADR-0037 s4, ADR-0041): picked recipes and cards as chips, and an
// inline search over recipes and cards. The links are made after the event exists; see design/notes/AgendaPage.md.
const SEARCH_DEBOUNCE_MS = 250;
const SHOWN_PER_KIND = 3;

export interface QuickAddLinksProps {
  picked: AgendaLinkCandidate[];
  onChange: (picked: AgendaLinkCandidate[]) => void;
  /** Takes `{ query, kinds }`. Pass a stable reference: it is a dependency of the debounce effect. */
  onSearch: (input: unknown) => Promise<AgendaActionResult<AgendaLinkCandidate[]>>;
  disabled: boolean;
  id: string;
  /** Pre-fills the field (also keeps the Ladle baselines deterministic). */
  initialQuery?: string;
}

export function QuickAddLinks({ picked, onChange, onSearch, disabled, id, initialQuery }: QuickAddLinksProps) {
  const t = useTranslations("components.agendaQuickAdd");
  const tErrors = useTranslations("agenda.errors");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<AgendaLinkCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const searchable = trimmed.length >= LINK_SEARCH_MIN;
  const pickedKeys = new Set(picked.map((item) => linkKey(item.kind, item.id)));

  // Debounced search-as-you-type; `cancelled` drops a response that a newer keystroke has outdated.
  useEffect(() => {
    if (!searchable) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      onSearch({ query: trimmed, kinds: QUICK_ADD_LINK_KINDS })
        .then((result) => {
          if (cancelled) return;
          setResults(result.success ? result.data : null);
          setError(result.success ? null : tErrors(result.error));
        })
        .catch(() => {
          if (cancelled) return;
          setResults(null);
          setError(tErrors("generic"));
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // `tErrors` excluded: next-intl's translator identity is unstable and would restart the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchable, trimmed, onSearch]);

  const groups = QUICK_ADD_LINK_KINDS.map((kind) => ({
    kind,
    items: (results?.filter((candidate) => candidate.kind === kind) ?? []).slice(0, SHOWN_PER_KIND),
  })).filter((group) => group.items.length > 0);

  function pick(candidate: AgendaLinkCandidate) {
    if (pickedKeys.has(linkKey(candidate.kind, candidate.id))) return;
    onChange([...picked, candidate]);
    setQuery("");
    setResults(null);
  }

  // Enter picks the first result and never submits the form behind it.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = groups.flatMap((group) => group.items).find((item) => !pickedKeys.has(linkKey(item.kind, item.id)));
    if (first && !isSearching) pick(first);
  }

  const titleOf = (candidate: AgendaLinkCandidate) => candidate.title.trim() || t("linkUntitled");

  return (
    <div id={id} className="flex flex-col gap-stack-sm">
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-inline-sm">
          {picked.map((item) => (
            <li key={linkKey(item.kind, item.id)} className="flex min-w-0 max-w-full">
              <Button
                variant="outline"
                size="small"
                icon={LINK_KIND_ICON[item.kind]}
                trailingIcon="X"
                aria-label={t("linkRemoveLabel", { title: titleOf(item) })}
                className="min-w-0 max-w-full"
                disabled={disabled}
                onClick={() => onChange(picked.filter((candidate) => candidate !== item))}
              >
                <span className="truncate">{titleOf(item)}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <InputField
        aria-label={t("linkSearchLabel")}
        placeholder={t("linkSearchPlaceholder")}
        leadingIcon="Search"
        value={query}
        maxLength={LINK_SEARCH_MAX}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {isSearching && <p className="text-sm font-semibold text-text-secondary">{t("linkSearching")}</p>}
      {error && !isSearching && (
        <p role="alert" className="text-sm font-semibold text-priority-urgent">
          {error}
        </p>
      )}
      {results !== null && !isSearching && results.length === 0 && (
        <p className="text-sm font-semibold text-text-secondary">{t("linkNoResults", { query: trimmed })}</p>
      )}
      {!isSearching && groups.length > 0 && (
        <ul className="flex flex-col">
          {groups.flatMap((group) =>
            group.items.map((candidate) => {
              const chosen = pickedKeys.has(linkKey(candidate.kind, candidate.id));
              return (
                <li key={linkKey(candidate.kind, candidate.id)} className="flex">
                  <Button
                    variant="transparent"
                    size="small"
                    icon={chosen ? "Check" : LINK_KIND_ICON[candidate.kind]}
                    align="left"
                    className="w-full min-w-0 justify-start"
                    disabled={disabled || chosen}
                    onClick={() => pick(candidate)}
                  >
                    <span className="sr-only">{t(`linkKinds.${candidate.kind}`)}: </span>
                    <span className="truncate">{titleOf(candidate)}</span>
                  </Button>
                </li>
              );
            }),
          )}
        </ul>
      )}
      {picked.length > 0 && <p className="text-sm font-semibold text-text-secondary">{t("linkPendingHint")}</p>}
    </div>
  );
}

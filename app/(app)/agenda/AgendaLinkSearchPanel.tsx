"use client";

// design: Claude-designed (#489)
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { Card } from "@/components/molecules/Card";
import { SidePanel } from "@/components/organisms/SidePanel";
import {
  AGENDA_LINK_KINDS,
  LINK_SEARCH_MAX,
  LINK_SEARCH_MIN,
  type AgendaLinkCandidate,
} from "@/lib/agenda/links";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { LINK_KIND_ICON } from "./AgendaEventLinks";

/**
 * Level-2 search over recipes, cards and notes together, grouped by kind.
 * Tapping a result links it at once and closes the panel. Same pattern as
 * MemberSearchPanel; see design/notes/AgendaEventLinks.md.
 */
const SEARCH_DEBOUNCE_MS = 250;

export const linkKey = (kind: string, id: string) => `${kind}:${id}`;

export interface AgendaLinkSearchPanelProps {
  open: boolean;
  onClose: () => void;
  /** Takes `{ query }`. Pass a stable reference: it is a dependency of the debounce effect. */
  onSearch: (input: unknown) => Promise<AgendaActionResult<AgendaLinkCandidate[]>>;
  /** Links the pick. Resolves to the action result; on success the panel closes. */
  onSelect: (candidate: AgendaLinkCandidate) => Promise<AgendaActionResult<unknown>>;
  /** `linkKey(kind, id)` of everything already linked to the event. */
  linkedKeys: ReadonlySet<string>;
  /** Pre-fills the field on open (also keeps the Ladle baselines deterministic). */
  initialQuery?: string;
}

export function AgendaLinkSearchPanel({
  open,
  onClose,
  onSearch,
  onSelect,
  linkedKeys,
  initialQuery,
}: AgendaLinkSearchPanelProps) {
  const t = useTranslations("components.agendaLinkSearchPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("agenda.errors");

  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<AgendaLinkCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= LINK_SEARCH_MIN;

  // Debounced search-as-you-type; `cancelled` drops a response that a newer keystroke has outdated.
  useEffect(() => {
    if (!open || !searchable) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      onSearch({ query: trimmedQuery })
        .then((result) => {
          if (cancelled) return;
          if (result.success) {
            setResults(result.data);
            setError(null);
          } else {
            setResults(null);
            setError(tErrors(result.error));
          }
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
  }, [open, searchable, trimmedQuery, onSearch]);

  function handleClose() {
    setQuery("");
    setResults(null);
    setError(null);
    onClose();
  }

  async function handlePick(candidate: AgendaLinkCandidate) {
    setIsLinking(true);
    setError(null);
    try {
      const result = await onSelect(candidate);
      if (result.success) handleClose();
      else setError(tErrors(result.error));
    } catch {
      setError(tErrors("generic"));
    } finally {
      setIsLinking(false);
    }
  }

  const showPrompt = !searchable && !isSearching;
  const groups = AGENDA_LINK_KINDS.map((kind) => ({
    kind,
    items: results?.filter((candidate) => candidate.kind === kind) ?? [],
  })).filter((group) => group.items.length > 0);

  return (
    <SidePanel
      open={open}
      onClose={handleClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      level={2}
      footer={
        <Button variant="filled" icon="ArrowLeft" className="w-full" onClick={handleClose}>
          {t("cancelLabel")}
        </Button>
      }
    >
      <InputField
        id="agenda-link-query"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        trailingIcon="Search"
        value={query}
        maxLength={LINK_SEARCH_MAX}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />

      {showPrompt && <p className="text-base font-semibold text-text-secondary">{t("searchPromptLabel")}</p>}
      {isSearching && <p className="text-base font-semibold text-text-secondary">{t("searchingLabel")}</p>}
      {error && !isSearching && (
        <p role="alert" className="text-base font-semibold text-priority-urgent">
          {error}
        </p>
      )}
      {results !== null && !isSearching && results.length === 0 && (
        <p className="text-base font-semibold text-text-secondary">{t("noResultsLabel", { query: trimmedQuery })}</p>
      )}

      {!isSearching &&
        groups.map((group) => (
          <section key={group.kind} className="flex w-full flex-col gap-stack-sm">
            <h3 className="text-sm font-semibold text-text-secondary">{t(`groups.${group.kind}`)}</h3>
            <ul className="flex w-full flex-col gap-stack-md">
              {group.items.map((candidate) => {
                const linked = linkedKeys.has(linkKey(candidate.kind, candidate.id));
                return (
                  <li key={candidate.id}>
                    <Card>
                      <button
                        type="button"
                        disabled={linked || isLinking}
                        onClick={() => void handlePick(candidate)}
                        className="flex w-full items-center gap-inline-lg text-left disabled:opacity-60"
                      >
                        <Icon name={LINK_KIND_ICON[candidate.kind]} className="shrink-0 text-text-secondary" />
                        <span className="min-w-0 flex-1 break-words text-base font-semibold text-text-primary">
                          {candidate.title.trim() || t("untitled")}
                        </span>
                        {linked && (
                          <span className="flex shrink-0 items-center gap-inline-xs text-sm font-semibold text-text-secondary">
                            <Icon name="Check" size={16} />
                            {t("linkedLabel")}
                          </span>
                        )}
                      </button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </SidePanel>
  );
}

"use client";

// figma: node-id=4231:16811
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "./SidePanel";
import { InputField } from "../atoms/InputField";
import { Avatar } from "../atoms/Avatar";
import { Button } from "../atoms/Button";
import { Card } from "../molecules/Card";
import { memberAvatarSrc, memberFullName } from "@/lib/sharing/member";
import type { ActionResult, MemberSearchResult } from "@/lib/sharing/types";

/**
 * Organism/MemberSearchPanel — Figma "Winkelmand/04..06" level-2 panel
 * (4231:16811 empty, 4231:17096 result, 4233:17340 selected). Pick one
 * person by name (or full e-mail address, which the RPC then also returns).
 * Knows nothing about baskets: the caller decides what "Voeg toe" means.
 * `SidePanel level={2}` supplies the chrome. Never imports "use server"
 * code (`onSearch` is a prop), so it stays Ladle-testable.
 * See design/notes/MemberSearchPanel.md.
 */

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 64;

export interface MemberSearchPanelProps {
  open: boolean;
  onClose: () => void;
  /** Takes `{ query }` (trimmed, 2 to 64 characters) and returns the matching members. Pass a stable reference: it is a dependency of the debounce effect. */
  onSearch: (input: unknown) => Promise<ActionResult<MemberSearchResult[]>>;
  /** Fired once on "Voeg toe" with the picked person, before `onClose`. Never fired on cancel. */
  onSelect: (member: MemberSearchResult) => void;
  /** The person already chosen by the caller: shown as selected as soon as they appear in the results. */
  selectedId?: string | null;
  /** Pre-fills the search field on open (a caller reopening with a query in hand; also makes the Ladle baselines deterministic). */
  initialQuery?: string;
}

export function MemberSearchPanel({
  open,
  onClose,
  onSearch,
  onSelect,
  selectedId = null,
  initialQuery,
}: MemberSearchPanelProps) {
  const t = useTranslations("components.memberSearchPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("sharing.errors");

  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<MemberSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<MemberSearchResult | null>(null);

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= MIN_QUERY_LENGTH;

  // Debounced search-as-you-type. `cancelled` drops a response that lands
  // after a newer keystroke already started a newer request. Failures
  // (including the rate limit) surface as their own message, never as an
  // empty result list.
  useEffect(() => {
    if (!open || !searchable) {
      setResults(null);
      setSearchError(null);
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
            setSearchError(null);
          } else {
            setResults(null);
            setSearchError(tErrors(result.error));
          }
        })
        .catch(() => {
          if (cancelled) return;
          setResults(null);
          setSearchError(tErrors("generic"));
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // `tErrors` deliberately excluded: next-intl's translator identity is
    // unstable across renders and would restart the debounce every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchable, trimmedQuery, onSearch]);

  // The caller's current pick counts as selected once it shows up in a result set.
  const pickedResult = picked ?? results?.find((result) => result.id === selectedId) ?? null;

  function handleClose() {
    setQuery("");
    setResults(null);
    setSearchError(null);
    setPicked(null);
    onClose();
  }

  function handleAdd() {
    if (!pickedResult) return;
    onSelect(pickedResult);
    handleClose();
  }

  const showPrompt = !searchable && !isSearching;

  return (
    <SidePanel
      open={open}
      onClose={handleClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      level={2}
      footer={
        <div className="flex gap-inline-sm">
          <Button variant="filled" icon="ArrowLeft" className="grow basis-0" onClick={handleClose}>
            {t("cancelLabel")}
          </Button>
          <Button
            variant="filled"
            icon="Plus"
            className="grow basis-0"
            onClick={handleAdd}
            disabled={!pickedResult}
          >
            {t("addLabel")}
          </Button>
        </div>
      }
    >
      <InputField
        id="member-search-query"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        trailingIcon="Search"
        value={query}
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />

      {showPrompt && <p className="text-base font-semibold text-text-secondary">{t("searchPromptLabel")}</p>}
      {isSearching && <p className="text-base font-semibold text-text-secondary">{t("searchingLabel")}</p>}
      {searchError && !isSearching && (
        <p role="alert" className="text-base font-semibold text-priority-urgent">
          {searchError}
        </p>
      )}

      {results !== null && !isSearching && results.length === 0 && (
        <p className="text-base font-semibold text-text-secondary">
          {t("noResultsLabel", { query: trimmedQuery })}
        </p>
      )}

      {results !== null && !isSearching && results.length > 0 && (
        <ul className="flex w-full flex-col gap-stack-md">
          {results.map((result) => {
            const selected = pickedResult?.id === result.id;
            const name = memberFullName(result, t("unnamedLabel"));
            return (
              <li key={result.id}>
                {/* Selected = the 1px `Stroke/primary 2` border of 4233:17340. That Figma
                    variable is not mirrored (open-questions.md#figma-stroke-primary-2-malformed-name);
                    its value is exactly `text-primary`, so that token is used. */}
                <Card contentClassName={selected ? "border-text-primary" : undefined}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPicked(result)}
                    className="flex w-full items-center gap-inline-lg text-left"
                  >
                    <Avatar name={name} src={memberAvatarSrc(result)} />
                    <span className="flex min-w-0 flex-1 flex-col gap-stack-sm">
                      <span className="break-words text-base font-semibold text-text-primary">{name}</span>
                      {result.email && (
                        <span className="break-all text-sm font-semibold text-text-secondary">{result.email}</span>
                      )}
                    </span>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </SidePanel>
  );
}

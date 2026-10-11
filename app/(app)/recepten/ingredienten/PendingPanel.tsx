"use client";

// design: Claude-designed on request (#326), design/notes/IngredientAdminPage.md.
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { resultDisplayName } from "@/components/organisms/IngredientSearchPanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { PanelSection, PanelTitle } from "./PanelSection";
import { UNITS } from "@/lib/recipes/units";
import type { PendingGroup } from "@/lib/recipes/ingredient-admin";
import type { ActionResult, IngredientSearchResult } from "@/lib/recipes/types";

const SEARCH_DEBOUNCE_MS = 300;
const WEIGHABLE_UNITS = UNITS.filter((unit) => unit.magnitude !== "mass").map((unit) => unit.code);

export interface PendingPanelProps {
  open: boolean;
  onClose: () => void;
  /** The group being linked; the panel keeps showing the last one while it closes. */
  group: PendingGroup | null;
  /** `searchIngredients` server action; only shared (`reference`) rows are offered. */
  onSearch: (input: unknown) => Promise<IngredientSearchResult[]>;
  onLink: (input: unknown) => Promise<ActionResult<unknown>>;
}

interface Picked {
  id: string;
  name: string;
}

export function PendingPanel({ open, onClose, group, onSearch, onLink }: PendingPanelProps) {
  const t = useTranslations("recipes.ingredientAdmin.pendingPanel");
  const tAlias = useTranslations("recipes.ingredientAdmin.aliasPanel");
  const tUnits = useTranslations("recipes.units");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");
  const locale = useLocale();

  const [picked, setPicked] = useState<Picked | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [unit, setUnit] = useState("");
  const [grams, setGrams] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open, same technique as AliasPanel.
  const groupKey = group?.key ?? "";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevGroupKey, setPrevGroupKey] = useState(groupKey);
  if (prevOpen !== open || prevGroupKey !== groupKey) {
    const shouldReset = open && (!prevOpen || groupKey !== prevGroupKey);
    setPrevOpen(open);
    setPrevGroupKey(groupKey);
    if (shouldReset) {
      setPicked(null);
      setQuery("");
      setResults(null);
      setSearchError(false);
      setUnit("");
      setGrams("");
      setError(null);
    }
  }

  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery === "") {
      setResults(null);
      setSearchError(false);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      onSearch({ query: trimmedQuery })
        .then((data) => {
          if (cancelled) return;
          setResults(data.filter((result) => result.source === "reference"));
          setSearchError(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResults(null);
          setSearchError(true);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery, onSearch]);

  const hasUnit = unit !== "";
  const canSave = !isPending && group !== null && picked !== null && (!hasUnit || grams.trim() !== "");

  function handleSave() {
    if (!group || !picked) return;
    setError(null);
    startTransition(async () => {
      const result = await onLink({
        name: group.name,
        ingredientId: picked.id,
        unitMass: hasUnit ? { unit, grams } : null,
      });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onClose();
    });
  }

  const title = t("title", { name: group?.name ?? "" });

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        <Button variant="filled" icon="Link" className="w-full" onClick={handleSave} disabled={!canSave}>
          {isPending ? t("linkingLabel") : t("linkLabel")}
        </Button>
      }
    >
      <PanelTitle>{title}</PanelTitle>
      {group && <p className="text-base text-text-secondary">{t("lines", { count: group.count })}</p>}

      <PanelSection heading={tAlias("searchHeading")}>
        <InputField
          label={tAlias("searchLabel")}
          id="pending-panel-search"
          placeholder={tAlias("searchPlaceholder")}
          trailingIcon="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {picked && (
          <p className="text-base font-semibold text-text-highlight-green">
            {tAlias("selectedLabel", { name: picked.name })}
          </p>
        )}
        {results === null && !isSearching && !searchError && !picked && (
          <p className="text-base font-semibold text-text-secondary">{t("searchPrompt")}</p>
        )}
        {isSearching && <p className="text-base font-semibold text-text-secondary">{tAlias("searching")}</p>}
        {searchError && <p className="text-base font-semibold text-priority-urgent">{tAlias("searchError")}</p>}
        {results !== null && !isSearching && results.length === 0 && (
          <p className="text-base font-semibold text-text-secondary">{tAlias("noResults", { query: trimmedQuery })}</p>
        )}
        {results !== null && !isSearching && results.length > 0 && (
          <Card>
            {results.map((result, index) => (
              <CardContentIngredient
                key={result.ingredient.id}
                name={resultDisplayName(result, locale)}
                checked={picked?.id === result.ingredient.id}
                onCheckedToggle={() =>
                  setPicked(
                    picked?.id === result.ingredient.id
                      ? null
                      : { id: result.ingredient.id, name: resultDisplayName(result, locale) },
                  )
                }
                divider={index < results.length - 1}
              />
            ))}
          </Card>
        )}
      </PanelSection>

      <PanelSection heading={t("weightHeading")} hint={t("weightHint")}>
        <div className="grid grid-cols-2 gap-x-inline-sm">
          <InputField
            label={t("unitLabel")}
            id="pending-unit"
            trailingIcon="ChevronDown"
            value={unit}
            onChange={(event: { target: { value: string } }) => setUnit(event.target.value)}
            options={[
              { value: "", label: t("unitNone") },
              ...WEIGHABLE_UNITS.map((code) => ({ value: code, label: tUnits(code) })),
            ]}
          />
          {hasUnit && (
            <InputField
              label={t("gramsLabel")}
              id="pending-grams"
              inputMode="decimal"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
            />
          )}
        </div>
      </PanelSection>
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}

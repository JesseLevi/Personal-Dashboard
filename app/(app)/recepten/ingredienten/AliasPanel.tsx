"use client";

// design: Claude-designed on request (#325, #350), design/notes/IngredientAdminPage.md.
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { resultDisplayName } from "@/components/organisms/IngredientSearchPanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { PanelSection, PanelTitle } from "./PanelSection";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { normalizeIngredientName } from "@/lib/recipes/import/normalize-name";
import type { AdminAlias } from "@/lib/recipes/ingredient-admin";
import type { ActionResult, IngredientSearchResult } from "@/lib/recipes/types";

const SEARCH_DEBOUNCE_MS = 300;

export type AliasPanelTarget = { mode: "create" } | { mode: "edit"; alias: AdminAlias };

export interface AliasPanelProps {
  open: boolean;
  onClose: () => void;
  target: AliasPanelTarget;
  /** `searchIngredients` server action; only shared (`reference`) rows are offered as a target. */
  onSearch: (input: unknown) => Promise<IngredientSearchResult[]>;
  onCreateAlias: (input: unknown) => Promise<ActionResult<unknown>>;
  onUpdateAlias: (input: unknown) => Promise<ActionResult>;
  onDeleteAlias: (input: unknown) => Promise<ActionResult>;
  onMutated?: () => void;
}

interface Picked {
  id: string;
  name: string;
}

export function AliasPanel({
  open,
  onClose,
  target,
  onSearch,
  onCreateAlias,
  onUpdateAlias,
  onDeleteAlias,
  onMutated,
}: AliasPanelProps) {
  const t = useTranslations("recipes.ingredientAdmin.aliasPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");
  const locale = useLocale();

  const alias = target.mode === "edit" ? target.alias : null;
  const initialPicked = (): Picked | null =>
    alias
      ? {
          id: alias.ingredient.id,
          name: locale === "en" && alias.ingredient.nameEn ? alias.ingredient.nameEn : alias.ingredient.nameNl,
        }
      : null;

  const [name, setName] = useState(alias?.aliasNormalized ?? "");
  const [picked, setPicked] = useState<Picked | null>(initialPicked);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const { confirming, ask, cancel } = useDeleteConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset-on-open (CategoryPanel's technique): a keyed remount would drop SidePanel's closed frame.
  const targetKey = alias ? `edit-${alias.id}` : "create";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setName(alias?.aliasNormalized ?? "");
      setPicked(initialPicked());
      setQuery("");
      setResults(null);
      setSearchError(false);
      cancel();
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

  const key = normalizeIngredientName(name.trim());
  const canSave = !isPending && key !== "" && picked !== null;

  function handleSave() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const result = alias
        ? await onUpdateAlias({ aliasId: alias.id, name: name.trim(), ingredientId: picked.id })
        : await onCreateAlias({ name: name.trim(), ingredientId: picked.id });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!alias) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteAlias({ aliasId: alias.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancel();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  const footer =
    alias && confirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancel}
        onConfirm={handleDelete}
        labels={{
          prompt: t("deleteConfirmLabel"),
          cancel: t("cancelLabel"),
          confirm: t("deleteConfirmButtonLabel"),
          deleting: t("deletingLabel"),
        }}
      />
    ) : (
      <div className="flex gap-inline-sm">
        {alias && (
          <Button variant="destructive" icon="Trash" onClick={ask} disabled={isPending}>
            {t("deleteLabel")}
          </Button>
        )}
        <Button variant="filled" icon="Save" className="grow basis-0" onClick={handleSave} disabled={!canSave}>
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={alias ? t("editTitle") : t("addTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <PanelTitle>{alias ? t("editTitle") : t("addTitle")}</PanelTitle>

      <PanelSection heading={t("nameHeading")}>
        <div className="flex w-full flex-col gap-stack-sm">
          <InputField
            label={t("nameLabel")}
            id="alias-panel-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          {key !== "" && <p className="text-base text-text-secondary">{t("keyPreview", { key })}</p>}
        </div>
      </PanelSection>

      <PanelSection heading={t("searchHeading")}>
        <InputField
          label={t("searchLabel")}
          id="alias-panel-search"
          placeholder={t("searchPlaceholder")}
          trailingIcon="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {picked && (
          <p className="text-base font-semibold text-text-highlight-green">
            {t("selectedLabel", { name: picked.name })}
          </p>
        )}
        {results === null && !isSearching && !searchError && !picked && (
          <p className="text-base font-semibold text-text-secondary">{t("searchPrompt")}</p>
        )}
        {isSearching && <p className="text-base font-semibold text-text-secondary">{t("searching")}</p>}
        {searchError && <p className="text-base font-semibold text-priority-urgent">{t("searchError")}</p>}
        {results !== null && !isSearching && results.length === 0 && (
          <p className="text-base font-semibold text-text-secondary">{t("noResults", { query: trimmedQuery })}</p>
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
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}

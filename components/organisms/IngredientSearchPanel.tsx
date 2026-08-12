"use client";

// figma: node-id=3957:10337
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SidePanel } from "./SidePanel";
import { InputField } from "../atoms/InputField";
import { Checkbox } from "../atoms/Checkbox";
import { Icon } from "../atoms/Icon";
import { Button } from "../atoms/Button";
import { Card } from "../molecules/Card";
import { CardContentIngredient } from "../molecules/CardContentIngredient";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  ReferenceIngredientRow,
} from "@/lib/recipes/types";

/**
 * Organism/IngredientSearchPanel — Figma "Add recipi/ingredientList/Mobile"
 * (3957:10309, panel 3957:10337) + its desktop pair (3957:10595, panel
 * 3957:11006). Named for its function (the Figma layer name has no direct
 * atomic-design translation — see design/notes/IngredientSearchPanel.md).
 * `SidePanel` supplies all chrome (drag handle, close X, both shapes) — this
 * file only supplies `children`/`footer`, same split `CardDetailPanel.tsx`
 * uses. Never imports "use server" code directly (`onSearch`/
 * `onCreateOwnIngredient` are props, ADR-0011 §2) so it stays Ladle-testable
 * with no Next.js request context, and never touches Supabase itself.
 * Deliberate Figma deviation (user decision 2026-07-30): a zero-results
 * "add as new ingredient" affordance the fetched node doesn't draw — full
 * reasoning in design/notes/IngredientSearchPanel.md and the PR body.
 * `level` (#149) forwards straight to `SidePanel` (`RecipePanel` passes `2`).
 */

const SEARCH_DEBOUNCE_MS = 300;

type SelectedEntry =
  | { kind: "own"; key: string; name: string; ingredient: IngredientRow }
  | { kind: "reference"; key: string; name: string; ingredient: ReferenceIngredientRow }
  | { kind: "new"; key: string; name: string };

// Builds the Map entry for a search result, branching explicitly on
// `source` rather than casting — `result.ingredient`'s type is only known
// per-branch (IngredientRow vs. ReferenceIngredientRow).
function selectedEntryFromResult(result: IngredientSearchResult, locale: string): SelectedEntry {
  const key = ingredientSearchResultKey(result);
  const name = resultDisplayName(result, locale);
  return result.source === "own"
    ? { kind: "own", key, name, ingredient: result.ingredient }
    : { kind: "reference", key, name, ingredient: result.ingredient };
}

/** Stable Map key for a search result — shared with callers wiring up `initialSelectedIds`. */
export function ingredientSearchResultKey(result: IngredientSearchResult): string {
  return `${result.source}:${result.ingredient.id}`;
}

function newIngredientKey(name: string): string {
  return `new:${name.trim().toLowerCase()}`;
}

// `own` rows carry the user's own free-text `name` and are never translated
// (ADR-0011 §2/§3, restated ADR-0013 §6). `reference` rows are the shared
// bilingual library layer (ADR-0013 §6): pick `name_en` for locale "en",
// falling back to `name_nl` whenever the English name is absent/empty (NEVO
// doesn't guarantee a non-empty English name for every row) or the locale
// isn't "en". `i18n/request.ts` hardcodes "nl" today (#162 wires
// `profiles.locale`), so this renders Dutch in practice until #162 lands —
// no further change needed here once it does.
export function resultDisplayName(result: IngredientSearchResult, locale: string): string {
  if (result.source === "own") return result.ingredient.name;
  const nameEn = result.ingredient.name_en;
  return locale === "en" && nameEn ? nameEn : result.ingredient.name_nl;
}

export interface IngredientSearchPanelProps {
  open: boolean;
  onClose: () => void;
  /** `"use server"` action, e.g. `app/(app)/recepten/actions.ts`'s `searchIngredients` — a thin wrapper around `searchIngredientLibrary` (ADR-0011 §2). Takes the same `unknown` shape every action in this codebase does. */
  onSearch: (input: unknown) => Promise<IngredientSearchResult[]>;
  /** `"use server"` action `createOwnIngredient` — materialises a library pick or creates a brand-new row (ADR-0011 §2/§5). */
  onCreateOwnIngredient: (input: unknown) => Promise<ActionResult<IngredientRow>>;
  /** Fired after a successful Opslaan with every selected/materialised ingredient row, before `onClose`. Never fired on a plain close/cancel — same contract shape as `CardDetailPanel`'s `onMutated`. */
  onSave: (ingredients: IngredientRow[]) => void;
  /** Pre-fills the search field on open. Real use: a future caller (#126) reopening this panel with text already typed elsewhere; also what makes the "filled results" Ladle story deterministic (design/notes/IngredientSearchPanel.md). */
  initialQuery?: string;
  /** `ingredientSearchResultKey` values to render pre-checked once the initial search resolves — lets a caller reopen the panel with a previous multi-select intact, and is the "checked rows" Ladle story's determinism mechanism. */
  initialSelectedIds?: string[];
  /** Forwarded to `SidePanel` (#149) — `RecipePanel` passes `2` since this panel always opens on top of its own. Defaults to `1` (a standalone caller/story). */
  level?: 1 | 2;
}

export function IngredientSearchPanel({
  open,
  onClose,
  onSearch,
  onCreateOwnIngredient,
  onSave,
  initialQuery,
  initialSelectedIds,
  level = 1,
}: IngredientSearchPanelProps) {
  const t = useTranslations("components.ingredientSearchPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");
  const locale = useLocale();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<IngredientSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Map<string, SelectedEntry>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const appliedInitialSelection = useRef(false);

  const trimmedQuery = query.trim();

  // Debounced search-as-you-type (300ms — a codebase default, no design/
  // product source, see design/notes/IngredientSearchPanel.md). `cancelled`
  // guards against an out-of-order response landing after a later keystroke
  // already started a newer request.
  useEffect(() => {
    if (trimmedQuery === "") {
      setResults(null);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      onSearch({ query: trimmedQuery })
        .then((data) => {
          if (cancelled) return;
          setResults(data);
          setSearchError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setResults(null);
          setSearchError(t("searchErrorLabel"));
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // `t` deliberately excluded: next-intl's translator identity is unstable
    // across renders, and including it here would re-trigger the debounce
    // on every render instead of only on a real query change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, onSearch]);

  // Applies `initialSelectedIds` exactly once, against whichever result set
  // first satisfies it (real usage: the initial search from `initialQuery`).
  useEffect(() => {
    if (appliedInitialSelection.current) return;
    if (!results || !initialSelectedIds || initialSelectedIds.length === 0) return;
    appliedInitialSelection.current = true;
    setSelections((current) => {
      const next = new Map(current);
      for (const result of results) {
        const key = ingredientSearchResultKey(result);
        if (!initialSelectedIds.includes(key) || next.has(key)) continue;
        next.set(key, selectedEntryFromResult(result, locale));
      }
      return next;
    });
  }, [results, initialSelectedIds, locale]);

  function toggleResult(result: IngredientSearchResult) {
    const key = ingredientSearchResultKey(result);
    setSelections((current) => {
      const next = new Map(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, selectedEntryFromResult(result, locale));
      }
      return next;
    });
  }

  function toggleNewIngredient(name: string) {
    const key = newIngredientKey(name);
    setSelections((current) => {
      const next = new Map(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { kind: "new", key, name: name.trim() });
      }
      return next;
    });
  }

  function handleClose() {
    setQuery("");
    setResults(null);
    setSearchError(null);
    setSelections(new Map());
    setSaveError(null);
    appliedInitialSelection.current = false;
    onClose();
  }

  function handleSave() {
    setSaveError(null);
    startSaveTransition(async () => {
      const materialized: IngredientRow[] = [];
      for (const entry of selections.values()) {
        if (entry.kind === "own") {
          materialized.push(entry.ingredient);
          continue;
        }
        const referenceId = entry.kind === "reference" ? entry.ingredient.id : null;
        const result = await onCreateOwnIngredient({ name: entry.name, referenceId });
        if (!result.success) {
          setSaveError(tErrors(result.error));
          return;
        }
        materialized.push(result.data);
      }
      onSave(materialized);
      handleClose();
    });
  }

  const showPrompt = results === null && !isSearching && !searchError;
  const newKey = newIngredientKey(trimmedQuery);

  return (
    <SidePanel
      open={open}
      onClose={handleClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      level={level}
      footer={
        <div className="flex gap-inline-sm">
          <Button
            variant="filled"
            icon="Save"
            className="grow basis-0"
            onClick={handleSave}
            disabled={isSaving || selections.size === 0}
          >
            {isSaving ? t("savingLabel") : t("saveLabel")}
          </Button>
        </div>
      }
    >
      <InputField
        id="ingredient-search-query"
        placeholder={t("searchPlaceholder")}
        trailingIcon="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {showPrompt && <p className="text-base font-semibold text-text-secondary">{t("searchPromptLabel")}</p>}
      {isSearching && <p className="text-base font-semibold text-text-secondary">{t("searchingLabel")}</p>}
      {searchError && <p className="text-base font-semibold text-priority-urgent">{searchError}</p>}

      {results !== null && !isSearching && results.length > 0 && (
        <Card>
          {results.map((result, index) => {
            const key = ingredientSearchResultKey(result);
            return (
              <CardContentIngredient
                key={key}
                name={resultDisplayName(result, locale)}
                checked={selections.has(key)}
                onCheckedToggle={() => toggleResult(result)}
                divider={index < results.length - 1}
              />
            );
          })}
        </Card>
      )}

      {results !== null && !isSearching && results.length === 0 && (
        <Card>
          {/* spacing-flag: `px-3 pb-2` no-results message — no analog on a
              fetched node for this synthetic row. design/notes/IngredientSearchPanel.md. */}
          <p className="px-3 pb-2 text-base font-semibold text-text-secondary">
            {t("noResultsLabel", { query: trimmedQuery })}
          </p>
          {/* Deliberate deviation from Figma (user decision 2026-07-30, see
              the module header + design/notes/IngredientSearchPanel.md):
              this row has no fetched node, so it's built from atoms
              directly rather than reusing CardContentIngredient's Figma-
              sourced structure. Checkbox stays the sole interactive
              control (never the whole row) to avoid nesting it inside
              another button. */}
          {/* #205: no fetched node for this row (see the module header) — gap/
              radius/padding tokens borrowed from CardContentIngredient's own
              measured default row (gap-inline-xl/rounded-container/
              component-md), which this deliberately matches pixel-for-pixel
              for visual consistency with its sibling rows in the same Card
              list, not independently re-measured. See
              design/notes/IngredientSearchPanel.md. */}
          <div className="flex w-full items-center gap-inline-xl rounded-container pl-component-md pr-component-md py-component-md">
            {/* spacing-flag: `gap-2` icon+label row — no fetched node for
                this synthetic row (see the module header). design/notes/IngredientSearchPanel.md. */}
            <div className="flex w-full items-center gap-2">
              <Icon name="Plus" className="text-text-secondary" />
              <p className="text-base font-semibold text-text-primary">
                {t("addNewIngredientLabel", { name: trimmedQuery })}
              </p>
            </div>
            <Checkbox
              checked={selections.has(newKey)}
              aria-label={t("addNewIngredientLabel", { name: trimmedQuery })}
              onClick={() => toggleNewIngredient(trimmedQuery)}
            />
          </div>
        </Card>
      )}

      {saveError && <p className="text-base font-semibold text-priority-urgent">{saveError}</p>}
    </SidePanel>
  );
}

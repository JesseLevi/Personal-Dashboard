"use client";

// design: Claude-designed on request (#325, #350), design/notes/IngredientAdminPage.md.
import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { ButtonToggle } from "@/components/molecules/ButtonToggle";
import type { AdminAlias, AdminEigenIngredient, PendingGroup } from "@/lib/recipes/ingredient-admin";
import type { ActionResult, IngredientSearchResult } from "@/lib/recipes/types";
import { AliasPanel, type AliasPanelTarget } from "./AliasPanel";
import { PendingPanel } from "./PendingPanel";
import { OwnIngredientPanel, type OwnIngredientPanelTarget } from "./OwnIngredientPanel";

type Tab = "aliases" | "own" | "pending";

// The full "Eigen ingrediënten" wraps in ButtonToggle below md; the short
// label is mobile-only (#350). The label is a string, so CSS alone can't swap it.
const DESKTOP_QUERY = "(min-width: 768px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(DESKTOP_QUERY);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

export interface IngredientAdminProps {
  title: string;
  aliases: AdminAlias[];
  eigen: AdminEigenIngredient[];
  pending: PendingGroup[];
  onSearch: (input: unknown) => Promise<IngredientSearchResult[]>;
  onCreateAlias: (input: unknown) => Promise<ActionResult<unknown>>;
  onUpdateAlias: (input: unknown) => Promise<ActionResult>;
  onDeleteAlias: (input: unknown) => Promise<ActionResult>;
  onCreateEigen: (input: unknown) => Promise<ActionResult<unknown>>;
  onUpdateEigen: (input: unknown) => Promise<ActionResult>;
  onDeleteEigen: (input: unknown) => Promise<ActionResult>;
  onLinkPending: (input: unknown) => Promise<ActionResult<unknown>>;
  /** Story hook: first tab shown. */
  initialTab?: Tab;
  /** Story hook: search text on first render. */
  initialQuery?: string;
}

interface RowProps {
  primary: string;
  secondary?: string;
  badge?: string;
  editLabel: string;
  divider: boolean;
  onClick: () => void;
}

function ListRow({ primary, secondary, badge, editLabel, divider, onClick }: RowProps) {
  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        aria-label={editLabel}
        onClick={onClick}
        className="flex w-full items-center justify-between gap-inline-xl rounded-control px-component-md py-component-md text-left transition-colors hover:bg-surface-secondary active:bg-surface-secondary-hover"
      >
        <span className="flex min-w-0 flex-col gap-stack-xs">
          <span className="truncate text-base font-semibold text-text-primary">{primary}</span>
          {secondary && <span className="truncate text-base text-text-secondary">{secondary}</span>}
        </span>
        {badge && <span className="shrink-0 text-sm text-text-secondary">{badge}</span>}
      </button>
      {divider && <div aria-hidden="true" className="h-px w-full bg-stroke-lines" />}
    </div>
  );
}

export function IngredientAdmin({
  title,
  aliases,
  eigen,
  pending,
  onSearch,
  onCreateAlias,
  onUpdateAlias,
  onDeleteAlias,
  onCreateEigen,
  onUpdateEigen,
  onDeleteEigen,
  onLinkPending,
  initialTab = "aliases",
  initialQuery = "",
}: IngredientAdminProps) {
  const t = useTranslations("recipes.ingredientAdmin");
  const tUnits = useTranslations("recipes.units");
  const locale = useLocale();
  const isDesktop = useIsDesktop();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [aliasPanel, setAliasPanel] = useState<{ open: boolean; target: AliasPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });
  const [ownPanel, setOwnPanel] = useState<{ open: boolean; target: OwnIngredientPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  const [pendingPanel, setPendingPanel] = useState<{ open: boolean; group: PendingGroup | null }>({
    open: false,
    group: null,
  });

  const needle = query.trim().toLowerCase();
  const matches = (...values: (string | null)[]) =>
    needle === "" || values.some((value) => value?.toLowerCase().includes(needle));

  const shownAliases = aliases.filter((alias) =>
    matches(alias.aliasNormalized, alias.ingredient.nameNl, alias.ingredient.nameEn),
  );
  const shownEigen = eigen.filter((item) => matches(item.nameNl, item.nameEn, item.categoryNl, item.categoryEn));

  const shownPending = pending.filter((group) => matches(group.key, group.name));

  const localName = (nameNl: string, nameEn: string | null) => (locale === "en" && nameEn ? nameEn : nameNl);
  const isAliases = tab === "aliases";
  const isPending = tab === "pending";
  const shownCount = isAliases ? shownAliases.length : isPending ? shownPending.length : shownEigen.length;
  const totalCount = isAliases ? aliases.length : isPending ? pending.length : eigen.length;
  const section = isAliases ? "aliases" : isPending ? "pending" : "own";

  return (
    <>
      <PageHeader
        title={title}
        actions={
          isPending ? undefined : (
          <Button
            icon="Plus"
            onClick={() =>
              isAliases
                ? setAliasPanel({ open: true, target: { mode: "create" } })
                : setOwnPanel({ open: true, target: { mode: "create" } })
            }
          >
            {isAliases ? t("aliases.addLabel") : t("own.addLabel")}
          </Button>
          )
        }
      />
      <div className="flex w-full flex-col gap-stack-xl pr-page-right-equal pt-stack-md md:max-w-3xl">
        <ButtonToggle
          aria-label={t("tabsLabel")}
          className="w-full"
          defaultValue={initialTab}
          onValueChange={(value) => {
            setTab(value as Tab);
            setQuery("");
          }}
          items={[
            { value: "aliases", icon: "Link", label: isDesktop ? t("tabs.aliases") : t("tabs.aliasesShort") },
            { value: "own", icon: "LeafyGreen", label: isDesktop ? t("tabs.own") : t("tabs.ownShort") },
            { value: "pending", icon: "List", label: isDesktop ? t("tabs.pending") : t("tabs.pendingShort") },
          ]}
        />
        <InputField
          id="ingredient-admin-search"
          aria-label={t(`${section}.searchPlaceholder`)}
          placeholder={t(`${section}.searchPlaceholder`)}
          trailingIcon="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {shownCount === 0 ? (
          <p className="py-stack-xxl text-center text-base text-text-secondary">
            {totalCount === 0 ? t(`${section}.empty`) : t(`${section}.noResults`, { query: query.trim() })}
          </p>
        ) : (
          <div className="flex w-full flex-col gap-stack-sm">
            <p className="text-base text-text-secondary">
              {needle === ""
                ? t(`${section}.count`, { count: totalCount })
                : t("countOf", { shown: shownCount, total: totalCount })}
            </p>
            <div className="flex w-full flex-col">
              {isPending
                ? shownPending.map((group, index) => (
                    <ListRow
                      key={group.key}
                      primary={group.name}
                      secondary={t("pending.lines", { count: group.count })}
                      editLabel={t("pending.rowLinkLabel", { name: group.name })}
                      divider={index < shownPending.length - 1}
                      onClick={() => setPendingPanel({ open: true, group })}
                    />
                  ))
                : isAliases
                ? shownAliases.map((alias, index) => {
                    const target = localName(alias.ingredient.nameNl, alias.ingredient.nameEn);
                    return (
                      <ListRow
                        key={alias.id}
                        primary={alias.aliasNormalized}
                        secondary={`→ ${target}`}
                        badge={alias.ingredient.source === "eigen" ? t("ownBadge") : undefined}
                        editLabel={t("aliases.rowEditLabel", { name: alias.aliasNormalized })}
                        divider={index < shownAliases.length - 1}
                        onClick={() => setAliasPanel({ open: true, target: { mode: "edit", alias } })}
                      />
                    );
                  })
                : shownEigen.map((item, index) => {
                    const name = localName(item.nameNl, item.nameEn);
                    const category = locale === "en" && item.categoryEn ? item.categoryEn : item.categoryNl;
                    const weight = item.unitMass
                      ? t("own.weightSummary", { unit: tUnits(item.unitMass.unit).toLowerCase(), grams: item.unitMass.grams })
                      : null;
                    return (
                      <ListRow
                        key={item.id}
                        primary={name}
                        secondary={[category, weight].filter(Boolean).join(" · ") || undefined}
                        badge={t("ownBadge")}
                        editLabel={t("own.rowEditLabel", { name })}
                        divider={index < shownEigen.length - 1}
                        onClick={() => setOwnPanel({ open: true, target: { mode: "edit", ingredient: item } })}
                      />
                    );
                  })}
            </div>
          </div>
        )}
      </div>

      <AliasPanel
        open={aliasPanel.open}
        onClose={() => setAliasPanel((current) => ({ ...current, open: false }))}
        target={aliasPanel.target}
        onSearch={onSearch}
        onCreateAlias={onCreateAlias}
        onUpdateAlias={onUpdateAlias}
        onDeleteAlias={onDeleteAlias}
      />
      <PendingPanel
        open={pendingPanel.open}
        onClose={() => setPendingPanel((current) => ({ ...current, open: false }))}
        group={pendingPanel.group}
        onSearch={onSearch}
        onLink={onLinkPending}
      />
      <OwnIngredientPanel
        open={ownPanel.open}
        onClose={() => setOwnPanel((current) => ({ ...current, open: false }))}
        target={ownPanel.target}
        onCreate={onCreateEigen}
        onUpdate={onUpdateEigen}
        onDelete={onDeleteEigen}
      />
    </>
  );
}

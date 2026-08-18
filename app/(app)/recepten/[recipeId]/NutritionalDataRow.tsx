"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { roundMacroForDisplay } from "@/lib/recipes/nutrition";
import { formatQuantity } from "@/lib/recipes/units";

// #160 — Figma "NutritionalData" (3997:15948 mobile / 3997:15543 desktop), a
// plain FRAME of Button/Default pills under the recipe title, not a
// fetched Figma component — same page-level-composition, no-figma-map-entry
// precedent as RecipeDetailPage.tsx's own Header/Knoppen rows. #166 added a
// seventh pill (fibre, node 4025:11826). Full reasoning:
// design/notes/RecipeDetailPage.md.

export interface NutritionalDataRowProps {
  timeMinutes: number | null;
  kcal: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  /** #166 — grams of dietary fibre, computed the same way as the other four macros (lib/recipes/nutrition.ts). `null` renders "?", same as any other unresolved macro. */
  fiberG: number | null;
  servings: number;
}

type NutritionKey = "time" | "calories" | "carbs" | "protein" | "fat" | "fiber";

export function NutritionalDataRow({
  timeMinutes,
  kcal,
  carbsG,
  proteinG,
  fatG,
  fiberG,
  servings,
}: NutritionalDataRowProps) {
  const t = useTranslations("components.recipeDetailPage.nutrition");
  const [openKey, setOpenKey] = useState<NutritionKey | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // One ref pair shared by all six triggers -- only one popover is ever
  // open, so it's attached to whichever item's wrapper is currently open
  // (below). Centre-anchored below by design; docs/incidents.md, 2026-08-18.
  const openWrapperRef = useRef<HTMLDivElement>(null);
  const openPopoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(openWrapperRef, openPopoverRef, {
    open: openKey !== null,
    anchor: "center",
    prefer: "below",
  });

  // Same click-outside-closes convention as RecipeDetailPage.tsx's own
  // overflow menu / TeDoenHeader.tsx's dropdowns — one shared ref for the
  // whole row since only one of the five popovers is ever open at once.
  useEffect(() => {
    if (!openKey) return;
    function handlePointerDown(event: PointerEvent) {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openKey]);

  // "When number is unknown show: ?" (Dev Mode annotation on 3997:15950,
  // stated to apply to all five/six buttons this function formats) — never a
  // fabricated 0. A `null` here means genuinely unresolvable (unlinked
  // ingredient, unconvertible unit, or a per_100ml reference row, ADR-0013
  // §4) — see lib/recipes/nutrition.ts.
  function formatValue(value: number | null, unit: string): string {
    return value === null ? t("unknownValue") : formatQuantity(value, unit);
  }

  // #166: macronutrients render as whole numbers — `roundMacroForDisplay`
  // keeps `null` null so formatValue still resolves it to "?".
  function formatMacro(value: number | null, unit: string): string {
    return formatValue(roundMacroForDisplay(value), unit);
  }

  // Order/icons match the fetched node exactly (Timer, Flame, Wheat,
  // BicepsFlexed, Droplet, LeafyGreen — fibre added #166, node 4025:11826) —
  // each opens a dropdown naming the abbreviated figure's full word
  // (annotations on 3997:15949-3997:15953 / 4025:11826). `isNevoData` marks
  // the macro dropdowns that must carry ADR-0013 §2's mandatory attribution
  // — Time excluded, since recipes.time_minutes isn't NEVO data.
  const items: { key: NutritionKey; icon: IconName; value: string; fullLabel: string; isNevoData: boolean }[] = [
    {
      key: "time",
      icon: "Timer",
      value: formatValue(timeMinutes, t("timeUnit")),
      fullLabel: t("timeLabel"),
      isNevoData: false,
    },
    {
      key: "calories",
      icon: "Flame",
      value: formatMacro(kcal, t("caloriesUnit")),
      fullLabel: t("caloriesLabel"),
      isNevoData: true,
    },
    {
      key: "carbs",
      icon: "Wheat",
      value: formatMacro(carbsG, t("carbsUnit")),
      fullLabel: t("carbsLabel"),
      isNevoData: true,
    },
    {
      key: "protein",
      icon: "BicepsFlexed",
      value: formatMacro(proteinG, t("proteinUnit")),
      fullLabel: t("proteinLabel"),
      isNevoData: true,
    },
    {
      key: "fat",
      icon: "Droplet",
      value: formatMacro(fatG, t("fatUnit")),
      fullLabel: t("fatLabel"),
      isNevoData: true,
    },
    {
      key: "fiber",
      icon: "LeafyGreen",
      value: formatMacro(fiberG, t("fiberUnit")),
      fullLabel: t("fiberLabel"),
      isNevoData: true,
    },
  ];

  return (
    <div
      ref={rowRef}
      className="flex w-full flex-wrap items-center justify-center gap-inline-md md:w-fit md:flex-nowrap md:justify-start"
    >
      {items.map((item) => (
        <div key={item.key} ref={item.key === openKey ? openWrapperRef : undefined} className="relative">
          <Button
            variant="filled"
            icon={item.icon}
            aria-expanded={openKey === item.key}
            onClick={() => setOpenKey((current) => (current === item.key ? null : item.key))}
          >
            {item.value}
          </Button>
          {openKey === item.key && (
            <div
              ref={openPopoverRef}
              className={`absolute z-[999] ${item.isNevoData ? "w-64" : "w-40"}`}
              style={popover.style}
            >
              <Dropdown className="shadow-sm">
                {/* spacing-flag: same — no Figma node for this popover's content padding — design/notes/NutritionalDataRow.md */}
                <p className="px-2 py-1 text-base font-semibold text-text-secondary">{item.fullLabel}</p>
                {/* ADR-0013 §2: NEVO's licence prescribes this exact English
                    string ("...and other data sources", since this row also
                    shows recipes.time_minutes, which isn't NEVO data) — a
                    legal attribution, not UI copy, so it's stored once in
                    both catalogs with an identical, unlocalised value rather
                    than translated (design/notes/RecipeDetailPage.md). */}
                {item.isNevoData && (
                  // spacing-flag: same — no Figma node for this popover's content padding — design/notes/NutritionalDataRow.md
                  <p className="px-2 pb-1 text-xs font-normal text-text-secondary">{t("nevoAttribution")}</p>
                )}
              </Dropdown>
            </div>
          )}
        </div>
      ))}
      {/* Servings pill (3997:16065/3997:25590) carries no Dev Mode
          annotation, unlike the five above — no dropdown/handler is
          invented for it (CLAUDE.md). Rendered, disabled: the same
          "real but non-functional" precedent this page's own "Voeg toe aan
          mand" button already uses. */}
      <Button variant="filled" icon="User" disabled>
        {formatQuantity(servings, t("servingsUnit"))}
      </Button>
    </div>
  );
}

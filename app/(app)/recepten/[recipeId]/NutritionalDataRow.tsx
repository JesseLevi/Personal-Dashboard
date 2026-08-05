"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { formatQuantity } from "@/lib/recipes/units";

// #160 — Figma "NutritionalData" (3997:15948 mobile / 3997:15543 desktop), a
// plain FRAME of six Button/Default pills under the recipe title, not a
// fetched Figma component — same page-level-composition, no-figma-map-entry
// precedent as RecipeDetailPage.tsx's own Header/Knoppen rows. Full
// reasoning: design/notes/RecipeDetailPage.md.

export interface NutritionalDataRowProps {
  timeMinutes: number | null;
  kcal: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  servings: number;
}

type NutritionKey = "time" | "calories" | "carbs" | "protein" | "fat";

export function NutritionalDataRow({
  timeMinutes,
  kcal,
  carbsG,
  proteinG,
  fatG,
  servings,
}: NutritionalDataRowProps) {
  const t = useTranslations("components.recipeDetailPage.nutrition");
  const [openKey, setOpenKey] = useState<NutritionKey | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

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
  // stated to apply to all five buttons this function formats) — never a
  // fabricated 0. Every macro is legitimately unknown today (ADR-0011 §5,
  // no licensed nutrient import has run) — see lib/recipes/nutrition.ts.
  function formatValue(value: number | null, unit: string): string {
    return value === null ? t("unknownValue") : formatQuantity(value, unit);
  }

  // Order/icons match the fetched node exactly (Timer, Flame, Wheat,
  // BicepsFlexed, Droplet) — each opens a dropdown naming the abbreviated
  // figure's full word (annotations on 3997:15949-3997:15953).
  const items: { key: NutritionKey; icon: IconName; value: string; fullLabel: string }[] = [
    { key: "time", icon: "Timer", value: formatValue(timeMinutes, t("timeUnit")), fullLabel: t("timeLabel") },
    { key: "calories", icon: "Flame", value: formatValue(kcal, t("caloriesUnit")), fullLabel: t("caloriesLabel") },
    { key: "carbs", icon: "Wheat", value: formatValue(carbsG, t("carbsUnit")), fullLabel: t("carbsLabel") },
    {
      key: "protein",
      icon: "BicepsFlexed",
      value: formatValue(proteinG, t("proteinUnit")),
      fullLabel: t("proteinLabel"),
    },
    { key: "fat", icon: "Droplet", value: formatValue(fatG, t("fatUnit")), fullLabel: t("fatLabel") },
  ];

  return (
    <div
      ref={rowRef}
      className="flex w-full flex-wrap items-center justify-center gap-3 md:w-fit md:flex-nowrap md:justify-start"
    >
      {items.map((item) => (
        <div key={item.key} className="relative">
          <Button
            variant="filled"
            icon={item.icon}
            aria-expanded={openKey === item.key}
            onClick={() => setOpenKey((current) => (current === item.key ? null : item.key))}
          >
            {item.value}
          </Button>
          {openKey === item.key && (
            <div className="absolute top-full left-1/2 z-[999] mt-2 w-40 -translate-x-1/2">
              <Dropdown className="shadow-sm">
                <p className="px-2 py-1 text-base font-semibold text-text-muted">{item.fullLabel}</p>
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

"use client";

// design: Claude-designed (#487)
import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { PlanChoices } from "@/components/molecules/PlanChoices";
import { useAgendaDraggable } from "@/components/organisms/useAgendaDraggable";
import { filterPlanRecipes, type PlanRecipe } from "@/lib/agenda/plan-recipes";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { MealSlot } from "@/lib/agenda/types";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";

export interface PlanRecipeListProps {
  recipes: readonly PlanRecipe[];
  categories: readonly { id: string; name: string }[];
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  onPlan: (recipeId: string, plannedOn: string, slot: MealSlot) => Promise<AgendaActionResult<unknown>>;
  onPlanned: (plannedOn: string, slot: MealSlot) => void;
}

function PlanRecipeRow({
  recipe,
  today,
  onPlan,
  onPlanned,
}: {
  recipe: PlanRecipe;
  today: string;
  onPlan: PlanRecipeListProps["onPlan"];
  onPlanned: PlanRecipeListProps["onPlanned"];
}) {
  const t = useTranslations("components.planDrawer");
  const tRecipe = useTranslations("components.cardContentRecipe");
  const rowRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const popover = usePopoverPosition(wrapperRef, popoverRef, {
    open,
    anchor: "right",
    prefer: "below",
    strategy: "fixed",
  });

  useAgendaDraggable(rowRef, { type: "recipe", id: recipe.id, title: recipe.title });

  return (
    <div
      ref={rowRef}
      className="flex cursor-grab items-center gap-inline-sm rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs"
    >
      <CardContentRecipe
        compact
        className="w-auto min-w-0 flex-1"
        name={recipe.title}
        imageUrl={recipe.thumbnailUrl ?? undefined}
        imageFallbackUrl={
          recipe.thumbnailUrl && recipe.thumbnailPath
            ? recipeThumbnailRouteUrl(recipe.id, recipe.thumbnailPath, "card")
            : undefined
        }
        duration={recipe.timeMinutes != null ? tRecipe("durationMinutes", { minutes: recipe.timeMinutes }) : undefined}
      />
      <span ref={wrapperRef} className="inline-flex shrink-0">
        <Button
          variant="transparent"
          icon="Calendar"
          aria-label={t("planRecipeLabel", { name: recipe.title })}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        />
      </span>
      {open &&
        createPortal(
          <PopoverBody popoverRef={popoverRef} style={popover.style} onClose={() => setOpen(false)} wrapperRef={wrapperRef}>
            <Dropdown className="shadow-sm">
              <PlanChoices
                today={today}
                onPlan={(plannedOn, slot) => onPlan(recipe.id, plannedOn, slot)}
                onPlanned={(plannedOn, slot) => {
                  setOpen(false);
                  onPlanned(plannedOn, slot);
                }}
              />
            </Dropdown>
          </PopoverBody>,
          document.body,
        )}
    </div>
  );
}

// Portalled out of the scrolling tray; a press outside trigger and popover closes it.
function PopoverBody({
  popoverRef,
  wrapperRef,
  style,
  onClose,
  children,
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLSpanElement | null>;
  style: CSSProperties;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("components.planDrawer");
  useOutsidePress([wrapperRef, popoverRef], onClose);
  return (
    <div ref={popoverRef} role="group" aria-label={t("planMenuLabel")} className="z-[999] w-64" style={style}>
      {children}
    </div>
  );
}

export function PlanRecipeList({ recipes, categories, today, onPlan, onPlanned }: PlanRecipeListProps) {
  const t = useTranslations("components.planDrawer");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categoryOptions = [{ value: "", label: t("allCategories") }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const visible = useMemo(() => filterPlanRecipes(recipes, { query, categoryId }), [recipes, query, categoryId]);

  return (
    <>
      {query ? (
        <InputField
          id="plan-recipes-search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          leadingIcon="Search"
          trailingIcon="X"
          trailingIconLabel={t("searchClearLabel")}
          onTrailingIconClick={() => setQuery("")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : (
        <InputField
          id="plan-recipes-search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          leadingIcon="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <InputField
        id="plan-recipes-category"
        aria-label={t("categoryLabel")}
        options={categoryOptions}
        trailingIcon="ChevronDown"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
      />
      <p className="text-sm font-semibold text-text-secondary">{t("dragHint")}</p>
      {visible.length === 0 ? (
        <p className="text-base font-semibold text-text-secondary">{t("noRecipes")}</p>
      ) : (
        <ul className="flex flex-col gap-stack-sm">
          {visible.map((recipe) => (
            <li key={recipe.id}>
              <PlanRecipeRow recipe={recipe} today={today} onPlan={onPlan} onPlanned={onPlanned} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

"use client";

// design: Claude-designed (#487)
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { PlanChoices } from "@/components/molecules/PlanChoices";
import { useAgendaDraggable } from "@/components/organisms/useAgendaDraggable";
import { defaultSlotForCategory } from "@/lib/agenda/meals";
import { filterPlanRecipes, type PlanRecipe } from "@/lib/agenda/plan-recipes";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { MealSlot } from "@/lib/agenda/types";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";

export interface PlanRecipeListProps {
  recipes: readonly PlanRecipe[];
  categories: readonly { id: string; name: string }[];
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  onPlan: (recipeId: string, plannedOn: string, slot: MealSlot) => Promise<AgendaActionResult<unknown>>;
  onPlanned: (plannedOn: string, slot: MealSlot) => void;
  /** "Week naar mand" as the tab's footer: sends the visible week's unsent meals. Omitted: no footer. */
  weekToBasket?: {
    onSend: (listId?: string) => Promise<ActionResult>;
    baskets: BasketOption[];
  };
}

/** A press that moved this far was a drag, not a click. */
const DRAG_THRESHOLD_PX = 5;

/**
 * Makes a draggable plan row the trigger of its own "plan on a day" menu: click, Enter or Space opens it,
 * a drag never does, Escape closes it and puts focus back on the row.
 */
export function usePlanMenu(rowRef: RefObject<HTMLDivElement | null>, popoverRef: RefObject<HTMLDivElement | null>) {
  const [open, setOpen] = useState(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const popover = usePopoverPosition(rowRef, popoverRef, { open, anchor: "right", prefer: "below", strategy: "fixed" });

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) rowRef.current?.focus();
  }

  const triggerProps = {
    role: "button" as const,
    tabIndex: 0,
    "aria-haspopup": "true" as const,
    "aria-expanded": open,
    onPointerDown: (event: { clientX: number; clientY: number }) => {
      pressRef.current = { x: event.clientX, y: event.clientY };
    },
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      // The portalled menu bubbles through the React tree; only a click inside the row counts.
      if (!event.currentTarget.contains(event.target as Node)) return;
      const press = pressRef.current;
      pressRef.current = null;
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_THRESHOLD_PX) return;
      // The drag handler swallows the press's default focus, so Escape would have nowhere to land.
      event.currentTarget.focus();
      setOpen((current) => !current);
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        close(true);
      } else if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    },
  };

  return { open, popover, close, triggerProps };
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
  const popoverRef = useRef<HTMLDivElement>(null);
  const { open, popover, close, triggerProps } = usePlanMenu(rowRef, popoverRef);

  useAgendaDraggable(rowRef, { type: "recipe", id: recipe.id, title: recipe.title });

  return (
    <div
      ref={rowRef}
      aria-label={t("planRecipeLabel", { name: recipe.title })}
      {...triggerProps}
      className="flex cursor-grab items-center gap-inline-sm rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm"
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
      {open &&
        createPortal(
          <PopoverBody popoverRef={popoverRef} style={popover.style} onClose={() => close(false)} wrapperRef={rowRef}>
            <Dropdown className="shadow-sm">
              <PlanChoices
                today={today}
                defaultSlot={defaultSlotForCategory(recipe.categoryName)}
                onPlan={(plannedOn, slot) => onPlan(recipe.id, plannedOn, slot)}
                onPlanned={(plannedOn, slot) => {
                  close(false);
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
export function PopoverBody({
  popoverRef,
  wrapperRef,
  style,
  onClose,
  children,
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
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

export function PlanRecipeList({ recipes, categories, today, onPlan, onPlanned, weekToBasket }: PlanRecipeListProps) {
  const t = useTranslations("components.planDrawer");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categoryOptions = [{ value: "", label: t("allCategories") }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const visible = useMemo(() => filterPlanRecipes(recipes, { query, categoryId }), [recipes, query, categoryId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-stack-sm">
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
      <div className="flex min-h-0 flex-1 flex-col gap-stack-sm overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {visible.length === 0 ? (
          <p className="text-base font-semibold text-text-secondary">{t("noRecipes")}</p>
        ) : (
          <ul className="flex flex-col gap-stack-md">
            {visible.map((recipe) => (
              <li key={recipe.id}>
                <PlanRecipeRow recipe={recipe} today={today} onPlan={onPlan} onPlanned={onPlanned} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {weekToBasket && (
        <div className="flex flex-col gap-stack-sm border-t border-stroke-primary pt-component-md">
          <p className="text-sm font-semibold text-text-secondary">{t("weekToBasketHint")}</p>
          <AnimatedAddToBasketButton
            label={t("weekToBasketLabel")}
            addedLabel={t("weekToBasketAddedLabel")}
            onAddToBasket={weekToBasket.onSend}
            baskets={weekToBasket.baskets}
            chooseBasketLabel={t("chooseBasketLabel")}
            className="w-full justify-center"
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Tag } from "@/components/atoms/Tag";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { CardContentStep } from "@/components/molecules/CardContentStep";
import { EventLinkLine } from "@/components/molecules/EventLinkLine";
import type { AgendaEventRef } from "@/lib/agenda/links";
import { PlanChoices } from "@/components/molecules/PlanChoices";
import { MemberSearchPanel } from "@/components/organisms/MemberSearchPanel";
import { Toast } from "@/components/organisms/Toast";
import type { MemberSearchResult } from "@/lib/sharing/types";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import type { BasketOption } from "@/lib/shopping/baskets";
import { formatQuantityFraction } from "@/lib/recipes/kitchen-units";
import { summarizeRecipeNutrition, type RecipeIngredientNutritionInput } from "@/lib/recipes/nutrition";
import { scaleIngredientRows } from "@/lib/recipes/scaling";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";
import { useImageFallback } from "@/lib/ui/image-fallback";
import type { UnitSystem } from "@/lib/recipes/units";
import type {
  RecipeCategoryRow,
  RecipeIngredientWithNutrition,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";
import { NutritionalDataRow } from "./NutritionalDataRow";
import { PasAanPanel } from "./PasAanPanel";
import { RecipePanel, type RecipePanelTarget } from "../RecipePanel";
import {
  createOwnIngredient,
  createRecipe,
  deleteRecipe,
  searchIngredients,
  searchRecipeShareMembers,
  shareRecipe,
  updateRecipe,
  uploadRecipeThumbnail,
} from "../actions";
import { confirmIngredientMatch } from "../import-actions";
import { SourceLink } from "./SourceLink";
import { addIngredientToShoppingList, sendRecipeToShoppingList } from "../../winkelmand/actions";
import { createMealPlan } from "../../agenda/meal-actions";
import { defaultSlotForCategory } from "@/lib/agenda/meals";
import { todayInAgendaZone } from "@/lib/agenda/time";

// #127/#160 recipe detail route body — V2 Figma "Recept/Mobile" (3997:14737)
// / "Recept/Desktop" (3997:15171), NutritionalData row 3997:15948/3997:15543,
// ingredient cards (unchanged geometry) 3778:5437/3778:5600. Page-level
// composition of existing atoms/molecules plus #160's two new page-local
// components (NutritionalDataRow, PasAanPanel) — same non-mapped-component
// precedent as ReceptenBoard.tsx/RecipePanel.tsx, not added to
// design/figma-map.json. No new Ladle story: this is a full route body (like
// ReceptenBoard.tsx, which also ships without one), not a self-contained
// overlay like RecipePanel.tsx/CardDetailPanel.tsx. Every decision/deviation
// below: design/notes/RecipeDetailPage.md.

/** Buckets ingredients (already position-sorted) by `group_label`, preserving
 * each group's first-seen order — including one shared bucket for every
 * `null`-label row, rendered as a single untitled Card (decision, not a
 * "default" group name — see design/notes/RecipeDetailPage.md). */
interface IngredientGroup {
  groupLabel: string | null;
  ingredients: RecipeIngredientWithNutrition[];
}

function groupIngredients(ingredients: RecipeIngredientWithNutrition[]): IngredientGroup[] {
  const order: (string | null)[] = [];
  const byLabel = new Map<string | null, RecipeIngredientWithNutrition[]>();
  for (const ingredient of ingredients) {
    const key = ingredient.group_label;
    if (!byLabel.has(key)) {
      byLabel.set(key, []);
      order.push(key);
    }
    byLabel.get(key)!.push(ingredient);
  }
  return order.map((groupLabel) => ({ groupLabel, ingredients: byLabel.get(groupLabel)! }));
}

export interface RecipeDetailPageProps {
  recipe: RecipeWithIngredientsAndSteps;
  categories: RecipeCategoryRow[];
  /** Presigned "full" hero URL minted in the page render (#391); null/absent -> placeholder. */
  thumbnailUrl?: string | null;
  /** Baskets this user can send to (own plus accepted shared, #429). More than one: send buttons open a basket popover first. */
  baskets?: BasketOption[];
  /** Events this recipe is linked to (ADR-0037 s4), upcoming first. */
  agendaEvents?: AgendaEventRef[];
}

export function RecipeDetailPage({
  recipe,
  categories,
  thumbnailUrl = null,
  baskets = [],
  agendaEvents = [],
}: RecipeDetailPageProps) {
  // #391: presigned hero; the route URL is the one-shot onError fallback.
  // See design/notes/RecipeDetailPage.md.
  const hero = useImageFallback(
    thumbnailUrl ?? "",
    thumbnailUrl && recipe.thumbnail_path
      ? recipeThumbnailRouteUrl(recipe.id, recipe.thumbnail_path, "full")
      : undefined,
  );
  const t = useTranslations("components.recipeDetailPage");
  const tUnits = useTranslations("recipes.units");
  // #164/#157: short unit labels for the per-step Tags only (Figma draws
  // those abbreviated -- "2 tbs Chia Seeds", "375 ml Non Dairy Milk"). The
  // ingredient-card Tag keeps the long label (`tUnits`) -- see
  // design/notes/RecipeDetailPage.md.
  const tUnitsShort = useTranslations("recipes.unitsShort");
  const tErrors = useTranslations("recipes.errors");
  const tSharingErrors = useTranslations("sharing.errors");
  const router = useRouter();

  // Local, display-only, session-only state -- never written back to
  // `recipe.servings` (#128) nor persisted anywhere (#160's unit system).
  // #153 added the floor of 1 (PortionStepper's own `min` prop). Both are
  // now set from the Pas-aan panel rather than a page-level control -- see
  // design/notes/RecipeDetailPage.md.
  const [portions, setPortions] = useState(recipe.servings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  // "plan": the overflow menu shows the Plannen choices (day and moment) instead of its actions.
  const [overflowView, setOverflowView] = useState<"menu" | "plan">("menu");
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const tPlan = useTranslations("agenda.plan");
  const format = useFormatter();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // #178: own transition, independent of handleDelete's -- sending to the
  // list and deleting the recipe are mutually exclusive user actions
  // rendered in different branches below, so sharing one pending flag would
  // only couple their disabled states for no reason.
  const [sendPending, setSendPending] = useState(false);

  // Same click-outside-closes convention as TeDoenHeader.tsx's board-
  // switcher/sort dropdowns — reused for the Ellipsis overflow menu.
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!overflowOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
        setOverflowView("menu");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [overflowOpen]);

  // Right-anchored below by design — docs/incidents.md, 2026-08-18.
  const overflowPopover = usePopoverPosition(overflowRef, overflowPopoverRef, {
    open: overflowOpen,
    anchor: "right",
    prefer: "below",
  });

  // ADR-0036: offers a copy of this recipe to the picked person. Failures
  // render as a text line under the header; the confirmation is a Toast.
  async function handleShare(member: MemberSearchResult) {
    setShareError(null);
    setShareNotice(null);
    const result = await shareRecipe({ recipeId: recipe.id, memberId: member.id });
    if (!result.success) {
      setShareError(tSharingErrors(result.error));
      return;
    }
    setShareNotice(t("sharedWithLabel", { name: member.displayName?.trim() || t("sharedUnnamedLabel") }));
  }

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteRecipe({ recipeId: recipe.id });
      if (!result.success) {
        setDeleteError(tErrors(result.error));
        cancelDelete();
        return;
      }
      router.push("/recepten");
    });
  }

  // #178: sends the whole recipe, scaled to the page's current session
  // `portions` (#128/#160 -- display-only, never `recipe.servings` itself).
  // #290: the real `ActionResult` is returned so AnimatedAddToBasketButton
  // plays "Toegevoegd" only on success; the failure display itself is
  // undesigned -- see docs/open-questions.md#winkelmand-send-no-success-feedback.
  async function handleSendToList(listId?: string) {
    setSendPending(true);
    try {
      return await sendRecipeToShoppingList({ listId, recipeId: recipe.id, targetPortions: portions });
    } finally {
      setSendPending(false);
    }
  }

  // #179 part 2: the per-row swipe-to-cart action -- one ingredient instead
  // of the whole recipe, same session `portions`. Returns the real result
  // too (#290), see handleSendToList above.
  function handleAddIngredientToCart(ingredientId: string, listId?: string) {
    return addIngredientToShoppingList({ listId, recipeId: recipe.id, ingredientId, targetPortions: portions });
  }

  // #128/#160/#164/#157: one shared scaled-and-converted list feeds both the
  // ingredient cards and the per-step Tags below, so `portions`/`unitSystem`
  // each only get applied once per render (lib/recipes/scaling.ts composes
  // scaling + kitchen-unit conversion in one pass). `getMasses` reads each
  // row's own batched `kitchenUnitMasses` (queries.ts, no second round
  // trip) rather than resolving anything here.
  const displayIngredients = scaleIngredientRows(
    recipe.ingredients,
    recipe.servings,
    portions,
    unitSystem,
    (ingredient) => ingredient.kitchenUnitMasses,
  );
  const ingredientGroups = groupIngredients(
    [...displayIngredients].sort((a, b) => a.position - b.position),
  );
  const steps = [...recipe.steps].sort((a, b) => a.position - b.position);
  const editTarget: RecipePanelTarget = { mode: "edit", recipe };

  // #153: steps carry ordered recipe_ingredients ids (RecipeStepWithIngredients);
  // looked up here rather than carrying a second copy, per that type's own
  // doc comment. Ids with no matching row (shouldn't happen, FK-enforced,
  // but never crash on it) are silently dropped. Looked up against the
  // display list (#128/#160) so step Tags show the same scaled/converted
  // quantities as the ingredient cards above.
  const ingredientsById = new Map(displayIngredients.map((ingredient) => [ingredient.id, ingredient]));

  // #160: per-person nutrition, from the recipe's OWN stored quantities/
  // `servings` -- never `portions`/`unitSystem`. Per-person nutrition is
  // portion-count-invariant (scaling ingredient mass by portions/servings
  // and then dividing by the same portions cancels out), so recomputing it
  // against the session-only display state would be redundant and would
  // additionally launder a display-only unit conversion into a nutrition
  // input, which lib/recipes/nutrition.ts's own header forbids. See
  // design/notes/RecipeDetailPage.md.
  const nutritionInputs: RecipeIngredientNutritionInput[] = recipe.ingredients.map((ingredient) => ({
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    unitMassGrams: ingredient.unitMassGrams,
    nutrients: ingredient.nutrients,
  }));
  const nutrition = summarizeRecipeNutrition(nutritionInputs, recipe.servings);
  const nutritionPerPerson = nutrition.perPerson;
  // Totals are based on the recognised rows only (lib/recipes/nutrition.ts);
  // the rest is marked per row so the user can link it in the edit panel.
  const notCountedIds = new Set(
    recipe.ingredients.filter((_, i) => nutrition.rowStatus[i] === "not-counted").map((ingredient) => ingredient.id),
  );

  return (
    <div className="flex w-full flex-col items-stretch gap-page-stack pr-page-right-equal">
      {/* spacing-flag: Header's itemSpacing (16) has no bound Figma variable — SPACE_BETWEEN layout, gap is a code-only fallback — design/notes/RecipeDetailPage.md */}
      <div className="flex w-full items-center justify-between gap-4">
        <Button
          icon="ArrowLeft"
          aria-label={t("backLabel")}
          onClick={() => router.push("/recepten")}
        />

        {deleteConfirming ? (
          <DeleteConfirm
            layout="inline"
            isPending={isPending}
            onCancel={cancelDelete}
            onConfirm={handleDelete}
            labels={{ prompt: t("deleteConfirmLabel"), cancel: t("cancelLabel"), confirm: t("deleteConfirmButtonLabel"), deleting: t("deletingLabel") }}
          />
        ) : (
          // spacing-flag: Figma's Desktop "Knoppen" row (3997:15176) spaces all three buttons uniformly at itemSpacing 20 (inline/gap-xl) — this outer wrapper's nested split (16 here, 20 on the inner group below) has no matching Figma node; converting would change the rendered px — design/notes/RecipeDetailPage.md
          <div className="flex flex-wrap items-center justify-end gap-4">
            {/* #178 wires the real handler; #179 adds the AddToBasket ->
                Toegevoegd slide animation -- see
                design/notes/RecipeDetailPage.md's "Voeg toe aan mand" entry
                and design/notes/AnimatedAddToBasketButton.md. */}
            <AnimatedAddToBasketButton
              label={t("addToBasketLabel")}
              shortLabel={t("addToBasketShortLabel")}
              iconOnlyBelow400
              addedLabel={t("addedToBasketLabel")}
              onAddToBasket={handleSendToList}
              baskets={baskets}
              chooseBasketLabel={t("chooseBasketLabel")}
              disabled={sendPending}
            />

            <Button
              variant="filled"
              icon="Share"
              aria-label={t("shareLabel")}
              onClick={() => {
                setShareError(null);
                setShareNotice(null);
                setShareOpen(true);
              }}
            >
              {/* #466: icon-only below md; permanent aria-label (same span-hide pattern as TeDoenHeader). */}
              <span className="hidden md:inline">{t("shareLabel")}</span>
            </Button>

            {/* Ellipsis overflow at every breakpoint (Bewerken, Verwijderen) —
                undesigned node, built from Button + Dropdown exactly like
                TeDoenHeader.tsx's own menus. See design/notes/RecipeDetailPage.md. */}
            <div ref={overflowRef} className="relative">
              <Button
                icon="Ellipsis"
                aria-label={t("overflowMenuLabel")}
                aria-expanded={overflowOpen}
                onClick={() => {
                  setOverflowOpen((open) => !open);
                  setOverflowView("menu");
                }}
              />
              {overflowOpen && overflowView === "plan" && (
                <div ref={overflowPopoverRef} className="absolute z-[999] w-64" style={overflowPopover.style}>
                  <Dropdown className="shadow-sm">
                    <PlanChoices
                      today={todayInAgendaZone()}
                      defaultSlot={defaultSlotForCategory(categories.find((category) => category.id === recipe.category_id)?.name ?? null)}
                      header={
                        <Button variant="white" align="left" icon="ArrowLeft" onClick={() => setOverflowView("menu")}>
                          {t("planLabel")}
                        </Button>
                      }
                      onPlan={(plannedOn, slot) => createMealPlan({ recipeId: recipe.id, plannedOn, slot })}
                      onPlanned={(plannedOn, slot) => {
                        setOverflowOpen(false);
                        setOverflowView("menu");
                        setPlanNotice(
                          tPlan("plannedNotice", {
                            slot: tPlan(`slots.${slot}`),
                            date: format.dateTime(new Date(`${plannedOn}T00:00:00Z`), {
                              weekday: "long",
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            }),
                          }),
                        );
                      }}
                    />
                  </Dropdown>
                </div>
              )}
              {overflowOpen && overflowView === "menu" && (
                <div ref={overflowPopoverRef} className="absolute z-[999] w-[209px]" style={overflowPopover.style}>
                  <Dropdown className="shadow-sm">
                    <Button
                      variant="white"
                      align="left"
                      icon="Calendar"
                      onClick={() => setOverflowView("plan")}
                    >
                      {t("planLabel")}
                    </Button>
                    <Button
                      variant="white"
                      align="left"
                      icon="Pencil"
                      onClick={() => {
                        setOverflowOpen(false);
                        setEditOpen(true);
                      }}
                    >
                      {t("editLabel")}
                    </Button>
                    <Button
                      variant="destructive"
                      align="left"
                      icon="Trash"
                      onClick={() => {
                        setOverflowOpen(false);
                        askDelete();
                      }}
                    >
                      {t("deleteLabel")}
                    </Button>
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {deleteError && (
        <p className="text-base font-semibold text-priority-urgent">{deleteError}</p>
      )}
      {shareError && (
        <p role="alert" className="text-base font-semibold text-priority-urgent">{shareError}</p>
      )}
      <Toast message={shareNotice} onDismiss={() => setShareNotice(null)} />
      <Toast message={planNotice} onDismiss={() => setPlanNotice(null)} />

      {/* #153: real thumbnail, 2:1 at every breakpoint (user-ordered
          override of the fetched node's own ~2:1-but-not-exact geometry —
          see design/notes/RecipeDetailPage.md). Decorative alt: recipe.title
          already renders as adjacent text below, same reasoning
          CardContentRecipe.tsx uses for its own thumbnail. No photo -> same
          bg-surface-primary placeholder, same box, so layout doesn't jump.
          #171: this is the page's LCP element — eager/high-priority, with
          explicit dimensions matching the 2:1 box so layout is known before
          the byte arrives. */}
      {thumbnailUrl ? (
        <img
          src={hero.src}
          onError={hero.onError}
          alt=""
          width={1280}
          height={640}
          loading="eager"
          fetchPriority="high"
          // spacing-flag: "image 63" rectangle (node 3997:14745 Mobile / 3997:15180 Desktop) has cornerRadius 12 with an empty boundVariables — unbound in Figma despite matching radius/card's value — design/notes/RecipeDetailPage.md
          className="aspect-[2/1] w-full rounded-xl object-cover"
        />
      ) : (
        // spacing-flag: same unbound "image 63" radius as the thumbnail above — design/notes/RecipeDetailPage.md
        <div aria-hidden="true" className="aspect-[2/1] w-full rounded-xl bg-surface-primary" />
      )}

      {/* spacing-flag: Title frame (node 3997:15946 Mobile / 3997:15181 Desktop) itemSpacing is 24 but not present in its boundVariables — unbound, despite matching stack/xl and page-stack's value — design/notes/RecipeDetailPage.md */}
      <div className="flex w-full flex-col items-center gap-6 py-component-lg">
        <h1 className="w-full text-center text-4xl font-semibold text-text-primary">{recipe.title}</h1>
        <NutritionalDataRow
          timeMinutes={recipe.time_minutes}
          kcal={nutritionPerPerson.kcal}
          carbsG={nutritionPerPerson.carbsG}
          proteinG={nutritionPerPerson.proteinG}
          fatG={nutritionPerPerson.fatG}
          fiberG={nutritionPerPerson.fiberG}
          servings={portions}
        />
        {nutrition.counted < nutrition.countable && (
          // design: Claude-designed on request (2026-10-07), design/notes/RecipeDetailPage.md.
          <p className="text-base font-semibold text-text-secondary">
            {t("nutritionCoverage", { counted: nutrition.counted, total: nutrition.countable })}
          </p>
        )}
        <SourceLink url={recipe.source_url} label={t("sourceLabel")} />
        <EventLinkLine events={agendaEvents} className="justify-center" />
      </div>

      {/* spacing-flag: Figma's "Main" frame keeps ingredient-group Cards as flat vertical siblings (page-stack=24, node 3997:14738/3997:15173) — only one ingredient-group Card exists in the fetched design, so no bound relationship covers this wrapper's md:flex-row (row-axis) gap — design/notes/RecipeDetailPage.md */}
      <div className="flex w-full flex-col gap-6 md:flex-row">
        {ingredientGroups.map((group, groupIndex) => (
          <Card
            key={group.groupLabel ?? "__ungrouped"}
            title={group.groupLabel ?? t("ingredientsDefaultTitle")}
            className="md:flex-1"
            settings={
              // #160: Personen/Eenheid apply to the whole recipe, not one
              // group -- the trigger renders once, on the first ingredient
              // Card, whichever group that is (including an untitled one;
              // Card's own `settings` slot handles that, see design/notes/Card.md).
              groupIndex === 0 ? (
                <Button
                  variant="filled"
                  icon="Settings2"
                  aria-label={t("settingsLabel")}
                  onClick={() => setPanelOpen(true)}
                />
              ) : undefined
            }
          >
            {group.ingredients.map((ingredient, index) => (
              <CardContentIngredient
                key={ingredient.id}
                name={ingredient.name}
                quantity={formatQuantityFraction(ingredient.quantity, ingredient.unit, tUnits(ingredient.unit))}
                divider={index < group.ingredients.length - 1}
                reviewLabel={
                  notCountedIds.has(ingredient.id)
                    ? t("notCountedLabel")
                    : ingredient.needs_review
                      ? t("needsReviewLabel")
                      : undefined
                }
                onReviewClick={
                  notCountedIds.has(ingredient.id) || ingredient.needs_review ? () => setEditOpen(true) : undefined
                }
                swipeAction="cart"
                onAddToCart={(listId) => handleAddIngredientToCart(ingredient.id, listId)}
                baskets={baskets}
                chooseBasketLabel={t("chooseBasketLabel")}
                addToCartLabel={t("addIngredientToBasketLabel", { name: ingredient.name })}
              />
            ))}
          </Card>
        ))}
      </div>

      <div className="flex w-full flex-col gap-page-stack">
        {steps.map((step, index) => {
          const stepIngredients = step.ingredientIds
            .map((id) => ingredientsById.get(id))
            .filter((ingredient): ingredient is RecipeIngredientWithNutrition => ingredient !== undefined);
          return (
            <Card key={step.id} step={index + 1} title={index === 0 ? t("stepsTitle") : undefined}>
              {/* #153: real per-step ingredient tags — see
                  design/notes/RecipeDetailPage.md for the "name + quantity,
                  neutral Tag" decision. Zero linked ingredients still
                  renders withIngredientTags={false}, no empty tag strip. */}
              <CardContentStep
                text={step.instruction}
                withIngredientTags={stepIngredients.length > 0}
              >
                {stepIngredients.map((ingredient) => {
                  const quantityPart = formatQuantityFraction(
                    ingredient.quantity,
                    ingredient.unit,
                    tUnitsShort(ingredient.unit),
                  );
                  const tagLabel = quantityPart
                    ? `${quantityPart} ${ingredient.name}`
                    : ingredient.name;
                  return (
                    <Tag key={ingredient.id} variant="neutral">
                      {tagLabel}
                    </Tag>
                  );
                })}
              </CardContentStep>
            </Card>
          );
        })}
      </div>

      <RecipePanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        target={editTarget}
        categories={categories}
        onCreateRecipe={createRecipe}
        onUpdateRecipe={updateRecipe}
        onDeleteRecipe={async (input) => {
          const result = await deleteRecipe(input);
          if (result.success) router.push("/recepten");
          return result;
        }}
        onSearchIngredients={searchIngredients}
        onCreateOwnIngredient={createOwnIngredient}
        onConfirmIngredientMatch={confirmIngredientMatch}
        onUploadThumbnail={uploadRecipeThumbnail}
        onMutated={() => router.refresh()}
      />

      <PasAanPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        portions={portions}
        unitSystem={unitSystem}
        onApply={(nextPortions, nextUnitSystem) => {
          setPortions(nextPortions);
          setUnitSystem(nextUnitSystem);
        }}
      />

      <MemberSearchPanel
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSearch={searchRecipeShareMembers}
        onSelect={handleShare}
        confirmLabel={t("shareLabel")}
        confirmIcon="Check"
      />
    </div>
  );
}

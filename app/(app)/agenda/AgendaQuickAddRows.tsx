// design: Claude-designed (#534)
"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Icon } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { ColorDot } from "@/components/molecules/ColorSwatches";
import type { CalendarCategoryView } from "@/lib/agenda/calendars";
import type { PlanCardGroup } from "@/lib/agenda/plan-cards";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import { rankRecipes } from "@/lib/agenda/quick-add";
import { REPEAT_CHOICES, type RepeatChoice } from "@/lib/agenda/repeat";
import type { MealSlot } from "@/lib/agenda/types";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";

// The editable rows of the quick-add window, one set per kind (ADR-0041). Every row shows what the text
// said and lets the user change it; `AgendaQuickAdd` owns the values.

export interface QuickAddValues {
  title: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  people: string;
  place: string;
  repeat: RepeatChoice;
  categoryId: string;
  recipeSearch: string;
  recipeId: string;
  moment: MealSlot;
  cardId: string;
}

export type SetQuickAddValue = <K extends keyof QuickAddValues>(key: K, value: QuickAddValues[K]) => void;

interface RowsProps {
  /** In the bottom sheet every field sits on its own row; the popover pairs them. */
  stacked?: boolean;
  values: QuickAddValues;
  set: SetQuickAddValue;
  disabled: boolean;
}

const ID = "agenda-quick-add";
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const SUGGESTED_RECIPES = 4;

// A small "?" after the label "Met": a click, Enter or Space opens a popover with the hint; Escape or a click outside closes it.
function PeopleHelp() {
  const t = useTranslations("components.agendaQuickAdd");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(wrapperRef, popoverRef, { open, anchor: "left", prefer: "below" });

  useOutsidePress([wrapperRef], () => {
    if (open) setOpen(false);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <span ref={wrapperRef} className="relative inline-flex" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("peopleHelpLabel")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center rounded-full text-text-secondary"
      >
        <Icon name="CircleHelp" className="size-4" />
      </button>
      {open && (
        <div ref={popoverRef} className="z-10 w-56" style={popover.style}>
          <Dropdown className="shadow-sm" role="tooltip">
            <p className="text-sm text-text-secondary">{t("peopleHelp")}</p>
          </Dropdown>
        </div>
      )}
    </span>
  );
}

export function EventRows({ stacked, values, set, disabled, categories }: RowsProps & { categories: CalendarCategoryView[] }) {
  const t = useTranslations("components.agendaQuickAdd");
  const tPanel = useTranslations("components.agendaPanel");
  const tAgenda = useTranslations("agenda");
  const category = categories.find((candidate) => candidate.id === values.categoryId);

  return (
    <>
      <InputField
        label={t("fields.title")}
        id={`${ID}-title`}
        value={values.title}
        onChange={(event) => set("title", event.target.value)}
        disabled={disabled}
      />
      <div className={stacked ? "flex flex-col gap-stack-md" : "flex items-end gap-inline-md"}>
        <InputField
          label={t("fields.date")}
          id={`${ID}-date`}
          type="date"
          leadingIcon="Calendar"
          value={values.date}
          onChange={(event) => set("date", event.target.value)}
          disabled={disabled}
        />
        <div className="flex h-12 shrink-0 items-center gap-inline-sm">
          <Checkbox
            checked={values.allDay}
            aria-labelledby={`${ID}-all-day-label`}
            disabled={disabled}
            onClick={() => set("allDay", !values.allDay)}
          />
          <span id={`${ID}-all-day-label`} className="text-base font-semibold whitespace-nowrap text-text-primary">
            {t("fields.allDay")}
          </span>
        </div>
      </div>
      {!values.allDay && (
        <div className={stacked ? "flex flex-col gap-stack-md" : "flex gap-inline-md"}>
          <InputField
            label={t("fields.start")}
            id={`${ID}-start`}
            type="time"
            value={values.start}
            onChange={(event) => set("start", event.target.value)}
            disabled={disabled}
          />
          <InputField
            label={t("fields.end")}
            id={`${ID}-end`}
            type="time"
            value={values.end}
            onChange={(event) => set("end", event.target.value)}
            disabled={disabled}
          />
        </div>
      )}
      <div className={stacked ? "flex flex-col gap-stack-md" : "flex gap-inline-md"}>
        <InputField
          label={t("fields.people")}
          labelAdornment={<PeopleHelp />}
          id={`${ID}-people`}
          placeholder={t("peoplePlaceholder")}
          value={values.people}
          onChange={(event) => set("people", event.target.value)}
          disabled={disabled}
        />
        <InputField
          label={t("fields.place")}
          id={`${ID}-place`}
          placeholder={t("placePlaceholder")}
          value={values.place}
          onChange={(event) => set("place", event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className={stacked ? "flex flex-col gap-stack-md" : "flex gap-inline-md"}>
        <InputField
          label={t("fields.repeat")}
          id={`${ID}-repeat`}
          options={REPEAT_CHOICES.map((choice) => ({ value: choice, label: tPanel(`repeatOptions.${choice}`) }))}
          leadingIcon="Repeat"
          trailingIcon="ChevronDown"
          value={values.repeat}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => set("repeat", event.target.value as RepeatChoice)}
          disabled={disabled}
        />
        {categories.length > 0 && (
          <InputField
            label={t("fields.category")}
            id={`${ID}-category`}
            leading={
              category ? (
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <ColorDot color={category.color} />
                </span>
              ) : undefined
            }
            options={categories.map((candidate) => ({
              value: candidate.id,
              label: candidate.name ?? tAgenda("defaultCalendarName"),
            }))}
            trailingIcon="ChevronDown"
            value={values.categoryId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => set("categoryId", event.target.value)}
            disabled={disabled}
          />
        )}
      </div>
    </>
  );
}

export function MealRows({ stacked, values, set, disabled, recipes }: RowsProps & { recipes: PlanRecipe[] }) {
  const t = useTranslations("components.agendaQuickAdd");
  const tSlots = useTranslations("agenda.plan.slots");
  const found = values.recipeSearch.trim() === "" ? recipes : rankRecipes(values.recipeSearch, recipes);
  const shown = found.slice(0, SUGGESTED_RECIPES);
  const picked = recipes.find((recipe) => recipe.id === values.recipeId);
  const list = picked && !shown.some((recipe) => recipe.id === picked.id) ? [picked, ...shown.slice(0, SUGGESTED_RECIPES - 1)] : shown;

  return (
    <>
      <InputField
        label={t("fields.recipe")}
        id={`${ID}-recipe`}
        placeholder={t("recipeSearchPlaceholder")}
        leadingIcon="Search"
        value={values.recipeSearch}
        onChange={(event) => {
          set("recipeSearch", event.target.value);
          set("recipeId", "");
        }}
        disabled={disabled}
      />
      {list.length === 0 ? (
        <p className="text-base font-semibold text-text-secondary">{t("recipesEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-stack-sm">
          {list.map((recipe) => {
            const selected = recipe.id === values.recipeId;
            return (
              <li key={recipe.id} className="flex">
                <Button
                  variant="outline"
                  icon={selected ? "Check" : "Utensils"}
                  aria-pressed={selected}
                  align="left"
                  className="w-full min-w-0 justify-start"
                  disabled={disabled}
                  onClick={() => set("recipeId", recipe.id)}
                >
                  <span className="truncate">{recipe.title}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className={stacked ? "flex flex-col gap-stack-md" : "flex gap-inline-md"}>
        <InputField
          label={t("fields.date")}
          id={`${ID}-date`}
          type="date"
          leadingIcon="Calendar"
          value={values.date}
          onChange={(event) => set("date", event.target.value)}
          disabled={disabled}
        />
        <InputField
          label={t("fields.moment")}
          id={`${ID}-moment`}
          options={MEAL_SLOTS.map((slot) => ({ value: slot, label: tSlots(slot) }))}
          trailingIcon="ChevronDown"
          value={values.moment}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => set("moment", event.target.value as MealSlot)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

export function TodoRows({
  values,
  set,
  disabled,
  groups,
  board,
}: RowsProps & { groups: PlanCardGroup[]; board: { boardName: string; columnName: string } | null }) {
  const t = useTranslations("components.agendaQuickAdd");
  const options = [
    { value: "", label: t("newCard") },
    ...groups.flatMap((group) =>
      group.cards.map((card) => ({ value: card.id, label: groups.length > 1 ? `${card.title} (${group.boardName})` : card.title })),
    ),
  ];

  return (
    <>
      <InputField
        label={t("fields.card")}
        id={`${ID}-card`}
        options={options}
        leadingIcon="Columns3"
        trailingIcon="ChevronDown"
        value={values.cardId}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => set("cardId", event.target.value)}
        disabled={disabled}
      />
      {values.cardId === "" && (
        <>
          <InputField
            label={t("fields.title")}
            id={`${ID}-title`}
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            disabled={disabled}
          />
          <p className="text-sm font-semibold text-text-secondary">
            {board ? t("todoTarget", { board: board.boardName, column: board.columnName }) : t("noBoard")}
          </p>
        </>
      )}
      <InputField
        label={t("fields.date")}
        id={`${ID}-date`}
        type="date"
        leadingIcon="Calendar"
        value={values.date}
        onChange={(event) => set("date", event.target.value)}
        disabled={disabled}
      />
    </>
  );
}

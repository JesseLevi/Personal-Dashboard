"use client";

// design: Claude-designed (#487)
import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { DEFAULT_MEAL_SLOT, MEAL_SLOTS, planDays } from "@/lib/agenda/meals";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { MealSlot } from "@/lib/agenda/types";

export interface PlanChoicesProps {
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  /** Plans the recipe on the chosen day and moment; the result decides what shows next. */
  onPlan: (plannedOn: string, slot: MealSlot) => Promise<AgendaActionResult<unknown>>;
  /** Called after a successful plan, with what was chosen. */
  onPlanned: (plannedOn: string, slot: MealSlot) => void;
  /** Rendered as the first row, e.g. a back button when this replaces another menu. */
  header?: ReactNode;
  /** Show the moment select. Off for things without a moment, such as cards; `onPlan` then gets the default moment. */
  showSlot?: boolean;
  /** The moment the select starts on; omitted: `DEFAULT_MEAL_SLOT`. */
  defaultSlot?: MealSlot;
}

/**
 * The rows of a "Plannen" menu: moment, today, tomorrow, the days after, and any other date.
 * Meant to sit inside a labelless `Dropdown` popover. Contract: design/notes/PlanChoices.md.
 */
export function PlanChoices({ today, onPlan, onPlanned, header, showSlot = true, defaultSlot = DEFAULT_MEAL_SLOT }: PlanChoicesProps) {
  const t = useTranslations("components.planChoices");
  const tErrors = useTranslations("agenda.errors");
  const format = useFormatter();
  const slotOptions = MEAL_SLOTS.map((value) => ({ value, label: t(`slots.${value}`) }));
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [otherDate, setOtherDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function plan(plannedOn: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await onPlan(plannedOn, slot);
    setPending(false);
    if (result.success) onPlanned(plannedOn, slot);
    else setError(tErrors(result.error));
  }

  function dayLabel(date: string, index: number) {
    if (index === 0) return t("todayLabel");
    if (index === 1) return t("tomorrowLabel");
    return format.dateTime(new Date(`${date}T00:00:00Z`), { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  }

  return (
    <>
      {header}
      {showSlot && (
        <InputField
          id="plan-choices-slot"
          label={t("momentLabel")}
          options={slotOptions}
          trailingIcon="ChevronDown"
          value={slot}
          onChange={(event) => setSlot(event.target.value as MealSlot)}
        />
      )}
      {planDays(today).map((date, index) => (
        <Button key={date} variant="white" align="left" icon="Calendar" disabled={pending} onClick={() => void plan(date)}>
          {dayLabel(date, index)}
        </Button>
      ))}
      <InputField
        id="plan-choices-date"
        type="date"
        label={t("otherDateLabel")}
        leadingIcon="Calendar"
        value={otherDate}
        min={today}
        onChange={(event) => setOtherDate(event.target.value)}
      />
      <Button variant="filled" icon="Check" disabled={pending || otherDate === ""} onClick={() => void plan(otherDate)}>
        {t("planLabel")}
      </Button>
      {error && (
        <p role="alert" className="px-component-xs text-sm font-semibold text-priority-urgent">
          {error}
        </p>
      )}
    </>
  );
}

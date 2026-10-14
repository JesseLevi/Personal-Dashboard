// design: Claude-designed (#487)
"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { PortionStepper } from "@/components/molecules/PortionStepper";
import { SidePanel } from "@/components/organisms/SidePanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import { MEAL_SLOTS } from "@/lib/agenda/meals";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaMealItem, MealSlot } from "@/lib/agenda/types";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import type { MealPlanDetail } from "./meal-actions";

export interface AgendaMealPanelProps {
  open: boolean;
  onClose: () => void;
  /** The meal to show; keep passing the last one while the panel closes. */
  item: AgendaMealItem;
  /** Baskets "Naar mand" can target; more than one opens the basket popover. */
  baskets: BasketOption[];
  onLoadMeal: (input: unknown) => Promise<AgendaActionResult<MealPlanDetail>>;
  onUpdateMeal: (input: unknown) => Promise<AgendaActionResult>;
  onDeleteMeal: (input: unknown) => Promise<AgendaActionResult>;
  onSendMeal: (input: unknown) => Promise<AgendaActionResult>;
  /** Opens the recipe page; a prop so the panel stays free of the router. */
  onOpenRecipe: (recipeId: string) => void;
  /** After a successful save, delete or send, before `onClose` where it applies. */
  onMutated?: () => void;
}

interface FormValues {
  slot: MealSlot;
  servings: number;
  date: string;
}

const fromItem = (item: AgendaMealItem): FormValues => ({ slot: item.slot, servings: item.servings, date: item.start.slice(0, 10) });

export function AgendaMealPanel({
  open,
  onClose,
  item,
  baskets,
  onLoadMeal,
  onUpdateMeal,
  onDeleteMeal,
  onSendMeal,
  onOpenRecipe,
  onMutated,
}: AgendaMealPanelProps) {
  const t = useTranslations("components.mealPanel");
  const tCount = useTranslations("components.portionStepper");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("agenda.errors");
  const slotOptions = MEAL_SLOTS.map((value) => ({ value, label: t(`slots.${value}`) }));

  const [values, setValues] = useState(() => fromItem(item));
  const [detail, setDetail] = useState<MealPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();

  // Reset on a fresh open or a meal switch, during render, as AgendaEventPanel does.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevId, setPrevId] = useState(item.id);
  if (prevOpen !== open || prevId !== item.id) {
    const shouldReset = open && (!prevOpen || prevId !== item.id);
    setPrevOpen(open);
    setPrevId(item.id);
    if (shouldReset) {
      setValues(fromItem(item));
      setDetail(null);
      setError(null);
      cancel();
    }
  }

  const loadId = open ? item.id : null;
  useEffect(() => {
    if (!loadId) return;
    let cancelled = false;
    void onLoadMeal({ id: loadId }).then((result) => {
      if (cancelled) return;
      if (result.success) setDetail(result.data);
      else setError(tErrors(result.error));
    });
    return () => {
      cancelled = true;
    };
  }, [loadId, onLoadMeal, tErrors]);

  const dirty = values.slot !== item.slot || values.servings !== item.servings || values.date !== item.start.slice(0, 10);
  const canSave = !isPending && dirty && values.date !== "";

  // Only what changed is sent; a changed date detaches an attached meal on the server.
  async function save(): Promise<AgendaActionResult> {
    const result = await onUpdateMeal({
      id: item.id,
      ...(values.slot !== item.slot ? { slot: values.slot } : {}),
      ...(values.servings !== item.servings ? { servings: values.servings } : {}),
      ...(!item.attached && values.date !== item.start.slice(0, 10) ? { plannedOn: values.date } : {}),
    });
    if (!result.success) setError(tErrors(result.error));
    return result;
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await save();
      if (!result.success) return;
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await onDeleteMeal({ id: item.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancel();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  // Unsaved changes are saved first so the basket gets the servings on screen.
  // The result type is the shopping one, which the button understands; the real error shows here.
  async function handleSendToBasket(listId?: string): Promise<ActionResult> {
    setError(null);
    if (dirty) {
      const saved = await save();
      if (!saved.success) return { success: false, error: "generic" };
    }
    const result = await onSendMeal({ id: item.id, listId });
    if (!result.success) {
      setError(tErrors(result.error));
      return { success: false, error: "generic" };
    }
    setDetail((current) => (current ? { ...current, sentToBasket: true } : current));
    onMutated?.();
    return { success: true, data: undefined };
  }

  const footer = confirming ? (
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
      <Button variant="destructive" icon="Trash" className="grow basis-0" onClick={ask} disabled={isPending}>
        {t("deleteLabel")}
      </Button>
      <Button variant="filled" icon="Save" className="grow basis-0" onClick={handleSave} disabled={!canSave}>
        {isPending ? t("savingLabel") : t("saveLabel")}
      </Button>
    </div>
  );

  return (
    <SidePanel open={open} onClose={onClose} title={t("title")} closeLabel={tSidePanel("closeLabel")} footer={footer}>
      <div className="flex flex-col gap-stack-sm">
        <span className="text-base font-semibold text-text-secondary">{t("recipeLabel")}</span>
        <Button
          variant="outline"
          align="left"
          icon="CookingPot"
          disabled={!detail}
          onClick={() => detail && onOpenRecipe(detail.recipeId)}
        >
          {item.title}
        </Button>
      </div>
      <InputField
        id="agenda-meal-slot"
        label={t("slotLabel")}
        options={slotOptions}
        trailingIcon="ChevronDown"
        value={values.slot}
        onChange={(event) => setValues((current) => ({ ...current, slot: event.target.value as MealSlot }))}
      />
      <div className="flex flex-col gap-stack-sm">
        <span className="text-base font-semibold text-text-secondary">{t("servingsLabel")}</span>
        <PortionStepper
          portions={values.servings}
          label={tCount("count", { count: values.servings })}
          decrementLabel={tCount("decrementLabel")}
          incrementLabel={tCount("incrementLabel")}
          onChange={(servings) => setValues((current) => ({ ...current, servings }))}
          className="self-start"
        />
      </div>
      <InputField
        id="agenda-meal-date"
        type="date"
        label={t("dateLabel")}
        leadingIcon="Calendar"
        value={values.date}
        onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))}
        disabled={item.attached}
      />
      {item.attached && <p className="text-sm font-semibold text-text-secondary">{t("attachedNotice")}</p>}
      <AnimatedAddToBasketButton
        label={t("toBasketLabel")}
        addedLabel={t("addedToBasketLabel")}
        onAddToBasket={handleSendToBasket}
        baskets={baskets}
        chooseBasketLabel={t("chooseBasketLabel")}
        disabled={isPending || !detail}
        className="self-start"
      />
      {detail?.sentToBasket && <p className="text-sm font-semibold text-text-secondary">{t("sentNotice")}</p>}
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}

// design: Claude-designed (#534)
"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { InputField } from "@/components/atoms/InputField";
import { ButtonToggle } from "@/components/molecules/ButtonToggle";
import { useIsNarrow } from "@/components/organisms/AgendaCalendar";
import type { CalendarCategoryView } from "@/lib/agenda/calendars";
import type { PlanCardGroup, QuickAddBoard } from "@/lib/agenda/plan-cards";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import {
  defaultEndTime,
  parseQuickAdd,
  type QuickAddKind,
  type QuickAddLocale,
  type QuickAddResult,
} from "@/lib/agenda/quick-add";
import { choiceToRule } from "@/lib/agenda/repeat";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { addDays, spanToUtc } from "@/lib/agenda/time";
import type { MealSlot } from "@/lib/agenda/types";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { cn } from "@/lib/ui/cn";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";
import type { AgendaEventPrefill } from "./AgendaEventPanel";
import { EventRows, MealRows, TodoRows, type QuickAddValues, type SetQuickAddValue } from "./AgendaQuickAddRows";

/** What a successful add reports, for the notice and the reload. */
export type QuickAddAdded =
  | { kind: "event"; title: string; date: string }
  | { kind: "meal"; title: string; date: string; slot: MealSlot }
  | { kind: "todo"; title: string; date: string };

export interface AgendaQuickAddProps {
  open: boolean;
  onClose: () => void;
  /** The header's "+ Nieuw": from `lg` the popover hangs from it. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The slot the user clicked or dragged: its day and time fill the form. */
  slot?: AgendaSpan | null;
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  categories: CalendarCategoryView[];
  recipes: PlanRecipe[];
  cardGroups: PlanCardGroup[];
  /** Where a new card goes; null without a board. */
  todoBoard: QuickAddBoard | null;
  onCreateEvent: (input: unknown) => Promise<AgendaActionResult<{ id: string }>>;
  onCreateMeal: (input: unknown) => Promise<AgendaActionResult<{ id: string }>>;
  onCreateCard: (input: unknown) => Promise<AgendaActionResult<{ id: string }>>;
  onPlanCard: (cardId: string, plannedFor: string) => Promise<AgendaActionResult>;
  onAdded: (added: QuickAddAdded) => void;
  onMoreDetails: (span: AgendaSpan, prefill: AgendaEventPrefill) => void;
  /** Story-only: the text the window starts with. */
  initialText?: string;
  /** Story-only: renders the bottom sheet whatever the viewport. */
  forceSheet?: boolean;
}

const KIND_ITEMS: ReadonlyArray<{ value: QuickAddKind; icon: IconName }> = [
  { value: "event", icon: "Calendar" },
  { value: "meal", icon: "Utensils" },
  { value: "todo", icon: "Columns3" },
];
const DEFAULT_START = "09:00";
const TEXT_ID = "agenda-quick-add-text";
const SHEET_ID = "agenda-quick-add-sheet";
// Safety net if `animationend` never fires (hidden tab, animations switched off): the sheet unmounts anyway.
const EXIT_FALLBACK_MS = 600;
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])';

// A field the user edited keeps its value until the text yields something else for it.
function useOverridable(base: QuickAddValues): [QuickAddValues, SetQuickAddValue] {
  const [overrides, setOverrides] = useState<Partial<Record<keyof QuickAddValues, { value: unknown; base: string }>>>({});
  const values = { ...base };
  for (const key of Object.keys(base) as Array<keyof QuickAddValues>) {
    const override = overrides[key];
    if (override && override.base === JSON.stringify(base[key])) Object.assign(values, { [key]: override.value });
  }
  const set: SetQuickAddValue = (key, value) =>
    setOverrides((current) => ({ ...current, [key]: { value, base: JSON.stringify(base[key]) } }));
  return [values, set];
}

function baseValues(parsed: QuickAddResult, today: string, slot: AgendaSpan | null, defaultCategory: string): QuickAddValues {
  const slotDate = slot ? slot.start.slice(0, 10) : null;
  const slotStart = slot && !slot.allDay ? slot.start.slice(11, 16) : null;
  const slotEnd = slot && !slot.allDay && slot.end && slot.end.slice(0, 10) === slotDate ? slot.end.slice(11, 16) : null;
  const timed = parsed.start !== null;
  const fromSlot = !timed && !parsed.explicitAllDay && slotStart !== null;
  const start = parsed.start ?? slotStart ?? DEFAULT_START;
  return {
    title: parsed.title,
    date: parsed.date ?? slotDate ?? today,
    allDay: parsed.explicitAllDay || !(timed || fromSlot),
    start,
    end: (timed ? parsed.end : fromSlot ? slotEnd : null) ?? defaultEndTime(start),
    people: parsed.people.join(", "),
    place: parsed.place ?? "",
    repeat: parsed.repeat,
    categoryId: parsed.categoryId ?? defaultCategory,
    recipeSearch: parsed.recipeQuery,
    recipeId: parsed.recipeId ?? "",
    moment: parsed.slot ?? "dinner",
    cardId: "",
  };
}

function Recognised({ text, parsed }: { text: string; parsed: QuickAddResult }) {
  const t = useTranslations("components.agendaQuickAdd");
  if (parsed.spans.length === 0) return null;
  let at = 0;
  return (
    <p className="text-sm font-semibold text-text-secondary" aria-live="polite">
      {t("recognisedLabel")}:{" "}
      {parsed.spans.map((span) => {
        const before = text.slice(at, span.start);
        at = span.end;
        return (
          <Fragment key={span.start}>
            {before}
            <mark className="rounded-control-inner bg-event-amber-surface px-component-xs text-event-amber-text">
              {text.slice(span.start, span.end)}
            </mark>
          </Fragment>
        );
      })}
      {text.slice(at)}
    </p>
  );
}

function QuickAddForm({
  onClose,
  slot,
  today,
  categories,
  recipes,
  cardGroups,
  todoBoard,
  onCreateEvent,
  onCreateMeal,
  onCreateCard,
  onPlanCard,
  onAdded,
  onMoreDetails,
  initialText = "",
  sheet,
}: Omit<AgendaQuickAddProps, "open" | "anchorRef" | "forceSheet"> & { sheet: boolean }) {
  const t = useTranslations("components.agendaQuickAdd");
  const tErrors = useTranslations("agenda.errors");
  const locale = useLocale() as QuickAddLocale;
  const [now] = useState(() => new Date());
  const [text, setText] = useState(initialText);
  const [pickedKind, setPickedKind] = useState<QuickAddKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(
    () => parseQuickAdd(text, { locale, now, categories, recipes, kind: pickedKind ?? undefined }),
    [text, locale, now, categories, recipes, pickedKind],
  );
  const defaultCategory = categories.find((category) => category.isDefault)?.id ?? categories[0]?.id ?? "";
  const slotValue = slot ?? null;
  const [values, set] = useOverridable(baseValues(parsed, today, slotValue, defaultCategory));
  const { kind } = parsed;

  const names = values.people.split(",").map((name) => name.trim()).filter(Boolean);
  const description = names.length > 0 ? t("withNames", { names: names.join(", ") }) : "";
  const recipe = recipes.find((candidate) => candidate.id === values.recipeId);
  const timeIsValid = values.allDay || (values.start !== "" && values.end !== "" && values.end >= values.start);
  const canAdd =
    !isPending &&
    values.date !== "" &&
    (kind === "event"
      ? values.title.trim() !== "" && timeIsValid
      : kind === "meal"
        ? recipe !== undefined
        : values.cardId !== "" || (values.title.trim() !== "" && todoBoard !== null));

  function eventSpan(): AgendaSpan {
    if (values.allDay) return { allDay: true, start: values.date, end: addDays(values.date, 1) };
    return { allDay: false, start: `${values.date}T${values.start}:00`, end: `${values.date}T${values.end}:00` };
  }

  function prefill(): AgendaEventPrefill {
    return { title: values.title.trim(), location: values.place.trim(), description, calendarId: values.categoryId, repeat: values.repeat };
  }

  async function add(): Promise<AgendaActionResult<unknown>> {
    const date = values.date;
    if (kind === "meal") {
      const result = await onCreateMeal({ recipeId: values.recipeId, plannedOn: date, slot: values.moment });
      if (result.success) onAdded({ kind, title: recipe?.title ?? "", date, slot: values.moment });
      return result;
    }
    if (kind === "todo") {
      const title = values.title.trim();
      const result = values.cardId ? await onPlanCard(values.cardId, date) : await onCreateCard({ title, plannedFor: date });
      const existing = cardGroups.flatMap((group) => group.cards).find((card) => card.id === values.cardId);
      if (result.success) onAdded({ kind, title: existing?.title ?? title, date });
      return result;
    }
    const rule = choiceToRule(values.repeat, null);
    const result = await onCreateEvent({
      title: values.title.trim(),
      ...spanToUtc(eventSpan()),
      location: values.place,
      description,
      ...(values.categoryId ? { calendarId: values.categoryId } : {}),
      ...(rule ? { repeat: rule } : {}),
    });
    if (result.success) onAdded({ kind: "event", title: values.title.trim(), date });
    return result;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    setError(null);
    startTransition(async () => {
      const result = await add();
      if (!result.success) setError(tErrors(result.error));
    });
  }

  const items = KIND_ITEMS.map((item) => ({ ...item, label: t(`kinds.${item.value}`) }));
  const noDay = parsed.date === null && text.trim() !== "";

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-stack-md overflow-y-auto [scrollbar-gutter:stable] px-component-lg pb-component-lg">
        <ButtonToggle aria-label={t("kindLabel")} items={items} defaultValue={kind} value={kind} size="small" onValueChange={(value) => setPickedKind(value as QuickAddKind)} />
        {pickedKind === "event" && pickedKind !== parsed.autoKind && (
          <p className="-mt-stack-sm text-sm font-semibold text-text-secondary">
            {t("kindPicked")} ·{" "}
            <button type="button" className="underline" onClick={() => setPickedKind(null)}>
              {t("kindBackToAuto")}
            </button>
          </p>
        )}
        <InputField
          label={t("textLabel")}
          id={TEXT_ID}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("textPlaceholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isPending}
        />
        <Recognised text={text} parsed={parsed} />
        {noDay && (
          <p className="text-sm font-semibold text-text-secondary">{t(slotValue ? "noDaySlot" : "noDayToday")}</p>
        )}
        {kind === "event" && <EventRows stacked={sheet} values={values} set={set} disabled={isPending} categories={categories} />}
        {kind === "meal" && <MealRows stacked={sheet} values={values} set={set} disabled={isPending} recipes={recipes} />}
        {kind === "todo" && <TodoRows values={values} set={set} disabled={isPending} groups={cardGroups} board={todoBoard} />}
        {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
      </div>
      <div
        className={cn(
          "flex shrink-0 gap-inline-sm p-component-lg",
          sheet && "border-t border-stroke-primary pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {kind === "event" && (
          <Button
            variant="outline"
            className="grow basis-0"
            disabled={isPending || values.date === ""}
            onClick={() => {
              onMoreDetails(eventSpan(), prefill());
              onClose();
            }}
          >
            {t("moreDetails")}
          </Button>
        )}
        <Button type="submit" variant="filled" icon="Plus" className="grow basis-0" disabled={!canAdd}>
          {isPending ? t("addingLabel") : t("addLabel")}
        </Button>
      </div>
    </form>
  );
}

function Sheet({ onClose, leaving, onLeft, children }: { onClose: () => void; leaving: boolean; onLeft: () => void; children: ReactNode }) {
  const t = useTranslations("components.agendaQuickAdd");
  const sheetRef = useRef<HTMLDivElement>(null);

  // Unmount once the exit animation is over (or the fallback fires).
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeft, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onLeft]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // The sheet itself holds focus on open (no keyboard): Shift+Tab must wrap, Tab walks into the first field.
    if (event.shiftKey && (active === first || active === sheetRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-overlay/60", leaving ? "animate-scrim-out" : "animate-scrim-in")}
      />
      <div
        ref={sheetRef}
        id={SHEET_ID}
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogLabel")}
        tabIndex={-1}
        inert={leaving}
        onKeyDown={handleKeyDown}
        onAnimationEnd={(event) => {
          if (leaving && event.target === event.currentTarget) onLeft();
        }}
        // layout-size: the sheet never covers the whole screen — design/notes/AgendaPage.md
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-container bg-surface-primary outline-none",
          leaving ? "animate-sheet-out" : "animate-sheet-in",
        )}
      >
        <div className="relative flex h-14 shrink-0 items-center justify-end px-component-lg">
          <span aria-hidden="true" className="absolute top-3 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-stroke-primary" />
          <Button variant="filled" icon="X" aria-label={t("closeLabel")} onClick={onClose} />
        </div>
        {children}
      </div>
    </>
  );
}

// spacing-flag: `w-104` and the viewport-bound height are layout sizes, no token — design/notes/AgendaPage.md
function PopoverShell({
  popoverRef,
  style,
  onKeyDown,
  children,
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const t = useTranslations("components.agendaQuickAdd");
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t("dialogLabel")}
      onKeyDown={onKeyDown}
      className="z-[999] flex max-h-[calc(100dvh-10rem)] w-104 flex-col rounded-control-outer border border-stroke-primary bg-surface-primary pt-component-lg shadow-sm"
      style={style}
    >
      {children}
    </div>
  );
}

// "+ Nieuw" and the other entries open this window (ADR-0041): a popover under the header button from `lg`,
// a bottom sheet below it. The form mounts per opening, so it always starts empty.
export function AgendaQuickAdd({ open, onClose, anchorRef, forceSheet = false, ...form }: AgendaQuickAddProps) {
  const narrow = useIsNarrow() || forceSheet;
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(anchorRef, popoverRef, {
    open: open && !narrow,
    anchor: "right",
    prefer: "below",
    strategy: "fixed",
  });
  const placed = popover.style.visibility !== "hidden";
  const returnFocus = useRef<HTMLElement | null>(null);

  useOutsidePress([anchorRef, popoverRef], () => {
    if (open && !narrow) onClose();
  });

  // Focus goes to the text field (popover) or the sheet itself, and back to where it came from on close.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // The sheet keeps the keyboard down: focus goes to the dialog, the text field only gets it in the popover.
    if (narrow) document.getElementById(SHEET_ID)?.focus();
    else if (placed) document.getElementById(TEXT_ID)?.focus();
  }, [open, narrow, placed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  }

  // The sheet stays mounted while it slides out; the form keeps its last state meanwhile.
  const [leaving, setLeaving] = useState(false);
  const onLeft = useCallback(() => setLeaving(false), []);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && narrow);
  }
  if (narrow && (open || leaving)) {
    return createPortal(
      <Sheet onClose={onClose} leaving={!open} onLeft={onLeft}>
        <QuickAddForm onClose={onClose} sheet {...form} />
      </Sheet>,
      document.body,
    );
  }
  if (!open) return null;
  return createPortal(
    <PopoverShell popoverRef={popoverRef} style={popover.style} onKeyDown={handleKeyDown}>
      <QuickAddForm onClose={onClose} sheet={false} {...form} />
    </PopoverShell>,
    document.body,
  );
}

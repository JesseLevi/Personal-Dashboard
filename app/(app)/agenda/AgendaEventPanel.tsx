// design: Claude-designed (#486)
"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { InputField } from "@/components/atoms/InputField";
import { SidePanel } from "@/components/organisms/SidePanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { addDays, spanToUtc } from "@/lib/agenda/time";
import type { AgendaEventDetail, AgendaEventItem } from "@/lib/agenda/types";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";

export type AgendaPanelTarget =
  | { mode: "create"; span: AgendaSpan }
  | { mode: "edit"; item: AgendaEventItem };

export interface AgendaEventPanelProps {
  open: boolean;
  onClose: () => void;
  target: AgendaPanelTarget;
  onLoadEvent: (input: unknown) => Promise<AgendaActionResult<AgendaEventDetail>>;
  onCreateEvent: (input: unknown) => Promise<AgendaActionResult<{ id: string }>>;
  onUpdateEvent: (input: unknown) => Promise<AgendaActionResult>;
  onDeleteEvent: (input: unknown) => Promise<AgendaActionResult>;
  /** After a successful create, update or delete, before `onClose`. */
  onMutated?: () => void;
}

interface FormValues {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
}

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

// Inputs hold wall-clock text: `YYYY-MM-DDTHH:mm` (timed) or `YYYY-MM-DD` (all day, last day inclusive).
function initialValues(target: AgendaPanelTarget): FormValues {
  const span = target.mode === "create" ? target.span : target.item;
  const base = { title: target.mode === "edit" ? target.item.title : "", location: "", description: "" };
  if (span.allDay) {
    const start = span.start.slice(0, 10);
    const last = span.end ? addDays(span.end.slice(0, 10), -1) : start;
    return { ...base, allDay: true, start, end: last < start ? start : last };
  }
  const start = span.start.slice(0, 16);
  const end = span.end ? span.end.slice(0, 16) : `${start.slice(0, 10)}T${DEFAULT_END_TIME}`;
  return { ...base, allDay: false, start, end };
}

function toggleAllDay(values: FormValues): FormValues {
  if (values.allDay) {
    return {
      ...values,
      allDay: false,
      start: `${values.start}T${DEFAULT_START_TIME}`,
      end: `${values.end}T${DEFAULT_END_TIME}`,
    };
  }
  return { ...values, allDay: true, start: values.start.slice(0, 10), end: values.end.slice(0, 10) };
}

function toSpan(values: FormValues): AgendaSpan {
  if (values.allDay) return { allDay: true, start: values.start, end: addDays(values.end, 1) };
  return { allDay: false, start: `${values.start}:00`, end: `${values.end}:00` };
}

export function AgendaEventPanel({
  open,
  onClose,
  target,
  onLoadEvent,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onMutated,
}: AgendaEventPanelProps) {
  const t = useTranslations("components.agendaPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("agenda.errors");

  const [values, setValues] = useState(() => initialValues(target));
  const [detailLoaded, setDetailLoaded] = useState(target.mode === "create");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();

  const item = target.mode === "edit" ? target.item : null;
  const readOnly = item?.source === "sync";
  const targetKey =
    target.mode === "edit" ? `edit-${target.item.id}` : `create-${target.span.start}-${target.span.end}`;

  // Reset on a fresh open or a target switch, during render, so no frame shows
  // stale fields and the one persistent SidePanel keeps its open animation
  // (design/notes/CardDetailPanel.md).
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setValues(initialValues(target));
      setDetailLoaded(target.mode === "create");
      setError(null);
      cancel();
    }
  }

  const editId = open && target.mode === "edit" ? target.item.id : null;
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void onLoadEvent({ id: editId }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setValues((current) => ({
          ...current,
          location: result.data.location ?? "",
          description: result.data.description ?? "",
        }));
        setDetailLoaded(true);
      } else {
        setError(tErrors(result.error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editId, onLoadEvent, tErrors]);

  function update(patch: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  const spanIsValid = values.start !== "" && values.end !== "" && values.end >= values.start;
  const canSave = !isPending && values.title.trim() !== "" && spanIsValid && (target.mode === "create" || detailLoaded);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fields = {
        title: values.title.trim(),
        ...spanToUtc(toSpan(values)),
        location: values.location,
        description: values.description,
      };
      const result =
        target.mode === "create"
          ? await onCreateEvent(fields)
          : await onUpdateEvent({ id: target.item.id, ...fields });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteEvent({ id: item.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancel();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  let footer;
  if (readOnly) footer = undefined;
  else if (item && confirming) {
    footer = (
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
    );
  } else {
    footer = (
      <div className="flex gap-inline-sm">
        {item && (
          <Button variant="destructive" icon="Trash" className="grow basis-0" onClick={ask} disabled={isPending}>
            {t("deleteLabel")}
          </Button>
        )}
        <Button variant="filled" icon="Save" className="grow basis-0" onClick={handleSave} disabled={!canSave}>
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );
  }

  const inputType = values.allDay ? "date" : "datetime-local";

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={readOnly ? t("viewTitle") : item ? t("editTitle") : t("addTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      {readOnly && <p className="text-base text-text-secondary">{t("readOnlyNotice")}</p>}
      <InputField
        label={t("fields.titleLabel")}
        id="agenda-event-title"
        value={values.title}
        onChange={(event) => update({ title: event.target.value })}
        disabled={readOnly}
        required
      />
      <div className="flex items-center gap-inline-sm">
        <Checkbox
          id="agenda-event-all-day"
          checked={values.allDay}
          aria-labelledby="agenda-event-all-day-label"
          disabled={readOnly}
          onClick={() => setValues(toggleAllDay)}
        />
        <span id="agenda-event-all-day-label" className="text-base font-semibold text-text-primary">
          {t("fields.allDayLabel")}
        </span>
      </div>
      <InputField
        key={`start-${inputType}`}
        label={values.allDay ? t("fields.startDateLabel") : t("fields.startLabel")}
        id="agenda-event-start"
        type={inputType}
        leadingIcon="Calendar"
        value={values.start}
        onChange={(event) => update({ start: event.target.value })}
        disabled={readOnly}
      />
      <InputField
        key={`end-${inputType}`}
        label={values.allDay ? t("fields.endDateLabel") : t("fields.endLabel")}
        id="agenda-event-end"
        type={inputType}
        leadingIcon="Calendar"
        value={values.end}
        onChange={(event) => update({ end: event.target.value })}
        disabled={readOnly}
      />
      <InputField
        label={t("fields.locationLabel")}
        id="agenda-event-location"
        value={values.location}
        onChange={(event) => update({ location: event.target.value })}
        disabled={readOnly || !detailLoaded}
      />
      <InputField
        label={t("fields.descriptionLabel")}
        id="agenda-event-description"
        multiline
        value={values.description}
        onChange={(event) => update({ description: event.target.value })}
        placeholder={detailLoaded ? undefined : t("loadingLabel")}
        disabled={readOnly || !detailLoaded}
      />
      <InputField
        label={t("fields.calendarLabel")}
        id="agenda-event-calendar"
        leadingIcon="Calendar"
        value={t("defaultCalendarName")}
        readOnly
        disabled
      />
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}

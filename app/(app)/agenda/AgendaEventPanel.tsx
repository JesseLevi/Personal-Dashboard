// design: Claude-designed (#486)
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { InputField } from "@/components/atoms/InputField";
import { SidePanel } from "@/components/organisms/SidePanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { AgendaLink, AgendaLinkCandidate } from "@/lib/agenda/links";
import { REPEAT_CHOICES, choiceToRule, ruleChanged, ruleToChoice, type RepeatChoice } from "@/lib/agenda/repeat";
import type { AgendaActionResult, AgendaErrorCode, SeriesScope } from "@/lib/agenda/schemas";
import { addDays, spanToUtc } from "@/lib/agenda/time";
import type { AgendaEventDetail, AgendaEventItem, AgendaRepeatRule } from "@/lib/agenda/types";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";
import { AgendaEventLinks } from "./AgendaEventLinks";
import { AgendaLinkSearchPanel, linkKey } from "./AgendaLinkSearchPanel";

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
  /** After a successful create, update or delete, before `onClose`; also after a link change, with the panel left open. */
  onMutated?: () => void;
  /** The "Gekoppeld" section shows for a saved event when the link actions are given. */
  onLoadLinks?: (input: unknown) => Promise<AgendaActionResult<AgendaLink[]>>;
  onSearchLinks?: (input: unknown) => Promise<AgendaActionResult<AgendaLinkCandidate[]>>;
  onLink?: (input: unknown) => Promise<AgendaActionResult<{ id: string }>>;
  onUnlink?: (input: unknown) => Promise<AgendaActionResult>;
  /** Client-side navigation for a link in "Gekoppeld". */
  onNavigate?: (href: string) => void;
}

interface FormValues {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
  repeat: RepeatChoice;
  /** "Eindigt": false = never, true = on `until`. */
  endsOn: boolean;
  until: string;
}

const SCOPES: SeriesScope[] = ["this", "following", "all"];

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

// Inputs hold wall-clock text: `YYYY-MM-DDTHH:mm` (timed) or `YYYY-MM-DD` (all day, last day inclusive).
function initialValues(target: AgendaPanelTarget): FormValues {
  const span = target.mode === "create" ? target.span : target.item;
  const base = {
    title: target.mode === "edit" ? target.item.title : "",
    location: "",
    description: "",
    repeat: "none" as RepeatChoice,
    endsOn: false,
    until: "",
  };
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
  onLoadLinks,
  onSearchLinks,
  onLink,
  onUnlink,
  onNavigate,
}: AgendaEventPanelProps) {
  const t = useTranslations("components.agendaPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("agenda.errors");

  const [values, setValues] = useState(() => initialValues(target));
  const [detailLoaded, setDetailLoaded] = useState(target.mode === "create");
  const [calendarName, setCalendarName] = useState<string | null>(null);
  const [links, setLinks] = useState<AgendaLink[] | null>(null);
  const [linksFailure, setLinksFailure] = useState<AgendaErrorCode | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [originalRule, setOriginalRule] = useState<AgendaRepeatRule | null>(null);
  const [scopePrompt, setScopePrompt] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();

  const item = target.mode === "edit" ? target.item : null;
  const readOnly = item?.source === "sync";
  // An occurrence of a series asks for a scope when it is saved or deleted (ADR-0042 §5-6).
  const isOccurrence = item?.recurring === true;
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
      setCalendarName(null);
      setLinks(null);
      setLinksFailure(null);
      setSearchOpen(false);
      setOriginalRule(null);
      setScopePrompt(null);
      setError(null);
      cancel();
    }
  }

  const eventId = target.mode === "edit" ? target.item.id : null;
  const editId = open && target.mode === "edit" ? target.item.id : null;
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void onLoadEvent({ id: editId }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        const loadedRule = result.data.repeat;
        setValues((current) => ({
          ...current,
          location: result.data.location ?? "",
          description: result.data.description ?? "",
          repeat: ruleToChoice(loadedRule),
          endsOn: loadedRule?.until != null,
          until: loadedRule?.until ?? "",
        }));
        setOriginalRule(loadedRule);
        setCalendarName(result.data.calendarName);
        setDetailLoaded(true);
      } else {
        setError(tErrors(result.error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editId, onLoadEvent, tErrors]);

  const loadLinks = useCallback(async () => {
    if (!editId || !onLoadLinks) return;
    const result = await onLoadLinks({ eventId: editId });
    if (result.success) setLinks(result.data);
    else setLinksFailure(result.error);
  }, [editId, onLoadLinks]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  function handleUnlink(link: AgendaLink) {
    if (!onUnlink) return;
    setError(null);
    startTransition(async () => {
      const result = await onUnlink({ linkId: link.id });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      setLinks((current) => current?.filter((candidate) => candidate.id !== link.id) ?? null);
      onMutated?.();
    });
  }

  // Resolves with the action result so the search panel can show a refusal and stay open.
  async function handleLink(candidate: AgendaLinkCandidate) {
    const result = await onLink!({ eventId, kind: candidate.kind, targetId: candidate.id });
    if (result.success) {
      await loadLinks();
      onMutated?.();
    }
    return result;
  }

  function update(patch: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  const spanIsValid = values.start !== "" && values.end !== "" && values.end >= values.start;
  const rule = choiceToRule(values.repeat, values.endsOn ? values.until : null, originalRule);
  const untilIsValid = !rule || !values.endsOn || (values.until !== "" && values.until >= values.start.slice(0, 10));
  const canSave =
    !isPending &&
    values.title.trim() !== "" &&
    spanIsValid &&
    untilIsValid &&
    (target.mode === "create" || detailLoaded);

  function handleSave(scope?: SeriesScope) {
    setError(null);
    setScopePrompt(null);
    startTransition(async () => {
      const fields = {
        title: values.title.trim(),
        ...spanToUtc(toSpan(values)),
        location: values.location,
        description: values.description,
      };
      // "Alleen deze" leaves the rule alone, so it is not sent.
      const repeat = rule && scope !== "this" ? { repeat: rule } : {};
      const result =
        target.mode === "create"
          ? await onCreateEvent({ ...fields, ...repeat })
          : await onUpdateEvent({ id: target.item.id, ...fields, ...repeat, ...(scope ? { scope } : {}) });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  function handleDelete(scope?: SeriesScope) {
    if (!item) return;
    setError(null);
    setScopePrompt(null);
    startTransition(async () => {
      const result = await onDeleteEvent({ id: item.id, ...(scope ? { scope } : {}) });
      if (!result.success) {
        setError(tErrors(result.error));
        cancel();
        return;
      }
      onMutated?.();
      onClose();
    });
  }

  // Changing how often an occurrence repeats cannot apply to "Alleen deze".
  const saveScopes = ruleChanged(originalRule, rule) ? SCOPES.filter((scope) => scope !== "this") : SCOPES;

  let footer;
  if (readOnly) footer = undefined;
  else if (scopePrompt) {
    const deleting = scopePrompt === "delete";
    footer = (
      <>
        <p className="text-base font-semibold text-text-primary">{t(deleting ? "scope.deletePrompt" : "scope.savePrompt")}</p>
        <div className="flex flex-col gap-inline-sm">
          {(deleting ? SCOPES : saveScopes).map((scope) => (
            <Button
              key={scope}
              variant={deleting ? "destructive" : "filled"}
              icon={deleting ? "Trash" : "Save"}
              onClick={() => (deleting ? handleDelete(scope) : handleSave(scope))}
              disabled={isPending}
            >
              {t(`scope.${scope}`)}
            </Button>
          ))}
          <Button variant="outline" onClick={() => setScopePrompt(null)} disabled={isPending}>
            {t("cancelLabel")}
          </Button>
        </div>
      </>
    );
  } else if (item && confirming) {
    footer = (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancel}
        onConfirm={() => handleDelete()}
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
          <Button
            variant="destructive"
            icon="Trash"
            className="grow basis-0"
            onClick={isOccurrence ? () => setScopePrompt("delete") : ask}
            disabled={isPending}
          >
            {t("deleteLabel")}
          </Button>
        )}
        <Button
          variant="filled"
          icon="Save"
          className="grow basis-0"
          onClick={isOccurrence ? () => setScopePrompt("save") : () => handleSave()}
          disabled={!canSave}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );
  }

  const inputType = values.allDay ? "date" : "datetime-local";

  // A series always repeats: an occurrence has no "Niet" (to stop it, end it or delete it).
  const repeatOptions = [...REPEAT_CHOICES, ...(values.repeat === "custom" ? (["custom"] as const) : [])]
    .filter((choice) => !(isOccurrence && choice === "none"))
    .map((choice) => ({ value: choice, label: t(`repeatOptions.${choice}`) }));
  const endsOptions = [
    { value: "never", label: t("endsOptions.never") },
    { value: "on", label: t("endsOptions.on") },
  ];

  const shownError = error ?? (linksFailure ? tErrors(linksFailure) : null);
  const linkedKeys = new Set((links ?? []).map((link) => linkKey(link.kind, link.targetId)));

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title={readOnly ? t("viewTitle") : item ? t("editTitle") : t("addTitle")}
        closeLabel={tSidePanel("closeLabel")}
        footer={footer}
      >
        {readOnly && (
          <div className="flex flex-col gap-stack-sm">
            <p className="text-base font-semibold text-text-primary">
              {calendarName ? t("importedFrom", { name: calendarName }) : t("importedFromFallback")}
            </p>
            <p className="text-base text-text-secondary">{t("readOnlyNotice")}</p>
          </div>
        )}
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
        {!readOnly && (
          <InputField
            label={t("fields.repeatLabel")}
            id="agenda-event-repeat"
            options={repeatOptions}
            leadingIcon="Repeat"
            trailingIcon="ChevronDown"
            value={values.repeat}
            onChange={(event) => update({ repeat: event.target.value as RepeatChoice })}
            disabled={!detailLoaded}
          />
        )}
        {!readOnly && values.repeat !== "none" && (
          <InputField
            label={t("fields.endsLabel")}
            id="agenda-event-ends"
            options={endsOptions}
            trailingIcon="ChevronDown"
            value={values.endsOn ? "on" : "never"}
            onChange={(event) => update({ endsOn: event.target.value === "on" })}
          />
        )}
        {!readOnly && values.repeat !== "none" && values.endsOn && (
          <InputField
            label={t("fields.untilLabel")}
            id="agenda-event-until"
            type="date"
            leadingIcon="Calendar"
            value={values.until}
            onChange={(event) => update({ until: event.target.value })}
          />
        )}
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
        {eventId && onLoadLinks && (
          <AgendaEventLinks
            links={links}
            onLink={() => setSearchOpen(true)}
            onUnlink={handleUnlink}
            onNavigate={onNavigate}
            disabled={isPending}
          />
        )}
        {shownError && <p className="text-base font-semibold text-priority-urgent">{shownError}</p>}
      </SidePanel>
      {eventId && onSearchLinks && onLink && (
        <AgendaLinkSearchPanel
          open={open && searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={onSearchLinks}
          onSelect={handleLink}
          linkedKeys={linkedKeys}
        />
      )}
    </>
  );
}

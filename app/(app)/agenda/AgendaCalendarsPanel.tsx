// design: Claude-designed (#490, #532)
"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { InputField } from "@/components/atoms/InputField";
import { ColorDot, ColorSwatches } from "@/components/molecules/ColorSwatches";
import { SidePanel } from "@/components/organisms/SidePanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type {
  CalendarAccountView,
  CalendarActionResult,
  CalendarCategoryView,
  CalendarOverview,
} from "@/lib/agenda/calendars";
import { KIND_COLORS, nextFreeColor, type AgendaColor } from "@/lib/agenda/colors";
import { HIDDEN_KINDS, isHidden, withVisibility, type AgendaHidden, type HiddenKind } from "@/lib/agenda/hidden";
import { cn } from "@/lib/ui/cn";

export interface AgendaCalendarsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the lists before the first load (stories, or a parent that already has them). */
  initialOverview?: CalendarOverview;
  /** What this device hides (cookie `agenda-hidden`, ADR-0040 §6). */
  hidden: AgendaHidden;
  onHiddenChange: (hidden: AgendaHidden) => void;
  onList: () => Promise<CalendarActionResult<CalendarOverview>>;
  onAdd: (input: unknown) => Promise<CalendarActionResult<{ id: string }>>;
  onRemove: (input: unknown) => Promise<CalendarActionResult>;
  onCreate: (input: unknown) => Promise<CalendarActionResult<{ id: string }>>;
  onUpdate: (input: unknown) => Promise<CalendarActionResult>;
  onDelete: (input: unknown) => Promise<CalendarActionResult>;
  /** After something changed that the events show (a calendar added, removed or recoloured): the Agenda reloads its events. */
  onMutated?: () => void;
  /** After the lists were (re)loaded, so the event panel's category field follows. */
  onOverviewChange?: (overview: CalendarOverview) => void;
}

const HELP_KEYS = ["outlook", "google", "icloud"] as const;

// Static class names, so Tailwind sees every token.
const TINT_CLASSES: Record<AgendaColor, { row: string; selected: string }> = {
  red: { row: "bg-event-red-surface text-event-red-text", selected: "border-event-red-accent" },
  orange: { row: "bg-event-orange-surface text-event-orange-text", selected: "border-event-orange-accent" },
  amber: { row: "bg-event-amber-surface text-event-amber-text", selected: "border-event-amber-accent" },
  green: { row: "bg-event-green-surface text-event-green-text", selected: "border-event-green-accent" },
  teal: { row: "bg-event-teal-surface text-event-teal-text", selected: "border-event-teal-accent" },
  blue: { row: "bg-event-blue-surface text-event-blue-text", selected: "border-event-blue-accent" },
  violet: { row: "bg-event-violet-surface text-event-violet-text", selected: "border-event-violet-accent" },
  pink: { row: "bg-event-pink-surface text-event-pink-text", selected: "border-event-pink-accent" },
  stone: { row: "bg-event-stone-surface text-event-stone-text", selected: "border-event-stone-accent" },
};

const KIND_LABEL_KEYS = { meal: "meal", planned_card: "plannedCard", deadline: "deadline" } as const;

type Removing = { kind: "category" | "account"; id: string; calendarId: string; name: string };

interface RowProps {
  color: AgendaColor;
  name: string;
  meta?: string;
  visible: boolean;
  showLabel: string;
  onVisibleChange: (visible: boolean) => void;
  /** Absent: the row has nothing to edit (fixed kinds). */
  expanded?: boolean;
  onToggle?: () => void;
  editorId?: string;
  children?: ReactNode;
}

// One calendar or kind: show checkbox, colour dot and name, tinted with its colour; the editor opens below.
function Row({ color, name, meta, visible, showLabel, onVisibleChange, expanded, onToggle, editorId, children }: RowProps) {
  return (
    <div className="flex flex-col gap-stack-sm">
      <div
        className={cn(
          "flex items-center gap-inline-sm rounded-control border p-component-sm",
          TINT_CLASSES[color].row,
          expanded ? TINT_CLASSES[color].selected : "border-transparent",
        )}
      >
        <Checkbox checked={visible} aria-label={showLabel} onClick={() => onVisibleChange(!visible)} />
        <ColorDot color={color} />
        {onToggle ? (
          <button
            type="button"
            className="min-w-0 grow truncate text-start text-base font-semibold"
            aria-expanded={expanded}
            aria-controls={editorId}
            onClick={onToggle}
          >
            {name}
          </button>
        ) : (
          <span className="min-w-0 grow truncate text-base font-semibold">{name}</span>
        )}
        {meta && <span className="shrink-0 text-sm">{meta}</span>}
      </div>
      {expanded && (
        <div
          id={editorId}
          className="flex flex-col gap-stack-md rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-md"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function AgendaCalendarsPanel({
  open,
  onClose,
  initialOverview,
  hidden,
  onHiddenChange,
  onList,
  onAdd,
  onRemove,
  onCreate,
  onUpdate,
  onDelete,
  onMutated,
  onOverviewChange,
}: AgendaCalendarsPanelProps) {
  const t = useTranslations("components.agendaCalendarsPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tAgenda = useTranslations("agenda");
  const format = useFormatter();

  const [overview, setOverview] = useState<CalendarOverview | null>(initialOverview ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();
  const focusNameRef = useRef(false);
  const overviewChangeRef = useRef(onOverviewChange);

  useEffect(() => {
    overviewChangeRef.current = onOverviewChange;
  });

  // After a new category is added its name field takes focus, so typing replaces the placeholder name.
  useEffect(() => {
    if (!focusNameRef.current) return;
    const field = document.getElementById("agenda-category-name");
    if (!(field instanceof HTMLInputElement)) return;
    focusNameRef.current = false;
    field.focus();
    field.select();
  });

  function apply(next: CalendarOverview) {
    setOverview(next);
    overviewChangeRef.current?.(next);
  }

  async function reload() {
    const result = await onList();
    if (result.success) apply(result.data);
    else setError(t(`errors.${result.error}`));
  }

  // Reset on a fresh open, during render, so no frame shows stale fields.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelected(null);
      setName("");
      setUrl("");
      setError(null);
      setRemoving(null);
      cancel();
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void onList().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setOverview(result.data);
        overviewChangeRef.current?.(result.data);
      } else {
        setError(t(`errors.${result.error}`));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, onList, t]);

  const defaultName = tAgenda("defaultCalendarName");
  const categoryName = (category: CalendarCategoryView) => category.name ?? defaultName;

  function toggleSelected(id: string, current: string) {
    setError(null);
    setSelected((value) => (value === id ? null : id));
    setDraftName(current);
  }

  function setVisible(target: { calendar: string } | { kind: HiddenKind }, visible: boolean) {
    onHiddenChange(withVisibility(hidden, target, visible));
  }

  function patchOverview(update: (current: CalendarOverview) => CalendarOverview) {
    setOverview((current) => (current ? update(current) : current));
  }

  // Colour saves at once; a refusal puts the old colour back.
  function handleColor(target: { id: string; color: AgendaColor }) {
    const previous = overview;
    setError(null);
    patchOverview((current) => ({
      categories: current.categories.map((c) => (c.id === target.id ? { ...c, color: target.color } : c)),
      accounts: current.accounts.map((a) => (a.calendarId === target.id ? { ...a, color: target.color } : a)),
    }));
    startTransition(async () => {
      const result = await onUpdate({ id: target.id, color: target.color });
      if (!result.success) {
        setOverview(previous);
        setError(t(`errors.${result.error}`));
        return;
      }
      onMutated?.();
      await reload();
    });
  }

  // The name saves when the field is left or Enter is pressed; an empty name puts the old one back.
  function commitName(category: CalendarCategoryView) {
    const next = draftName.trim();
    if (next === "") {
      setDraftName(category.name ?? "");
      return;
    }
    if (next === category.name) return;
    setError(null);
    startTransition(async () => {
      const result = await onUpdate({ id: category.id, name: next });
      if (!result.success) {
        setDraftName(category.name ?? "");
        setError(t(`errors.${result.error}`));
        return;
      }
      await reload();
    });
  }

  function handleCreate() {
    if (!overview) return;
    setError(null);
    const color = nextFreeColor([...overview.categories, ...overview.accounts].map((entry) => entry.color));
    startTransition(async () => {
      const newName = t("newCategoryName");
      const result = await onCreate({ name: newName, color });
      if (!result.success) {
        setError(t(`errors.${result.error}`));
        return;
      }
      focusNameRef.current = true;
      setSelected(result.data.id);
      setDraftName(newName);
      await reload();
    });
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await onAdd({ name: name.trim(), url: url.trim() });
      if (!result.success) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setName("");
      setUrl("");
      onMutated?.();
      await reload();
    });
  }

  function handleRemove() {
    if (!removing) return;
    const target = removing;
    setError(null);
    startTransition(async () => {
      const result = await (target.kind === "category" ? onDelete : onRemove)({ id: target.id });
      cancel();
      setRemoving(null);
      if (!result.success) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setSelected(null);
      setVisible({ calendar: target.calendarId }, true);
      onMutated?.();
      await reload();
    });
  }

  function statusLabel(account: CalendarAccountView): string {
    if (account.status === "ok" && account.lastSyncedAt) {
      return t("status.ok", { time: format.relativeTime(new Date(account.lastSyncedAt)) });
    }
    return account.status === "failed" ? t("status.failed") : t("status.never");
  }

  function failureReason(account: CalendarAccountView): string | null {
    if (account.status !== "failed") return null;
    const key = account.errorCode && t.has(`syncErrors.${account.errorCode}`) ? account.errorCode : "fetch_failed";
    return t(`syncErrors.${key}`);
  }

  function colorField(id: string, color: AgendaColor) {
    return (
      <div className="flex flex-col gap-stack-sm">
        <span className="text-base font-semibold text-text-secondary">{t("colorLabel")}</span>
        <ColorSwatches value={color} label={t("colorLabel")} onChange={(next) => handleColor({ id, color: next })} />
      </div>
    );
  }

  const canAdd = !isPending && name.trim() !== "" && url.trim() !== "";

  const footer =
    removing && confirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={() => {
          cancel();
          setRemoving(null);
        }}
        onConfirm={handleRemove}
        labels={{
          prompt:
            removing.kind === "category"
              ? t("deleteCategoryConfirmLabel", { name: removing.name, target: defaultName })
              : t("deleteConfirmLabel", { name: removing.name }),
          cancel: t("cancelLabel"),
          confirm: t("deleteConfirmButtonLabel"),
          deleting: t("deletingLabel"),
        }}
      />
    ) : (
      <Button variant="filled" icon="Plus" className="grow basis-0" onClick={handleAdd} disabled={!canAdd}>
        {isPending ? t("addingLabel") : t("addLabel")}
      </Button>
    );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <p className="text-base text-text-secondary">{t("intro")}</p>
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
      {overview === null && <p className="text-base text-text-secondary">{t("loadingLabel")}</p>}

      {overview && (
        <section className="flex flex-col gap-stack-sm" aria-labelledby="agenda-categories-heading">
          <h3 id="agenda-categories-heading" className="text-base font-semibold text-text-primary">
            {t("categoriesHeading")}
          </h3>
          {overview.categories.map((category) => {
            const title = categoryName(category);
            return (
              <Row
                key={category.id}
                color={category.color}
                name={title}
                meta={category.isDefault ? t("defaultBadge") : undefined}
                visible={!isHidden(hidden, { calendar: category.id })}
                showLabel={t("showLabel", { name: title })}
                onVisibleChange={(visible) => setVisible({ calendar: category.id }, visible)}
                expanded={selected === category.id}
                onToggle={() => toggleSelected(category.id, category.name ?? "")}
                editorId={`agenda-editor-${category.id}`}
              >
                {!category.isDefault && (
                  <InputField
                    label={t("nameLabel")}
                    id="agenda-category-name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => commitName(category)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    maxLength={100}
                  />
                )}
                {colorField(category.id, category.color)}
                {!category.isDefault && (
                  <div className="flex flex-col gap-stack-sm">
                    <p className="text-base text-text-secondary">{t("moveNote", { target: defaultName })}</p>
                    <Button
                      variant="destructive"
                      icon="Trash"
                      disabled={isPending}
                      onClick={() => {
                        setRemoving({ kind: "category", id: category.id, calendarId: category.id, name: title });
                        ask();
                      }}
                    >
                      {t("deleteCategoryLabel")}
                    </Button>
                  </div>
                )}
              </Row>
            );
          })}
          <Button variant="white" icon="Plus" disabled={isPending} onClick={handleCreate}>
            {t("addCategoryLabel")}
          </Button>
        </section>
      )}

      {overview && (
        <section className="flex flex-col gap-stack-sm" aria-labelledby="agenda-linked-heading">
          <h3 id="agenda-linked-heading" className="text-base font-semibold text-text-primary">
            {t("linkedHeading")}
          </h3>
          {overview.accounts.length === 0 && <p className="text-base text-text-secondary">{t("emptyLabel")}</p>}
          {overview.accounts.map((account) => (
            <Row
              key={account.id}
              color={account.color}
              name={account.name}
              meta={account.status === "failed" ? t("status.failed") : undefined}
              visible={!isHidden(hidden, { calendar: account.calendarId })}
              showLabel={t("showLabel", { name: account.name })}
              onVisibleChange={(visible) => setVisible({ calendar: account.calendarId }, visible)}
              expanded={selected === account.calendarId}
              onToggle={() => toggleSelected(account.calendarId, account.name)}
              editorId={`agenda-editor-${account.calendarId}`}
            >
              <p className="text-base text-text-secondary">{failureReason(account) ?? statusLabel(account)}</p>
              {colorField(account.calendarId, account.color)}
              <Button
                variant="destructive"
                icon="Trash"
                disabled={isPending}
                onClick={() => {
                  setRemoving({ kind: "account", id: account.id, calendarId: account.calendarId, name: account.name });
                  ask();
                }}
              >
                {t("removeAccountLabel")}
              </Button>
            </Row>
          ))}
        </section>
      )}

      {overview && (
        <section className="flex flex-col gap-stack-sm" aria-labelledby="agenda-fixed-heading">
          <h3 id="agenda-fixed-heading" className="text-base font-semibold text-text-primary">
            {t("fixedHeading")}
          </h3>
          {HIDDEN_KINDS.map((kind) => {
            const label = t(`kinds.${KIND_LABEL_KEYS[kind]}`);
            return (
              <Row
                key={kind}
                color={KIND_COLORS[kind]}
                name={label}
                meta={t("fixedBadge")}
                visible={!isHidden(hidden, { kind })}
                showLabel={t("showLabel", { name: label })}
                onVisibleChange={(visible) => setVisible({ kind }, visible)}
              />
            );
          })}
        </section>
      )}

      <h3 className="text-base font-semibold text-text-primary">{t("addHeading")}</h3>
      <InputField
        label={t("nameLabel")}
        id="agenda-calendar-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
      />
      <InputField
        label={t("urlLabel")}
        id="agenda-calendar-url"
        leadingIcon="Link"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="url"
      />
      <p className="text-base text-text-secondary">{t("privacyNotice")}</p>

      <h3 className="text-base font-semibold text-text-primary">{t("help.heading")}</h3>
      <ul className="flex flex-col gap-stack-sm text-base text-text-secondary">
        {HELP_KEYS.map((key) => (
          <li key={key}>{t(`help.${key}`)}</li>
        ))}
      </ul>
    </SidePanel>
  );
}

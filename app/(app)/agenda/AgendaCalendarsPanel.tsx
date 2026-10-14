// design: Claude-designed (#490)
"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { Tag } from "@/components/atoms/Tag";
import { Card } from "@/components/molecules/Card";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { SidePanel } from "@/components/organisms/SidePanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { CalendarAccountView, CalendarActionResult } from "@/lib/agenda/calendars";

export interface AgendaCalendarsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the list before the first load (stories, or a parent that already has it). */
  initialAccounts?: CalendarAccountView[];
  onList: () => Promise<CalendarActionResult<CalendarAccountView[]>>;
  onAdd: (input: unknown) => Promise<CalendarActionResult<{ id: string }>>;
  onRemove: (input: unknown) => Promise<CalendarActionResult>;
  /** After an account was added or removed, before the list reloads: the Agenda reloads its events. */
  onMutated?: () => void;
}

const HELP_KEYS = ["outlook", "google", "icloud"] as const;

export function AgendaCalendarsPanel({
  open,
  onClose,
  initialAccounts,
  onList,
  onAdd,
  onRemove,
  onMutated,
}: AgendaCalendarsPanelProps) {
  const t = useTranslations("components.agendaCalendarsPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const format = useFormatter();

  const [accounts, setAccounts] = useState<CalendarAccountView[] | null>(initialAccounts ?? null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CalendarAccountView | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();

  async function reload() {
    const result = await onList();
    if (result.success) setAccounts(result.data);
    else setError(t(`errors.${result.error}`));
  }

  // Reset on a fresh open, during render, so no frame shows stale fields.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
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
      if (result.success) setAccounts(result.data);
      else setError(t(`errors.${result.error}`));
    });
    return () => {
      cancelled = true;
    };
  }, [open, onList, t]);

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
      const result = await onRemove({ id: target.id });
      cancel();
      setRemoving(null);
      if (!result.success) {
        setError(t(`errors.${result.error}`));
        return;
      }
      onMutated?.();
      await reload();
    });
  }

  function statusLabel(account: CalendarAccountView): string {
    if (account.status === "ok" && account.lastSyncedAt) {
      return t("status.ok", { time: format.relativeTime(new Date(account.lastSyncedAt)) });
    }
    if (account.status === "failed") {
      const key = account.errorCode && t.has(`syncErrors.${account.errorCode}`) ? account.errorCode : "fetch_failed";
      return t("status.failed", { reason: t(`syncErrors.${key}`) });
    }
    return t("status.never");
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
          prompt: t("deleteConfirmLabel", { name: removing.name }),
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
      <h3 className="text-base font-semibold text-text-primary">{t("listHeading")}</h3>
      {accounts === null && <p className="text-base text-text-secondary">{t("loadingLabel")}</p>}
      {accounts?.length === 0 && <p className="text-base text-text-secondary">{t("emptyLabel")}</p>}
      {accounts?.map((account) => (
        <Card key={account.id}>
          <CardContentTicket title={account.name}>
            <Tag variant={account.status === "ok" ? "low" : account.status === "failed" ? "urgent" : "neutral"}>
              {statusLabel(account)}
            </Tag>
            <Button
              variant="destructive"
              icon="Trash"
              aria-label={t("deleteLabel", { name: account.name })}
              disabled={isPending}
              onClick={() => {
                setRemoving(account);
                ask();
              }}
            />
          </CardContentTicket>
        </Card>
      ))}

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
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
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

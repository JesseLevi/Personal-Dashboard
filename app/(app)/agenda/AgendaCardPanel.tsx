// design: Claude-designed
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { SidePanel } from "@/components/organisms/SidePanel";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaDeadlineItem, AgendaPlannedCardItem } from "@/lib/agenda/types";

export type AgendaCardPanelItem = AgendaPlannedCardItem | AgendaDeadlineItem;

export interface AgendaCardPanelProps {
  open: boolean;
  onClose: () => void;
  /** The planned card or deadline to show; keep passing the last one while the panel closes. */
  item: AgendaCardPanelItem;
  /** Moves a planned card to another day. */
  onSaveDay: (cardId: string, day: string) => Promise<AgendaActionResult>;
  /** Takes the item off the agenda: clears the planned day or the deadline. The card stays. */
  onRemove: (item: AgendaCardPanelItem) => Promise<AgendaActionResult>;
  /** Opens the card in Te doen; a prop so the panel stays free of the router. */
  onOpenCard: (cardId: string) => void;
}

export const agendaCardId = (item: AgendaCardPanelItem) => item.id.replace(/^deadline:/, "");

export function AgendaCardPanel({ open, onClose, item, onSaveDay, onRemove, onOpenCard }: AgendaCardPanelProps) {
  const t = useTranslations("components.cardPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("agenda.errors");
  const day = item.start.slice(0, 10);
  const planned = item.kind === "planned_card";

  const [value, setValue] = useState(day);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset on a fresh open or an item switch, during render, as AgendaMealPanel does.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevKey, setPrevKey] = useState(`${item.id}|${day}`);
  if (prevOpen !== open || prevKey !== `${item.id}|${day}`) {
    const shouldReset = open && (!prevOpen || prevKey !== `${item.id}|${day}`);
    setPrevOpen(open);
    setPrevKey(`${item.id}|${day}`);
    if (shouldReset) {
      setValue(day);
      setError(null);
    }
  }

  const canSave = planned && !isPending && value !== "" && value !== day;

  function run(action: () => Promise<AgendaActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onClose();
    });
  }

  const footer = (
    <div className="flex gap-inline-sm">
      <Button variant="destructive" icon="Trash" className="grow basis-0" onClick={() => run(() => onRemove(item))} disabled={isPending}>
        {planned ? t("unplanLabel") : t("clearDeadlineLabel")}
      </Button>
      {planned && (
        <Button
          variant="filled"
          icon="Save"
          className="grow basis-0"
          onClick={() => run(() => onSaveDay(agendaCardId(item), value))}
          disabled={!canSave}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      )}
    </div>
  );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={planned ? t("plannedTitle") : t("deadlineTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <div className="flex flex-col gap-stack-sm">
        <span className="text-base font-semibold text-text-secondary">{t("cardLabel")}</span>
        <Button variant="outline" align="left" icon="Columns3" onClick={() => onOpenCard(agendaCardId(item))}>
          {item.title}
        </Button>
        {planned && (
          <span className="text-sm font-semibold text-text-secondary">
            {t("location", { board: item.board, column: item.column })}
          </span>
        )}
      </div>
      <InputField
        id="agenda-card-date"
        type="date"
        label={planned ? t("dateLabel") : t("deadlineLabel")}
        leadingIcon="Calendar"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={!planned}
      />
      {!planned && <p className="text-sm font-semibold text-text-secondary">{t("deadlineNotice")}</p>}
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
  );
}

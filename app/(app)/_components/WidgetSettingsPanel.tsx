"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { deleteWidgetTokenAction } from "@/lib/widget/actions";
import type { WidgetTokenItem } from "@/lib/widget/types";
import { DeleteConfirm } from "./DeleteConfirm";
import { WidgetSettings } from "./WidgetSettings";

// design: Claude-designed (#657, #668) — level-2 panel of SettingsPanel around
// WidgetSettings; contract in design/notes/WidgetSettingsPanel.md.

export interface WidgetSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** The member's widget tokens (`listWidgetTokens`), newest first. */
  tokens: readonly WidgetTokenItem[];
  /** Seeds the "shown once" token state (stories only). */
  initialCreatedToken?: string | null;
}

export function WidgetSettingsPanel({ open, onClose, tokens, initialCreatedToken = null }: WidgetSettingsPanelProps) {
  const t = useTranslations("settings.widget");
  const tSidePanel = useTranslations("components.sidePanel");

  // Deleting a token asks first, in the footer slot.
  const [tokenToDelete, setTokenToDelete] = useState<WidgetTokenItem | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setTokenToDelete(null);
  }, [open]);

  function confirmDeleteToken() {
    if (!tokenToDelete) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteWidgetTokenAction({ id: tokenToDelete.id });
      if (!result.success) setDeleteError(t(`errors.${result.error}`));
      setTokenToDelete(null);
    });
  }

  return (
    <SidePanel
      level={2}
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        tokenToDelete ? (
          <DeleteConfirm
            layout="stacked"
            isPending={isDeletePending}
            onCancel={() => setTokenToDelete(null)}
            onConfirm={confirmDeleteToken}
            labels={{
              prompt: t("tokens.deleteConfirm.prompt"),
              cancel: t("tokens.deleteConfirm.cancel"),
              confirm: t("tokens.deleteConfirm.confirm"),
              deleting: t("tokens.deleteConfirm.deleting"),
            }}
          />
        ) : undefined
      }
    >
      <WidgetSettings tokens={tokens} initialCreatedToken={initialCreatedToken} onAskDelete={setTokenToDelete} />
      {deleteError ? <p className="text-base font-semibold text-priority-urgent">{deleteError}</p> : null}
    </SidePanel>
  );
}

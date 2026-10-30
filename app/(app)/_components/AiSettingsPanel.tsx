"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { Checkbox } from "@/components/atoms/Checkbox";
import { setAiEnabled } from "@/lib/profile/actions";
import { DeleteConfirm, useDeleteConfirm } from "./DeleteConfirm";

// design: Claude-designed (#579, #668) — level-2 panel of SettingsPanel from
// Checkbox and text; contract in design/notes/AiSettingsPanel.md.

export interface AiSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Server-resolved `profiles.ai_enabled` (ADR-0043 §2) — seeds the opt-in checkbox. */
  aiEnabled: boolean;
  /** Server-resolved `isEmbeddingConfigured()`; false shows "Nog niet beschikbaar" and disables the checkbox. */
  aiAvailable: boolean;
}

export function AiSettingsPanel({ open, onClose, aiEnabled, aiAvailable }: AiSettingsPanelProps) {
  const t = useTranslations("components.settingsPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("profile.errors");
  const aiHeadingId = useId();

  // The opt-in saves on its own (a consent, not a form field). Turning on is
  // immediate; turning off asks first because it wipes the index (DeleteConfirm
  // idiom, replaces the footer).
  const [pendingAi, setPendingAi] = useState(aiEnabled);
  useEffect(() => {
    setPendingAi(aiEnabled);
  }, [aiEnabled]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiPending, startAiTransition] = useTransition();
  const { confirming, ask, cancel } = useDeleteConfirm();
  useEffect(() => {
    if (!open) cancel();
  }, [open, cancel]);

  function applyAi(enabled: boolean) {
    setAiError(null);
    startAiTransition(async () => {
      const result = await setAiEnabled({ enabled });
      if (result.success) setPendingAi(enabled);
      else setAiError(tErrors(result.error));
      cancel();
    });
  }

  function handleAiToggle() {
    if (!aiAvailable || isAiPending) return;
    if (pendingAi) ask();
    else applyAi(true);
  }

  return (
    <SidePanel
      level={2}
      open={open}
      onClose={onClose}
      title={t("ai.title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        confirming ? (
          <DeleteConfirm
            layout="stacked"
            isPending={isAiPending}
            onCancel={cancel}
            onConfirm={() => applyAi(false)}
            labels={{
              prompt: t("ai.confirmPrompt"),
              cancel: t("ai.cancelLabel"),
              confirm: t("ai.confirmLabel"),
              deleting: t("ai.confirmingLabel"),
            }}
          />
        ) : undefined
      }
    >
      <section className="flex flex-col gap-stack-sm" aria-labelledby={aiHeadingId}>
        <h3 id={aiHeadingId} className="text-base font-semibold text-text-primary">
          {t("ai.title")}
        </h3>
        {aiAvailable ? null : <p className="text-base text-text-secondary">{t("ai.unavailable")}</p>}
        <label className="flex items-center gap-inline-sm text-base text-text-primary">
          <Checkbox
            checked={aiAvailable && pendingAi}
            disabled={!aiAvailable || isAiPending}
            onClick={handleAiToggle}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          />
          {t("ai.checkboxLabel")}
        </label>
        <p className="text-base text-text-secondary">{t("ai.sendsLabel")}</p>
        <p className="text-base text-text-secondary">{t("ai.recipientLabel")}</p>
        <p className="text-base text-text-secondary">{t("ai.offLabel")}</p>
        {aiError ? <p className="text-base font-semibold text-priority-urgent">{aiError}</p> : null}
      </section>
    </SidePanel>
  );
}

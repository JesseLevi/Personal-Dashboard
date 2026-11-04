"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { setAiEnabled, setAssistantPatternsEnabled } from "@/lib/profile/actions";
import { AssistantLogPanel } from "./AssistantLogPanel";
import { DeleteConfirm, useDeleteConfirm } from "./DeleteConfirm";

// design: Claude-designed (#579, #668) — level-2 panel of SettingsPanel from
// Checkbox and text; contract in design/notes/AiSettingsPanel.md.

export interface AiSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Server-resolved `profiles.ai_enabled` (ADR-0043 §2) — seeds the opt-in checkbox. */
  aiEnabled: boolean;
  /** Server-resolved `profiles.assistant_patterns_enabled` (ADR-0060 §1) — seeds the pause checkbox. */
  patternsEnabled: boolean;
  /** Server-resolved `isEmbeddingConfigured()`; false shows "Nog niet beschikbaar" and disables the checkbox. */
  aiAvailable: boolean;
}

export function AiSettingsPanel({ open, onClose, aiEnabled, patternsEnabled, aiAvailable }: AiSettingsPanelProps) {
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
  // The log (level 2 as well, rendered after this panel so it stacks on top) is closed with this panel.
  const [logOpen, setLogOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      cancel();
      setLogOpen(false);
    }
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

  // The pause saves on its own too, subordinate to the opt-in (ADR-0060 §1): turning
  // it off deletes nothing, so there is nothing to confirm.
  const [pendingPatterns, setPendingPatterns] = useState(patternsEnabled);
  useEffect(() => {
    setPendingPatterns(patternsEnabled);
  }, [patternsEnabled]);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const [isPatternsPending, startPatternsTransition] = useTransition();

  function handlePatternsToggle() {
    if (!aiAvailable || !pendingAi || isPatternsPending) return;
    const enabled = !pendingPatterns;
    setPatternsError(null);
    startPatternsTransition(async () => {
      const result = await setAssistantPatternsEnabled({ enabled });
      if (result.success) setPendingPatterns(enabled);
      else setPatternsError(tErrors(result.error));
    });
  }

  function handleAiToggle() {
    if (!aiAvailable || isAiPending) return;
    if (pendingAi) ask();
    else applyAi(true);
  }

  return (
    <>
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
          <label className="flex items-center gap-inline-sm text-base text-text-primary">
            <Checkbox
              checked={aiAvailable && pendingAi && pendingPatterns}
              disabled={!aiAvailable || !pendingAi || isAiPending || isPatternsPending}
              onClick={handlePatternsToggle}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            />
            {t("ai.patternsLabel")}
          </label>
          <p className="text-base text-text-secondary">{t("ai.patternsHelp")}</p>
          {patternsError ? <p className="text-base font-semibold text-priority-urgent">{patternsError}</p> : null}
          <p className="text-base text-text-secondary">{t("ai.sendsLabel")}</p>
          <p className="text-base text-text-secondary">{t("ai.recipientLabel")}</p>
          <p className="text-base text-text-secondary">{t("ai.logHelp")}</p>
          <p className="text-base text-text-secondary">{t("ai.offLabel")}</p>
          {aiError ? <p className="text-base font-semibold text-priority-urgent">{aiError}</p> : null}
          <Button variant="white" align="left" trailingIcon="ArrowRight" onClick={() => setLogOpen(true)}>
            {t("ai.logNavLabel")}
          </Button>
        </section>
      </SidePanel>
    <AssistantLogPanel open={open && logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

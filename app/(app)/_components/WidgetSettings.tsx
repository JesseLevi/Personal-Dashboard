"use client";

import { useId, useState, useTransition, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { Step } from "@/components/atoms/Step";
import { copyToClipboard } from "@/lib/dom/clipboard";
import { createWidgetTokenAction } from "@/lib/widget/actions";
import { SCRIPTABLE_APP_STORE_URL, WIDGET_SCRIPT_PATH, WIDGET_SHORTCUT_URL } from "@/lib/widget/install";
import { WIDGET_LABEL_MAX_LENGTH, WIDGET_TOKEN_LIMIT } from "@/lib/widget/limits";
import type { WidgetTokenItem } from "@/lib/widget/types";

// design: Claude-designed (#657) — body of WidgetSettingsPanel, composed from
// Button, InputField and Step; contract in design/notes/WidgetSettingsPanel.md.

export interface WidgetSettingsProps {
  tokens: readonly WidgetTokenItem[];
  /** Seeds the "shown once" state (stories); at runtime it comes from the create action. */
  initialCreatedToken?: string | null;
  /** Asks the panel to open its delete confirmation for this token. */
  onAskDelete: (token: WidgetTokenItem) => void;
}

const LINK_CLASS = "font-semibold text-text-primary underline";

export function WidgetSettings({ tokens, initialCreatedToken = null, onAskDelete }: WidgetSettingsProps) {
  const t = useTranslations("settings.widget");
  const locale = useLocale();
  const headingId = useId();
  const labelFieldId = useId();
  const createdFieldId = useId();

  const [label, setLabel] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(initialCreatedToken);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [scriptState, setScriptState] = useState<"idle" | "copying" | "copied">("idle");
  const [scriptError, setScriptError] = useState<string | null>(null);

  const limitReached = tokens.length >= WIDGET_TOKEN_LIMIT;
  // Fixed zone: the server render and the browser agree, so there is no hydration mismatch.
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }).format(
      new Date(iso),
    );

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createWidgetTokenAction({ label });
      if (!result.success) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setLabel("");
      setTokenCopied(false);
      setCreatedToken(result.data.token);
    });
  }

  async function handleCopyToken() {
    if (!createdToken) return;
    setError(null);
    try {
      await copyToClipboard(createdToken);
      setTokenCopied(true);
    } catch {
      setError(t("created.copyFailed"));
    }
  }

  async function handleCopyScript() {
    setScriptError(null);
    setScriptState("copying");
    const script = fetch(WIDGET_SCRIPT_PATH).then((response) => {
      if (!response.ok) throw new Error(`script ${response.status}`);
      return response.text();
    });
    try {
      await copyToClipboard(script);
      setScriptState("copied");
    } catch {
      setScriptState("idle");
      setScriptError(t("errors.scriptUnavailable"));
    }
  }

  return (
    <section className="flex flex-col gap-stack-md" aria-labelledby={headingId}>
      <div className="flex flex-col gap-stack-xs">
        <h3 id={headingId} className="text-base font-semibold text-text-primary">
          {t("title")}
        </h3>
        <p className="text-base text-text-secondary">{t("intro")}</p>
      </div>

      <div className="flex flex-col gap-stack-sm">
        <h4 className="text-base font-semibold text-text-primary">{t("tokens.title")}</h4>
        {tokens.length === 0 ? (
          <p className="text-base text-text-secondary">{t("tokens.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-stack-sm">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between gap-inline-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-semibold text-text-primary">{token.label}</span>
                  <span className="text-sm text-text-secondary">
                    {t("tokens.createdOn", { date: formatDate(token.createdAt) })}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {t("tokens.lastUsed", {
                      date: token.lastUsedAt ? formatDate(token.lastUsedAt) : t("tokens.never"),
                    })}
                  </span>
                </div>
                <Button
                  variant="transparent"
                  size="compact"
                  icon="Trash"
                  aria-label={t("tokens.deleteLabel", { label: token.label })}
                  onClick={() => onAskDelete(token)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {createdToken ? (
        <div className="flex flex-col gap-stack-sm">
          <p className="text-base font-semibold text-text-primary">{t("created.title")}</p>
          <p className="text-base font-semibold text-priority-urgent">{t("created.warning")}</p>
          <InputField id={createdFieldId} aria-label={t("created.title")} readOnly value={createdToken} />
          <div className="flex gap-inline-sm">
            <Button variant="filled" icon={tokenCopied ? "Check" : "Copy"} onClick={handleCopyToken}>
              {tokenCopied ? t("created.copied") : t("created.copy")}
            </Button>
            <Button variant="outline" onClick={() => setCreatedToken(null)}>
              {t("created.done")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-stack-sm">
          <InputField
            label={t("tokens.labelField")}
            id={labelFieldId}
            type="text"
            maxLength={WIDGET_LABEL_MAX_LENGTH}
            placeholder={t("tokens.labelPlaceholder")}
            value={label}
            disabled={limitReached}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setLabel(event.target.value)}
          />
          <Button
            variant="filled"
            icon="Plus"
            onClick={handleCreate}
            disabled={limitReached || isPending || label.trim() === ""}
          >
            {isPending ? t("tokens.creating") : t("tokens.create")}
          </Button>
          {limitReached ? <p className="text-base text-text-secondary">{t("tokens.limitReached")}</p> : null}
        </div>
      )}
      {error ? <p className="text-base font-semibold text-priority-urgent">{error}</p> : null}

      <div className="flex flex-col gap-stack-sm">
        <h4 className="text-base font-semibold text-text-primary">{t("install.title")}</h4>
        <ol className="flex flex-col gap-stack-md">
          <li className="flex gap-inline-sm">
            <Step>1</Step>
            <div className="flex min-w-0 flex-col gap-stack-xs">
              <p className="text-base font-semibold text-text-primary">{t("install.step1.title")}</p>
              <p className="text-base text-text-secondary">{t("install.step1.body")}</p>
              <a href={SCRIPTABLE_APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {t("install.step1.link")}
              </a>
            </div>
          </li>
          <li className="flex gap-inline-sm">
            <Step>2</Step>
            <div className="flex min-w-0 flex-col gap-stack-xs">
              <p className="text-base font-semibold text-text-primary">{t("install.step2.title")}</p>
              <p className="text-base text-text-secondary">{t("install.step2.body")}</p>
              {WIDGET_SHORTCUT_URL ? (
                <a href={WIDGET_SHORTCUT_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {t("install.step2.link")}
                </a>
              ) : (
                <>
                  <p className="text-base text-text-secondary">{t("install.step2.manual")}</p>
                  <ol className="list-decimal pl-component-md text-base text-text-secondary">
                    <li>{t("install.step2.manualIf")}</li>
                    <li>{t("install.step2.manualThen")}</li>
                    <li>{t("install.step2.manualElse")}</li>
                  </ol>
                </>
              )}
            </div>
          </li>
          <li className="flex gap-inline-sm">
            <Step>3</Step>
            <div className="flex min-w-0 flex-col gap-stack-xs">
              <p className="text-base font-semibold text-text-primary">{t("install.step3.title")}</p>
              <p className="text-base text-text-secondary">{t("install.step3.body")}</p>
              <div>
                <Button
                  variant="outline"
                  icon={scriptState === "copied" ? "Check" : "Copy"}
                  onClick={handleCopyScript}
                  disabled={scriptState === "copying"}
                >
                  {scriptState === "copying"
                    ? t("install.step3.copying")
                    : scriptState === "copied"
                      ? t("install.step3.copied")
                      : t("install.step3.copy")}
                </Button>
              </div>
              {scriptError ? <p className="text-base font-semibold text-priority-urgent">{scriptError}</p> : null}
            </div>
          </li>
        </ol>
        <p className="text-base text-text-secondary">{t("install.safari")}</p>
      </div>
    </section>
  );
}

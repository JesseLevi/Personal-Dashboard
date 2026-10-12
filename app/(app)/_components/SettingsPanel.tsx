"use client";

import { useEffect, useId, useState, useTransition, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { SidePanel } from "@/components/organisms/SidePanel";
import { ButtonToggle, type ButtonToggleItem } from "@/components/molecules/ButtonToggle";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { ImageUploadField } from "@/components/molecules/ImageUploadField";
import { removeAvatar, updateLocale, updateName, uploadAvatar } from "@/lib/profile/actions";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile/schemas";
import type { Locale } from "@/lib/profile/types";

// design: Claude-designed on request (#398, #404) — the Voornaam + Achternaam
// fields only (the two bottom inputs).
// #265 — Figma "Add recipi/Desktop" frame (misleadingly named; the actual
// content is `4160:33196` desktop drawer / `4160:34064` mobile pull-up
// panel, both reusing SidePanel per the ticket brief). Page-level
// composition of existing atoms/molecules/organisms, same non-mapped-
// component precedent as BoardPanel.tsx/CardDetailPanel.tsx (not added to
// design/figma-map.json). Full reasoning: design/notes/SettingsPanel.md.

const THEME_ICONS: Record<"system" | "light" | "dark", IconName> = {
  system: "SunMoon",
  light: "Sun",
  dark: "Moon",
};

// Figma's Taal field uses the literal flag icons (Icon/NL, Icon/UK) as the
// leading icon per locale — not a generic globe glyph — matching the
// fetched Input-field instance exactly (Content: "Nederlands", Leading-icon:
// Icon/NL). "en" pairs with UK per Figma's own choice (the file has no US
// flag), not a codebase substitution.
const LOCALE_FLAGS: Record<Locale, IconName> = {
  nl: "NL",
  en: "UK",
};

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Server-resolved current locale (`lib/profile/queries.ts#getProfileForNav`) — seeds the Taal field's initial selection. */
  currentLocale: Locale;
  /** Server-resolved `profiles.display_name` (#398; the FIRST name since #404) — seeds the Voornaam field. */
  currentDisplayName: string | null;
  /** Server-resolved `profiles.last_name` (#404, `getLastName`) — seeds the Achternaam field. */
  currentLastName: string | null;
  /** #434: whether the user has a profile photo (seeds the filled state of the photo field). */
  hasAvatar: boolean;
}

export function SettingsPanel({
  open,
  onClose,
  currentLocale,
  currentDisplayName,
  currentLastName,
  hasAvatar,
}: SettingsPanelProps) {
  const t = useTranslations("components.settingsPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("profile.errors");
  const languageFieldId = useId();
  const firstNameFieldId = useId();
  const lastNameFieldId = useId();

  const { theme, setTheme } = useTheme();
  const themeItems: readonly ButtonToggleItem[] = (
    ["system", "light", "dark"] as const
  ).map((value) => ({
    value,
    icon: THEME_ICONS[value],
    label: t(`themeOptions.${value}`),
  }));

  // next-themes' `theme` is `undefined` until the client mounts (avoids a
  // hydration mismatch, per its own docs), but `ButtonToggle` is
  // deliberately UNcontrolled (`defaultValue` only, matching the old atom's
  // own precedent) — SidePanel keeps this whole tree mounted-but-inert
  // while closed, so ButtonToggle mounts (and freezes its own initial
  // selection) immediately at page load, before `theme` has resolved.
  // `themeReady` flips exactly once, the first time a real value arrives,
  // and keys a single, one-time ButtonToggle remount so its `defaultValue`
  // picks up the real value — never on every click afterward, which would
  // otherwise remount (and un-animate) the indicator on each selection.
  // Invisible in practice: the panel is closed while this resolves.
  const [pendingTheme, setPendingTheme] = useState<"system" | "light" | "dark">("system");
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    if (themeReady || !theme) return;
    setPendingTheme(theme as "system" | "light" | "dark");
    setThemeReady(true);
  }, [theme, themeReady]);

  const [pendingLocale, setPendingLocale] = useState<Locale>(currentLocale);
  // Re-syncs whenever the server-resolved value actually changes — this
  // component never unmounts on a same-layout navigation (Next.js keeps a
  // shared layout instance across route changes), and `updateLocale`
  // itself triggers exactly that: a `revalidatePath("/", "layout")` after
  // a successful save re-renders `AppLayout` with the new value, so without
  // this effect a reopened panel would show the pre-save `pendingLocale`
  // forever. Safe to fire on the save path too — by then `pendingLocale`
  // already equals the incoming value, so it's a same-value no-op.
  useEffect(() => {
    setPendingLocale(currentLocale);
  }, [currentLocale]);

  // #398/#404: same re-sync-on-prop-change reasoning as pendingLocale above.
  const [pendingFirstName, setPendingFirstName] = useState(currentDisplayName ?? "");
  useEffect(() => {
    setPendingFirstName(currentDisplayName ?? "");
  }, [currentDisplayName]);
  const [pendingLastName, setPendingLastName] = useState(currentLastName ?? "");
  useEffect(() => {
    setPendingLastName(currentLastName ?? "");
  }, [currentLastName]);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // #434: the photo saves on its own (an upload is too heavy to hold back
  // for Opslaan); the action's layout revalidation refreshes both avatars.
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();

  function handleAvatarFile(file: File | null) {
    setAvatarError(null);
    if (!file) return;
    startAvatarTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadAvatar(formData);
      if (!result.success) setAvatarError(tErrors(result.error));
    });
  }

  function handleAvatarClear() {
    setAvatarError(null);
    startAvatarTransition(async () => {
      const result = await removeAvatar();
      if (!result.success) setAvatarError(tErrors(result.error));
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      // Locale is the part that can actually fail (a real server call) —
      // committed first, and the theme (a pure client-side/localStorage
      // write that can't fail) is only applied once it succeeds. Never
      // render success unconditionally (#233's AnimatedAddToBasketButton
      // lesson, docs/HANDOFF.md) — a failed save keeps the panel open with
      // a visible error and leaves the previously-active theme untouched.
      const result = await updateLocale({ locale: pendingLocale });
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      // #398/#404: one write for both names, skipped when neither changed
      // (compared trimmed, matching the schema). Any failure keeps the panel
      // open.
      if (
        pendingFirstName.trim() !== (currentDisplayName ?? "") ||
        pendingLastName.trim() !== (currentLastName ?? "")
      ) {
        const nameResult = await updateName({
          firstName: pendingFirstName,
          lastName: pendingLastName,
        });
        if (!nameResult.success) {
          setError(tErrors(nameResult.error));
          return;
        }
      }
      setTheme(pendingTheme);
      onClose();
    });
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={tSidePanel("closeLabel")}
      footer={
        // Single full-width Opslaan on both breakpoints (#265 decision —
        // the mobile node's second "Verwijderen" button is unbuilt residue,
        // see design/notes/SettingsPanel.md and
        // docs/open-questions.md#settings-mobile-delete-button-not-built).
        // No `grow basis-0` here: unlike BoardPanel.tsx/CardDetailPanel.tsx,
        // this Button is a direct child of SidePanel's column footer, not
        // nested in its own `flex gap-inline-sm` row — `grow`/`basis-0` on a
        // flex-col's direct child act on the vertical axis (SidePanel.tsx's
        // own footer comment says it plainly: "a lone button already fills
        // 100% for free"), which collapsed this button to 24px tall instead
        // of Figma's 40px. See design/notes/SettingsPanel.md.
        <Button
          variant="filled"
          icon="Save"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      }
    >
      <ImageUploadField
        id="settings-avatar"
        name="avatar"
        placeholder={t("avatar.placeholder")}
        ariaLabel={t("avatar.inputLabel")}
        disabled={isAvatarPending}
        selectedFileName={hasAvatar ? t("avatar.inputLabel") : null}
        onFileSelect={handleAvatarFile}
        onClear={handleAvatarClear}
        clearLabel={t("avatar.remove")}
      />
      {avatarError ? (
        <p className="text-base font-semibold text-priority-urgent">{avatarError}</p>
      ) : null}
      <ButtonToggle
        key={themeReady ? "theme-ready" : "theme-loading"}
        title={t("themeLabel")}
        items={themeItems}
        defaultValue={pendingTheme}
        onValueChange={(value) => setPendingTheme(value as "system" | "light" | "dark")}
      />
      <InputField
        label={t("languageLabel")}
        id={languageFieldId}
        leadingIcon={LOCALE_FLAGS[pendingLocale]}
        trailingIcon="ChevronDown"
        options={[
          { value: "nl", label: t("languageOptions.nl") },
          { value: "en", label: t("languageOptions.en") },
        ]}
        value={pendingLocale}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          setPendingLocale(event.target.value as Locale)
        }
      />
      <InputField
        label={t("firstNameLabel")}
        id={firstNameFieldId}
        type="text"
        autoComplete="given-name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={pendingFirstName}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setPendingFirstName(event.target.value)}
      />
      <InputField
        label={t("lastNameLabel")}
        id={lastNameFieldId}
        type="text"
        autoComplete="family-name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={pendingLastName}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setPendingLastName(event.target.value)}
      />
      {error ? (
        <p className="text-base font-semibold text-priority-urgent">{error}</p>
      ) : null}
    </SidePanel>
  );
}

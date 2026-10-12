"use client";

import { useRef, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/atoms/Avatar";
import { Button } from "@/components/atoms/Button";

// Claude-designed (#434, no Figma): profile photo row at the top of
// SettingsPanel, composed from Avatar + Button only. Presentational: the
// panel owns the server actions (so a story can render this without them).
// Contract: design/notes/SettingsPanel.md.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export interface SettingsAvatarFieldProps {
  /** Name for the letter fallback (the first name). */
  name: string;
  /** Same-origin photo URL, null when the user has none. */
  src: string | null;
  /** True while an upload or removal is running. */
  pending: boolean;
  /** Already-translated error, shown under the row. */
  error?: string | null;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
}

export function SettingsAvatarField({
  name,
  src,
  pending,
  error,
  onSelectFile,
  onRemove,
}: SettingsAvatarFieldProps) {
  const t = useTranslations("components.settingsPanel.avatar");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    event.target.value = "";
    if (file) onSelectFile(file);
  }

  return (
    <div className="flex flex-col gap-inline-sm">
      <div className="flex flex-wrap items-center gap-inline-sm">
        <Avatar name={name} src={src} size="md" />
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          aria-label={t("inputLabel")}
          tabIndex={-1}
          className="sr-only"
          onChange={handleChange}
        />
        <Button
          variant="outline"
          icon="Image"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? t("busy") : src ? t("change") : t("choose")}
        </Button>
        {src ? (
          <Button variant="transparent" icon="Trash" disabled={pending} onClick={onRemove}>
            {t("remove")}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-base font-semibold text-priority-urgent">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { importUrlSchema } from "@/lib/recipes/import/url";
import type { ActionResult } from "@/lib/recipes/types";

// "Via link" SidePanel (desktop side panel / mobile pull-up) — Figma "Add
// recipi dropdown 02/Desktop" 4164:23722 (+ Mobile 4164:23777): one `Link`
// Input-field and a filled "Opslaan" Button (Icon/Save) in the footer. Same
// reset-on-open pattern as CategoryPanel.tsx. The real action is a prop so
// Ladle can mock it. Closes as soon as the import row exists (the action
// only inserts it); the pipeline runs after the response. Notes:
// design/notes/LinkImportPanel.md.
export interface LinkImportPanelProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  onStartImport: (categoryId: string, url: string) => Promise<ActionResult<{ recipeId: string }>>;
  /** Fired after the import row was created, before `onClose`. */
  onStarted?: () => void;
}

export function LinkImportPanel({ open, onClose, categoryId, onStartImport, onStarted }: LinkImportPanelProps) {
  const t = useTranslations("components.recipeImport.linkPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("recipes.errors");

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setUrl("");
      setError(null);
    }
  }

  function handleSave() {
    const parsed = importUrlSchema.safeParse(url);
    if (!parsed.success) {
      setError(t("invalidUrl"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onStartImport(categoryId, parsed.data);
      if (!result.success) {
        setError(tErrors(result.error));
        return;
      }
      onStarted?.();
      onClose();
    });
  }

  const footer = (
    <Button variant="filled" icon="Save" onClick={handleSave} disabled={isPending || url.trim() === ""}>
      {isPending ? t("savingLabel") : t("saveLabel")}
    </Button>
  );

  return (
    <SidePanel open={open} onClose={onClose} title={t("title")} closeLabel={tSidePanel("closeLabel")} footer={footer}>
      <InputField
        label={t("linkLabel")}
        id="link-import-panel-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder={t("linkPlaceholder")}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleSave();
        }}
        aria-invalid={error !== null}
        aria-describedby={error ? "link-import-panel-error" : undefined}
        required
      />
      {error && (
        <p id="link-import-panel-error" role="alert" className="text-base font-semibold text-priority-urgent">
          {error}
        </p>
      )}
    </SidePanel>
  );
}

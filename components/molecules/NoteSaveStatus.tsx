// design: Claude-designed on request (#334). Record: design/notes/NoteEditor.md
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import type { SaveStatus } from "@/lib/notes/save-controller";

export interface NoteSaveStatusProps {
  status: SaveStatus;
  onRetry: () => void;
  onReload: () => void;
}

export function NoteSaveStatus({ status, onRetry, onReload }: NoteSaveStatusProps) {
  const t = useTranslations("components.noteSaveStatus");
  if (status === "conflict") {
    return (
      <div role="status" className="flex items-center gap-inline-sm">
        <p className="text-sm font-semibold text-text-secondary">{t("conflict")}</p>
        <Button variant="destructive" onClick={onReload}>
          {t("reload")}
        </Button>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div role="status">
        <Button variant="destructive" onClick={onRetry}>
          {t("error")}
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="text-sm font-semibold text-text-secondary">
      {status === "saving" ? t("saving") : t("saved")}
    </p>
  );
}

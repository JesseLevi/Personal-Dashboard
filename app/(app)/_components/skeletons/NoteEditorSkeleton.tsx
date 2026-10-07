import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { LoadingStatus } from "./skeleton-parts";

/**
 * Loading state for the note editor: only the editor's own back button.
 * No Figma loading frame exists for this page, so nothing below it is
 * invented — docs/open-questions.md#note-editor-skeleton-undesigned.
 */
export function NoteEditorSkeleton() {
  const t = useTranslations("components.noteEditor");
  return (
    <>
      <LoadingStatus />
      <div aria-hidden="true" inert className="flex w-full items-center justify-between pr-page-right-equal">
        <Button icon="ArrowLeft" aria-label={t("backLabel")} />
      </div>
    </>
  );
}

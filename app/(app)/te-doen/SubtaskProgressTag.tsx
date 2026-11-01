"use client";

import { useTranslations } from "next-intl";
import { Tag } from "@/components/atoms/Tag";

// design: Claude-designed (#694)
// The "3/7" chip on a board card (ADR-0053); contract: design/notes/TeDoenBoard.md.
export function SubtaskProgressTag({ done, total }: { done: number; total: number }) {
  const t = useTranslations("boards");
  return (
    <Tag variant="neutral" icon="ListTodo">
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <span className="sr-only">{t("subtaskProgress", { done, total })}</span>
    </Tag>
  );
}

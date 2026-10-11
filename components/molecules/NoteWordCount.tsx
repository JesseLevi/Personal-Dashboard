// design: Claude-designed on request (#334). Record: design/notes/NoteEditor.md
import { useTranslations } from "next-intl";

export interface NoteWordCountProps {
  words: number;
  minutes: number;
}

export function NoteWordCount({ words, minutes }: NoteWordCountProps) {
  const t = useTranslations("components.noteWordCount");
  return (
    <p className="text-xs font-semibold text-text-secondary">
      {t("words", { count: words })} · {t("readingTime", { count: minutes })}
    </p>
  );
}

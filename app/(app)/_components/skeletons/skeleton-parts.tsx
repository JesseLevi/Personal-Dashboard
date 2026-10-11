import { useTranslations } from "next-intl";

// Shared by every loading skeleton (design/notes/Skeletons.md). The visual
// skeleton is `aria-hidden` + `inert`; this is the single accessible
// announcement that replaces it for assistive tech.
export function LoadingStatus() {
  const t = useTranslations("common");
  return (
    <span role="status" className="sr-only">
      {t("loading")}
    </span>
  );
}

// The slow opacity "breathe" (`--animate-breathe`, app/globals.css) for the
// placeholder surfaces only — never the static chrome (title, buttons).
export const SKELETON_BREATHE = "animate-breathe motion-reduce:animate-none";

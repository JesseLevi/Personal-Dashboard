// design: Claude-designed, no Figma. Composition of Button and the login page's text styles;
// record in design/notes/LoginForm.md (magic-link confirm screen).
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";

export interface ConfirmFormProps {
  /** Already masked by the server page; null when the link is opened without the login cookie. */
  maskedEmail: string | null;
  tokenHash: string;
  type: string;
  confirmAction: (formData: FormData) => void | Promise<void>;
}

export function ConfirmForm({ maskedEmail, tokenHash, type, confirmAction }: ConfirmFormProps) {
  const t = useTranslations("auth.confirm");
  return (
    <div className="flex w-[312px] flex-col items-center">
      <h1 className="text-center text-xl font-semibold text-text-primary">
        {maskedEmail ? t("titleKnown", { email: maskedEmail }) : t("titleUnknown")}
      </h1>
      <p className="mt-stack-sm text-center text-base font-semibold text-text-secondary">
        {maskedEmail ? t("descriptionKnown") : t("descriptionUnknown")}
      </p>

      <form action={confirmAction} className="mt-stack-xl w-full">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit" className="w-full">
          {t("submit")}
        </Button>
      </form>

      <Link href="/login" prefetch={false} className="mt-stack-sm w-full">
        <Button presentational variant="transparent" icon="ArrowLeft" className="w-full">
          {t("back")}
        </Button>
      </Link>
    </div>
  );
}

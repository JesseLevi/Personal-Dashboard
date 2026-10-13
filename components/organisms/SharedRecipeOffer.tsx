// design: Claude-designed (#467)
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";

/**
 * Organism/SharedRecipeOffer — a recipe offered by someone else (ADR-0036): the
 * normal recipe `Card` flush at the top of a tag-blue block (the `Tag` "medium" tokens), with a thin strip below
 * ("Gedeeld door {name}", accept and decline). Knows nothing about server
 * actions; the caller does the accepting and declining.
 * See design/notes/SharedRecipeOffer.md.
 */
export interface SharedRecipeOfferProps {
  name: string;
  imageUrl?: string;
  /** Already-formatted duration, as `CardContentRecipe` takes it. */
  duration?: string;
  /** First name of the sender, resolved by the caller (with its "unnamed" fallback). */
  inviterName: string;
  onAccept: () => void;
  onDecline: () => void;
  /** A request is running: both buttons are disabled. */
  pending?: boolean;
}

export function SharedRecipeOffer({
  name,
  imageUrl,
  duration,
  inviterName,
  onAccept,
  onDecline,
  pending = false,
}: SharedRecipeOfferProps) {
  const t = useTranslations("sharing.recipeOffer");
  return (
    <div className="flex w-full flex-col rounded-card bg-priority-medium-bg">
      <Card>
        <CardContentRecipe name={name} imageUrl={imageUrl} duration={duration} />
      </Card>
      <div className="flex items-center gap-inline-sm px-component-md py-component-sm">
        <p className="text-base font-semibold text-priority-medium">{t("sharedBy", { name: inviterName })}</p>
        <div className="ml-auto flex items-center gap-inline-sm">
          <Button variant="white" size="compact" icon="Check" aria-label={t("acceptLabel")} onClick={onAccept} disabled={pending} />
          <Button variant="white" size="compact" icon="X" aria-label={t("declineLabel")} onClick={onDecline} disabled={pending} />
        </div>
      </div>
    </div>
  );
}

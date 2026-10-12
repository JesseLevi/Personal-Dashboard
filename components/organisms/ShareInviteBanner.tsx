// design: Claude-designed (#427) from Figma "Winkelmand/08" (4233:17679)
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";

/**
 * Organism/ShareInviteBanner — an untitled `Card` holding a
 * `CardContentTicket`: the invitation sentence and the Accepteren / Afwijzen
 * buttons. Knows nothing about baskets; the caller does the accepting and
 * declining. See design/notes/ShareInviteBanner.md.
 */
export interface ShareInviteBannerProps {
  /** Full name of the person who invites. */
  inviterName: string;
  onAccept: () => void;
  onDecline: () => void;
  /** A request is running: both buttons are disabled. */
  pending?: boolean;
}

export function ShareInviteBanner({ inviterName, onAccept, onDecline, pending = false }: ShareInviteBannerProps) {
  const t = useTranslations("sharing.invite");
  return (
    <Card>
      <CardContentTicket title={t("message", { name: inviterName })}>
        <Button icon="Check" onClick={onAccept} disabled={pending}>
          {t("acceptLabel")}
        </Button>
        <Button icon="X" onClick={onDecline} disabled={pending}>
          {t("declineLabel")}
        </Button>
      </CardContentTicket>
    </Card>
  );
}

// figma: node-id=3670:1696
import { CardContentTicket } from "./CardContentTicket";
import { Tag } from "../atoms/Tag";
import { Card } from "./Card";

export const Default = () => (
  <div className="w-96">
    <CardContentTicket title="HBO Wachtwoord updaten">
      <Tag variant="medium">Medium</Tag>
      <Tag variant="neutral">S</Tag>
    </CardContentTicket>
  </div>
);

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type").
export const InCard = () => (
  <Card>
    <CardContentTicket title="HBO Wachtwoord updaten">
      <Tag variant="medium">Medium</Tag>
      <Tag variant="neutral">S</Tag>
    </CardContentTicket>
  </Card>
);

// SLOT is `wrap: true` — demonstrates pills wrapping onto a second line in a narrow card.
export const ManyLabels = () => (
  <div className="w-72">
    <CardContentTicket title="Zorgverzekering vergelijken en overstappen">
      <Tag variant="urgent">Urgent</Tag>
      <Tag variant="neutral">M</Tag>
      <Tag variant="neutral">Verzekering</Tag>
      <Tag variant="neutral">Financieel</Tag>
    </CardContentTicket>
  </div>
);

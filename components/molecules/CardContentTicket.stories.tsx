// figma: node-id=3670:1696
import { CardContentTicket } from "./CardContentTicket";
import { Tag } from "../atoms/Tag";
import { Card } from "./Card";

// Dev-only demo copy ("HBO Wachtwoord updaten", "Medium", "S") — not
// user-facing UI chrome, same convention as CardContentRecipe.stories.tsx's
// "Amandel Pasta" placeholder. Real ticket data comes from the database at
// the call site.
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

// The SLOT is `wrap: true` in the fetched node — demonstrates more than two
// Tag pills wrapping onto a second line inside a narrow card, which the
// single-sample Figma frame doesn't itself show but the layout supports.
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

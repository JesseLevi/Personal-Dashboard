// design: Claude-designed on request (#318)
import { CardContentRecipeFailed } from "./CardContentRecipeFailed";
import { Card } from "./Card";
import nl from "../../messages/nl.json";

const t = nl.components.recipeImport.failed;
const reasons = nl.recipes.import.errors;

const Failed = ({ reason, name }: { reason: string; name: string }) => (
  <div className="w-72.5">
    <Card>
      <CardContentRecipeFailed
        title={t.title}
        name={name}
        reason={reason}
        retryLabel={t.retryLabel}
        deleteLabel={t.deleteLabel}
        onRetry={() => {}}
        onDelete={() => {}}
      />
    </Card>
  </div>
);

export const Timeout = () => <Failed name="leukerecepten.nl" reason={reasons.timeout} />;

// Longest reason and a long host: the copy wraps, the buttons wrap instead of overflowing.
export const LongTexts = () => (
  <Failed name="www.een-heel-lange-receptensite-naam.example.com" reason={reasons.ai_unavailable} />
);

export const Busy = () => (
  <div className="w-72.5">
    <Card>
      <CardContentRecipeFailed
        title={t.title}
        name="leukerecepten.nl"
        reason={reasons.no_recipe_found}
        retryLabel={t.retryLabel}
        deleteLabel={t.deleteLabel}
        onRetry={() => {}}
        onDelete={() => {}}
        disabled
      />
    </Card>
  </div>
);

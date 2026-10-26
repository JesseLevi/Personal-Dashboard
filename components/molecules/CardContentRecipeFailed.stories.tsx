// design: Claude-designed on request (#318)
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { CardContentRecipeFailed } from "./CardContentRecipeFailed";
import { Card } from "./Card";
import nl from "../../messages/nl.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card content recipe failed" } satisfies StoryDefault;

const t = nl.components.recipeImport.failed;
const reasons = nl.recipes.import.errors;

const Failed = ({ reason, name, disabled }: { reason: string; name: string; disabled?: boolean }) => (
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
        disabled={disabled}
      />
    </Card>
  </div>
);

export const Overview = () => (
  <>
    <StoryIntro what="A recipe import that failed: the reason, with retry and delete." note="CardContentRecipeFailed" />
    <Specimens>
      <Specimen label="default" hint="reason: timeout">
        <Failed name="leukerecepten.nl" reason={reasons.timeout} />
      </Specimen>
      <Specimen label="disabled" hint="busy while a retry or delete runs">
        <Failed name="leukerecepten.nl" reason={reasons.no_recipe_found} disabled />
      </Specimen>
    </Specimens>
  </>
);

// Longest reason and a long host: the copy wraps, the buttons wrap instead of overflowing.
export const LongText = () => (
  <Failed name="www.een-heel-lange-receptensite-naam.example.com" reason={reasons.ai_unavailable} />
);

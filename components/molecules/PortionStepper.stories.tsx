// figma: node-id=3953:9750 (mobile) / 3778:5596 (desktop)
import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { PortionStepper } from "./PortionStepper";
import en from "../../messages/en.json";

export default { title: "Basis / Invoer / Portion stepper" } satisfies StoryDefault;

// Resolves the real ICU catalog entries via next-intl's own engine (Ladle's
// global Provider in .ladle/components.tsx already supplies locale "nl") so
// this story can never hand-duplicate — and drift from — messages/*.json's
// pluralisation rule.
function ControlledPortionStepper({ initialPortions }: { initialPortions: number }) {
  const t = useTranslations("components.portionStepper");
  const [portions, setPortions] = useState(initialPortions);
  return (
    <PortionStepper
      portions={portions}
      label={t("count", { count: portions })}
      decrementLabel={t("decrementLabel")}
      incrementLabel={t("incrementLabel")}
      onChange={setPortions}
    />
  );
}

// `items-start` on wrappers: the stepper is `inline-flex` and hugs its content; stretching it is a Ladle artifact.
export const Overview = () => (
  <>
    <StoryIntro what="A minus/plus stepper for the number of portions; the label is pluralised by the ICU catalog." note="PortionStepper" />
    <Specimens>
      {[1, 2, 6, 12].map((portions) => (
        <Specimen key={portions} label={`${portions}`} hint={portions === 1 ? "singular form, decrement disabled" : undefined}>
          <ControlledPortionStepper initialPortions={portions} />
        </Specimen>
      ))}
    </Specimens>
  </>
);

type PlaygroundProps = {
  portions: number;
  min: number;
};

export const Playground: Story<PlaygroundProps> = ({ portions, min }) => {
  const t = useTranslations("components.portionStepper");
  return (
    <PortionStepper
      portions={portions}
      min={min}
      label={t("count", { count: portions })}
      decrementLabel={t("decrementLabel")}
      incrementLabel={t("incrementLabel")}
    />
  );
};

Playground.args = {
  portions: 6,
  min: 1,
};

Playground.argTypes = {
  portions: { control: { type: "number", min: 1, max: 20, step: 1 } },
  min: { control: { type: "number", min: 0, max: 10, step: 1 } },
};

// Press minus and plus: the count changes and the decrement stops at `min`.
export const Interactive = () => <ControlledPortionStepper initialPortions={6} />;

// English catalog check, incl. the same 1-vs-plural edge case ("1 person" vs
// "N people"); nests its own provider since Ladle's global one is locale "nl".
export const English = () => (
  <NextIntlClientProvider locale="en" messages={en}>
    <div className="flex flex-col items-start gap-stack-md">
      {[1, 2, 6].map((portions) => (
        <ControlledPortionStepper key={portions} initialPortions={portions} />
      ))}
    </div>
  </NextIntlClientProvider>
);

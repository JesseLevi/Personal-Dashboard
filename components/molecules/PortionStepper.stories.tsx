// figma: node-id=3953:9750 (mobile) / 3778:5596 (desktop)
import type { Story } from "@ladle/react";
import { useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { PortionStepper } from "./PortionStepper";
import en from "../../messages/en.json";

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

type PlaygroundProps = {
  portions: number;
};

export const Playground: Story<PlaygroundProps> = ({ portions }) => (
  <ControlledPortionStepper initialPortions={portions} />
);

Playground.args = {
  portions: 6,
};

Playground.argTypes = {
  portions: { control: { type: "number", min: 1, max: 20, step: 1 } },
};

// Both fetched nodes (3953:9750 mobile / 3778:5596 desktop) are pixel-identical
// hug-sized rows — the two breakpoints differ only in surrounding viewport, not
// in the component itself, so this pairs the same instance in two width contexts.
export const Breakpoints = () => (
  <div className="flex flex-col gap-8">
    <div className="flex w-[375px] flex-col gap-2">
      <p className="text-sm font-semibold text-text-muted">Mobile (375px)</p>
      <ControlledPortionStepper initialPortions={6} />
    </div>
    <div className="flex w-[1024px] max-w-full flex-col gap-2">
      <p className="text-sm font-semibold text-text-muted">Desktop</p>
      <ControlledPortionStepper initialPortions={6} />
    </div>
  </div>
);

// Representative portion values, incl. the 1-vs-plural edge case — every value
// below routes through the real ICU `count` message, not a hand-picked string.
export const RepresentativeValues = () => (
  <div className="flex flex-col gap-4">
    {[1, 2, 6, 12].map((portions) => (
      <ControlledPortionStepper key={portions} initialPortions={portions} />
    ))}
  </div>
);

// English catalog check, incl. the same 1-vs-plural edge case ("1 person" vs
// "N people") — nests its own NextIntlClientProvider since Ladle's global one
// (.ladle/components.tsx) is fixed to locale "nl".
export const EnglishCatalog = () => (
  <NextIntlClientProvider locale="en" messages={en}>
    <div className="flex flex-col gap-4">
      {[1, 2, 6].map((portions) => (
        <ControlledPortionStepper key={portions} initialPortions={portions} />
      ))}
    </div>
  </NextIntlClientProvider>
);

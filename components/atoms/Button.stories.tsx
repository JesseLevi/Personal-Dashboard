// figma: node-id=3623:4346
import { Fragment } from "react";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { ALL_ICON_NAMES, type IconName } from "./Icon";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Button" } satisfies StoryDefault;

// Dev-only demo copy — not user-facing (component text always comes from
// `children` at call sites).

type Variant = NonNullable<ButtonProps["variant"]>;

const VARIANTS: { variant: Variant; label: string }[] = [
  { variant: "filled", label: "Filled" },
  { variant: "white", label: "White" },
  { variant: "transparent", label: "Transparent" },
  { variant: "outline", label: "Outline" },
  { variant: "destructive", label: "Distructive" },
];

// Full Style x State matrix (Default / Hover / Active / Selected). Hover and
// Active are labelled columns, not faked with a class, since the point is to
// prove the real CSS works. Last column is load-bearing: a selected button
// must still react to hover/active — hover and hold the Outline row to check
// it (see docs/design-tokens.md and design/notes/Button.md for why Outline
// needs the aria-pressed compound variants).
export const StateMatrix = () => (
  <div className="grid grid-cols-[112px_repeat(3,auto)] items-center gap-x-6 gap-y-3">
    <span />
    <span className="text-sm font-semibold text-text-secondary">Default</span>
    <span className="text-sm font-semibold text-text-secondary">
      Hover / Active (hover and hold)
    </span>
    <span className="text-sm font-semibold text-text-secondary">
      Selected (+ hover / hold)
    </span>
    {VARIANTS.map(({ variant, label }) => (
      <Fragment key={variant}>
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <Button variant={variant}>Categorie</Button>
        <Button variant={variant}>Categorie</Button>
        <Button variant={variant} aria-pressed="true">
          Categorie
        </Button>
      </Fragment>
    ))}
  </div>
);

export const Overview = () => (
  <>
    <StoryIntro what="The one action control: five looks, three sizes, optional icons on either side." note="Button" />
    <div className="flex flex-col gap-stack-xl">
      <Specimens>
        {VARIANTS.map(({ variant }) => (
          <Specimen key={variant} label={variant}>
            <Button variant={variant}>Categorie</Button>
          </Specimen>
        ))}
      </Specimens>
      <Specimens>
        <Specimen label="size default" hint="40 px">
          <Button icon="Plus">Standaard</Button>
        </Specimen>
        <Specimen label="size small" hint="32 px">
          <Button icon="Plus" size="small">
            Klein
          </Button>
        </Specimen>
        <Specimen label="size compact" hint="icon only, 32 px box">
          <Button icon="Plus" size="compact" aria-label="Compact" />
        </Specimen>
        <Specimen label="icon only" hint="needs aria-label">
          <Button icon="Plus" aria-label="Categorie" />
        </Specimen>
      </Specimens>
      <Specimens>
        <Specimen label="icon + label" hint="leading icon">
          <Button icon="Plus">Categorie</Button>
        </Specimen>
        <Specimen label="label only" hint="no icon">
          <Button>Categorie</Button>
        </Specimen>
        <Specimen label="trailingIcon + icon" hint="icon on both sides">
          <Button icon="Plus" trailingIcon="ChevronDown">
            Categorie
          </Button>
        </Specimen>
        <Specimen label="trailingIcon" hint="chevron only on the right">
          <Button trailingIcon="ChevronDown">Categorie</Button>
        </Specimen>
      </Specimens>
      <Specimens>
        <Specimen label="align center" hint="group centred in a wide button">
          <Button align="center" trailingIcon="ChevronDown" className="w-40">
            Categorie
          </Button>
        </Specimen>
        <Specimen label="align left" hint="label at the start, chevron at the far edge">
          <Button align="left" trailingIcon="ChevronDown" className="w-40">
            Categorie
          </Button>
        </Specimen>
      </Specimens>
    </div>
  </>
);

type PlaygroundProps = {
  variant: Variant;
  size: "default" | "small";
  align: "center" | "left";
  icon?: IconName;
  trailingIcon?: IconName;
  label: string;
  disabled: boolean;
  pressed: boolean;
};

export const Playground: Story<PlaygroundProps> = ({ label, pressed, ...props }) => (
  <Button {...props} aria-pressed={pressed || undefined} className="w-56">
    {label}
  </Button>
);
Playground.args = { variant: "filled", size: "default", align: "center", label: "Categorie", disabled: false, pressed: false };
Playground.argTypes = {
  variant: { control: { type: "select" }, options: VARIANTS.map((v) => v.variant) },
  size: { control: { type: "select" }, options: ["default", "small"] },
  align: { control: { type: "select" }, options: ["center", "left"] },
  icon: { control: { type: "select" }, options: ALL_ICON_NAMES },
  trailingIcon: { control: { type: "select" }, options: ALL_ICON_NAMES },
  label: { control: { type: "text" } },
  disabled: { control: { type: "boolean" } },
  pressed: { control: { type: "boolean" } },
};

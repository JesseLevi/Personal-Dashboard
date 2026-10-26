// figma: node-id=3705:4402
import { useState, type ChangeEvent } from "react";
import { Specimen, StoryIntro } from "@/.ladle/story-kit";
import { InputField } from "./InputField";
import { ALL_ICON_NAMES, type IconName } from "./Icon";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Invoer / Input field" } satisfies StoryDefault;

// Dev-only demo copy — not user-facing (real labels/placeholders come from
// next-intl catalogs at the call site).

// Every icon combination renders the same container height: this doubles as
// the regression check (design/notes/InputField.md). Hover and typed rows
// show the real :hover / :focus-within look.
export const Overview = () => (
  <>
    <StoryIntro what="A labelled text field with optional icons, a textarea and a select shape." note="InputField" />
    <div className="flex w-72 flex-col gap-stack-lg">
      <Specimen label="default" hint="placeholder, trailing chevron">
        <InputField id="ov-default" label="Field" placeholder="Example" trailingIcon="ChevronDown" />
      </Specimen>
      <Specimen label="hover" hint="hover this one">
        <InputField id="ov-hover" label="Field" placeholder="Example" trailingIcon="ChevronDown" />
      </Specimen>
      <Specimen label="typed" hint="value present (the :focus-within look)">
        <InputField id="ov-typed" label="Field" trailingIcon="ChevronDown" defaultValue="Example" />
      </Specimen>
      <Specimen label="leading icon">
        <InputField id="ov-leading" label="Field" leadingIcon="Calendar" placeholder="Example" />
      </Specimen>
      <Specimen label="both icons">
        <InputField id="ov-both" label="Field" leadingIcon="Calendar" placeholder="Example" trailingIcon="ChevronDown" />
      </Specimen>
      <Specimen label="no icons">
        <InputField id="ov-none" label="Field" placeholder="Example" />
      </Specimen>
      <Specimen label="clearable, empty" hint="search: leading icon only">
        <InputField id="ov-clear-empty" placeholder="Zoeken" leadingIcon="Search" />
      </Specimen>
      <Specimen label="clearable, typed" hint="real trailing X button">
        <InputField
          id="ov-clear-typed"
          placeholder="Zoeken"
          leadingIcon="Search"
          defaultValue="Honden"
          trailingIcon="X"
          trailingIconLabel="Zoekopdracht wissen"
          onTrailingIconClick={() => {}}
        />
      </Specimen>
      <Specimen label="multiline" hint="fixed 144 px textarea">
        <InputField id="ov-multi" label="Omschrijving" multiline placeholder="Example" />
      </Specimen>
      <Specimen label="select" hint="native select with options">
        <InputField
          id="ov-select"
          label="Field"
          trailingIcon="ChevronDown"
          placeholderOption="Choose"
          defaultValue=""
          options={[
            { value: "a", label: "Option A" },
            { value: "b", label: "Option B" },
          ]}
        />
      </Specimen>
    </div>
  </>
);

type PlaygroundProps = {
  label: string;
  placeholder: string;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  disabled: boolean;
  multiline: boolean;
};

export const Playground: Story<PlaygroundProps> = ({ multiline, ...props }) => (
  <div className="w-72">
    {multiline ? <InputField id="playground" multiline {...props} /> : <InputField id="playground" {...props} />}
  </div>
);
Playground.args = { label: "Field", placeholder: "Example", disabled: false, multiline: false };
Playground.argTypes = {
  label: { control: { type: "text" } },
  placeholder: { control: { type: "text" } },
  leadingIcon: { control: { type: "select" }, options: ALL_ICON_NAMES },
  trailingIcon: { control: { type: "select" }, options: ALL_ICON_NAMES },
  disabled: { control: { type: "boolean" } },
  multiline: { control: { type: "boolean" } },
};

// Type to make the X appear; click it to clear the field.
export const Interactive = () => {
  const [value, setValue] = useState("");
  const common = {
    id: "interactive",
    placeholder: "Zoeken",
    leadingIcon: "Search" as const,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
  };
  return (
    <div className="w-72">
      {value ? (
        <InputField {...common} trailingIcon="X" trailingIconLabel="Zoekopdracht wissen" onTrailingIconClick={() => setValue("")} />
      ) : (
        <InputField {...common} />
      )}
    </div>
  );
};

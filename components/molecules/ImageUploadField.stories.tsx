// figma: node-id=3968:11192 (desktop) / 3953:9875 (mobile)
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { Story, StoryDefault } from "@ladle/react";
import { ImageUploadField } from "./ImageUploadField";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

export default { title: "Basis / Invoer / Image upload field" } satisfies StoryDefault;

const selectImageEn = en.components.imageUploadField.selectImage;
const selectImageNl = nl.components.imageUploadField.selectImage;

const Field = (props: Partial<React.ComponentProps<typeof ImageUploadField>>) => (
  <div className="w-96">
    <ImageUploadField id="thumbnail" name="thumbnail" placeholder={selectImageEn} ariaLabel={selectImageEn} {...props} />
  </div>
);

export const Overview = () => (
  <>
    <StoryIntro what="A file picker that looks like an input field, for a recipe thumbnail." note="ImageUploadField" />
    <Specimens>
      <Specimen label="empty" hint="the only state Figma models">
        <Field id="ov-empty" />
      </Specimen>
      <Specimen label="file selected" hint="own interpretation, not in Figma">
        <Field id="ov-filled" selectedFileName="pasta-carbonara.jpg" />
      </Specimen>
      <Specimen label="disabled">
        <Field id="ov-disabled" disabled />
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = {
  selectedFileName: string;
  disabled: boolean;
};

export const Playground: Story<PlaygroundProps> = ({ selectedFileName, disabled }) => (
  <Field key={selectedFileName} id="playground-thumbnail" selectedFileName={selectedFileName || null} disabled={disabled} />
);

Playground.args = {
  selectedFileName: "",
  disabled: false,
};
Playground.argTypes = {
  selectedFileName: { control: { type: "text" } },
  disabled: { control: { type: "boolean" } },
};

// Pick a real file from disk; the field keeps the name and the X clears it again.
export const Interactive = () => <Field id="interactive-thumbnail" onClear={() => {}} clearLabel="Clear" />;

export const Dutch = () => (
  <Field id="nl-thumbnail" placeholder={selectImageNl} ariaLabel={selectImageNl} />
);

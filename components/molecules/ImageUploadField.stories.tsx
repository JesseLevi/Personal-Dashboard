// figma: node-id=3968:11192 (desktop) / 3953:9875 (mobile)
import type { Story, StoryDefault } from "@ladle/react";
import { ImageUploadField } from "./ImageUploadField";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

export default { title: "Basis / Invoer / Image upload field" } satisfies StoryDefault;

const selectImageEn = en.components.imageUploadField.selectImage;
const selectImageNl = nl.components.imageUploadField.selectImage;

type PlaygroundProps = {
  selectedFileName: string;
};

export const Playground: Story<PlaygroundProps> = ({ selectedFileName }) => (
  <div className="w-96">
    <ImageUploadField
      id="playground-thumbnail"
      name="thumbnail"
      placeholder={selectImageEn}
      ariaLabel={selectImageEn}
      selectedFileName={selectedFileName || null}
    />
  </div>
);

Playground.args = {
  selectedFileName: "",
};

// No file selected -- the only state the fetched node models.
export const Empty = () => (
  <div className="w-96">
    <ImageUploadField
      id="empty-thumbnail"
      name="thumbnail"
      placeholder={selectImageEn}
      ariaLabel={selectImageEn}
    />
  </div>
);

// File already selected -- this component's own interpretation, not modeled
// by Figma (see design/notes/ImageUploadField.md).
export const FileSelected = () => (
  <div className="w-96">
    <ImageUploadField
      id="filled-thumbnail"
      name="thumbnail"
      placeholder={selectImageEn}
      ariaLabel={selectImageEn}
      selectedFileName="pasta-carbonara.jpg"
    />
  </div>
);

export const Disabled = () => (
  <div className="w-96">
    <ImageUploadField
      id="disabled-thumbnail"
      name="thumbnail"
      placeholder={selectImageEn}
      ariaLabel={selectImageEn}
      disabled
    />
  </div>
);

// NL catalog check.
export const SelectImageNl = () => (
  <div className="w-96">
    <ImageUploadField
      id="nl-thumbnail"
      name="thumbnail"
      placeholder={selectImageNl}
      ariaLabel={selectImageNl}
    />
  </div>
);

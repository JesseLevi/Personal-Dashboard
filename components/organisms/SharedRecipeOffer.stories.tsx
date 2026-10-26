import { SharedRecipeOffer } from "./SharedRecipeOffer";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Shared recipe offer" } satisfies StoryDefault;

const noop = () => {};
const THUMBNAIL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='orange'/></svg>";

// A recipe offered by Youri: photo, duration, accept and decline.
export const Default = () => (
  <div className="w-74">
    <SharedRecipeOffer
      name="Amandel Pasta"
      imageUrl={THUMBNAIL}
      duration="20 min"
      inviterName="Youri"
      onAccept={noop}
      onDecline={noop}
    />
  </div>
);

// A request is running: both buttons are disabled.
export const Pending = () => (
  <div className="w-74">
    <SharedRecipeOffer
      name="Amandel Pasta"
      imageUrl={THUMBNAIL}
      duration="20 min"
      inviterName="Youri"
      onAccept={noop}
      onDecline={noop}
      pending
    />
  </div>
);

// No photo and no duration: the grey placeholder square, a long title wrapping.
export const NoThumbnail = () => (
  <div className="w-74">
    <SharedRecipeOffer
      name="Romige pasta met geroosterde paprika en gerookte amandelen"
      inviterName="Naamloos"
      onAccept={noop}
      onDecline={noop}
    />
  </div>
);

export const Overview = () => (
  <div>
    <StoryIntro
      what="Card in a recipe column when someone shares a recipe with you: photo, duration, accept and decline."
      note="SharedRecipeOffer"
    />
    <Specimens>
      <Specimen label="Default" hint="Photo, duration, both buttons">
        <Default />
      </Specimen>
      <Specimen label="Pending" hint="A request is running, buttons disabled">
        <Pending />
      </Specimen>
      <Specimen label="No thumbnail" hint="Placeholder square, long title wraps">
        <NoThumbnail />
      </Specimen>
    </Specimens>
  </div>
);

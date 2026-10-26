// figma: node-id=4233:17679
import { ShareInviteBanner } from "./ShareInviteBanner";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Winkelmand / Share invite banner" } satisfies StoryDefault;

const noop = () => {};

// One and several invitations side by side.
export const Overview = () => (
  <div>
    <StoryIntro
      what="Banner on the shopping basket page when someone shares a basket with you: accept or decline."
      note="ShareInviteBanner"
    />
    <Specimens>
      <Specimen label="One invitation" hint="Sentence with accept and decline">
        <div className="w-80">
          <ShareInviteBanner inviterName="Youri Tukker" onAccept={noop} onDecline={noop} />
        </div>
      </Specimen>
      <Specimen label="Two invitations" hint="One banner each, stacked">
        <div className="flex w-80 flex-col gap-stack-xl">
          <ShareInviteBanner inviterName="Youri Tukker" onAccept={noop} onDecline={noop} />
          <ShareInviteBanner inviterName="Anne de Vries" onAccept={noop} onDecline={noop} />
        </div>
      </Specimen>
    </Specimens>
  </div>
);

// One invitation: sentence, Accepteren (Check) and Afwijzen (X; Figma draws ArrowUpDown, a copy slip).
export const SingleInvite = () => (
  <ShareInviteBanner inviterName="Youri Tukker" onAccept={noop} onDecline={noop} />
);

// Several invitations stack, one banner each.
export const TwoInvites = () => (
  <div className="flex flex-col gap-stack-xl">
    <ShareInviteBanner inviterName="Youri Tukker" onAccept={noop} onDecline={noop} />
    <ShareInviteBanner inviterName="Anne de Vries" onAccept={noop} onDecline={noop} />
  </div>
);


// figma: node-id=4233:17679
import { ShareInviteBanner } from "./ShareInviteBanner";

const noop = () => {};

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


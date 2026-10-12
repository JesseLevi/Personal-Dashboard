# ShareInviteBanner
Figma: `Winkelmand/08` node `4233:17679` (the untitled `Card` above the first group) · Code: `components/organisms/ShareInviteBanner.tsx` (+ `.stories.tsx`)

## Anatomy
`Card` (Title=No) holding a `CardContentTicket`, as the node draws: the title is the sentence `sharing.invite.message` ("{name} wil mand delen"), the Slot holds two filled `Button`s, Accepteren (`Check`) and Afwijzen (`X`).

## Contract
- Generic: no basket knowledge. Props: `inviterName` (full name, resolved by the caller with `memberFullName`), `onAccept`, `onDecline`, optional `pending` (disables both buttons while a request runs).
- The caller does the work: the Winkelmand page renders one banner per pending invite (`pendingInvites()`), on whichever basket is open. Accept calls `acceptShare` and navigates to that basket; decline calls `declineShare` and the banner disappears. Errors render in the page from `sharing.errors.*`.
- Strings: `sharing.invite.message`, `acceptLabel`, `declineLabel` (both locales).

## Deliberate decisions
- **Deviation from Figma:** Afwijzen draws `ArrowUpDown`, an obvious copy slip from the sort button. Code uses `X`.
- New component by exception (ADR-0034): the node is a composition of existing parts, but it is reused for every pending invite and carries the sharing copy. No new token.
- Buttons are `filled` (default) as drawn; they wrap under each other on a very narrow card via the Ticket slot's `flex-wrap`.

## Token gaps and flags
- None of its own: gaps come from `CardContentTicket` (see its note).

## Gotchas
- Stories: `SingleInvite`, `TwoInvites`.

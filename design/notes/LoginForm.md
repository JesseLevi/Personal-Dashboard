# LoginForm

- **Code:** `app/login/LoginForm.tsx` (client, the two-step animation) +
  `app/login/page.tsx` (server: auth-check, translations, layout, the
  decorative visual pane).
- **Figma section:** `Pages/Login`, node `3929:25181`.
- **Node IDs fetched (#158, first tool call — REST `nodes` endpoint, not the
  Figma MCP, which is not available to this agent; see "MCP not available"
  below):** `LogIn/Desktop` `3929:25202`, `LogIn/Mobile` `3929:25182`,
  `LogIn/Mobile/Step-01` `3934:32620`, `LogIn/Mobile/Step-03` `3933:32343`,
  `LogIn/Mobile/Error` `3985:10266`, `LogIn/Mobile/InloglinkSend`
  `3989:13128`.
- Page-level composition (Server Component + one colocated client
  component), same precedent as `CategoryPanel.tsx` — not added to
  `design/figma-map.json`, which only holds `components/` design-system
  entries.

Built #158, replacing the deliberately-plain Phase-1 login (#7, ADR-0004)
now that a real design exists.

## MCP not available to this agent

`docs/guides/ui-components.md` requires the fetch to be this agent's own
first tool call via the Figma MCP (`get_figma_data`). That MCP server is
configured in `.mcp.json` but was not present in this agent's tool list (a
subagent-scoping fact, not a decision made mid-ticket). Used the documented
fallback instead — the same REST endpoint the guide already names for Dev
Mode annotations (`GET https://api.figma.com/v1/files/<fileKey>/nodes?ids=…`,
`X-Figma-Token` from `.mcp.json`) — for the *entire* payload (geometry, text,
fills, component properties, annotations), not just annotations. Every
measurement below was read from that live payload, not from the ticket
prompt's own geometry summary, and cross-checked against it (no
discrepancies found). `download_figma_images` was likewise unavailable;
the equivalent REST image-render endpoint was used for the pixel check
(see "Pixel check" below).

## Geometry (verified against the live payload, node ids inline)

- Page background `stone-100` (`#F5F5F4`, confirmed via `3929:25182`'s own
  fill) = `surface-muted`, already painted by `app/layout.tsx`'s `<body>` —
  the login page doesn't repaint it. Page padding 16px both breakpoints.
- **Mobile** (`3929:25182`, 402×820): Login block (`3934:32743`) 370×418,
  no fill of its own (transparent, sits directly on the page background —
  confirmed no `fills` entry, so this is not a card/panel). Header
  (`3934:32744`) at 24px below the block top would be a top-anchored read,
  but the actual offset (104px) exactly matches vertical-centering
  ((418−212)/2≈104, where 212 = header 28 + gap 24 + StepAnimation 160) — so
  mobile's Login content is centered within a fixed 418px box, not
  top-anchored. That 418px figure is itself just "whatever's left after a
  370px image block and 16/16px padding inside an arbitrarily-chosen 820px
  mobile canvas" (418+370+32=820 exactly) — not a value worth reproducing
  literally on a real, variable-height viewport. Built instead as: header +
  StepAnimation flow naturally with normal top padding (no forced vertical
  centering) on mobile, immediately followed (0px gap, confirmed: image
  top y=1701 exactly equals Login block bottom y=1701) by the 370×370
  image, `rounded-3xl` (cornerRadius 24, confirmed).
- **Desktop** (`3929:25202`, 1440×868): Login block (`3930:25515`) 548×836,
  Image block (`3930:25483`) 836×836, 16px padding each side (measured:
  block left edge − frame left edge = 16; frame right edge − image right
  edge = 16), 24px gap between them (image left edge − block right edge =
  24). Login content here genuinely **is** vertically centered: header
  offset from block top = 312px, and (836−212)/2 = 312 exactly. Unlike
  mobile's 418px, desktop's 836px height is not arbitrary — it's the
  image's own square height (836 wide because that's the available column
  width), so centering the login content against it is the correct
  responsive read: `md:items-center` on the row, not a fixed height.
  **Desktop only ever draws Step-01** (`StepAnimation` didn't exist yet
  when this frame was authored — no `Step-03`/rail node anywhere under
  `3929:25202`) — read as "desktop gets the same two-step behaviour as
  mobile, just never separately drawn", not "desktop has no step 3", since
  nothing in the file suggests desktop should behave differently and the
  ticket explicitly asked for this reading to be recorded here.
- **StepAnimation** (`3934:32745`, 668×160): `Step-01` pane at x=0
  (312×104), `Step-03` pane at x=357 (312×160) — 357 = 312 (pane) + 45
  (gap), confirmed identically in all three fetched instances that draw the
  full rail (`3929:25182`, `3934:32620`, `3989:13128`). Visible window is
  312px wide; the rail translates by 357px, the window never resizes.
  Built with the rail as a `flex` row (`w-[312px]` pane + `ml-[45px]` on the
  second pane) inside a `w-[312px] overflow-hidden` window, translated via
  `-translate-x-[357px]` — the house convention
  (`transition-transform duration-[var(--duration-base)] ease-base
  motion-reduce:transition-none`, `Dropdown.tsx:160`).
- **Step-01** (`3934:32746`/`3934:32624`/…): `Input-field` 312×48 (`E-mail`
  placeholder) + 16px gap + `Button/Default` 312×40 ("Doorgaan"). Both the
  leading `Icon/Calendar` on the input and the leading/trailing icon frames
  on the button are present in the tree but `visible: false` — confirmed by
  reading each node's own `visible` field, not assumed from the name — so
  neither renders in Figma and neither is built here (`InputField` with no
  `leadingIcon`/`trailingIcon`, `Button` with no `icon`). Button
  `componentProperties`: `Style=Filled, State=Default`, fill `#E7E5E4`
  (stone-200 = `surface-raised`) — Button's ordinary default variant, no
  new component needed.
- **Step-03** (`3934:32750`/…): `Input-field` 312×48 ("Wachtwoord"
  placeholder, same hidden-icon situation) + 16px + `Button/Default`
  "Inloggen" (`Style=Filled`, identical to Doorgaan) + 16px +
  `Button/Default` "Stuur mij een inloglink" — `Style=Outline`, fill none,
  stroke `#D6D3D1` (stone-300 = `border`, Button/Outline's ordinary default)
  — **and this one's leading icon IS visible** (`Icon/Scroll`,
  `Leading icon: true`; trailing hidden). `InloglinkSend`
  (`3989:13128`)'s equivalent button swaps text to "Inlog link verstuurd"
  and the leading icon to `Icon/Check` — same Outline/visible-leading-icon
  shape, confirmed via the same `componentProperties` read.
- **Error** (`3985:10266`): confirmed by both the JSON tree *and* the
  rendered PNG (fetched via the REST image-render endpoint) — see "The
  Error frame's real content" below for why this is not built literally.
  Pane height with the error line visible: 144 = 48 (input) + 16 + 24 (text
  row) + 16 + 40 (button) — reproduced via the `ErrorLine` component's own
  `mt-4` (16px) on the text and `mt-4` (16px) on the following button, both
  unconditional, with the line's grid row collapsing to 0 (not negative
  margin or `gap-0` juggling) when there is no error — verified by hand
  that the collapsed-state math reduces to exactly the no-error pane height
  (104 for Step-01, 160 for Step-03).
- **Corner radius / fills confirmed directly, not assumed:** image panel
  `cornerRadius: 24` (`rounded-3xl`) with an `IMAGE` fill (flat image-fill,
  matches "export once, commit as a static asset" from the ticket). Header
  text fill `#000000` (pure black) — see "Header colour" below.

## The Error frame's real content — literal Figma vs. the built behaviour

The fetched `Error` frame's *only* pane with content is shaped like
**Step-01** (`Input-field` "E-mail" + error text + `Button` "Doorgaan"), not
Step-03: the pane literally named `Step-01` in that frame carries the
credentials-error copy ("E-mailadres of wachtwoord klopt niet.") sitting
between an **E-mail** field and a **Doorgaan** button. Confirmed twice — the
JSON tree (node `3985:10314`'s parent `3985:10270` has exactly those three
children) and the rendered PNG (fetched via the REST image endpoint) both
show it plainly, ruling out a JSON-only artifact.

This does not match the ticket's own behaviour spec (step 1 only ever
format-validates, client-side, no server round trip — a credentials error
is structurally impossible there) and the ticket explicitly names this as a
deliberate deviation ("bewust afwijkend van het Error-frame, door de
gebruiker bepaald"). Read together, the Figma frame is a mockup artifact —
built by duplicating the Step-01 pane and splicing in error copy that
actually belongs to the password step, never re-parented onto the real
Step-03 shape. Built instead as two separate, real error states that each
reuse the frame's exact visual pattern (144px pane, 16px margins, `text-base
font-semibold`, `text-priority-urgent`, centered) on the *correct* pane:

- **Step-1 pane**: a new message (`auth.errors.invalid-email-format`, "Vul
  een geldig e-mailadres in.") for an empty/invalid address — pure
  client-side, no action call.
- **Step-3 pane**: the frame's own literal copy
  (`auth.errors.invalid-credentials`, unchanged from the Phase-1 catalog) on
  the password field + "Inloggen" button — exactly where it semantically
  belongs.

## Header colour — `text-text`, not literal black

The greeting text's own Figma fill is `#000000` (pure black), while the
`text` semantic token is stone-950, not pure black. Built with `text-text`
per the token-scale rule (no new token for a 1-off value this close to an
existing one) — flagged here as the ticket asked, not silently reconciled.

## Greeting — server clock, client-corrected

Annotation on `3930:25897` (Dev Mode, dropped by the MCP payload and fetched
via REST separately from the geometry call): 00:00–05:00 Goeienacht,
05:00–12:00 Goeiemorgen, 12:00–18:00 Goeiemiddag, 18:00–00:00 Goeieavond.
`lib/auth/greeting.ts`'s `greetingKeyForHour` is the single source both
`page.tsx` (server clock, `new Date().getHours()`) and `LoginForm.tsx` (a
`useEffect` reading the visitor's own clock post-mount) call, so the two
never disagree on where an hour falls. The initial client render uses the
same `serverGreetingKey` prop the server rendered with, so the correction is
an ordinary post-mount state update rather than a real hydration mismatch —
`suppressHydrationWarning` is kept on the element regardless, per the
ticket's explicit instruction, as a defensive measure against edge cases
(e.g. a statically-cached response whose baked-in server time has gone
stale by the time a real visitor hydrates it).

Shipped as four whole sentences per locale (`auth.greeting.night/morning/
afternoon/evening`), not a composed string, per ADR-0007 and the ticket's
own instruction.

## Back-to-email trigger — undesigned, kept minimal

No Figma node draws any "go back to step 1" affordance, and the ticket
explicitly leaves the trigger to be chosen, asking only that it not leave
the user stuck. Built as two redundant, low-footprint triggers rather than
inventing a full visible layout: **Escape** (matching this codebase's own
existing close-on-Escape convention — `Dropdown.tsx`, the mobile nav
drawer in `AppShellNav.tsx`) for keyboard users, plus a small icon-only
`Button` (`variant="transparent" size="compact" icon="ArrowLeft"`, the
`ButtonToggle.tsx` segment precedent for icon-only `compact`) for
mouse/touch users who have no keyboard. The icon button adds ~40px
(button height 32 + 8px margin) to the Step-03 pane beyond the
Figma-measured 160/144/200px heights — a small, deliberate, flagged
deviation, not an oversight. See
`docs/open-questions.md#login-step-3-back-to-email-trigger-undesigned`.

## Visual pane — static PNG, not re-fetched at build time

Both breakpoints' visual pane is a flat `IMAGE` fill in Figma with no
sub-structure. The two exports were copied into `public/login/` (Figma's own
image URLs expire, so they can't be fetched again at request time) and are
rendered via `next/image` — mobile/desktop swapped with `md:hidden`/
`hidden md:block` rather than one `<Image>` with a responsive `src`, since
`next/image` has no art-direction primitive for two entirely different
source files. `alt=""` + `aria-hidden="true"`: purely decorative, matches
the ticket. The box under the image carries `bg-surface-raised` so a slow
image load never flashes a mismatched background — the image itself
happens to show app UI already painted in `stone-200`.

## Pixel check

Fetched all six frames' PNG renders via the REST image-render endpoint
(`download_figma_images` was likewise unavailable to this agent — see "MCP
not available" above) and compared by eye against the Ladle stories
(`LoginForm.stories.tsx`) after building: layout, spacing, button/outline
styling, and the Error frame's actual content (which drove the "Error
frame's real content" deviation above) all matched. No additional pixel
mismatches found beyond the deviations already recorded in this file.

## Visual-baseline clock freeze

`LoginForm`'s greeting corrects to the *visitor's* local clock in a
post-mount effect, which would otherwise make its own Ladle screenshots
flip text depending on what time of day `pnpm test:visual` happens to run.
Rather than special-casing this one story, `tests/visual/ladle.visual.spec.
ts` now freezes every story's clock once (`page.clock.setFixedTime(...)`,
Playwright's Clock API) to a fixed 14:00 timestamp before navigating —
harmless to every other story, since none of the rest read the clock, and
it conveniently lands in the same "afternoon" bucket the Figma reference
frames themselves sample ("Goeiemiddag en welkom").

## `accent` token — now fully orphaned

`docs/guides/ui-components.md` already flagged `accent` as having exactly
two `app/`-level consumers keeping it alive as a real token despite having
no `components/` consumer: `app/login/page.tsx:72` (`bg-accent`) and
`app/page.tsx:30` (`text-accent`). #158 rewrites both files and neither
uses `accent` anymore — the token now has zero consumers anywhere in the
repo. Not deleted here (`design/tokens.json`'s scale is a token-layer
decision, out of scope for a page-level ticket per `CLAUDE.md`'s
architecture-layer boundary) — flagged in `docs/HANDOFF.md` for the
architecture layer to retire when convenient.

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
  `3989:13128`. **#407:** `Step-01` `4221:14843`, `Step-02` `4221:14891`
  (see "Greeting heading"). **Fix round, same ticket:** `LogIn/Mobile/Step-03/Error`
  `3991:13224` — see "Terug/Inloggen row" below.
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
  full available row height (836 = 868 − 2×16 padding), which the image
  fills by being height-driven (`h-full`/`aspect-square`, not a
  width-driven square) and the login column matches by being `flex-1` and
  stretching to the row's height by default, with its own inner
  `justify-center` doing the vertical centering — see "Page layout" below
  for the bug this replaced and why it needed `h-screen`, not
  `min-h-screen`, on the page's root. **Desktop only ever draws Step-01** (`StepAnimation` didn't exist yet
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
  Built (#396) as two panes stacked in one `grid` cell (`col-start-1
  row-start-1`), each a pure slide, no fade (`transition-[translate]
  duration-[var(--duration-base)] ease-base motion-reduce:transition-none`;
  the inactive pane sits outside the mask box, so it is invisible). Trap: in
  Tailwind v4 `translate-x-*` sets the `translate` property, so an arbitrary
  transition list must name `translate`, not `transform`. Active `translate-x-0`, inactive
  email `-translate-x-[357px]`, inactive password `translate-x-[357px]`, both
  `pointer-events-none` + `inert`. Replaced the translated flex rail
  inside `overflow-hidden` because (1) `focus()` on the still-offscreen
  password input made the browser scroll the overflow-hidden window
  (`scrollLeft`), stacking on the transform (double shift, timing-dependent)
  — now there is no scroll container, and focus uses `preventScroll`; (2) the
  hard window clipped focus rings and cut panes at the edge. Edge softening is
  a horizontal `mask-image` gradient on a wrapper with 16px padding
  (`p-component-lg`) offset by equal negative margin / reduced `mt`, so layout
  is unchanged and rings stay whole. Container height = tallest pane.
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

## Greeting heading — name arrives after Doorgaan (#407, ADR-0031)

Replaces the time-of-day greeting (`greetingKeyForHour`, `lib/auth/greeting.ts`,
`auth.greeting.night..evening` and `suppressHydrationWarning` are gone).
Figma section `4221:14942`: `LogIn/Mobile/Step-01` `4221:14843`, heading
`4221:14845` "Hey, welkom bij Atlas"; `LogIn/Mobile/Step-02` `4221:14891`,
heading `4221:14940` "Hey Carlotta, welkom bij Atlas". Same text style as
before (Inter 20 semibold), so the h1 classes are unchanged.

- **Technique (user-designed animation):** `GreetingHeading` is a centered
  flex row of three parts: `Hey` | name part (leading space + name) |
  `, welkom bij Atlas`. The name part is an inline grid going
  `grid-cols-[0fr]` -> `[1fr]` plus opacity 0 -> 1 (child `overflow-hidden
  whitespace-pre`, like `ErrorLine`); the centered row pushes the outer parts
  apart. `transition-[grid-template-columns,opacity]`. Trap: Tailwind v4
  translate utilities set `translate`, not `transform`, so any arbitrary
  transition list must name `translate` (and `grid-template-columns`) explicitly.
- **Accessibility:** visual row is `aria-hidden`; an `sr-only` span carries
  the full sentence, so the h1 name is exactly "Hey, welkom bij Atlas" or
  "Hey Carlotta, welkom bij Atlas" (the collapsed name never leaks).
- **Long names:** the name part is `min-w-0` with `text-ellipsis`, so the
  row shrinks the name instead of overflowing. The row is capped by its column
  (370px at 402px wide), not 312px, because the real sentence is ~300px.
  Cosmetic: a truncated name shows "..." followed by a space before the comma.
- **Lookup flow:** on a valid Doorgaan the lookup starts beside the step slide
  (never delays it): Turnstile token (`useTurnstile.ts`, invisible widget,
  `action: login_greeting`, `execution: execute`, ~5s timeout, reset after each
  token) then `lookupGreetingName`. Same e-mail after Terug keeps the name, no
  re-query; a different one collapses the old name first, then looks up. Stale
  responses are dropped; null or a throw keeps the plain greeting, no error UI.
  No site key = no script, null token.
- **Measured (Ladle, 402px, 600ms mock):** name width 0 -> 78.8px over ~200ms,
  opacity 0 -> 1; "Hey" x 103.8 -> 64.5, tail x 140.3 -> 179.6 (both move apart).
- **Open difference:** the Step-02 frame has no Terug button, but the built
  Step-03 pane keeps the Terug/Inloggen row (buttons out of scope for #407).

## Name already on step 1 (#416, deliberate Figma deviation)

Figma shows the name only in Step-02. At the user's explicit request the lookup
now also starts while typing (valid address, 250ms idle, or blur), so the name
can appear on step 1. An invalid/empty field keeps the shown name (no flicker
while fixing a typo). Doorgaan reuses the lookup via the same-address dedupe.

## Terug/Inloggen row — the back trigger is now designed (fix round)

`LogIn/Mobile/Step-03/Error` (`3991:13224`), fetched in a fix round after
the user drew it, resolves `docs/open-questions.md#login-step-3-back-to-
email-trigger-undesigned` (removed, not left open) and replaces the
undesigned icon-only back button the first pass shipped. The node's
Step-03 pane (`3991:13233`, `Input + Button`, `VERTICAL gap=16`,
`counterAxisAlignItems=CENTER`) is, in order: `Input-field` "Wachtwoord"
312×48; error text 290×24 (`#FF6467`, `Error` annotation); **`Frame 3`**
(`3991:13289`), a `312×40 HORIZONTAL gap=8` row holding `Button` "Terug"
(`Style: Outline`, `Leading icon: true`, `Icon/Arrow-left`, 153×40) and
`Button` "Inloggen" (`Style: Filled`, 151×40); then the unchanged
"Stuur mij een inloglink" button. 200 = 48 + 16 + 24 + 16 + 40 + 16 + 40,
so with no error the pane is 160 — identical to the original Step-03
frame's height — which is the tell that **Frame 3 replaces the
full-width "Inloggen" button unconditionally, in both the idle and error
states**, not only while an error shows. Built that way: the icon-only
`ArrowLeft` button above the password field is gone, and both Step-03
forms (idle and error, `LoginForm.stories.tsx`'s `Step3Password` and
`Step3Error`) now render the two-button row.

**153/151 vs. equal halves:** the node's own two button widths differ by
2px (153 and 151, both against a 312px row with an 8px gap, which would
split evenly at 152/152) — a hug/rounding artefact from how Figma sized
each button's content, not a deliberate asymmetry. Built as two `flex-1`
buttons sharing the row equally, which is the reading Figma's own
`8px`-gap/`312px`-row intent actually implies.

**Escape stays, now redundant.** The Escape-key handler on the Step-03
pane (`Dropdown.tsx`'s own close-on-Escape convention) predates this node
and costs zero pixels, so it was kept as a second, no-cost way to trigger
`handleStepBack` alongside the now-visible "Terug" button — not removed
just because a first trigger now exists.

**Copy discrepancy, not reconciled:** this node's error text reads
"E-mailadres of wachtwoord klopt niet" **without** a trailing period,
while the original `Error` frame (`3985:10266`, `3985:10314`) and the
existing `auth.errors.invalid-credentials` catalog value both carry one.
Kept the existing i18n value (with the period) rather than editing it to
match the newer, punctuation-less frame — a one-character inconsistency
between two Figma frames is not a signal to touch a settled translation
value on the strength of a single re-draw, and the ticket didn't ask for
it. Flagged here per the "note the deviation, don't silently uniformize"
instruction.

## Visual pane — static PNG, not re-fetched at build time

Both breakpoints' visual pane is a flat `IMAGE` fill in Figma with no
sub-structure. The two exports were copied into `public/login/` (Figma's own
image URLs expire, so they can't be fetched again at request time) and are
rendered via `next/image` — mobile/desktop swapped with `lg:hidden`/
`hidden lg:block` rather than one `<Image>` with a responsive `src`, since
`next/image` has no art-direction primitive for two entirely different
source files. `alt=""` + `aria-hidden="true"`: purely decorative, matches
the ticket. The box under the image carries `bg-surface-raised` so a slow
image load never flashes a mismatched background — the image itself
happens to show app UI already painted in `stone-200`.

## Page layout — two real bugs found in a browser, fixed (fix round)

`LoginForm.stories.tsx`'s Ladle baselines only ever cover `LoginForm`
itself, never `app/login/page.tsx`'s surrounding layout — so a first pass
that read as pixel-correct in Ladle still shipped two real bugs, both only
visible by actually loading `/login` in a browser at several viewport
sizes (`pnpm dev` + a throwaway Playwright script, `node` run from the
repo root so it resolves `@playwright/test`). Confirmed empirically, not
reasoned from CSS alone, since one of the two is a genuine CSS subtlety
that's easy to get backwards:

- **Breakpoint was `md` (768px); should be `lg` (1024px).** At 820px wide
  (a real tablet width) the row layout kicked in with the 548px fixed
  login column eating most of the width and the image squeezed into a
  tiny square in the top-right corner of an otherwise empty page. Figma
  only ever draws a 402px mobile frame and a 1440px desktop frame, so
  where the actual switch should land was always this codebase's own
  call, not a Figma fact — `lg` was chosen so tablet widths get the
  stacked layout instead of a half-broken row.
- **The image pane was width-driven (`aspect-square` on a `flex-1` box)
  when it needed to be height-driven.** On the 1440×868 viewport the
  ticket happened to pass by coincidence — the remaining width after a
  548px login column and 24px gap is exactly 868px, so a width-driven
  square landed on the right height purely by chance. At 1280×800 the
  same math gives a 676px-tall square inside a 768px-tall row, leaving a
  visible gap under the image — confirmed both algebraically and with a
  real screenshot. Figma's own image block is full-height (836 of 868 −
  2×16 padding), so the fix makes the image `aspect-square` off its own
  *height* (`h-full` desktop, `shrink-0`) with the login column as the
  one that's `flex-1` and absorbs whatever horizontal space is left —
  the reverse of the first pass's roles.
- **That fix only worked once `main` changed from `min-h-screen` to
  `h-screen`.** `h-full` on the image is a percentage height, and a
  percentage height only resolves against an ancestor with a *definite*
  computed height — `min-height` alone does not count, even once the box
  has actually painted at exactly that height on screen. Verified with a
  `page.evaluate` dump of `getBoundingClientRect()`/`getComputedStyle()`
  inside the throwaway Playwright script: with `min-h-screen` the image
  box measured `0×0`; switching the ancestor to `h-screen` (a real,
  explicit height) made the exact same `h-full` rule resolve correctly
  (836×836 at 1440×868, matching Figma to the pixel). Not assumed from
  reading the CSS — the 0×0 measurement is what caught it.
- **Mobile (402×820) was re-verified after the fix**, not just
  eyeballed: `getBoundingClientRect()` gave the login block 370×418 at
  (16,16) and the image 370×370 at (16,434) — 434 = 16 + 418, and
  434 + 370 + 16 = 820, an exact match to Figma's own
  418 + 370 + 2×16 = 820 composition.

`LoginForm` itself needed no changes for this — the fix is entirely in
`app/login/page.tsx`'s `main`/wrapper classes.

## Pixel check

Fetched all six frames' PNG renders via the REST image-render endpoint
(`download_figma_images` was likewise unavailable to this agent — see "MCP
not available" above) and compared by eye against the Ladle stories
(`LoginForm.stories.tsx`) after building: layout, spacing, button/outline
styling, and the Error frame's actual content (which drove the "Error
frame's real content" deviation above) all matched. No additional pixel
mismatches found beyond the deviations already recorded in this file.
Fix round: re-verified against `3991:13224`'s own rendered PNG (Terug/
Inloggen row) and, separately, against real `/login` screenshots at
1440×868, 1280×800, 820×1180 and 402×820 — see "Page layout" above for
what that second check caught that the first pixel check couldn't, since
it never looked past `LoginForm`'s own boundary.

## Visual-baseline clock freeze

No longer needed by LoginForm (the heading is not clock-dependent); the
freeze in `tests/visual/*.spec.ts` stays, harmless.

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

## #219

Measured against `Pages/Login` (`3929:25181`) → `LogIn/Mobile`
(`3929:25182`), `LogIn/Desktop` (`3929:25202`), and the Step-03/Error
variant (`3991:13224`) the file header above already anchors this
component to.

### Converted (`app/login/page.tsx`)

`page.tsx:36` — the top-level `<main>`: `p-4`→`p-component-lg`,
`lg:gap-6`→`lg:gap-page-stack`:

| old utility | new utility | node-id | `boundVariables` key | variable |
| --- | --- | --- | --- | --- |
| `p-4` | `p-component-lg` | `3929:25182` / `3929:25202` | `paddingTop/Right/Bottom/Left` | `spacing/component/padding-lg` (16px, all sides, both frames) |
| `lg:gap-6` | `lg:gap-page-stack` | `3929:25202` (Desktop, `layoutMode: HORIZONTAL`) | `itemSpacing` | `spacing/layout/page-stack` (24px) |

**Axis discrepancy, reported not silently fixed**: `LogIn/Desktop`'s own
`layoutMode` is `HORIZONTAL` (the login column and the image pane sit in a
row, matching `lg:flex-row` in code), yet its `itemSpacing` is bound to
`spacing/layout/page-stack` — a token named for the vertical/page-stack
family, used here as a row gap. This is precisely the "Figma binds a
stack-family token to a horizontal auto-layout" case the shared briefing
calls out: the fix is to use the token as measured, not to "correct" it to
an `inline/*` token that seems more axis-appropriate. Flagging here per
that instruction; no code change beyond using the bound token as-is.
`LogIn/Mobile`'s own `itemSpacing` is `0` (no gap, `layoutMode: VERTICAL`)
— consistent with the code having no unprefixed `gap-*` at all, only
`lg:gap-*`.

`page.tsx:53` — the image pane: `rounded-3xl`→`rounded-container`,
confirmed off `boundVariables`, not inferred from the resolved 24px value:

| old utility | new utility | node-id | `boundVariables` key | variable |
| --- | --- | --- | --- | --- |
| `rounded-3xl` | `rounded-container` | `3932:26125` (mobile "Image") / `3930:25483` (desktop "Image") | `topLeftRadius`/`topRightRadius`/`bottomLeftRadius`/`bottomRightRadius` | `radius/container` (24px, all four corners, both frames) |

### Flagged (`app/login/LoginForm.tsx`)

`LoginForm.tsx:201` — the Terug/Inloggen button row (`gap-2`). Measured
the fetched "Frame 3" node itself (`3991:13289`, the node this file's own
header comment already names for its 153/151px hug-artefact width call):
`itemSpacing: 8` but **no `boundVariables` entry** — unbound in Figma. 8px
coincides with both `spacing/inline/gap-sm` and `spacing/component/
padding-sm`; with no binding to disambiguate, stays raw rather than
guessed.

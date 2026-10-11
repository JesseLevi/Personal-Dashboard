# SettingsPanel (`app/(app)/_components/SettingsPanel.tsx`)

- **Code:** `app/(app)/_components/SettingsPanel.tsx` (page-level composition
  of `SidePanel` + the new `ButtonToggle` molecule + `InputField` + `Button`
  — not a new atomic-design leaf, so **not** added to `design/figma-map.json`,
  same precedent as `BoardPanel.tsx`/`CardDetailPanel.tsx`).
- **Node IDs:** desktop drawer `4160:33196` (400×874, inside a frame
  misleadingly named "Add recipi/Desktop" — content is genuinely Settings,
  confirmed by its children below, not a copy-paste error in the node
  reference), mobile pull-up panel `4160:34064` (402×360, "Pull-up panel").
  Dev Mode annotations already read off these nodes (carried over from the
  ticket brief, not re-fetched — see `design/notes/SidePanel.md`'s own note
  on the sandbox's REST/`curl` restriction): mobile = "Slides in from
  bottom", its footer = "This part is sticky, Z-index: 999".

Built #265. **Reuses `Organism/SidePanel` outright** — no new organism, per
the ticket's explicit instruction and directly answering the "would a
PullUpPanel/Drawer organism be useful" designer annotation (it already
exists). `SidePanel`'s own `md:`-prefixed single-markup mobile/desktop split
means this file writes one JSX tree, not two.

## Measured content (both nodes fetched via `figma_execute`/`boundVariables`, not the hosted MCP)

Both nodes share the same four children in the same order: `Top` (pull
handle + close button, no title text — matches `SidePanel`'s own sr-only
title contract exactly, no code change needed there), `Button/Toggle`
INSTANCE (368×80, `Titel: true`, text "Kleurenthema"), `Input-field`
INSTANCE (368/370×80, `Field: "Taal"`), `Bottom` (footer).

**Kleurenthema toggle** (`4160:33400` desktop / `4160:34265` mobile — the
molecule's own instance, not the component definition; that's `4160:33335`,
see `design/notes/ButtonToggle.md`): three segments, `componentProperties`
confirmed one by one — `Systeem`/`Icon/Sun-moon`, `Licht`/`Icon/Sun`,
`Donker`/`Icon/Moon`, all `Style=Transparent, State=Default`. Wired to
`next-themes`' `setTheme("system"|"light"|"dark")` — `app/layout.tsx`'s
existing `ThemeProvider attribute="data-theme" defaultTheme="system"
enableSystem` (#206) is untouched, per the brief.

**Taal field** (`4160:33206` desktop / `4160:34266` mobile): `Field: "Taal"`,
`Content: "Nederlands"`, `Leading-icon: true` → `Icon/NL` (node `4160:34392`),
`Trailing-icon: true` → `Icon/Chevron-down` (node `3687:4444`, confirmed by
name — not assumed from the generic "Choose trailing-icon" property key),
`State: "Selected"`. **Composed, not extended**: `InputField`'s existing
`options`/`leadingIcon`/`trailingIcon` props already cover this exactly —
`<InputField options={[...]} leadingIcon={pendingLocale === "nl" ? "NL" :
"UK"} trailingIcon="ChevronDown" .../>` — the leading icon just swaps per
the current selection, a plain prop computation, zero `InputField.tsx`
changes. `State: "Selected"` in Figma reads as "this static sample was
captured mid-interaction" (the same `:focus-within` mapping
`design/notes/InputField.md` already documents for every other Selected
sample), not a request to force the field to always look focused — no
`InputField.tsx` change needed for that either. `Eenheid` annotations on
this same Input-field container (mentioned in the ticket) are a leftover
from the Add-recipe frame this panel was copied from, per the ticket's own
"ignore" instruction — not acted on.

**Footer** (`Bottom`, node `4160:33207` desktop / `4160:34080` mobile) —
**this is the one place the two breakpoints genuinely disagree**, and the
disagreement is a Figma authoring artifact, not a design decision:

| | Desktop (`4160:33207`) | Mobile (`4160:34080`) |
|---|---|---|
| Buttons | 1 × `Button/Default`, 368px (full width), `Style=Filled`, text "Opslaan" | 2 × `Button/Default`, 180px each: `Style=Destructive` text **"Verwijderen"**, icon a trash glyph; `Style=Filled` text **"Oplsaan"** (typo) |

Three independent signals agree this is residue, not a real second action:
(1) the desktop node — the same panel, same footer role — has only one
button; (2) the parent frame is literally named "Add recipi/Desktop", i.e.
this whole panel started life as a copy of the Add-recipe SidePanel, whose
footer legitimately has a destructive delete option; (3) "Oplsaan" is a
typo nobody would ship as final copy. Per the ticket's explicit decision:
**built desktop's single full-width `Opslaan` footer on both breakpoints**
— `footer` is one `<Button variant="filled" icon="Save" className="grow
basis-0">`, same `grow basis-0` single-button convention every other
`SidePanel` footer in this codebase already uses (`BoardPanel.tsx`,
`CardDetailPanel.tsx`). Deviation recorded at
`docs/open-questions.md#settings-mobile-delete-button-not-built`.

## Footer `grow basis-0` bugfix (post-#265, `fix/account-dropdown-clicks`)

The Opslaan `Button` shipped with `className="grow basis-0"` directly on
itself, reasoning (wrongly) that it matched `BoardPanel.tsx`/
`CardDetailPanel.tsx`'s footer convention. It doesn't: those footers wrap
their button(s) in a nested `<div className="flex gap-inline-sm">` row, so
`grow`/`basis-0` act on that row's horizontal main axis. This footer had no
such row — the Button was a direct child of `SidePanel`'s own footer, which
is `flex flex-col` (vertical main axis). `grow basis-0` on a flex-col's
direct child sizes it on the *vertical* axis instead, collapsing the button
from Figma's 40px (`Button/Default` in `4160:33208`, `hSize: FILL`) down to
a measured 24px. `SidePanel.tsx`'s own footer comment already states the
fix: "a lone button already fills 100% for free" — the column's default
`align-items: stretch` already gives a single direct-child button full
width, no opt-in needed. Removed the className; the misleading comment
above it (claiming `grow basis-0` was the shared convention here) is
corrected to explain why this footer is the one exception. `SidePanel.tsx`
itself was not touched — its footer container was already correct.

## Save: locale first, then theme, then close

`handleSave()` calls `updateLocale({ locale: pendingLocale })`
(`lib/profile/actions.ts`, #162) **before** `setTheme(pendingTheme)`
(`next-themes`) — deliberately ordered, not arbitrary: `updateLocale` is the
only part of "Save" that can actually fail (a real server round trip);
`setTheme` is a synchronous, can't-fail localStorage/DOM write. On failure,
the panel stays open with a visible inline error (`profile.errors.*`,
mirroring `boards.errors`/`notes.errors`'s existing three-code shape) and
neither the theme nor the panel-close happens — **never renders success
unconditionally**, the explicit lesson `docs/HANDOFF.md` records for
`AnimatedAddToBasketButton` (#233). `updateLocale` already calls
`revalidatePath("/", "layout")` itself (its own header comment), so no
extra revalidation is needed here.

## `ButtonToggle` is uncontrolled — the sync-on-mount subtlety

`ButtonToggle` (the new molecule) only accepts `defaultValue`, matching the
old atom's own precedent — no controlled `value` prop. `next-themes`'
`useTheme()` returns `theme: undefined` until the client mounts (its own
documented hydration-mismatch guard). Since `SidePanel` keeps its children
mounted (but `inert`) even while closed, `ButtonToggle` would otherwise
freeze its very first (pre-hydration) `defaultValue` — "system" — forever,
even once the real persisted theme (e.g. "dark") resolves a moment later.

Fixed with a one-time resync: a `themeReady` boolean flips exactly once,
the first render where `theme` is defined, and keys a **single** forced
`ButtonToggle` remount at that point (`key={themeReady ? "theme-ready" :
"theme-loading"}`) so its `defaultValue` picks up the resolved value. Every
click after that never touches the key, so the indicator's own slide
animation is never interrupted by a remount. In practice this resync
happens well before a user could ever open the panel (it requires clicking
through the Sidebar account row and the dropdown first), so it is a
correctness fix for the general case, not a fix for an observed flash.

**`pendingLocale` needed the analogous fix for a real (not just
theoretical) reason.** `SettingsPanel` never unmounts on a same-layout
route change — Next.js keeps one shared layout instance across navigations
— and `updateLocale` itself triggers exactly that: its own
`revalidatePath("/", "layout")` re-renders `AppLayout` with the fresh
`profiles.locale` value after every successful save, flowing a new
`currentLocale` prop into the same mounted `SettingsPanel`. Without a
`useEffect(() => setPendingLocale(currentLocale), [currentLocale])`, a
reopened panel would keep showing whatever `pendingLocale` was initialized
to on first mount, forever — the exact same "uncontrolled state doesn't
resync on prop change" trap, just triggered by this component's own save
flow instead of an external event. Safe on the save path too: by the time
the effect fires there, `pendingLocale` already equals the incoming value,
so it's a same-value no-op, not a stomp.

## Naam field — Claude-designed on request (#398)

Claude-designed on request (#398), no Figma node: the user explicitly asked
for a display-name input. One existing `InputField` (single-line text,
`label` = Naam / Name) placed above the theme toggle, reusing the same
atoms and semantic tokens as the Taal field; no new tokens or components.
Saved by the existing Opslaan button: `updateLocale` first, then
`updateDisplayName` (skipped when the trimmed value is unchanged); the panel
closes and the theme applies only when every write succeeded, otherwise the
existing inline error line shows. Empty/whitespace becomes `null` (sidebar
shows its fallback name); max 60 chars (app-level, the column has no DB
constraint). Seeded from `AppShellNav`'s `displayName`, re-synced on prop
change like `pendingLocale`. No Ladle story / visual baseline: the panel
imports server actions and next-themes, and no story for it exists (flagged
in the PR, not invented).

## Not built

- **No email/password fields** — Figma draws only Kleurenthema + Taal (the
  Naam field is the #398 Claude-designed exception above).
- **No delete-account button** — see the footer table above.
- **No avatar upload** — undesigned, out of scope (`design/notes/Sidebar.md`'s
  own #265 entry covers the read-only avatar/initials side).

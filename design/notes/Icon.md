# Icon
Figma: `Icons` frame · node `3760:6187` (one `Icon/<Name>` layer per icon) · Code: `components/atoms/Icon.tsx`

## Anatomy
Single wrapper around `lucide-react` (^1.25.0). Props: `name`, `size` (default 24), `strokeWidth` (default 2), `className` (colour via a text token / `currentColor`). Always `aria-hidden`.

`IconName` is derived, not hand-written: `ICONS` (lucide) and `FLAG_ICONS` are `as const satisfies` tables and `IconName = keyof ICONS | keyof FLAG_ICONS`. `ALL_ICON_NAMES`, `isIconName()` and `Icon.stories.tsx` all read the tables, so adding an icon is a one-edit change (the table) and it shows up in the story and the runtime guard automatically. The `icon--all-icons` baseline grows with it and must be regenerated. (#284)

`NL` / `UK` are the only non-lucide entries: real flag artwork in `public/flags/{nl,uk}.svg` (Figma `4160:34392` / `4160:34393`), rendered through a plain `<img alt="" aria-hidden width height>` ahead of the lucide lookup. `strokeWidth` is an inert no-op on a flag. (#265)

## Deliberate decisions
- Figma layer names equal lucide export names (PascalCase), so `IconName` is a direct lookup; Figma layers were renamed to match (Clock became AlarmClockCheck, Cake CakeSlice, List Scroll, Folder FolderClosed, Columns Columns3, Cross X, Calandar typo fixed). Sidebar panel icons are `PanelLeftClose` / `PanelLeftOpen` (sidebar sits on the left, divider at x=9).
- Never trust a name alone, verify shape: render the candidate export and compare paths/bboxes against the Figma vector. Real false friends caught: `Columns` vs `Columns3` (3 columns = 2 dividers), `Cross` (a medical glyph, not X), `Astroid` (lucide does ship it, spelled without the middle "e"; leading path coefficients matched `Sparkle` by coincidence of the shared 24x24 construction, so match on full shape, never leading numbers), `ArrowRightLeft` vs mirrored `ArrowLeftRight`, `Settings` vs `Cog` / `Settings2`, `Timer` (plain stopwatch) vs `AlarmClockCheck`. Figma's cubic `C` curves versus lucide's `a` / `q` arcs are the same glyph, not a mismatch. (#25, #19, #94, #104, #123, #160, #265)
- If no lucide export matches, it is an Architecture-level call (custom SVG vs Figma vector): flag it, never hand-draw. (Astroid was wrongly vendored as a custom SVG once, then fixed to the direct import.)
- Flags live in `public/flags/*.svg`, not inline: they carry brand hex that `check:server-only` greps for in `components/`, and a flag fill really is a colour literal, not a token gap. `<img>` over `next/image`: static SVG at a fixed small size gains nothing from optimisation, and it matches `RecipeDetailPage` / `CardContentRecipe`. (#265)
- `Shirt` stays in the union after Kleding was removed: the union mirrors the Figma Icons frame (47 layers, Shirt among them), not current consumers. DB-sourced icon names go through `isIconName()` with a `FolderClosed` fallback (`ReceptenBoard.tsx`), so nothing breaks either way. (#226)
- Icons with no Figma vector to verify against (presence-only check that they are real lucide exports): Coffee, Soup, Pizza, Cookie (#125); the full 74-icon lucide "Food & beverage" set for the CategoryPanel picker, taken from lucide's own per-icon `categories` metadata, with distinct accessible labels per catalog under `components.categoryPanel.iconLabels.*` (#125, see `design/notes/CategoryPanel.md#icon-picker-all-74`); and the 20 EditingBar toolbar icons, which are detached frames in Figma (#227). EditingBar alignment icons are `TextAlign*`, not the older `Align*`; the Figma layer name is authoritative.
- `Users` (#429) is the shared-basket marker next to `User` in the basket popover; it has no Figma vector, presence-only check that it is a real lucide export.
- `Share` is the "Delen" button on the recipe page (ADR-0036); no Figma vector, presence-only check that it is a real lucide export.
- `PanelRight` is the "Plannen" button of the Agenda header (the tray sits on the right); no Figma vector, presence-only check that it is a real lucide export.
- `CalendarSync` marks imported events in the Agenda (`AgendaCalendar`); no Figma vector, presence-only check that it is a real lucide export.
- `Repeat` marks an occurrence of a recurring own event in the Agenda (`AgendaCalendarItem`, ADR-0042); no Figma vector, presence-only check that it is a real lucide export.
- `Minus` has no Figma node (Figma draws `Icon/Plus` on both stepper sides); it is coordinate-identical to Plus's horizontal bar. (#123)
- `optimizePackageImports: ["lucide-react"]` (`next.config.ts`) was measured with no production effect (lucide is `sideEffects: false` with one ESM file per icon, so tree-shaking already drops unused icons; lucide chunk byte-identical before/after). Kept as Next's documented default and for dev cold start. (#173)

## Gotchas
- Icons that vary by context are instance overrides, not new defaults (e.g. `EllipsisVertical` at 16 px in the sidebar account row).

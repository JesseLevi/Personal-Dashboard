# Guide: UI components

Read this before building or changing anything in `components/` or the UI in `app/`.

## Where a design comes from (ADR-0034)

**Default: you design it in code.**
- Compose existing components first, with semantic tokens only.
- Before adding a component, check `components/{atoms,molecules,organisms}` and the design notes for something that fits. A new component is the exception: it must add real value, and its note says why no existing one fit.
- No new tokens or primitives without asking. The scale is closed. Flag a missing token in the note; never hardcode it.
- Header comment: `// design: Claude-designed (#NNN)`. Add a Ladle story, a visual baseline and `design/notes/<Component>.md`. Send the user a screenshot of every new surface.
- Design for both breakpoints (mobile 320–430 px, desktop) and both themes. Use the existing interaction patterns: `SidePanel` for edit panels, `Dropdown` + `usePopoverPosition` for menus, `DeleteConfirm` for destructive actions, skeletons for loading.

**When the user names a Figma design, implement it exactly**, unless they say otherwise:
- **The agent that writes the component fetches the node itself**, as the first step of the build. Use the `figma-console` bridge (`figma_get_status` with `probe: true` must report the `[PD] Personal Dashboard` file). It has no rate limit and is the only route to `boundVariables`. The hosted Figma MCP dies after a few calls.
- **A resolved value never identifies a token. Read `boundVariables`.**
  - `radius/control-outer` and `radius/card` are both 12, and 4/8/12/16 appear in all three spacing groups.
  - A ramp step's *name* is not the *state* it is used in: `Button/White` binds Hover → `…/selected` (#213).
  ```js
  const n = await figma.getNodeByIdAsync('<nodeId>');
  const bv = n.boundVariables || {};   // fills, strokes, radii, itemSpacing, padding*
  // COMPONENT_SET: read each variant child's own bindings.
  ```
- **Dev Mode annotations** are not in the MCP payload. Read them via REST (`GET /v1/files/<key>/nodes?ids=<id>`, header `X-Figma-Token`). Check them whenever interaction is involved.
- **Record the node** in `design/figma-map.json` (one line per component) and in the `// figma: node-id=…` header. Note any deliberate deviation in the design note.

## Composition and variants

- Atoms ← molecules ← organisms ← `app/`. Dependencies flow one way, and the tree mirrors the design's nesting.
- **CVA**:
  - variant axes (Style, Type) become props;
  - **states (Hover/Active/Focus/pressed) become CSS pseudo-classes, never props**;
  - booleans become optional props;
  - slots become `children` or named slots.
- **Show success only on a successful result.** An optimistic animation once hid a broken write path (`AnimatedAddToBasketButton`).

## House style

- **Server Component by default.** Add `"use client"` only where the component itself owns state, handlers or hooks.
- **`className` merging**:
  - always use `cn()` from `@/lib/ui/cn` (clsx + tailwind-merge, configured with the generated token names);
  - for CVA, write `cn(xVariants({...}), className)`, never CVA's own `className` arg;
  - a new token namespace needs adding in `lib/ui/cn.ts`.
- **Icons go only through the `Icon` atom** (the single `lucide-react` importer).
  - `IconName` entries equal lucide export names. Never trust a name alone; render and compare, because lucide's `Cross` is a medical glyph.
  - Decorative icons get `aria-hidden`. An icon-only control carries the accessible name.
- **Accessibility is part of the component.**
  - Use real semantics (`role="checkbox"` + `aria-checked`, not a styled div).
  - Menus are keyboard-operable with correct roles and return focus on close.
  - Keep the visible text as the accessible name rather than adding a duplicate `aria-label`.
- **No inline styles and no raw hex in `components/`, comments included** (`check:server-only` greps them).
  - The only exception is runtime geometry from `usePopoverPosition`, flagged in place.
  - Ladle stories use utilities too.
- **Raw radius/spacing utilities are gated** (`check:raw-spacing`): use the semantic spacing/radius token.
  - Genuinely unbound values carry `// spacing-flag: <reason> — design/notes/<Component>.md` in the comment block directly above the line.
- **Comments are a budget** (`check:comment-budget`: at most 30% comment lines, blocks at most 15 lines, no ticket narration).
  - A component carries a short header (source, variant mapping) and a sentence where code is non-obvious.
  - Everything else goes in the design note.

## Design notes (`design/notes/<Component>.md`)

A note is the component's **contract**, not its history. Sections: Anatomy, Deliberate decisions, Token gaps and flags, Gotchas, Open (slugs in `docs/open-questions.md`). Keep it at about 5 KB or less.

When you change a component, rewrite the bullets that changed. Don't append ticket narration: git and the PR already hold that.

## Tokens (ADR-0010)

- **Pipeline**: Figma variables export (`design/figma-variables/`) → `design/tokens.json` → `pnpm sync:tokens` → `app/theme.css` → utilities.
- **Never hand-edit `theme.css`.**
- **CI gates**:
  - `check:tokens-drift` checks the mirror;
  - `check:retired-tokens` fails on renamed/removed tokens anywhere (list: `design/retired-tokens.json`).
- **Figma text styles** are Tailwind-native: `text-xl/semibold` → `text-xl font-semibold`.
- **Colour states** (role / hover / active / selected, and why Selected must compose with Hover and Active) are in `docs/design-tokens.md`. Read it before adding state styling.
- **Dark mode**: follows the OS via `next-themes` (`data-theme`). There is no `dark:` utility anywhere.

## Visual tests

- **The gate is CI's Linux job** (`ci-visual.yml`) over Ladle stories.
  - Regenerate baselines with `gh workflow run visual-update.yml --ref <branch> [-f grep=<pattern>]`, then run `ci-visual.yml` by hand (a bot push triggers no CI).
  - Review the PNGs like any diff.
  - Local `-darwin.png` baselines are git-ignored and drift, so ignore local mismatches.
- **Flake**: `threshold` stays 0 and `maxDiffPixels` 16. Run the full suite twice before believing a lone failure; never bisect, because isolation changes rasterization.
- **Blind spots**:
  - interaction states are rendered only for Button (`states.visual.spec.ts`);
  - `.tiptap` prose only via `notities--editor--note-editor-content--prose`;
  - dark mode only for the `DARK_STORIES` subset in `dark.visual.spec.ts`. A new dark-sensitive story belongs in that list.
  
  Check other states and dark values by eye.
- **Scoped local regeneration**: `pnpm exec playwright test --update-snapshots -g <pattern>`, not `pnpm test:visual:update -- -g` (which regenerates everything). `-g` matches story names, not what they render.
- **`pnpm ladle:build`** for a non-interactive build. `pnpm ladle` is the dev server.

## Ladle

- **Title**: `{ title: "<Group> / <Subgroup> / <Component name>" } satisfies StoryDefault`; the story ID is the slug (`basis--invoer--button--state-matrix`) and names the baseline PNGs.
- **Group rule**: two or more modules means `Basis`, one means that module; atoms are always `Basis`. `CardContent*` stays in `Basis / Kaarten`, `SearchPanel` in `Basis / Panelen`.
- **Order** (`storyOrder` in `.ladle/config.mjs`, self-contained as Ladle serialises it): `Basis`, the modules in `Sidebar` order, `Account` last; per component `Overview`, `Playground`, `Interactive` lead, then alphabetical. New groups need an entry.
- **Per component**:
  - `Overview` first: `StoryIntro {what, note}` plus every variant and state in labelled `Specimens`/`Specimen {label, hint?}` (`@/.ladle/story-kit`; dev-only English copy). Fixed panels (wrap in `PanelFrame`) cannot sit side by side: show one state.
  - `Playground`: `args` + `argTypes` for each variant axis (`select`), boolean and text prop. Required in `Fundament`/`Invoer`; in `Kaarten`/`Panelen` only where a prop drives appearance.
  - `Interactive`: local `useState`, no server; required where behaviour is the point (Dropdown, Checkbox, panels, Toast, drag, Carousel…).
  - Separate stories only for what it cannot show: `Empty`, `Loading`, `Error`, `DeleteConfirm`, `LongText`, `Mobile`, `Dutch`. Merge stories that coincide.
- **Chrome** (sidebar, toolbar, width presets) lives in `.ladle/ladle-theme.css` and `.ladle/config.mjs`; `mode=preview`, used by the visual suite, renders none of it.

| Group | Components |
| --- | --- |
| Basis / Fundament | Icon, Avatar, AvatarGroup, Tag, Step, BlurFade |
| Basis / Invoer | Button, ButtonToggle, Checkbox, Dropdown, InputField, OtpInput, ImageUploadField, PortionStepper, AnimatedAddToBasketButton |
| Basis / Kaarten | Card, CardContainer, CardContent* (Ingredient, Note, Recipe, RecipeFailed, RecipeSkeleton, Step, Ticket), BoardView, Carousel, BoardSkeleton |
| Basis / Panelen | SidePanel, Sidebar, PageHeader, Toast, SearchPanel, IngredientSearchPanel, MemberSearchPanel |
| Agenda | AgendaPageLayout, AgendaCalendar, AgendaHeader, AgendaDayStrip, AgendaQuickAdd, AgendaEventPanel, AgendaMealPanel, AgendaCardPanel, AgendaCalendarsPanel, AgendaLinkSearchPanel, AgendaSyncNotices, PlanDrawer, PlanChoices, EventLinkLine, ColorSwatches |
| Te doen | CardDetailPanel, BoardPanel |
| Recepten | RecipePanel, CategoryPanel, AddRecipeMenu, LinkImportPanel, SourceLink, RecipeIngredientRow, StepIngredientPanel, IngredientAdmin, SharedRecipeOffer, RecipeDetailSkeleton |
| Winkelmand | WinkelmandHeader, ShoppingListPanel, ShareInviteBanner |
| Notities / Editor | NoteEditorContent, EditingBar, NoteBubbleMenu, SlashMenu, NoteMarkdownMenu, NoteBlockHandle, LinkPopover, NoteLinkMenu |
| Notities / Blokken | NoteCodeBlock, NoteDetails, NoteImageView, NoteLinkView, NoteTable, NoteTableHandles, TableMenu, TableSizePicker |
| Notities / Rondom | NoteBacklinks, NoteTableOfContents, NoteSaveStatus, NoteCategoryPanel |
| Account | LoginForm, LoginCodeForm, ConfirmForm, SettingsPanel |

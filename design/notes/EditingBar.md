# EditingBar
Figma: `EditingBar` · desktop `3978:14138`, mobile `3978:14870` (file "Notion - V2", `QwWEkv3z4DKsipNQVrMIyQ`); deliberately departs from it, Claude-designed on request (#329 menus, #330 table picker, #333 slim bar, #386 polish) · Code: `components/organisms/EditingBar.tsx`, `EditingBarMenu.tsx`, `EditingBarOverflow.tsx`, `TableSizePicker.tsx`, `usePopoverPanel.ts`

## Anatomy
One `role="toolbar"` (`data-editing-bar`), built from `Button variant="transparent"` + `Icon`. Order (`GROUPS`, separators `h-6 w-px bg-stroke-lines`): block type menu, list menu, table picker | bold, italic, link | align menu | image | undo, redo | More. Eleven roving stops; More is always last.

- Block type (Text / H1-H3) and list (bulleted / numbered / checklist) are `EditingBarMenu`: a `Button` trigger with the current label and `ChevronDown`, plus a portalled labelless `Dropdown` (`role="menu"`, rows `menuitemradio`, trailing `Check` on the active one). `BLOCK_TYPE_MENU` is shared with the bubble menu's "Turn into".
- Align is an `EditingBarMenu` with `iconOnly`: trigger shows the current alignment icon + chevron, the label is `sr-only` plus `aria-label` "Tekstuitlijning: <current>". It goes through the labelled `Button` branch because an icon-only `Button` cannot carry a trailing icon.
- Table is `TableSizePicker`: trigger + portalled panel with a `role="grid"` of 8x8 `gridcell` buttons (`aria-label` "3 x 4", `aria-selected` for the range) and a `role="status"` line. Highlight `surface-secondary` + `stroke-primary-hover`, focused cell `stroke-secondary-active`. Default 3 x 3, header row on. The grid is `TableSizeGrid`, also used by the slash menu.
- More is `EditingBarOverflow` (`menu`, `Ellipsis`): an insert section (quote, code block, divider, filtered from `SLASH_ITEMS`, labels from `components.slashMenu.items`) and a format section (underline, strikethrough, highlight, inline code, superscript, subscript). Toggles are `menuitemcheckbox` with `aria-checked`; divider is a plain `menuitem`.
- Image: opens the file picker (`openImagePicker`); labelled "Afbeelding" on desktop, icon-only with the same `aria-label` on mobile (`design/notes/NoteEditor.md` #339).
- Link opens the shared `LinkPopover` through `requestLinkPopover` (`design/notes/NoteEditor.md` #331).
- Mobile (`< md` or the `mobile` prop): same eleven items, scrolls horizontally. With the cursor in a table the bar swaps to Back (`ArrowLeft`) | the ten `TABLE_COMMANDS` (`lib/notes/table-commands.ts`) as icon + text (icons repeat, so text is required), `aria-disabled` rows like the desktop table menu, toolbar label "Tabelwerkbalk". Back returns to the default bar and focuses the editor; the table slot then shows a "Table actions" button instead of the picker (no nested tables). Leaving the table resets this.
- Active state is Button's own `aria-pressed` Selected. On `transparent` that is only a colour shift (`text-text-secondary` to `text-text-primary`, icon follows via `currentColor`); no fill was added because Figma's Default buttons draw none. Undo, redo, table, image and menus never carry `aria-pressed`.
- Bar tokens: `rounded-card`, `px-component-xs`, `bg-surface-highlight-white`; buttons are `Button`'s own `size-10`. Mobile inset `left-page-left right-page-right-equal` (the measured 16px equals them).

## Deliberate decisions
- Slim bar instead of Figma's 20 buttons (undo, redo, heading, list, quote, table, code block, code, bold, italic, strike, underline, highlight, link, super, sub, 4 aligns; separators 2/6/6/2/4; mobile also "Afbeelding" `3978:15082`). With the bubble (#331) and slash menu (#332) most were one gesture away. Bold, italic, link duplicate the bubble on purpose: the bar works with a collapsed cursor and is the discoverable list. Format rows live in More because mobile has no bubble. Insert rows come from `SLASH_ITEMS`, so a new block there needs no edit here. (#333)
- Desktop hugs its content, centred (`md:mx-auto md:w-fit md:max-w-full`); mobile is the fixed full-width bottom bar. (#386)
- `role="toolbar"` with roving tabindex (ARIA APG) instead of a row of Tab stops: one Tab stop, Left/Right/Home/End move. Arrow nav reads `[data-toolbar-item]` from the DOM via `querySelectorAll` (not per-button refs, `Button` is not `forwardRef`), so menus, picker, overflow and the table bar share one handler; popover rows never carry that attribute. The active stop resets to 0 when the mode swaps. (#234, #333)
- Menus are portalled to `body` and positioned from the trigger rect (`measure()`: open upward in the lower half of the viewport, right-aligned in the right half; `--menu-x` / `--menu-y` custom properties, runtime geometry like the keyboard inset) because the bar is `overflow-x-auto` and would clip an in-bar panel. `EditingBarMenu`, `EditingBarOverflow` and `TableSizePicker` stay private parts, not catalogue atoms; promote only if another surface needs the same shape. `usePopoverPanel` shares placement and dismissal (outside pointer, resize, scroll) for the picker, overflow and `TableMenu`. (#329, #330, #333)
- Popover separators bleed to the panel edge (`-mx-component-xs`), otherwise the line reads narrower than the rows. Also in `NoteMarkdownMenu`. (#386)
- Option icons (`Pilcrow`, `Heading1-3`, `ListOrdered`, `ListTodo`, `TextAlign*`) are registered in `Icon.tsx`, which moved the `icon--all-icons` baseline. (#386)
- Table button no longer inserts a fixed 3x3; hover (mouse only) moves the highlight, click or tap inserts at once. Touch has no hover, so there the highlight is only a preview; no stepper variant was built. (#330)
- Keyboard inset: `position: fixed` anchors to the layout viewport, and the iOS keyboard shrinks only the visual viewport, so the bar hid behind it. `useKeyboardInset()` computes `max(0, innerHeight - (visualViewport.height + offsetTop))`, listens to both `resize` and `scroll` on `visualViewport`, is SSR-safe (0 until the effect runs, guards a missing `visualViewport`), and writes `--keyboard-inset` for `translate-y-[calc(var(--keyboard-inset,0px)*-1)] md:translate-y-0`. The breakpoint split stays in Tailwind so the value never leaks into the static desktop bar. (#263)
- Mobile bar uses `bottom-[env(safe-area-inset-bottom)]`, not padding: padding would grow the 48px bar and off-centre its buttons. `NoteEditor.tsx` already reserves `pb-[calc(4rem+env(safe-area-inset-bottom))]` below it. Scrollbar is hidden (`[scrollbar-width:none]`), the same stand-in as `Carousel` (`design/notes/Carousel.md`). (#234)
- `useEditorState` selector, not a whole-editor re-render per keystroke; it also carries `inTable`, the active option per menu, and the enabled table commands. A null editor renders nothing. (#234)

## Token gaps and flags
- Bar `paddingTop/Bottom` (4px, `py-1`) and `itemSpacing` (8px, `gap-2`) are unbound on `3978:14138` / `3978:14870`; `spacing-flag` in `EditingBar.tsx`.
- `TableSizeGrid` cell `size-6` has no spacing token (a raw size utility, not covered by `check:raw-spacing`).
- The 20 Figma buttons are detached frames named `Button/Default` with loose icon frames, not instances; the visible glyph sits under `Leading + Text > Icon`, and a hidden leftover `Icon/Plus` instance on each is residue. Code builds on real `Button` / `Icon` regardless.

## Gotchas
- `EditingBarMenu`, `EditingBarOverflow` and `TableSizePicker` triggers: Enter / Space / click or ArrowDown / ArrowUp open; focus lands on the active row (else the first); arrows / Home / End move; Escape, Tab and outside click close; focus returns to the editor (`editor.commands.focus()`).
- Table grid: roving tabindex, arrows without wrap, Home/End jump to column 1/8, Enter/Space insert, Escape/Tab close.
- Mobile table mode is exercised in Chromium via the `mobile` prop only; the `matchMedia` branch and the iOS keyboard lift were never seen on a device.
- Baselines `editing-bar--*` and `note-editor-content--prose`; open-menu stories cover light and dark.
- `tests/notes-editingbar.test.ts` checks every command stays reachable (`BAR_COMMAND_IDS`, `OVERFLOW_COMMAND_IDS`, align options).

## Open
- `docs/open-questions.md#notes-editingbar-detached-from-components`

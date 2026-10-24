# SearchPanel
Figma: none, designed in code (ADR-0034) · Code: `components/organisms/SearchPanel.tsx` (+ `.stories.tsx`), logic in `lib/search/panel.ts`, shortcut hook in `app/(app)/_components/useSearchShortcut.ts`

## Why a new component
No existing organism searches across modules. `MemberSearchPanel` picks one person, `AgendaLinkSearchPanel` links three kinds and is Agenda-bound, and neither is keyboard-navigable. The panel is `SidePanel` + `InputField` + `Card`; the only new thing is the combination and its keyboard model.

## Anatomy
`SidePanel` (level 1, no footer). Children: `InputField` (trailing `Search`, no visible label), then a polite live region holding one state line or the result groups. Each group is an `h3` (`text-sm`, secondary) over a list of `Card` rows. A row is one `<button role="option">`: type icon (`Notebook`, `ChefHat`, `Columns3`, `Calendar`, `ShoppingBasket`), title (`text-base font-semibold`), event date and snippet (`text-sm`, secondary, snippet clamped to two lines). Last, the optional smart-search line.

## Contract
- Props: `open`, `onClose`, `onSearch(q)` (a stable reference, normally `searchAllAction`), `onOpen(href)`, `onOpenSettings`, `canEnableSmartSearch`, `autoFocusField`, `initialQuery`.
- Opens from the Sidebar item (also in the mobile drawer) and from ⌘K / Ctrl+K. State lives in `AppShellNav`.
- Click or Enter calls `onOpen(href)` after closing the panel; the shell navigates with its page transition. Everything resets on close.

## Deliberate decisions
- **Grouped per module, groups ordered by their best hit.** The backend already ranks, so the first group holds the best match and the order inside a group is the backend's. Mixed-by-rank was rejected: five kinds of row without a heading are hard to scan.
- **Focus stays in the field.** Arrow keys (and Home/End) move a highlight wrapping at both ends; Enter opens it. The ARIA pattern is combobox + listbox with `aria-activedescendant`; rows have `tabIndex={-1}`. The highlight is the `stroke-primary-selected` border on the Card, the same token as a focused field. The first result is highlighted when results arrive, so Enter right after typing opens the best hit. Pointer movement moves the highlight too.
- **Autofocus only from `lg`** (`autoFocusField = !useIsNarrow()`, as the agenda quick add): below it the phone keeps its keyboard down until the member taps the field. `SidePanel` focuses its close button first; the field takes over afterwards.
- **300 ms debounce, minimum 2 characters** (`NOTES_SEARCH_MIN_QUERY_LENGTH`), same as the notes search. A response outdated by a newer keystroke is dropped. A pre-filled `initialQuery` searches at once, so the stories settle without a timer.
- **Degradation is silent.** A `keyword` answer renders the same results. Only when the member could switch smart search on (a provider exists, they have not opted in; `aiAvailable && !aiEnabled` in the shell) one calm `text-sm` line follows: "Slim zoeken staat uit...", a button that closes the panel and opens Settings (there is no settings route; Settings is the panel from the account menu). A keyword answer for a member who did opt in (budget used up) shows nothing.
- A failed request shows a neutral "Zoeken lukt nu even niet." in secondary text, not the error colour; it is not a "no results".
- **Shortcut guard** (`isSearchShortcut`): exactly Meta xor Ctrl plus K, no Alt/Shift, ignored while typing (`INPUT`, `TEXTAREA`, `SELECT`, contenteditable, so the note editor keeps Mod-K for links), while composing, while the search or Settings panel is open, and while any other modal `SidePanel` is open (`[role=dialog][aria-modal=true]` not `aria-hidden`).
- Events show their day (`date`, `d MMM`, UTC so it never shifts); the Agenda has no deep link, so the row opens `/agenda`.

## Token gaps and flags
- No raw spacing or colour. Row `gap-inline-lg` (as `CardContentRecipe`), text column `gap-stack-sm`, list `gap-stack-md`, groups `gap-stack-xl`.
- `CardContentNote`, `-Recipe` and `-Ticket` were not used: they carry thumbnails, categories and planning chips that a result does not have.

## Gotchas
- Stories: `Empty`, `Loading`, `Results`, `NoResults`, `SmartSearchOff` with mock actions; `Results` and `SmartSearchOff` are in the dark subset. `Loading` uses a never-resolving promise.
- The hook reads `document` for open dialogs, so it only runs in the shell, not in Ladle.

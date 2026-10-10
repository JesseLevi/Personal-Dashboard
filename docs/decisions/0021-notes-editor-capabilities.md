# ADR-0021: Notes editor capabilities and interaction model

**Status**: Accepted (2026-10-10, user decision; tickets `[Not]`, epic linked from `docs/HANDOFF.md`). Builds on Architecture.md §137 (fixed TipTap extension whitelist) and the "Claude-designed UI" rule in `docs/guides/ui-components.md`. ADR-0022 (images) and ADR-0023 (note links) extend this ADR.

## Context

- Phase 6 shipped a working editor (#233–#235, #263): StarterKit + TextAlign/Highlight/Super-/Subscript/TableKit, and one fixed 20-button `EditingBar`. The user finds it far below Apple Notes/Notion: the heading button only toggles H1, H1–H3 barely differ visually, there is no ordered/task list button, tables can't be sized or edited (no row/column UI, `resizable: false`, and `table-layout: auto` makes columns jump while typing), the link button is a `window.prompt`, and nothing appears where you type (no selection menu, no slash menu).
- Figma (`Pages/Notities/Breakpoints`) designs none of this. Open questions `notes-prose-typography-not-designed`, `notes-table-ui-not-designed` and `notes-editingbar-link-no-url-input-designed` are still open.
- Since Tiptap 3.0 (June 2025) DragHandle, Details, TableOfContents, UniqueID, FileHandler, Emoji and Mathematics are MIT, and `@tiptap/markdown` is official (3.7). Only AI, Comments, Collaboration and Version History stay paid.
- Goal (user): the nicest notes page possible without bloat.

## Decision

1. **Typing first, chrome second.** Everything a note can contain is reachable from the keyboard: StarterKit's markdown input rules (`# `, `- `, `1. `, `[] `, `> `, ```` ``` ````) plus a `/` slash menu. Visible controls appear where they are needed:
   - **Bubble menu** on a text selection: desktop only (`(pointer: fine)`), because on iOS it collides with the native selection callout.
   - **Slash menu** on `/`: all devices.
   - **Table controls** when the cursor is inside a table.
   - **EditingBar** stays. On desktop it slims down to the essentials once the bubble and slash menus exist. On mobile it remains the primary surface and becomes context-aware (table actions while inside a table).
2. **Extension policy.** Only official MIT `@tiptap/*` packages, pinned to the same version as `@tiptap/core`. No `@tiptap-pro`, no community packages. Build small glue (slash menu, table menu) on official primitives (`@tiptap/suggestion`, `@tiptap/react/menus`) instead.
3. **Approved additions** (each lands in `lib/notes/extensions.ts`, the single whitelist; Architecture.md §137):

   | Capability | Package |
   | --- | --- |
   | Headings H1–H3 (`levels: [1, 2, 3]`) | StarterKit config |
   | Task lists | `TaskList`/`TaskItem` (`@tiptap/extension-list`) |
   | Resizable tables | `TableKit` with `resizable: true` |
   | Smart typography (NL quotes „…”) | `Typography` (`@tiptap/extension-typography`) |
   | Word count / reading time | `CharacterCount` (`@tiptap/extensions`, already installed) |
   | Block drag handle | `@tiptap/extension-drag-handle-react` |
   | Syntax-highlighted code | `CodeBlockLowlight` replacing StarterKit's `codeBlock` (same node name `codeBlock`, so stored docs stay valid), small fixed language set |
   | Collapsible sections | `Details` (`@tiptap/extension-details`) |
   | Markdown paste / copy / export | `@tiptap/markdown` (editor-side only; storage stays TipTap JSON) |
   | Images | ADR-0022 |
   | Links between notes | ADR-0023 |
   | Table of contents (optional, last) | `TableOfContents` + `UniqueID` |

   **Rejected**: font family, text colour and font size (`TextStyle`/`Color`/`FontFamily` bypass the semantic token system), Emoji (the OS picker exists), Mathematics, InvisibleCharacters, Collaboration/AI/Comments/Version History (paid, costs per use, single-user app), Notion-style databases, community slash/drag-handle packages.
4. **Stored-content rules.** Additive only: a node or mark type that has been stored is never removed or renamed without a migration rewriting stored documents. Every new node type lands in the same PR with (a) `lib/notes/document.ts` coverage (`toPlainText`/`deriveTitle`, so search via `notes.content_text` finds it) plus a unit test, (b) `.tiptap` CSS in `app/globals.css` using semantic tokens only, (c) nl + en strings. Pasted HTML/markdown passes through the ProseMirror schema, which drops anything outside the whitelist. Links allow `http`, `https` and `mailto` only. Never `dangerouslySetInnerHTML`.
5. **UI design.** The user explicitly asked Claude to design this round (2026-10-10). Every new surface follows "Claude-designed UI" (`docs/guides/ui-components.md`): existing components and bound semantic tokens only. A new component only when no existing one fits and it adds real value (judge critically, record why in its design note). Header `// design: Claude-designed on request (#NNN)`, a Ladle story, a visual baseline and a screenshot for the user. No new tokens without asking: a missing token is flagged, never hardcoded. This design round closes the three open questions above as each ticket lands.
6. **Menus.** Positioning via Floating UI (Tiptap 3's own dependency), styling via tokens. Every menu is keyboard-operable (arrows, Enter, Escape), has the right ARIA role (`menu`/`listbox`/`toolbar`) and returns focus to the editor on close.
7. **Weight.** Heavy dependencies (lowlight grammars, markdown parser) are imported lazily or limited to a fixed subset. No extension is added "just in case"; each must map to a ticket.

## Consequences

- The fixed toolbar stops being the only way in. Users who never touch it still get full formatting through markdown shortcuts and `/`.
- The extension whitelist grows from 6 to about 15 entries, all MIT, no new paid services or running costs (ADR-0018 priority 2 is unaffected). Images (ADR-0022) are the one addition with storage cost.
- Read-only renderers of `notes.content` must use the same list; `document.ts` stays the single plaintext derivation.
- The shipped `.tiptap` CSS stops being provisional once the typography and table tickets land.
- Stored documents written before this ADR stay valid: every change is additive, and `CodeBlockLowlight` keeps the `codeBlock` node name.

## Alternatives considered

- **Tiptap's paid Notion-like template / Pro extensions**: subscription cost and backend coupling for features a single-user app doesn't need.
- **Community packages (`tiptap-slash-command`, `tiptap-extension-global-drag-handle`)**: unclear v3 maintenance; the official primitives make the glue small.
- **A different editor (BlockNote, Lexical, Plate)**: would break the stored TipTap JSON and Architecture.md §137 for gains Tiptap's MIT set now covers.
- **Toolbar only, no contextual menus**: what exists today; it is the problem being solved.

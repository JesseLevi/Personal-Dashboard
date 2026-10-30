# WidgetSettingsPanel
Figma: none. Claude-designed (ADR-0034, ADR-0047) · Code: `app/(app)/_components/WidgetSettingsPanel.tsx` (shell) + `app/(app)/_components/WidgetSettings.tsx` (body)

## Anatomy
Level-2 `SidePanel` opened from `SettingsPanel`'s "iPhone-widget" button. `WidgetSettingsPanel` owns the panel, the delete confirmation and the delete error; `WidgetSettings` is the body, composed from `InputField`, `Button` and `Step`, no new component or token. The body, in order:
- Title and a one-line intro.
- "Tokens": the member's tokens (label, created, last used or "nooit") each with a transparent `Trash` button, or an empty line.
- Either the new-token form (`InputField` label + filled "Nieuwe token" `Button`) or, right after creating, the plaintext token once with a warning, a copy button and "Klaar". At 5 tokens the form is disabled and explains why.
- "Installeren": three `Step`s (Scriptable from the App Store, the Shortcut, the script copy button) and a Safari note.
- Footer: none, except `DeleteConfirm` (stacked) while a token deletion is being confirmed.

## Deliberate decisions
- Deleting a token swaps the panel's footer for `DeleteConfirm`; `WidgetSettings` only asks through `onAskDelete`. The pending token is cleared when the panel closes. A failed delete shows `settings.widget.errors.*` under the body.
- Dates use a fixed `Europe/Amsterdam` zone so server and browser render the same text.
- Copying the script fetches `/widget/atlas-widget.js` inside a `ClipboardItem` promise (keeps Safari's user gesture); a 404 shows `settings.widget.errors.scriptUnavailable`. Step 2 shows the manual Shortcut steps while `WIDGET_SHORTCUT_URL` (`lib/widget/install.ts`) is `null`.
- Tokens come from `listWidgetTokens` in the layout (empty before the hosted migration) and arrive through `SettingsPanel`. `initialCreatedToken` only seeds stories; at runtime the create action fills it.
- No footer when there is nothing to confirm; `SidePanel` then draws no footer strip.

## Gotchas
- Never `key` or remount the `SidePanel` (see `SidePanel.md`).
- `SettingsPanel` passes `open={open && widgetOpen}`, so closing the base panel closes this one.
- The panel scrolls, so the install steps sit below the fold in the panel stories; the `Content` story shows the four states (empty, with tokens, just created, limit reached) outside a panel.
- Ladle aliases `@/lib/widget/actions` to `.ladle/mocks/widget-actions.ts`; keep its exports in step with the real module.

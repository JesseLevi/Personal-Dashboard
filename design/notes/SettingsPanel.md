# SettingsPanel
Figma: desktop drawer `4160:33196` (inside a frame misleadingly named "Add recipi/Desktop"; the content is genuinely Settings), mobile pull-up panel `4160:34064`. Name fields and the two navigation buttons: Claude-designed on request · Code: `app/(app)/_components/SettingsPanel.tsx`

## Anatomy
Page-level composition, not a leaf component, so not in `design/figma-map.json` (same precedent as `BoardPanel.tsx` / `CardDetailPanel.tsx`). It reuses `SidePanel` outright (its `md:` split means one JSX tree for both breakpoints), no new organism. Children in order:
- `ButtonToggle` "Kleurenthema": three segments, Systeem (`SunMoon`) / Licht (`Sun`) / Donker (`Moon`), wired to `next-themes` `setTheme`. `app/layout.tsx`'s `ThemeProvider` is untouched.
- `InputField` "Taal": composed, not extended. `options`, `leadingIcon` (flag `NL`/`UK`, swapped per selection; the file has no US flag) and `trailingIcon="ChevronDown"` cover it with zero `InputField` changes. Figma's `State: Selected` is a captured-mid-interaction sample, not a request to force a focused look.
- `ImageUploadField` "Profielfoto": the same "Selecteer afbeelding" input field as the recipe flow, no preview and no remove button. The Sidebar shows the result. Accepts jpeg/png/webp.
- `InputField` Voornaam, then Achternaam: same atoms and semantic tokens. `display_name` holds the first name (the sidebar shows it); `last_name` is nullable. Max `DISPLAY_NAME_MAX_LENGTH` (40) each, app-level only. `autoComplete` given-name / family-name.
- Two full-width navigation `Button`s, `variant="white" align="left" trailingIcon="ArrowRight"`, no leading icon: "Verbanden en slim zoeken" opens `AiSettingsPanel`, "iPhone-widget" opens `WidgetSettingsPanel` (both `SidePanel level={2}`, rendered as siblings of this panel).
- Inline error `<p>` (`text-priority-urgent`) from `profile.errors.*`.
- Footer: one full-width filled `Save` Button, label switches to `savingLabel` while pending. It never swaps for a `DeleteConfirm`; the sub-panels own those.

## Deliberate decisions
- One full-width Opslaan footer on both breakpoints. Desktop draws one button; mobile draws a second destructive "Verwijderen" plus a typo "Oplsaan", residue of the Add-recipe panel this was copied from. No delete-account button.
- The footer Button has no `grow basis-0`. Unlike `BoardPanel`/`CardDetailPanel`, which wrap buttons in a `flex gap-inline-sm` row, this Button is a direct child of `SidePanel`'s `flex-col` footer; `grow basis-0` acts on the vertical axis there and collapsed it to 24px instead of 40px. A lone footer button already stretches to full width.
- Save order: `updateLocale` first, then ONE `updateName` write for both names (skipped when both trimmed values equal the current ones), then `setTheme`, then close. Server calls are the only part that can fail, `setTheme` cannot. On any failure the panel stays open with the inline error and neither theme nor close happens. Never render success unconditionally (the `AnimatedAddToBasketButton` lesson). `updateLocale` already calls `revalidatePath("/", "layout")` itself. Opslaan saves only theme, locale and names.
- Empty or whitespace names become `null`.
- `lastName` comes from the separate, error-swallowing `getLastName` query, not `getProfileForNav`, so a hosted DB without the matching migration only loses this field.
- The photo saves immediately through `uploadAvatar` / `removeAvatar`, not with Opslaan (an upload is too heavy to hold back, and a failed theme/name save must not drop it). Its own `avatarError` and pending state; errors from `profile.errors.*`. The actions revalidate the layout, so the Sidebar follows. The stored file is one 120×120 WebP (server re-encode, EXIF stripped); URL `?v=<updated_at>` busts the immutable cache.
- Sub-panels: `aiOpen` / `widgetOpen` live here; each sub-panel gets `open={open && aiOpen}`, and an effect resets both flags when this panel closes, so closing the base closes the sub-panels. Closing a sub-panel (X, Escape, scrim, drag) returns to this panel. `aiEnabled`, `aiAvailable` and `widgetTokens` still arrive from the layout through `AppShellNav` and are passed on.
- The navigation buttons use `ArrowRight` and no leading icon because the icon set has no `ChevronRight` and no phone glyph; the labels are `components.settingsPanel.ai.navLabel` and `settings.widget.title`.
- Ladle aliases `@/lib/profile/actions` and `@/lib/widget/actions` to `.ladle/mocks/*-actions.ts`; keep their exports in step with the real modules.
- No email/password fields: undesigned.
- `Eenheid` annotations on the Taal container are leftovers from the Add-recipe frame; ignored.

## Gotchas
- Never `key` or remount a `SidePanel` here or in the sub-panels (see `SidePanel.md`); the base and both sub-panels stay mounted and only `open` changes.
- `ButtonToggle` is uncontrolled (`defaultValue` only) and `next-themes`' `theme` is `undefined` until mount, while `SidePanel` keeps its children mounted (inert) when closed. A one-time `themeReady` flip keys a single `ButtonToggle` remount so it picks up the real theme; never key it on every click or the indicator animation breaks.
- `pendingLocale`, `pendingFirstName` and `pendingLastName` each re-sync via `useEffect` when their server prop changes. The panel never unmounts on same-layout navigation, and `updateLocale`'s revalidation re-renders `AppLayout` with the new values into the same mounted instance; without the effect a reopened panel shows stale values. Safe on the save path (same-value no-op).

## Open
- `docs/open-questions.md#settings-mobile-delete-button-not-built`

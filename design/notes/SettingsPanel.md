# SettingsPanel
Figma: desktop drawer `4160:33196` (inside a frame misleadingly named "Add recipi/Desktop"; the content is genuinely Settings), mobile pull-up panel `4160:34064`. Name fields: Claude-designed on request (#398, #404) · Code: `app/(app)/_components/SettingsPanel.tsx`

## Anatomy
Page-level composition, not a leaf component, so not in `design/figma-map.json` (same precedent as `BoardPanel.tsx` / `CardDetailPanel.tsx`). It reuses `SidePanel` outright (its `md:` split means one JSX tree for both breakpoints), no new organism (#265). Children in order:
- `ButtonToggle` "Kleurenthema": three segments, Systeem (`SunMoon`) / Licht (`Sun`) / Donker (`Moon`), wired to `next-themes` `setTheme`. `app/layout.tsx`'s `ThemeProvider` (#206) is untouched.
- `InputField` "Taal": composed, not extended. `options`, `leadingIcon` (flag `NL`/`UK`, swapped per selection; the file has no US flag) and `trailingIcon="ChevronDown"` cover it with zero `InputField` changes. Figma's `State: Selected` is a captured-mid-interaction sample, not a request to force a focused look.
- `InputField` Voornaam, then Achternaam (Claude-designed, #398, #404): same atoms and semantic tokens, no new tokens. `display_name` holds the first name (the sidebar shows it); `last_name` is nullable. Max `DISPLAY_NAME_MAX_LENGTH` (40) each, app-level only. `autoComplete` given-name / family-name.
- `ImageUploadField` (#434), now between Taal and Voornaam with a visible "Profielfoto" title like the other inputs: the same "Selecteer afbeelding" input field as the recipe flow, no preview and no remove button. The Sidebar shows the result. Accepts jpeg/png/webp.
- Inline error `<p>` (`text-priority-urgent`) from `profile.errors.*`.
- Footer: one full-width filled `Save` Button, label switches to `savingLabel` while pending.

## Deliberate decisions
- One full-width Opslaan footer on both breakpoints. Desktop draws one button; mobile draws a second destructive "Verwijderen" plus a typo "Oplsaan", residue of the Add-recipe panel this was copied from. No delete-account button (#265).
- The footer Button has no `grow basis-0`. Unlike `BoardPanel`/`CardDetailPanel`, which wrap buttons in a `flex gap-inline-sm` row, this Button is a direct child of `SidePanel`'s `flex-col` footer; `grow basis-0` acts on the vertical axis there and collapsed it to 24px instead of 40px. A lone footer button already stretches to full width (#265).
- Save order: `updateLocale` first, then ONE `updateName` write for both names (skipped when both trimmed values equal the current ones), then `setTheme`, then close. Server calls are the only part that can fail, `setTheme` cannot. On any failure the panel stays open with the inline error and neither theme nor close happens. Never render success unconditionally (the `AnimatedAddToBasketButton` lesson, #233). `updateLocale` already calls `revalidatePath("/", "layout")` itself (#162).
- Empty or whitespace names become `null` (#404).
- `lastName` comes from the separate, error-swallowing `getLastName` query, not `getProfileForNav`, so a hosted DB without the #404 migration only loses this field (#404).
- The photo saves immediately through `uploadAvatar` / `removeAvatar`, not with Opslaan (an upload is too heavy to hold back, and a failed theme/name save must not drop it). Its own `avatarError` and pending state; errors from `profile.errors.*`. The actions revalidate the layout, so the Sidebar follows. The stored file is one 120×120 WebP (server re-encode, EXIF stripped); URL `?v=<updated_at>` busts the immutable cache (#434).
- "Verbanden en slim zoeken" (ADR-0043 §2, #579) is a Claude-designed section from the `Checkbox` atom and text, last before the error line. It saves immediately through `setAiEnabled` (a consent, not a form field). Turning off swaps the footer for `DeleteConfirm` (it wipes the index). `aiAvailable` (`isEmbeddingConfigured()`) and `aiEnabled` (`getAiEnabled`, error-swallowing) come from the layout; unavailable shows "Nog niet beschikbaar" and a disabled checkbox.
- Ladle aliases `@/lib/profile/actions` to `.ladle/mocks/profile-actions.ts`; keep its exports in step with the real module.
- No email/password fields: undesigned (#265).
- `Eenheid` annotations on the Taal container are leftovers from the Add-recipe frame; ignored per the ticket (#265).

## Gotchas
- `ButtonToggle` is uncontrolled (`defaultValue` only) and `next-themes`' `theme` is `undefined` until mount, while `SidePanel` keeps its children mounted (inert) when closed. A one-time `themeReady` flip keys a single `ButtonToggle` remount so it picks up the real theme; never key it on every click or the indicator animation breaks.
- `pendingLocale`, `pendingFirstName` and `pendingLastName` each re-sync via `useEffect` when their server prop changes. The panel never unmounts on same-layout navigation, and `updateLocale`'s revalidation re-renders `AppLayout` with the new values into the same mounted instance; without the effect a reopened panel shows stale values. Safe on the save path (same-value no-op).
- No Ladle story or visual baseline for the panel itself: it imports server actions and `next-themes`.

## Open
- `docs/open-questions.md#settings-mobile-delete-button-not-built`

# ADR-0007: i18n via next-intl — NL default, EN maintained from day one

**Status**: Accepted

## Context

Vision.md §2 fixes NL/EN now with easy future language additions. The UI ships NL-first, but hardcoding strings would make EN (and every later language) a repo-wide refactor.

## Decision

- `next-intl` (MIT, App Router-native). Message catalogs in `messages/nl.json` and `messages/en.json`; locale from the `profiles.locale` preference.
- **No user-facing string literals in components** — everything through the message catalog, from the very first ticket. EN keys are filled in the same PR that adds the NL string (machine-assisted translation is fine for now).
- Dates/numbers through `next-intl` formatters, never manual formatting.
- AI-agent output language follows `profiles.locale` (the locale is passed into the LLM prompt); embeddings are language-agnostic by model choice (ADR-0006).

## Consequences

- Adding a language later = one new catalog file + locale option.
- CI can lint for missing keys between catalogs.
- Slight overhead per ticket (two catalog entries per string) — accepted as the price of the §2 fundament.

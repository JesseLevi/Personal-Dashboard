# ADR-0016: Kleding is out of the platform

**Status**: Accepted (user decision, 2026-08-13)

## Context

`Vision.md` listed Kleding (wardrobe: items with photos, categorisation, outfits) as one of the platform's modules, and ADR-0004 put its schema in Phase 6 as a backend-only module alongside Notities and Agenda — no UI, because no designs existed. Nothing was ever built: no migration, no `clothing_items`/`outfits`/`outfit_items` tables, no `clothing-photos` bucket, no server actions, no UI. The only footprint in the codebase was a nav item.

When Phase 6 was restructured into a full Notities UI phase (2026-08-13), the Figma file confirmed the same conclusion independently: the `Sidebar` component set (`3674:5664`) now has **five** nav items — Te doen, Notities, Recepten, Winkelmand, Assistent. Kleding is gone from the design.

## Decision

Kleding is dropped from the platform entirely. This is the user's scope decision, recorded here — not an architectural trade-off weighed by the implementer.

Concretely: no wardrobe tables, no `clothing-photos` bucket, no Kleding module in `Vision.md`, and no nav entry. The module is not "deferred" — it is out, and `Architecture.md` §11 does not carry it as a future round.

## Consequences

- **Nothing to migrate.** The tables and the bucket were never created, so removal is a code-and-docs change only. No `drop table` migration exists or should be written.
- `components/organisms/Sidebar.tsx` drops `"clothes"` from `SidebarItemId` and `NAV_ITEMS`, which makes `labels: Record<SidebarItemId, string>` a five-key record for every caller (`AppShellNav.tsx`, `Sidebar.stories.tsx`). The Sidebar's visual baselines were regenerated for the five-item rail.
- **`Shirt` stays in `IconName`** (`components/atoms/Icon.tsx`). That union is defined as one entry per icon in the Figma "Icons" frame (`3760:6187`), and `Icon/Shirt` is still in that frame (measured 2026-08-13 via the `figma-console` bridge). Removing it would break the atom's contract to satisfy a module boundary. Nothing else references it; `isIconName()` already guards database-stored icon names, so an unused entry costs one lucide import.
- **`components.sidebar.items.clothes` stays in `messages/nl.json` and `messages/en.json`** (user decision, same day): an unreferenced key in both catalogs is harmless, keeps the key sets identical (ADR-0007), and avoids churn in the one file that parallel Phase 6 branches all touch.
- `supabase/migrations/20260801000001_recipe_thumbnails_storage.sql` keeps its header comment calling itself "the pattern `clothing-photos` should mirror". Applied migrations are an append-only record (ADR-0009); a stale forward reference in a comment is not worth rewriting a file that has already run against hosted.
- The EXIF-strip requirement in `Architecture.md` §7 **stays** — it was written for clothing and recipe photos, and recipe thumbnails still need it. Only the wardrobe motivation dropped away.
- ADR-0004's phase list is a historical record and keeps its original text; its status line now points here.

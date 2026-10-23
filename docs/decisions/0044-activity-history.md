# ADR-0044: Activity history: an append-only log of what is bought and cooked

**Status**: Accepted (user decision, 2026-10-23, #575). Moves `Vision.md` scope for Winkelmand.

## Context

- The user wants Atlas to notice rhythms: "you buy peanut butter every four weeks, is it nearly finished?", or how often a recipe is cooked. That serves the Vision's second promise, fewer small decisions.
- Today nothing remembers this. Clearing a basket deletes its items, and a meal plan can be removed after the meal.
- A rhythm is counting and date arithmetic. Deterministic code does it better, cheaper and without sending anything to a provider (ADR-0018 §3). Embeddings (ADR-0043) are the wrong tool.
- The history only becomes useful after weeks of data, so recording should start well before Phase 9 builds detectors on it.
- `Vision.md` keeps "voorraadbeheer" out of Winkelmand. Counting stock stays out; suggesting from purchase rhythm is new scope.

## Decision

1. **One append-only table, `public.activity_events`**: `user_id`, `kind`, `occurred_at`, and the context per kind:
   - `kind` is text with a check (`basket_item_added`, `basket_item_checked`, `recipe_cooked`); a new kind widens the check;
   - `item_key`: the normalised item name (lower case, trimmed, collapsed whitespace), the grouping key for rhythms;
   - `item_name`, `quantity`, `unit` as entered; `shopping_list_id`, `shopping_list_item_id`, `recipe_id`, `meal_plan_id`, all `on delete set null`, so history outlives what it points at.
   - There is no actor column: who ticked an item in a shared basket is not recorded.
2. **Recording happens in the database, for every member**, independent of AI consent: it is the member's own data in their own database.
   - Triggers on `shopping_list_items` write `basket_item_added` on insert and `basket_item_checked` when `checked` turns true. Unchecking deletes that item's latest `basket_item_checked` event, so a mis-tap leaves no trace.
   - The trigger functions are `security definer` with `search_path = ''`. Clients get no insert or update grant on the table.
   - A row inside a shared basket carries the basket owner's `user_id`, like the item itself (ADR-0035), so the history belongs to the owner.
3. **Cooked = a planned meal whose day has passed.** `settle_cooked_meals()` writes one `recipe_cooked` event per past `meal_plans` row (unique on `meal_plan_id`). A plan attached to an event takes the event's date.
   - It runs lazily when a member opens Agenda or Recepten, and for everyone in the daily cron (ADR-0039 §6).
   - A plan removed before its day never counts. A plan left in place for a meal that was skipped does count; an explicit "not cooked" action is possible later.
4. **Access**: the owner reads and deletes their own events (a later "clear history" action). Nobody updates them. pgTAP covers isolation, the absent insert grant, the triggers and the settle function.
5. **Backfill once** in the migration, from what exists: current basket items (added at `created_at`, checked ones at `updated_at`) and past meal plans.
6. **Use**: Phase 9 detectors (#32) read this table with SQL, for example the median interval per `item_key` against the last purchase. An LLM only phrases a signal, and only for consenting members (ADR-0043 §2). Without AI the same numbers can drive plain suggestions.
7. **Scope**: no stock counts, no expiry dates, no prices. That is still "voorraadbeheer" and stays out.

## Consequences

- History starts on the day the migration reaches production; the backfill gives a thin head start. Ship it before the rest of Phase 8.
- Rows are small and grow with use: a few thousand a year per active member.
- `item_key` groups "pindakaas" and "Pindakaas " but not "pindakaas 600g" or "peanut butter". Matching against the ingredient library (ADR-0020) is a later refinement and needs no schema change.
- A member in a shared basket contributes to the owner's history and sees none of it.

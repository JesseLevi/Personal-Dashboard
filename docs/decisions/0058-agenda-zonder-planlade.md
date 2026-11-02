# ADR-0058: The Agenda has no plan tray

**Status**: Accepted (2026-11-01, user decision, #718). Amends ADR-0037 §8 (the tray and external dragging) and ADR-0051 §2 (where `cook_rhythm` shows). §3 amended by ADR-0059: Vandaag is gone, `cook_rhythm` shows on the Agenda day cards. §2 amended 2026-11-02 (user decision, #750): a recipe on an event is an attached meal.

## Context

- ADR-0037 planned by dragging recipes and cards from a tray ("Plannen") onto the calendar, on desktop and mobile. ADR-0041 later added quick add, which plans a meal (recipe search) and a card (new or open) from one surface, and ADR-0051 put the "Lang niet gekookt" group in the tray.
- Two ways to plan the same things cost a toggle, a column, a cookie, drag plumbing and two lists to keep in step. The user wants one.

## Decision

1. **The tray goes, on mobile and desktop**, with its toggle (the **Plannen** button, the ⋯ menu item, the `P` key) and the cookie that remembered it. Nothing is dragged onto the calendar from outside any more: FullCalendar's external dragging, dropping an item on the tray to clear its day, and dropping a recipe on an event are gone. Dragging items that are already on the calendar to another day or time stays.
2. **Planning from the Agenda goes through quick add** (ADR-0041): Maaltijd searches the recipes, Te doen picks "Nieuwe kaart" or an open card. The recipe page's `...` menu still plans with a chosen day and moment. **A recipe on an event is a meal attached to it** (amended, #750): choosing a recipe under Koppelen in quick add or in the event panel creates a `meal_plans` row with `calendar_event_id`, never a `calendar_event_links` row, so the meal shows on the day cards, the grid and the basket, and follows the event. The moment comes from the event's start (before 11:00 breakfast, 11:00–16:00 lunch, later or all-day dinner), editable in the meal panel. Cards and notes stay links; existing recipe links stay as they are.
3. **`cook_rhythm` shows on Vandaag only** (ADR-0057), with the signals of any kind it already lists (at most 5). Quick add does not show it. The Agenda has no loader for it.
4. **Acting still settles the signal** (ADR-0051 §3): planning a recipe with an open `cook_rhythm` through quick add (`createMealPlan`) marks it `acted`, as does the signal's own action.

## Consequences

- No schema change. `PlanRecipe` and `PlanCardGroup` stay as quick add's data; the card list keeps leaving cards in done columns out (ADR-0050).
- `PlanChoices` stays: the recipe page uses it.
- A member who had the tray open finds the calendar at full width; the stale `agenda-tray` cookie is ignored.

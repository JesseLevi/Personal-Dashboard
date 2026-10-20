import { useRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/atoms/Button";
import type { CalendarCategoryView } from "@/lib/agenda/calendars";
import type { PlanCardGroup } from "@/lib/agenda/plan-cards";
import type { PlanRecipe } from "@/lib/agenda/plan-recipes";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";
import { AgendaQuickAdd } from "./AgendaQuickAdd";

// The popover hangs from the "+ Nieuw" button; the visual suite freezes the clock on Thursday 2026-01-01,
// so "vrijdag" is 2 January. The window is `position: fixed`, so the wrapper gives the screenshot a height.
const TODAY = "2026-01-01";

const categories: CalendarCategoryView[] = [
  { id: "cal-1", name: null, color: "blue", isDefault: true },
  { id: "cal-social", name: "Sociaal", color: "pink", isDefault: false },
  { id: "cal-sport", name: "Sport", color: "orange", isDefault: false },
  { id: "cal-work", name: "Werk", color: "teal", isDefault: false },
];

const recipe = (id: string, title: string): PlanRecipe => ({
  id,
  title,
  servings: 4,
  categoryId: "main",
  categoryName: "Hoofdgerecht",
  timeMinutes: null,
  thumbnailUrl: null,
  thumbnailPath: null,
});
const recipes = [
  recipe("r1", "Warme dal"),
  recipe("r2", "Warme bloemkoolsoep"),
  recipe("r3", "Pasta pesto"),
  recipe("r4", "Vegan Currykikkererwten"),
  recipe("r5", "Blauwe bessen eiwitmuffins"),
];

const cardGroups: PlanCardGroup[] = [
  {
    boardId: "b1",
    boardName: "Mijn bord",
    cards: [
      { id: "c1", title: "Cadeau kopen voor opa", columnName: "Te doen", plannedFor: null },
      { id: "c2", title: "Fiets laten nakijken", columnName: "Bezig", plannedFor: null },
    ],
  },
];
const todoBoard = { boardName: "Mijn bord", columnId: "col-1", columnName: "Backlog" };

const created = async (): Promise<AgendaActionResult<{ id: string }>> => ({ success: true, data: { id: "new" } });
const planned = async (): Promise<AgendaActionResult> => ({ success: true, data: undefined });
const noop = () => {};

const props = {
  open: true,
  onClose: noop,
  today: TODAY,
  categories,
  recipes,
  cardGroups,
  todoBoard,
  onCreateEvent: created,
  onCreateMeal: created,
  onCreateCard: created,
  onPlanCard: planned,
  onAdded: noop,
  onMoreDetails: noop,
};

function Stage({ children }: { children: (anchorRef: RefObject<HTMLElement | null>) => ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <div className="min-h-screen">
      <div className="flex justify-end">
        <span ref={anchorRef} className="inline-flex">
          <Button variant="white" icon="Plus">
            Nieuw
          </Button>
        </span>
      </div>
      {children(anchorRef)}
    </div>
  );
}

const Window = ({ text, slot, forceSheet }: { text?: string; slot?: AgendaSpan; forceSheet?: boolean }) => (
  <Stage>
    {(anchorRef) => <AgendaQuickAdd {...props} anchorRef={anchorRef} initialText={text} slot={slot ?? null} forceSheet={forceSheet} />}
  </Stage>
);

// Event: the recognised parts are marked under the text and filled into the rows.
export const Event = () => <Window text="Etentje bij mama za 18u met Youri en Sanne" />;
export const EventAllDay = () => <Window text="film op vrijdag met youri" />;
export const EventRepeating = () => <Window text="yoga elke dinsdag 19u" />;
export const Meal = () => <Window text="Warme dal donderdag" />;
export const MealNoRecipe = () => <Window text="Lunch morgen" />;
export const Todo = () => <Window text="KPN bellen dinsdag" />;
export const Empty = () => <Window />;
export const NoDayRecognised = () => <Window text="Tandarts" />;

// A click or drag on an empty slot: its day and time fill the form.
export const FromSlot = () => (
  <Window slot={{ allDay: false, start: "2026-01-03T14:00:00", end: "2026-01-03T15:30:00" }} text="Boodschappen" />
);

// The bottom sheet below `lg` follows the viewport, so this story forces it.
export const Sheet = () => <Window forceSheet text="Etentje bij mama za 18u met Youri en Sanne" />;

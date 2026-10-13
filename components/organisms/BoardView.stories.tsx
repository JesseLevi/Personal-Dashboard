// figma: node-id=3680:1442
import { useState } from "react";
import { BoardView, type BoardColumn } from "./BoardView";
import { CardContentTicket } from "../molecules/CardContentTicket";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import { SharedRecipeOffer } from "./SharedRecipeOffer";
import { Tag } from "../atoms/Tag";
import { Button } from "../atoms/Button";
import { blurInTotalMs, blurOutTotalMs, usePrefersReducedMotion } from "../../lib/ui/blur-fade";
import en from "../../messages/en.json";

const addLabel = en.components.cardContainer.addLabel;
const editLabel = en.components.cardContainer.editLabel;
// Reuses the empty-state button copy CardContainer's own story already
// sources from the message catalog (#87) — no new key added by #90.
const emptyLabel = en.components.cardContainer.addItemLabel;

interface TicketItem {
  id: string;
  title: string;
  tag: { variant: "urgent" | "medium" | "low" | "neutral"; label: string };
}

// 4 columns, uneven counts, one genuinely empty — matches the fetched
// board's own Ideeën/Klaar/Bezig/Afgerond shape (node 3680:1442).
const initialTicketColumns: BoardColumn<TicketItem>[] = [
  {
    id: "ideeen",
    name: "Ideeën",
    icon: "Lightbulb",
    items: [
      { id: "t1", title: "HBO Wachtwoord updaten", tag: { variant: "medium", label: "Medium" } },
      { id: "t2", title: "Eric verjaardag cadeau kopen", tag: { variant: "urgent", label: "Urgent" } },
      { id: "t3", title: "Brainstormen bestemmingen zomervakantie", tag: { variant: "low", label: "Low" } },
    ],
  },
  {
    id: "klaar",
    name: "Klaar",
    icon: "AlarmClockCheck",
    items: [
      { id: "t4", title: "Nieuwe stofzuiger", tag: { variant: "medium", label: "Medium" } },
      { id: "t5", title: "Vloer dweilen", tag: { variant: "low", label: "Low" } },
    ],
  },
  {
    id: "bezig",
    name: "Bezig",
    icon: "Loader",
    items: [
      { id: "t6", title: "Belastingaangifte controleren", tag: { variant: "urgent", label: "Urgent" } },
    ],
  },
  {
    id: "afgerond",
    name: "Afgerond",
    icon: "CircleCheck",
    // Deliberately empty — exercises CardContainer's `emptyState` slot and
    // the droppable-when-empty column, not just the ticket's minimum 4.
    items: [],
  },
];

// Drag between/within columns — verified with mouse and keyboard against a
// real `pnpm ladle` render (see design/notes/BoardView.md). `onMove` only
// logs here: this component persists nothing, a later ticket writes it.
// `onItemClick` (#94) increments a visible counter + last-clicked title, the
// harness this ticket's own click-vs-drag Playwright check drives — a real
// drag must NOT also bump it, a plain click must.
export const Default = () => {
  const [columns, setColumns] = useState(initialTicketColumns);
  const [clickLog, setClickLog] = useState<{ count: number; lastTitle: string | null }>({
    count: 0,
    lastTitle: null,
  });
  return (
    <div>
      <p data-testid="click-log" className="p-2 text-sm">
        clicks: {clickLog.count} / last: {clickLog.lastTitle ?? "none"}
      </p>
      <BoardView
        columns={columns}
        addLabel={addLabel}
        editLabel={editLabel}
        emptyLabel={emptyLabel}
        renderItem={(item: TicketItem) => (
          <CardContentTicket title={item.title}>
            <Tag variant={item.tag.variant}>{item.tag.label}</Tag>
          </CardContentTicket>
        )}
        onItemClick={(item) =>
          setClickLog((current) => ({ count: current.count + 1, lastTitle: item.title }))
        }
        onMove={({ itemId, toColumnId, toIndex }) => {
          setColumns((current) => {
            const from = current.find((c) => c.items.some((i) => i.id === itemId));
            const item = from?.items.find((i) => i.id === itemId);
            if (!from || !item) return current;
            return current.map((column) => {
              if (column.id === from.id && column.id === toColumnId) return column;
              if (column.id === from.id) {
                return { ...column, items: column.items.filter((i) => i.id !== itemId) };
              }
              if (column.id === toColumnId) {
                const items = column.items.slice();
                items.splice(toIndex, 0, item);
                return { ...column, items };
              }
              return column;
            });
          });
        }}
      />
    </div>
  );
};

interface RecipeItem {
  id: string;
  name: string;
  duration: string;
}

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// Proof this organism is genuinely generic (#90 acceptance): same BoardView,
// same drag mechanics, a completely different Card-content molecule — no
// Te-Doen-specific field (priority, tag) leaks in here.
const recipeColumns: BoardColumn<RecipeItem>[] = [
  {
    id: "ontbijt",
    name: "Ontbijt",
    icon: "Croissant",
    items: [
      { id: "r1", name: "Amandel Pasta", duration: "20 min" },
      { id: "r2", name: "Havermout", duration: "10 min" },
    ],
  },
  {
    id: "lunch",
    name: "Lunch",
    icon: "Sandwich",
    items: [{ id: "r3", name: "Tosti", duration: "8 min" }],
  },
  {
    id: "diner",
    name: "Diner",
    icon: "CakeSlice",
    items: [
      { id: "r4", name: "Kip Curry", duration: "35 min" },
      { id: "r5", name: "Zalm met Groenten", duration: "25 min" },
      { id: "r6", name: "Linzensoep", duration: "30 min" },
    ],
  },
  { id: "toetjes", name: "Toetjes", icon: "Scroll", items: [] },
];

export const RecipeGeneric = () => (
  <BoardView
    columns={recipeColumns}
    addLabel={addLabel}
    editLabel={editLabel}
    emptyLabel={emptyLabel}
    renderItem={(item: RecipeItem) => (
      <CardContentRecipe
        imageUrl={PLACEHOLDER_IMAGE}
        name={item.name}
        duration={item.duration}
      />
    )}
  />
);

// #467: non-draggable content above a column's cards, also above an empty column's add button.
export const ColumnTop = () => (
  <BoardView
    columns={recipeColumns}
    addLabel={addLabel}
    editLabel={editLabel}
    emptyLabel={emptyLabel}
    renderColumnTop={(columnId) =>
      columnId === recipeColumns[0].id || columnId === recipeColumns[recipeColumns.length - 1].id ? (
        <SharedRecipeOffer
          name="Amandel Pasta"
          imageUrl={PLACEHOLDER_IMAGE}
          duration="20 min"
          inviterName="Youri"
          onAccept={() => {}}
          onDecline={() => {}}
        />
      ) : null
    }
    renderItem={(item: RecipeItem) => (
      <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name={item.name} duration={item.duration} />
    )}
  />
);

// Done styling: cards in the last column render muted (opacity-30 + line-through).
const lastColumnId = initialTicketColumns[initialTicketColumns.length - 1].id;
const mutedColumns: BoardColumn<TicketItem>[] = initialTicketColumns.map((column) =>
  column.id === lastColumnId
    ? { ...column, items: [{ id: "t7", title: "Ramen lappen", tag: { variant: "low", label: "Low" } }] }
    : column,
);

export const LastColumnMuted = () => (
  <BoardView
    columns={mutedColumns}
    addLabel={addLabel}
    editLabel={editLabel}
    emptyLabel={emptyLabel}
    isItemMuted={(_item, columnId) => columnId === lastColumnId}
    renderItem={(item: TicketItem) => (
      <CardContentTicket title={item.title}>
        <Tag variant={item.tag.variant}>{item.tag.label}</Tag>
      </CardContentTicket>
    )}
  />
);

// Board switch. Exit fade on the current board, then the other board
// mounts with the enter fade; the motion is dropped once it has played.
export const BoardSwitch = () => {
  const [board, setBoard] = useState<"tickets" | "recipes">("tickets");
  const [motion, setMotion] = useState<"in" | "out" | undefined>();
  const reduced = usePrefersReducedMotion();
  const next = board === "tickets" ? "recipes" : "tickets";

  function switchBoard() {
    setMotion("out");
    setTimeout(() => {
      setBoard(next);
      setMotion("in");
      setTimeout(() => setMotion(undefined), blurInTotalMs(4, reduced));
    }, blurOutTotalMs(4, reduced));
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={switchBoard} disabled={motion !== undefined}>
        Switch board
      </Button>
      {board === "tickets" ? (
        <BoardView
          key="tickets"
          columns={initialTicketColumns}
          columnMotion={motion}
          addLabel={addLabel}
          editLabel={editLabel}
          emptyLabel={emptyLabel}
          renderItem={(item: TicketItem) => (
            <CardContentTicket title={item.title}>
              <Tag variant={item.tag.variant}>{item.tag.label}</Tag>
            </CardContentTicket>
          )}
        />
      ) : (
        <BoardView
          key="recipes"
          columns={recipeColumns}
          columnMotion={motion}
          addLabel={addLabel}
          editLabel={editLabel}
          emptyLabel={emptyLabel}
          renderItem={(item: RecipeItem) => (
            <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name={item.name} duration={item.duration} />
          )}
        />
      )}
    </div>
  );
};

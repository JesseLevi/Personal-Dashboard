// One pure builder per source type: row in, canonical text out (ADR-0043 §3).
// Only fields that bump the source's `updated_at` go in, and dates and
// container names (calendars, boards) stay out, so repeats hash alike. An
// empty string means "nothing to embed".

const join = (parts: Array<string | null | undefined>, separator = "\n\n") =>
  parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(separator);

const byPosition = <T extends { position: number }>(rows: T[]) => [...rows].sort((a, b) => a.position - b.position);

export function noteText(note: { title: string; content_text: string }): string {
  return join([note.title, note.content_text]);
}

export function recipeText(recipe: {
  title: string;
  ingredients: Array<{ name: string; position: number }>;
  steps: Array<{ instruction: string; position: number }>;
}): string {
  return join([
    recipe.title,
    join(
      byPosition(recipe.ingredients).map((i) => i.name),
      "\n",
    ),
    join(
      byPosition(recipe.steps).map((s) => s.instruction),
      "\n",
    ),
  ]);
}

export function cardText(card: { title: string; description: string | null; labels: string[] }): string {
  return join([card.title, card.description, join([...card.labels].sort(), ", ")]);
}

export function eventText(event: { title: string; location: string | null; description: string | null }): string {
  return join([event.title, event.location, event.description]);
}

/** Name only, never the quantity: "pindakaas" hashes the same every time it is added. */
export function shoppingItemText(item: { name: string }): string {
  return join([item.name]);
}

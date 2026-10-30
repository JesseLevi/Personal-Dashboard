import tokens from "@/design/tokens.json";
import { isAgendaColor, type AgendaColor } from "@/lib/agenda/colors";

// Event accent colours for the widget, read from design/tokens.json (ADR-0040,
// ADR-0047 §2): the script holds no palette.

export type WidgetColor = { light: string; dark: string };

type Primitives = Record<string, { value: string }>;

const primitives = tokens.primitive.color as unknown as Primitives;
const semantic = tokens.semantic.color as unknown as Record<string, { light: string; dark: string }>;

function resolve(ref: string): string {
  const name = /^\{primitive\.color\.([^}]+)\}$/.exec(ref)?.[1];
  const value = name ? primitives[name]?.value : undefined;
  if (!value) throw new Error(`unresolvable token reference: ${ref}`);
  return value;
}

/** Light and dark value of `event-<key>-accent`. */
export function widgetColor(key: AgendaColor): WidgetColor {
  const token = semantic[`event-${key}-accent`];
  if (!token) throw new Error(`missing token event-${key}-accent`);
  return { light: resolve(token.light), dark: resolve(token.dark) };
}

/** Like `widgetColor` for a stored palette key; null when the key is not in the palette. */
export function widgetColorOrNull(key: unknown): WidgetColor | null {
  return isAgendaColor(key) ? widgetColor(key) : null;
}

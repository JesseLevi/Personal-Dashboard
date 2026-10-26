// Read contract of the Assistent signals (ADR-0046 §8-9). No surface uses it yet.

export type AssistantSignalKind = "buy_rhythm" | "cook_rhythm" | "pattern";

/** Rhythms are phrased at display time (`t(key, values)`); patterns carry stored plain text. */
export type AssistantSignalText =
  | { key: "assistant.signals.buyRhythm" | "assistant.signals.cookRhythm"; values: Record<string, string | number> }
  | { plain: string };

export type AssistantSignalAction =
  | { type: "add_to_basket"; itemName: string; labelKey: "assistant.signals.actions.addToBasket" }
  | { type: "link"; href: string; labelKey: "assistant.signals.actions.openRecipe" | "assistant.signals.actions.open" };

export interface AssistantSignal {
  id: string;
  kind: AssistantSignalKind;
  createdAt: string;
  text: AssistantSignalText;
  action: AssistantSignalAction;
}

export type AssistantActionError = "invalid-input" | "unauthenticated" | "not-found" | "already-handled" | "generic";

export type AssistantActionResult = { success: true; href?: string } | { success: false; error: AssistantActionError };

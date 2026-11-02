// The Te doen picker of quick add: open cards as select options, one group per board.
import type { PlanCard, PlanCardGroup } from "@/lib/agenda/plan-cards";

export interface CardSelectOption {
  value: string;
  label: string;
}

export type CardSelectEntry = CardSelectOption | { label: string; options: CardSelectOption[] };

/**
 * "Nieuwe kaart" first and ungrouped, then each board's cards by title. With one board the cards sit flat;
 * with several, each board is a group named after it. A board without a card gets no group.
 */
export function buildCardSelectOptions(groups: readonly PlanCardGroup[], newCardLabel: string): CardSelectEntry[] {
  const filled = groups.filter((group) => group.cards.length > 0);
  const toOption = (card: PlanCard): CardSelectOption => ({ value: card.id, label: card.title });
  return [
    { value: "", label: newCardLabel },
    ...(filled.length > 1
      ? filled.map((group) => ({ label: group.boardName, options: group.cards.map(toOption) }))
      : filled.flatMap((group) => group.cards.map(toOption))),
  ];
}

/** The card with this id and the name of its board, or `null`. */
export function findPlanCard(groups: readonly PlanCardGroup[], cardId: string): { card: PlanCard; boardName: string } | null {
  for (const group of groups) {
    const card = group.cards.find((candidate) => candidate.id === cardId);
    if (card) return { card, boardName: group.boardName };
  }
  return null;
}

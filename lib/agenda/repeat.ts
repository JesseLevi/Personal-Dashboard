import type { AgendaRepeatRule } from "@/lib/agenda/types";

// The "Herhalen" choices of the event panel (ADR-0042 §1) and the rule each one stands for.
// `custom` only appears for a stored rule none of the choices produces.
export const REPEAT_CHOICES = ["none", "daily", "weekly", "biweekly", "monthly", "yearly"] as const;
export type RepeatChoice = (typeof REPEAT_CHOICES)[number] | "custom";

const RULES: Record<Exclude<RepeatChoice, "none" | "custom">, Pick<AgendaRepeatRule, "freq" | "interval">> = {
  daily: { freq: "daily", interval: 1 },
  weekly: { freq: "weekly", interval: 1 },
  biweekly: { freq: "weekly", interval: 2 },
  monthly: { freq: "monthly", interval: 1 },
  yearly: { freq: "yearly", interval: 1 },
};

/** The rule for a choice and an end date (null = never); null when the event does not repeat. */
export function choiceToRule(
  choice: RepeatChoice,
  until: string | null,
  custom?: AgendaRepeatRule | null,
): AgendaRepeatRule | null {
  if (choice === "none") return null;
  if (choice === "custom") return custom ? { ...custom, until } : null;
  return { ...RULES[choice], until };
}

/** The choice that produces a stored rule, or `custom` when none does. */
export function ruleToChoice(rule: AgendaRepeatRule | null): RepeatChoice {
  if (!rule) return "none";
  for (const [choice, candidate] of Object.entries(RULES)) {
    if (candidate.freq === rule.freq && candidate.interval === rule.interval) return choice as RepeatChoice;
  }
  return "custom";
}

/** Whether two rules differ in how often or until when the event repeats. */
export function ruleChanged(a: AgendaRepeatRule | null, b: AgendaRepeatRule | null): boolean {
  if (!a || !b) return a !== b;
  return a.freq !== b.freq || a.interval !== b.interval || a.until !== b.until;
}

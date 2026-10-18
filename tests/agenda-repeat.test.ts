import { describe, expect, it } from "vitest";
import { REPEAT_CHOICES, choiceToRule, ruleChanged, ruleToChoice } from "@/lib/agenda/repeat";
import { createEventSchema, deleteEventSchema, repeatRuleSchema, updateEventSchema } from "@/lib/agenda/schemas";

describe("repeat choices", () => {
  it("maps every choice to a rule and back", () => {
    for (const choice of REPEAT_CHOICES.filter((c) => c !== "none")) {
      const rule = choiceToRule(choice, null);
      expect(rule).not.toBeNull();
      expect(ruleToChoice(rule)).toBe(choice);
    }
  });

  it("offers the five repeats of ADR-0042 and no repeat", () => {
    expect(choiceToRule("none", "2026-12-31")).toBeNull();
    expect(choiceToRule("daily", null)).toEqual({ freq: "daily", interval: 1, until: null });
    expect(choiceToRule("biweekly", "2026-12-31")).toEqual({ freq: "weekly", interval: 2, until: "2026-12-31" });
    expect(choiceToRule("monthly", null)).toEqual({ freq: "monthly", interval: 1, until: null });
    expect(choiceToRule("yearly", null)).toEqual({ freq: "yearly", interval: 1, until: null });
  });

  it("keeps a stored rule no choice produces as custom", () => {
    const stored = { freq: "daily" as const, interval: 3, until: null };
    expect(ruleToChoice(stored)).toBe("custom");
    expect(choiceToRule("custom", "2026-06-01", stored)).toEqual({ ...stored, until: "2026-06-01" });
    expect(ruleToChoice(null)).toBe("none");
  });

  it("sees a changed rule", () => {
    const weekly = choiceToRule("weekly", null);
    expect(ruleChanged(weekly, choiceToRule("weekly", null))).toBe(false);
    expect(ruleChanged(weekly, choiceToRule("biweekly", null))).toBe(true);
    expect(ruleChanged(weekly, choiceToRule("weekly", "2026-12-31"))).toBe(true);
    expect(ruleChanged(null, null)).toBe(false);
    expect(ruleChanged(null, weekly)).toBe(true);
  });
});

describe("repeat schemas", () => {
  const span = { title: "Tandarts", startsAt: "2026-10-20T07:00:00.000Z", endsAt: "2026-10-20T08:00:00.000Z", allDay: false, location: null, description: null };

  it("accepts a rule with an end date or none, interval 1 to 99", () => {
    expect(repeatRuleSchema.safeParse({ freq: "weekly", interval: 2, until: null }).success).toBe(true);
    expect(repeatRuleSchema.safeParse({ freq: "yearly", interval: 99, until: "2030-01-01" }).success).toBe(true);
    expect(repeatRuleSchema.safeParse({ freq: "weekly", interval: 0, until: null }).success).toBe(false);
    expect(repeatRuleSchema.safeParse({ freq: "weekly", interval: 100, until: null }).success).toBe(false);
    expect(repeatRuleSchema.safeParse({ freq: "hourly", interval: 1, until: null }).success).toBe(false);
    expect(repeatRuleSchema.safeParse({ freq: "daily", interval: 1, until: "morgen" }).success).toBe(false);
  });

  it("takes a rule on create and a scope on update and delete", () => {
    expect(createEventSchema.safeParse({ ...span, repeat: { freq: "daily", interval: 1, until: null } }).success).toBe(true);
    expect(createEventSchema.safeParse(span).success).toBe(true);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(updateEventSchema.safeParse({ ...span, id, scope: "following", repeat: { freq: "daily", interval: 1, until: null } }).success).toBe(true);
    expect(updateEventSchema.safeParse({ ...span, id, scope: "sometimes" }).success).toBe(false);
    expect(deleteEventSchema.safeParse({ id, scope: "all" }).success).toBe(true);
    expect(deleteEventSchema.safeParse({ id }).success).toBe(true);
    expect(deleteEventSchema.safeParse({ id, scope: "x" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { blankDraft, toDraft, toInput, validateDraft } from "@/lib/draft";
import { buildFunctionRunSheet, buildFunctions, sortFunctions } from "@/lib/engine/functions";
import { buildPlan } from "@/lib/engine/plan";
import type { EventFunction } from "@/lib/engine/types";
import { planToIcs } from "@/lib/ics";
import { eventSummary, formatDate } from "@/lib/labels";
import { sampleWedding } from "@/lib/sample";
import { EventInputSchema } from "@/lib/schema";
import { makeInput, TODAY } from "./fixtures";

const threeDays: EventFunction[] = [
  { kind: "wedding", day: 3, startTime: "18:30" },
  { kind: "mehendi", day: 1, startTime: "16:00", guests: 120 },
  { kind: "haldi", day: 1, startTime: "10:00", guests: 80 },
  { kind: "sangeet", day: 2, startTime: "19:00" },
];
const multi = makeInput({ days: 3, functions: threeDays, budget: 1_800_000, guests: 220 });

describe("wedding functions", () => {
  it("orders functions by day, then time", () => {
    expect(sortFunctions(threeDays).map((f) => f.kind)).toEqual(["haldi", "mehendi", "sangeet", "wedding"]);
  });

  it("dates each function from the first day and splits the whole budget across them", () => {
    const fns = buildFunctions(multi);
    expect(fns.map((f) => f.date)).toEqual(["2027-04-10", "2027-04-10", "2027-04-11", "2027-04-12"]);
    expect(fns.reduce((s, f) => s + f.amount, 0)).toBe(1_800_000);
    const by = Object.fromEntries(fns.map((f) => [f.kind, f]));
    // The wedding, with everyone and the heaviest weight, costs most; the small haldi least.
    expect(by.wedding!.amount).toBeGreaterThan(by.sangeet!.amount);
    expect(by.haldi!.amount).toBeLessThan(by.mehendi!.amount);
    expect(by.haldi!.guests).toBe(80);
    expect(by.sangeet!.guests).toBe(220);
  });

  it("never gives a function more guests than the event", () => {
    const input = makeInput({ guests: 50, functions: [{ kind: "sangeet", day: 1, startTime: "19:00", guests: 400 }] });
    expect(buildFunctions(input)[0]!.guests).toBe(50);
  });

  it("builds a dated run sheet per function and uses it in the plan", () => {
    const sheet = buildFunctionRunSheet(multi);
    expect(new Set(sheet.map((s) => s.function))).toEqual(new Set(["haldi", "mehendi", "sangeet", "wedding"]));
    expect(sheet.find((s) => s.function === "sangeet")!.date).toBe("2027-04-11");
    const plan = buildPlan(multi, TODAY);
    expect(plan.runSheet).toEqual(sheet);
    expect(plan.functions).toHaveLength(4);
  });

  it("adds tasks only for the functions that are on", () => {
    const ids = buildPlan(multi, TODAY).tasks.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["mehendi-artists", "sangeet-practice", "haldi-kit", "function-transport"]),
    );
    const single = buildPlan(makeInput(), TODAY);
    expect(single.functions).toEqual([]);
    expect(single.tasks.map((t) => t.id)).not.toContain("mehendi-artists");
  });

  it("puts each function in the calendar file on its own date", () => {
    const ics = planToIcs(buildPlan(multi, TODAY), "abc");
    expect(ics).toContain("SUMMARY:Riya and Arjun's wedding: Sangeet");
    expect(ics).toContain("UID:fn-sangeet-abc@jashn\r\nDTSTAMP");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270411");
    expect(ics).not.toContain("UID:event-abc");
  });

  it("summarises a multi-day plan in one line", () => {
    const day = formatDate("2027-04-10");
    expect(eventSummary(multi)).toBe(`Wedding over 3 days from ${day}, Dehradun. 4 functions.`);
    expect(eventSummary(makeInput())).toBe(`Wedding on ${day} at 18:00, Dehradun.`);
  });
});

describe("the schema for functions", () => {
  it("fills in one day and no functions for plans saved before this feature", () => {
    const old: Record<string, unknown> = { ...makeInput() };
    delete old.days;
    delete old.functions;
    const parsed = EventInputSchema.parse(old);
    expect(parsed.days).toBe(1);
    expect(parsed.functions).toEqual([]);
  });

  it("rejects a function after the last day, a repeated function and a bad time", () => {
    const after = makeInput({ days: 2, functions: [{ kind: "haldi", day: 3, startTime: "10:00" }] });
    expect(EventInputSchema.safeParse(after).success).toBe(false);
    const twice = makeInput({
      days: 2,
      functions: [
        { kind: "haldi", day: 1, startTime: "10:00" },
        { kind: "haldi", day: 2, startTime: "10:00" },
      ],
    });
    expect(EventInputSchema.safeParse(twice).success).toBe(false);
    const time = makeInput({ functions: [{ kind: "haldi", day: 1, startTime: "25:00" }] });
    expect(EventInputSchema.safeParse(time).success).toBe(false);
    expect(EventInputSchema.safeParse(makeInput({ days: 4 })).success).toBe(false);
  });

  it("accepts the sample wedding", () => {
    expect(EventInputSchema.safeParse(sampleWedding(TODAY)).success).toBe(true);
  });
});

describe("functions in the wizard draft", () => {
  const base = {
    ...blankDraft(TODAY),
    type: "wedding" as const,
    title: "R and A",
    city: "Pune",
    guests: "200",
    budget: "20 lakh",
  };

  it("round-trips functions, with a blank guest count meaning everyone", () => {
    const draft = toDraft(multi);
    expect(draft.functions.find((f) => f.kind === "sangeet")!.guests).toBe("");
    const input = EventInputSchema.parse(toInput(draft));
    expect(input.functions).toEqual(multi.functions);
  });

  it("drops functions when the event is not a wedding", () => {
    const draft = { ...base, type: "birthday" as const, days: 3, functions: toDraft(multi).functions };
    const input = EventInputSchema.parse(toInput(draft));
    expect(input.days).toBe(1);
    expect(input.functions).toEqual([]);
  });

  it("explains a function guest count that is not a number", () => {
    const draft = {
      ...base,
      days: 1,
      functions: [{ kind: "haldi" as const, day: 1, startTime: "10:00", guests: "0" }],
    };
    expect(validateDraft(draft, TODAY).functions).toMatch(/guests/);
  });
});

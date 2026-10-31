import { describe, expect, it } from "vitest";
import { addDays, addMinutes, daysBetween, isValidDate } from "@/lib/engine/dates";
import { formatCompactINR, parseAmount } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import { buildTasks } from "@/lib/engine/timeline";
import { makeInput, TODAY } from "./fixtures";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("timeline", () => {
  it("uses ideal lead times when there is plenty of time", () => {
    const date = "2027-06-01";
    const tasks = buildTasks(makeInput({ date }), TODAY, daysBetween(TODAY, date));
    expect(tasks.some((t) => t.compressed)).toBe(false);
    expect(tasks.find((t) => t.id === "invites")?.due).toBe(addDays(date, -60));
  });

  it("squeezes long tasks into the time left without changing their order", () => {
    for (const daysToGo of [3, 10, 25, 45, 90]) {
      const date = addDays(TODAY, daysToGo);
      const tasks = buildTasks(makeInput({ date }), TODAY, daysToGo);
      for (const t of tasks) {
        expect(t.due >= TODAY && t.due <= date).toBe(true);
      }
      const byLead = [...tasks].sort((a, b) => b.idealLeadDays - a.idealLeadDays);
      for (let i = 1; i < byLead.length; i++) {
        expect(byLead[i].due >= byLead[i - 1].due).toBe(true);
      }
    }
  });

  it("marks squeezed tasks as compressed", () => {
    const tasks = buildTasks(makeInput({ date: addDays(TODAY, 20) }), TODAY, 20);
    expect(tasks.find((t) => t.id === "venue")?.compressed).toBe(true);
    expect(tasks.find((t) => t.id === "kit")?.compressed).toBe(false);
  });

  it("only includes tasks that fit the event", () => {
    const plain = ids(buildTasks(makeInput({ type: "birthday" }), TODAY, 160));
    expect(plain).not.toContain("permits");
    expect(plain).not.toContain("tent");
    expect(plain).not.toContain("attire");
    const outdoorCommunity = ids(buildTasks(makeInput({ type: "community", setting: "outdoor", venueBooked: true }), TODAY, 160));
    expect(outdoorCommunity).toEqual(expect.arrayContaining(["permits", "tent", "venue-confirm"]));
    expect(outdoorCommunity).not.toContain("venue");
  });
});

describe("buildPlan", () => {
  it("is deterministic", () => {
    expect(buildPlan(makeInput(), TODAY)).toEqual(buildPlan(makeInput(), TODAY));
  });

  it("dates vendor deadlines from the matching task", () => {
    const plan = buildPlan(makeInput(), TODAY);
    const caterer = plan.vendors.find((v) => v.id === "caterer");
    expect(caterer?.bookBy).toBe(plan.tasks.find((t) => t.id === "caterer")?.due);
  });

  it("picks vendors from context", () => {
    const kids = buildPlan(makeInput({ type: "birthday", preferences: ["kidsFriendly"] }), TODAY);
    expect(ids(kids.vendors)).toContain("cake");
    expect(ids(kids.vendors)).not.toContain("makeup");
    expect(kids.vendors.find((v) => v.id === "entertainment")?.questions[0]).toMatch(/children's entertainer/);
    const eco = buildPlan(makeInput({ preferences: ["ecoFriendly", "vegetarianOnly"] }), TODAY);
    expect(ids(eco.vendors)).toContain("sanitation");
    expect(eco.vendors.find((v) => v.id === "caterer")?.questions.join(" ")).toMatch(/vegetarian.*food bank|food bank/s);
  });

  it("derives logistics from the headcount", () => {
    const plan = buildPlan(makeInput({ guests: 200 }), TODAY);
    const q = Object.fromEntries(plan.logistics.map((l) => [l.id, l.quantity]));
    expect(q).toMatchObject({ plates: 210, seats: 210, tables: 27, staff: 8, parking: 67 });
  });

  it("flags a food budget that is far below typical", () => {
    const plan = buildPlan(makeInput({ guests: 500, budget: 300_000 }), TODAY);
    expect(plan.insights[0]).toMatchObject({ id: "catering-low", severity: "critical" });
  });

  it("warns about the monsoon for outdoor events only", () => {
    const outdoor = buildPlan(makeInput({ date: "2027-07-15", setting: "outdoor" }), TODAY);
    const indoor = buildPlan(makeInput({ date: "2027-07-15" }), TODAY);
    expect(ids(outdoor.insights)).toContain("monsoon");
    expect(ids(indoor.insights)).not.toContain("monsoon");
  });

  it("warns about music after 10 pm and peak season", () => {
    const plan = buildPlan(makeInput({ date: "2026-12-12", startTime: "20:00", priorities: ["entertainment"] }), TODAY);
    expect(ids(plan.insights)).toEqual(expect.arrayContaining(["noise", "season"]));
  });

  it("flags a rushed event", () => {
    const plan = buildPlan(makeInput({ date: addDays(TODAY, 10) }), TODAY);
    expect(ids(plan.insights)).toContain("rush");
    expect(ids(plan.insights)).not.toContain("compressed");
  });

  it("sorts insights by severity", () => {
    const order = { critical: 0, warning: 1, info: 2 };
    const plan = buildPlan(makeInput({ guests: 600, budget: 400_000, setting: "outdoor", date: "2027-01-20", venueBooked: true }), TODAY);
    const ranks = plan.insights.map((i) => order[i.severity]);
    expect(ranks).toEqual([...ranks].sort());
  });
});

describe("helpers", () => {
  it("parses Indian amount styles", () => {
    expect(parseAmount("5 lakh")).toBe(500_000);
    expect(parseAmount("budget 2.5L")).toBe(250_000);
    expect(parseAmount("1 crore")).toBe(10_000_000);
    expect(parseAmount("Rs 80k")).toBe(80_000);
    expect(parseAmount("4,50,000")).toBe(450_000);
    expect(parseAmount("no amount")).toBeNull();
  });

  it("formats compact rupees", () => {
    expect(formatCompactINR(440_000)).toMatch(/4\.4 L$/);
    expect(formatCompactINR(12_000_000)).toMatch(/1\.2 Cr$/);
  });

  it("handles dates and times", () => {
    expect(isValidDate("2027-02-30")).toBe(false);
    expect(daysBetween("2026-11-01", "2026-12-01")).toBe(30);
    expect(addMinutes("23:30", 90)).toBe("01:00");
    expect(addMinutes("01:00", -120)).toBe("23:00");
  });
});

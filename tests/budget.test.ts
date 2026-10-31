import { describe, expect, it } from "vitest";
import { BASE_SHARES, buildBudget, splitExact } from "@/lib/engine/budget";
import { EVENT_TYPES } from "@/lib/engine/types";
import { makeInput } from "./fixtures";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const line = (b: ReturnType<typeof buildBudget>, c: string) => b.lines.find((l) => l.category === c);

describe("base shares", () => {
  it.each(EVENT_TYPES)("%s starts at exactly 100%%", (type) => {
    expect(sum(Object.values(BASE_SHARES[type]))).toBe(100);
  });
});

describe("splitExact", () => {
  it("always sums to the amount, in whole units", () => {
    for (const amount of [1, 99, 100_001, 1_234_567, 9_999_999]) {
      const parts = splitExact(amount, [3, 1, 7, 2.5], amount >= 100_000 ? 100 : 1);
      expect(sum(parts)).toBe(amount);
    }
  });

  it("returns zeros when there is nothing to split", () => {
    expect(splitExact(0, [1, 2], 1)).toEqual([0, 0]);
  });
});

describe("buildBudget", () => {
  it("adds up to the exact total for every event type and many totals", () => {
    for (const type of EVENT_TYPES) {
      for (const budget of [15_000, 99_999, 250_050, 3_333_333]) {
        const b = buildBudget(
          makeInput({ type, budget, setting: "outdoor", priorities: ["food", "decor", "photography"] }),
        );
        expect(sum(b.lines.map((l) => l.amount))).toBe(budget);
        expect(b.lines.every((l) => l.amount >= 0)).toBe(true);
      }
    }
  });

  it("keeps contingency at its base share when priorities change", () => {
    const plain = buildBudget(makeInput());
    const boosted = buildBudget(makeInput({ priorities: ["photography", "decor", "food"] }));
    expect(line(boosted, "contingency")?.amount).toBe(line(plain, "contingency")?.amount);
  });

  it("raises the top priority's share and lowers non-priorities", () => {
    const plain = buildBudget(makeInput());
    const boosted = buildBudget(makeInput({ priorities: ["photography"] }));
    expect(line(boosted, "photography")!.amount).toBeGreaterThan(line(plain, "photography")!.amount);
    expect(line(boosted, "catering")!.amount).toBeLessThan(line(plain, "catering")!.amount);
    expect(line(boosted, "photography")!.reasons.join(" ")).toMatch(/top priority/);
  });

  it("drops the venue line when the venue is already arranged", () => {
    const b = buildBudget(makeInput({ venueBooked: true, priorities: ["venue"] }));
    expect(line(b, "venue")).toBeUndefined();
    expect(sum(b.lines.map((l) => l.amount))).toBe(2_000_000);
  });

  it("adds outdoor costs to decor, logistics and contingency", () => {
    const indoor = buildBudget(makeInput({ type: "engagement" }));
    const outdoor = buildBudget(makeInput({ type: "engagement", setting: "outdoor" }));
    expect(line(indoor, "logistics")).toBeUndefined();
    expect(line(outdoor, "logistics")!.amount).toBeGreaterThan(0);
    expect(line(outdoor, "contingency")!.amount).toBeGreaterThan(line(indoor, "contingency")!.amount);
  });

  it("keeps locked lines and rebalances the rest", () => {
    const b = buildBudget(makeInput(), { catering: 900_000 });
    expect(line(b, "catering")).toMatchObject({ amount: 900_000, locked: true });
    expect(sum(b.lines.map((l) => l.amount))).toBe(2_000_000);
    expect(b.overBy).toBe(0);
  });

  it("reports overspend instead of hiding it", () => {
    const b = buildBudget(makeInput({ budget: 100_000 }), { catering: 80_000, decor: 50_000 });
    expect(b.overBy).toBe(30_000);
    expect(b.lines.filter((l) => !l.locked).every((l) => l.amount === 0)).toBe(true);
  });

  it("puts contingency last and reports the per-guest cost", () => {
    const b = buildBudget(makeInput());
    expect(b.lines.at(-1)?.category).toBe("contingency");
    expect(b.perGuest).toBe(10_000);
  });
});

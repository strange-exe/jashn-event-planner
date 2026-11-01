import { describe, expect, it } from "vitest";
import { applyChanges, describeChange } from "@/lib/engine/changes";
import { parseIntent } from "@/lib/engine/intent";
import type { EventInput } from "@/lib/engine/types";
import { cleanText, EventInputSchema, LIMITS, toChange, type Change } from "@/lib/schema";
import { makeInput } from "./fixtures";

describe("parseIntent", () => {
  it.each([
    ["Cut the budget by 20%", [{ op: "scaleBudget", percent: -20 }]],
    ["increase budget by 10 percent", [{ op: "scaleBudget", percent: 10 }]],
    ["set the budget to 12 lakh", [{ op: "setBudget", value: 1_200_000 }]],
    ["add 50 more guests", [{ op: "addGuests", value: 50 }]],
    ["remove 20 people", [{ op: "addGuests", value: -20 }]],
    ["we will have 150 guests", [{ op: "setGuests", value: 150 }]],
    ["move it to 2027-05-02", [{ op: "setDate", value: "2027-05-02" }]],
    ["start at 7:30 pm", [{ op: "setStartTime", value: "19:30" }]],
    ["make it an outdoor event", [{ op: "setSetting", value: "outdoor" }]],
    ["prioritise photos and then food", [{ op: "setPriorities", value: ["photography", "food"] }]],
    ["make it eco-friendly", [{ op: "setPreference", key: "ecoFriendly", value: true }]],
    ["no longer vegetarian", [{ op: "setPreference", key: "vegetarianOnly", value: false }]],
    ["we already have a venue", [{ op: "setVenueBooked", value: true }]],
  ])("%s", (message, expected) => {
    expect(parseIntent(message)).toEqual(expected);
  });

  it("does not read non-veg as vegetarian", () => {
    expect(parseIntent("serve non-veg too")).toEqual([]);
  });

  it("rejects values outside the limits", () => {
    expect(parseIntent("cut the budget by 95%")).toEqual([]);
    expect(parseIntent("we will have 999999 guests")).toEqual([]);
  });

  it("understands several requests in one message", () => {
    const ops = parseIntent("Cut budget by 10% and add 30 guests, make it outdoor").map((c) => c.op);
    expect(ops).toEqual(["scaleBudget", "addGuests", "setSetting"]);
  });
});

describe("applyChanges", () => {
  it("applies changes in order without mutating the input", () => {
    const input = makeInput({ budget: 1_000_000, guests: 100 });
    const next = applyChanges(input, [
      { op: "scaleBudget", percent: -20 },
      { op: "addGuests", value: 25 },
      { op: "setPreference", key: "ecoFriendly", value: true },
      { op: "setPreference", key: "ecoFriendly", value: true },
    ]);
    expect(next).toMatchObject({ budget: 800_000, guests: 125, preferences: ["ecoFriendly"] });
    expect(input.budget).toBe(1_000_000);
  });

  it("clamps guests to the allowed range", () => {
    expect(applyChanges(makeInput({ guests: 10 }), [{ op: "addGuests", value: -50 }]).guests).toBe(1);
  });

  it("describes a change in plain words", () => {
    expect(describeChange({ op: "scaleBudget", percent: -20 }, makeInput())).toMatch(
      /^Cut the budget by 20% \(to .*16,00,000\)$/,
    );
  });

  it("keeps a scaled budget inside the allowed range", () => {
    const next = applyChanges(makeInput({ budget: 10_000 }), [{ op: "scaleBudget", percent: -90 }]);
    expect(next.budget).toBe(LIMITS.budget.min);
  });

  // Every op the assistant can propose: what it changes and the sentence shown before Apply.
  const base = makeInput({ budget: 1_000_000, guests: 100, preferences: ["kidsFriendly"] });
  it.each<[Change, Partial<EventInput>, RegExp]>([
    [{ op: "setBudget", value: 500_000 }, { budget: 500_000 }, /^Set the budget to .*5,00,000$/],
    [{ op: "scaleBudget", percent: 10 }, { budget: 1_100_000 }, /^Raise the budget by 10% \(to .*11,00,000\)$/],
    [{ op: "setGuests", value: 80 }, { guests: 80 }, /^Set guests to 80$/],
    [{ op: "addGuests", value: 30 }, { guests: 130 }, /^Add 30 guests \(to 130\)$/],
    [{ op: "addGuests", value: -30 }, { guests: 70 }, /^Remove 30 guests \(to 70\)$/],
    [{ op: "setDate", value: "2027-05-02" }, { date: "2027-05-02" }, /^Move the date to 2027-05-02$/],
    [{ op: "setStartTime", value: "19:30" }, { startTime: "19:30" }, /^Start at 19:30$/],
    [{ op: "setSetting", value: "either" }, { setting: "either" }, /^Make it indoor or outdoor$/],
    [{ op: "setSetting", value: "outdoor" }, { setting: "outdoor" }, /^Make it outdoor$/],
    [{ op: "setPriorities", value: ["food", "decor"] }, { priorities: ["food", "decor"] }, /^Prioritise food, decor$/],
    [{ op: "setPriorities", value: [] }, { priorities: [] }, /^Clear priorities$/],
    [{ op: "setPreference", key: "kidsFriendly", value: false }, { preferences: [] }, /^Remove a kids-friendly plan$/],
    [
      { op: "setPreference", key: "alcoholFree", value: true },
      { preferences: ["kidsFriendly", "alcoholFree"] },
      /^Add no alcohol$/,
    ],
    [{ op: "setVenueBooked", value: true }, { venueBooked: true }, /^Mark the venue as already arranged$/],
    [{ op: "setVenueBooked", value: false }, { venueBooked: false }, /^Include finding a venue$/],
    [{ op: "setStyle", value: "Retro" }, { style: "Retro" }, /^Set the style to "Retro"$/],
  ])("applies and describes %o", (change, expected, label) => {
    expect(applyChanges(base, [change])).toEqual({ ...base, ...expected });
    expect(describeChange(change, base)).toMatch(label);
  });
});

describe("toChange (model output)", () => {
  it("accepts a valid flat change", () => {
    expect(toChange({ op: "setPreference", text: "kidsFriendly", flag: true })).toEqual({
      op: "setPreference",
      key: "kidsFriendly",
      value: true,
    });
  });

  it("drops invalid or out-of-range changes", () => {
    expect(toChange({ op: "setGuests", number: -5 })).toBeNull();
    expect(toChange({ op: "setPreference", text: "freeBeer", flag: true })).toBeNull();
    expect(toChange({ op: "setDate", text: "next friday" })).toBeNull();
    expect(toChange({ op: "setPriorities", list: ["food", "food"] })).toBeNull();
  });
});

describe("EventInputSchema", () => {
  it("strips control and bidi characters and trims", () => {
    const bidi = String.fromCodePoint(0x202e);
    expect(cleanText(`  Riya${bidi} \n party  `)).toBe("Riya party");
  });

  it("rejects bad input with readable messages", () => {
    const r = EventInputSchema.safeParse({ ...makeInput(), date: "2027-02-30", guests: 0, title: "  " });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["date", "guests", "title"]));
  });

  it("accepts the fixture", () => {
    expect(EventInputSchema.safeParse(makeInput()).success).toBe(true);
  });
});

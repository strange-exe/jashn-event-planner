import { describe, expect, it } from "vitest";
import type { GenerateClient } from "@/lib/ai/gemini";
import { handleInvite, InviteRequestSchema } from "@/lib/ai/handlers";
import { buildPlan } from "@/lib/engine/plan";
import { groupsOf, parseNames, plannedHeadcount, summarizeGuests, type Guest } from "@/lib/guests";
import { cleanInvite, fallbackInvite, rsvpBy } from "@/lib/invite";
import { summarizeSpend, type Payment } from "@/lib/payments";
import {
  decodeShared,
  encodeShared,
  fragmentData,
  MAX_DECODED_BYTES,
  shareHash,
  ShareLinkError,
  toShared,
} from "@/lib/share";
import { makeInput, TODAY } from "./fixtures";

const guest = (over: Partial<Guest>): Guest => ({
  id: crypto.randomUUID(),
  name: "Meera",
  group: "",
  party: 1,
  rsvp: "pending",
  food: "any",
  ...over,
});

describe("guest list", () => {
  it("counts people by reply and food choices of those coming", () => {
    const s = summarizeGuests([
      guest({ party: 4, rsvp: "yes", food: "veg" }),
      guest({ party: 2, rsvp: "yes", food: "jain" }),
      guest({ party: 3, rsvp: "maybe" }),
      guest({ party: 2, rsvp: "no", food: "veg" }),
      guest({ party: 1 }),
    ]);
    expect(s.invitations).toBe(5);
    expect(s.invited).toBe(12);
    expect(s.people).toEqual({ pending: 1, yes: 6, maybe: 3, no: 2 });
    expect(s.food).toEqual({ any: 0, veg: 4, jain: 2, vegan: 0, nonveg: 0 });
    // Everyone who said yes plus half of the maybes, rounded up.
    expect(plannedHeadcount(s)).toBe(8);
  });

  it("has no headcount until someone says yes", () => {
    expect(plannedHeadcount(summarizeGuests([guest({ rsvp: "maybe", party: 5 })]))).toBeNull();
    expect(plannedHeadcount(summarizeGuests([]))).toBeNull();
  });

  it("parses pasted names, dropping blanks, duplicates and unsafe characters", () => {
    const rlo = String.fromCodePoint(0x202e);
    expect(parseNames(`Meera\n\n  Kabir ,meera; Ana${rlo}nya\n`, 10)).toEqual(["Meera", "Kabir", "Ana nya"]);
    expect(parseNames("a\nb\nc", 2)).toEqual(["a", "b"]);
  });

  it("lists groups in use, sorted and unique", () => {
    expect(groupsOf([guest({ group: "Office" }), guest({ group: "Family" }), guest({ group: "Office" })])).toEqual([
      "Family",
      "Office",
    ]);
  });
});

describe("spend tracker", () => {
  const plan = buildPlan(makeInput(), TODAY);
  const pay = (over: Partial<Payment>): Payment => ({
    id: crypto.randomUUID(),
    category: "catering",
    label: "",
    amount: 10_000,
    date: "2027-01-10",
    status: "paid",
    ...over,
  });

  it("adds paid and due per line and overall", () => {
    const catering = plan.budget.lines.find((l) => l.category === "catering")!;
    const s = summarizeSpend(plan.budget, [
      pay({ amount: 50_000 }),
      pay({ amount: catering.amount, status: "due", date: "2027-03-01" }),
      pay({ category: "decor", amount: 20_000, status: "due", date: "2027-02-01" }),
    ]);
    const line = s.lines.find((l) => l.category === "catering")!;
    expect(line).toEqual({
      category: "catering",
      planned: catering.amount,
      paid: 50_000,
      due: catering.amount,
      over: 50_000,
    });
    expect(s.paid).toBe(50_000);
    expect(s.due).toBe(catering.amount + 20_000);
    expect(s.left).toBe(plan.budget.total - s.paid - s.due);
    expect(s.upcoming.map((p) => p.date)).toEqual(["2027-02-01", "2027-03-01"]);
  });

  it("starts empty with the whole budget left", () => {
    const s = summarizeSpend(plan.budget, []);
    expect(s.paid + s.due).toBe(0);
    expect(s.left).toBe(plan.budget.total);
    expect(s.lines.every((l) => l.over === 0)).toBe(true);
  });
});

describe("share link", () => {
  const shared = toShared({
    input: makeInput(),
    locks: { catering: 900_000 },
    done: { venue: true, caterer: false },
    booked: { photographer: true },
  });

  it("keeps only ticked items", () => {
    expect(shared.done).toEqual(["venue"]);
    expect(shared.booked).toEqual(["photographer"]);
  });

  it("round-trips through the URL fragment", async () => {
    const data = await encodeShared(shared);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fragmentData(shareHash(data))).toBe(data);
    expect(await decodeShared(data)).toEqual(shared);
  });

  it("rejects damaged, foreign and empty links", async () => {
    await expect(decodeShared("")).rejects.toThrow(ShareLinkError);
    await expect(decodeShared("not base64!")).rejects.toThrow("unexpected characters");
    await expect(decodeShared("AAAA")).rejects.toThrow(ShareLinkError);
    // Valid compression, but not a plan.
    const other = await encodeShared({ hello: "world" } as never);
    await expect(decodeShared(other)).rejects.toThrow("does not hold a valid plan");
  });

  it("stops inflating a small link that expands past the cap", async () => {
    // A long run of one character compresses to a few bytes: a tiny decompression bomb.
    const bomb = new Blob([" ".repeat(MAX_DECODED_BYTES * 20)])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(bomb).arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const data = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(data.length).toBeLessThan(2_000);
    await expect(decodeShared(data)).rejects.toThrow("too large");
  });

  it("ignores fragments in another format", () => {
    expect(fragmentData("#other=1")).toBe("");
  });
});

describe("invites", () => {
  it("writes an English fallback with the date, time, city and reply-by date", () => {
    const text = fallbackInvite(makeInput({ style: "pastel garden" }), "en", "formal", TODAY);
    expect(text).toContain("You are cordially invited to Riya and Arjun's wedding.");
    expect(text).toContain("Saturday, 10 April 2027");
    expect(text).toMatch(/Time: 6:00\s?pm/i);
    expect(text).toContain("Place: Dehradun");
    expect(text).toContain("Theme: pastel garden");
    expect(text).toContain("by Saturday, 20 March 2027");
    expect(text).not.toMatch(/\n{3}/);
  });

  it("writes a Hindi fallback in Devanagari", () => {
    const text = fallbackInvite(makeInput(), "hi", "warm", TODAY);
    expect(text).toMatch(/\p{Script=Devanagari}/u);
    expect(text).toContain("Dehradun");
    expect(text).not.toContain("थीम");
  });

  it("drops the reply-by date once it has passed", () => {
    const soon = makeInput({ date: "2026-11-10" });
    expect(rsvpBy(soon, TODAY)).toBeNull();
    expect(fallbackInvite(soon, "en", "warm", TODAY)).toContain("let us know soon");
  });

  it("cleans model text but keeps line breaks", () => {
    const rlo = String.fromCodePoint(0x202e);
    expect(cleanInvite(`Hi${rlo}there\r\n\n\n\n  Come   along\t `)).toBe("Hi there\n\nCome along");
  });

  it("uses the model when it answers, and the template when it fails", async () => {
    const calls: unknown[] = [];
    const client = (answer: string | Error): GenerateClient => ({
      models: {
        async generateContent(req) {
          calls.push(req);
          if (answer instanceof Error) throw answer;
          return { text: answer };
        },
      },
    });
    const body = InviteRequestSchema.parse({ input: makeInput(), language: "en", tone: "fun" });
    const ai = await handleInvite(body, { client: client('{"text":"Join us"}'), today: TODAY });
    expect(ai).toEqual({ text: "Join us", source: "ai" });

    const failed = await handleInvite(body, { client: client(new Error("down")), today: TODAY });
    expect(failed.source).toBe("rules");
    expect(failed.fallback).toBe("unavailable");
    expect(failed.text).toContain("Save the date: Riya and Arjun's wedding.");
  });

  it("rejects unknown languages and tones", () => {
    expect(InviteRequestSchema.safeParse({ input: makeInput(), language: "fr", tone: "warm" }).success).toBe(false);
    expect(InviteRequestSchema.safeParse({ input: makeInput(), language: "en", tone: "rude" }).success).toBe(false);
  });
});

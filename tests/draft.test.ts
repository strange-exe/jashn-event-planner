import { afterEach, describe, expect, it, vi } from "vitest";
import { askAssistant, getIdeas } from "@/lib/api";
import { blankDraft, STEP_FIELDS, toDraft, toInput, validateDraft } from "@/lib/draft";
import { EventInputSchema } from "@/lib/schema";
import { makeInput, TODAY } from "./fixtures";

describe("wizard draft", () => {
  it("round-trips a saved event through the form", () => {
    const input = makeInput();
    expect(EventInputSchema.parse(toInput(toDraft(input)))).toEqual(input);
  });

  it("reads budgets written in words", () => {
    const draft = { ...toDraft(makeInput()), budget: "3 lakh" };
    expect(toInput(draft)).toMatchObject({ budget: 300_000 });
  });

  it("flags only the missing fields of a blank form, each on its own step", () => {
    const errors = validateDraft(blankDraft(TODAY), TODAY);
    expect(Object.keys(errors).sort()).toEqual(["budget", "city", "guests", "title"]);
    expect(STEP_FIELDS.map((fields) => fields.filter((f) => errors[f]))).toEqual([
      ["title"],
      ["city"],
      ["guests", "budget"],
    ]);
  });

  it("gives readable messages for numbers and past dates", () => {
    const draft = { ...toDraft(makeInput()), guests: "0", budget: "abc", date: "2026-10-01" };
    const errors = validateDraft(draft, TODAY);
    expect(errors.guests).toMatch(/^Enter between 1 and 20,000 guests/);
    expect(errors.budget).toMatch(/for example 3 lakh/);
    expect(errors.date).toBe("Pick today or a future date.");
  });

  it("starts a new event 45 days out with no errors once filled", () => {
    const draft = { ...blankDraft(TODAY), title: "Aarav turns 7", city: "Pune", guests: "40", budget: "60k" };
    expect(draft.date).toBe("2026-12-16");
    expect(validateDraft(draft, TODAY)).toEqual({});
  });
});

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the event and returns the typed reply", async () => {
    const fetchMock = stubFetch(200, { reply: "ok", changes: [], source: "rules" });
    const res = await askAssistant(makeInput(), "hi", []);
    expect(res.reply).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/assistant");
    expect(JSON.parse(String(init.body))).toMatchObject({ message: "hi", history: [] });
  });

  it("surfaces the server's error message, or a fallback", async () => {
    stubFetch(429, { error: "Too many requests." });
    await expect(askAssistant(makeInput(), "hi", [])).rejects.toThrow("Too many requests.");
    stubFetch(500, null);
    await expect(getIdeas(makeInput())).rejects.toThrow("Could not get ideas.");
  });

  it("sends the category only when one is chosen", async () => {
    const fetchMock = stubFetch(200, { ideas: [], source: "rules" });
    await getIdeas(makeInput());
    await getIdeas(makeInput(), "food");
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)));
    expect("category" in bodies[0]).toBe(false);
    expect(bodies[1].category).toBe("food");
  });
});

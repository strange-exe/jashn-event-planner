import { afterEach, describe, expect, it, vi } from "vitest";
import { handleLocal } from "@/lib/ai/handlers";
import type { GroundedClient, GroundedResponse } from "@/lib/ai/gemini";
import { localPrompt, mapsSearchUrl, toAnswer, toolFor } from "@/lib/local";
import { makeInput } from "./fixtures";

const input = makeInput({
  title: "Private family name",
  notes: "Grandmother uses a wheelchair",
  days: 2,
  functions: [
    { kind: "mehendi", day: 1, startTime: "16:00", guests: 60 },
    { kind: "wedding", day: 2, startTime: "18:00" },
  ],
});

function fakeClient(response: GroundedResponse | Error) {
  const calls: { model: string; contents: string; config: Record<string, unknown> }[] = [];
  const client: GroundedClient = {
    models: {
      generateContent: async (req) => {
        calls.push(req);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
  return { client, calls };
}

const RLO = String.fromCodePoint(0x202e);

const mapsAnswer: GroundedResponse = {
  text: `Doon Garden Lawns - outdoor lawn for 200${RLO}\r\nRiver View Banquet - indoor hall`,
  candidates: [
    {
      groundingMetadata: {
        groundingChunks: [
          { maps: { uri: "https://maps.google.com/?cid=1", title: "Doon Garden Lawns" } },
          { maps: { uri: "https://maps.google.com/?cid=1", title: "Duplicate" } },
          { maps: { uri: "javascript:alert(1)", title: "Bad" } },
          { maps: { uri: "http://maps.google.com/?cid=3", title: "Not https" } },
          { maps: { uri: "https://maps.google.com/?cid=2", title: "" } },
          { web: { uri: "https://example.com", title: "A web chunk on a Maps answer" } },
        ],
      },
    },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe("local suggestions", () => {
  it("sends the event's shape, never its title or notes", () => {
    const prompt = localPrompt(input, "venues");
    expect(prompt).toContain("Dehradun");
    expect(prompt).toContain("mehendi (60 guests)");
    expect(prompt).not.toContain("Private family name");
    expect(prompt).not.toContain("wheelchair");
    expect(localPrompt(input, "prices")).toContain("catering per plate");
    expect(localPrompt(input, "themes")).toContain("decor themes");
  });

  it("uses Maps for places and Search for prices and themes", () => {
    expect(toolFor("caterers")).toBe("googleMaps");
    expect(toolFor("prices")).toBe("googleSearch");
    expect(toolFor("themes")).toBe("googleSearch");
  });

  it("builds a Google Maps search link the user can open themselves", () => {
    const url = new URL(mapsSearchUrl(input, "caterers"));
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("query")).toBe("caterers in Dehradun");
    expect(new URL(mapsSearchUrl(input, "prices")).searchParams.get("query")).toBe("wedding venues in Dehradun");
  });

  it("keeps only unique https place links and cleans the text", () => {
    const answer = toAnswer(mapsAnswer, "googleMaps");
    expect(answer.links).toEqual([
      { uri: "https://maps.google.com/?cid=1", title: "Doon Garden Lawns" },
      { uri: "https://maps.google.com/?cid=2", title: "maps.google.com" },
    ]);
    expect(answer.text).toBe("Doon Garden Lawns - outdoor lawn for 200\nRiver View Banquet - indoor hall");
    expect(answer.suggestionsHtml).toBeUndefined();
  });

  it("keeps Google's Search Suggestions for a search answer, unless the snippet is oversized", () => {
    const html = '<div class="chips"><a href="https://www.google.com/search?q=x">x</a></div>';
    const res = (snippet: string): GroundedResponse => ({
      text: "Catering is about 900 to 1,500 rupees a plate.",
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/r/1", title: "example.in" } }],
            searchEntryPoint: { renderedContent: snippet },
          },
        },
      ],
    });
    expect(toAnswer(res(html), "googleSearch").suggestionsHtml).toBe(html);
    expect(toAnswer(res("x".repeat(20_001)), "googleSearch").suggestionsHtml).toBeUndefined();
  });

  it("returns the grounded answer with the Maps tool on", async () => {
    const { client, calls } = fakeClient(mapsAnswer);
    const result = await handleLocal({ input, topic: "venues" }, { client });
    expect(result.source).toBe("google-maps");
    expect(result.answer?.links).toHaveLength(2);
    expect(calls[0]!.config.tools).toEqual([{ googleMaps: {} }]);
    expect(calls[0]!.config.responseJsonSchema).toBeUndefined();
  });

  it("shows nothing it cannot source: an answer without links falls back to the search link", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ text: "Some venues", candidates: [] });
    const result = await handleLocal({ input, topic: "venues" }, { client });
    expect(result).toMatchObject({ source: "none", fallback: "unavailable" });
    expect(result.answer).toBeUndefined();
    expect(result.searchUrl).toContain("google.com/maps/search");
  });

  it("falls back when the model fails or is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(new Error("overloaded"));
    expect((await handleLocal({ input, topic: "themes" }, { client })).fallback).toBe("unavailable");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await handleLocal({ input, topic: "themes" })).fallback).toBe("not-configured");
  });
});

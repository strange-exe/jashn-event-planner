import type { GroundedResponse, GroundingTool } from "./ai/gemini";
import { functionGuests } from "./engine/functions";
import type { EventInput } from "./engine/types";
import { EVENT_LABEL, FUNCTION_LABEL, PREFERENCE_LABEL } from "./labels";

// Venue, vendor, price and theme suggestions for the event's city, grounded on Google
// Maps (places) or Google Search (prices, themes). Nothing here is invented by the app:
// the text and links come from Google, and without the model the user gets a link to
// run the search themselves.

export const LOCAL_TOPICS = ["venues", "caterers", "decor", "photography", "mehendi", "prices", "themes"] as const;
export type LocalTopic = (typeof LOCAL_TOPICS)[number];

export const LOCAL_TOPIC_LABEL: Record<LocalTopic, string> = {
  venues: "Venues",
  caterers: "Caterers",
  decor: "Decorators",
  photography: "Photographers",
  mehendi: "Henna and make-up",
  prices: "Prices",
  themes: "Popular themes",
};

const TOOL: Record<LocalTopic, GroundingTool> = {
  venues: "googleMaps",
  caterers: "googleMaps",
  decor: "googleMaps",
  photography: "googleMaps",
  mehendi: "googleMaps",
  prices: "googleSearch",
  themes: "googleSearch",
};

export const toolFor = (topic: LocalTopic) => TOOL[topic];

/** What to look for on Google Maps, also used for the fallback search link. */
const PLACE_QUERY: Record<Exclude<LocalTopic, "prices" | "themes">, string> = {
  venues: "venues and banquet halls",
  caterers: "caterers",
  decor: "event decorators",
  photography: "photographers",
  mehendi: "mehendi artists and bridal make-up",
};

export const LOCAL_SYSTEM = [
  "You help families in India plan celebrations.",
  "Answer in plain text: no markdown, no asterisks, no headings.",
  "Use only what your search tool returns. Never invent a business, a price, a phone number or a rating.",
  "When a price is not in the results, say to ask for a quote instead of guessing.",
  "Keep it under 180 words.",
].join(" ");

const MAX_LINKS = 10;
const MAX_TEXT = 2_000;
const MAX_TITLE = 120;
// Google's Search Suggestions are a small HTML snippet; anything larger is not one.
const MAX_SUGGESTIONS_HTML = 20_000;

/** The event as the search needs it: no title, notes or guest names. */
function brief(input: EventInput): string {
  const kind = EVENT_LABEL[input.type].name.toLowerCase();
  const fns = input.functions.length
    ? ` with ${input.functions.map((f) => `${FUNCTION_LABEL[f.kind].name.toLowerCase()} (${functionGuests(f, input)} guests)`).join(", ")}`
    : "";
  const perGuest = Math.round(input.budget / input.guests);
  const prefs = input.preferences.map((p) => PREFERENCE_LABEL[p].toLowerCase());
  return [
    `A ${kind} in ${input.city}, India, for ${input.guests} guests${fns}.`,
    `Total budget about ${input.budget} rupees (${perGuest} per guest).`,
    input.style ? `Style: ${input.style}.` : "",
    prefs.length ? `Needs: ${prefs.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function localPrompt(input: EventInput, topic: LocalTopic): string {
  const about = brief(input);
  if (topic === "prices") {
    return `${about} Using current web results, give typical price ranges in ${input.city} for: venue hire per day, catering per plate, decor, photography and video, and henna artists. Say which ranges you could not find.`;
  }
  if (topic === "themes") {
    return `${about} Using current web results, list 4 to 6 popular ${EVENT_LABEL[input.type].name.toLowerCase()} decor themes in India this season, one line each with its colours, and say which suit this budget.`;
  }
  return `${about} Using Google Maps, suggest up to 6 ${PLACE_QUERY[topic]} in or near ${input.city} that fit this event. One place per line: its name, then why it fits.`;
}

/** A Google Maps search the user can run themselves; used when the model is unavailable. */
export function mapsSearchUrl(input: EventInput, topic: LocalTopic): string {
  const what =
    topic === "prices"
      ? `${EVENT_LABEL[input.type].name.toLowerCase()} venues`
      : topic === "themes"
        ? `${EVENT_LABEL[input.type].name.toLowerCase()} decorators`
        : PLACE_QUERY[topic];
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${what} in ${input.city}`)}`;
}

export interface LocalLink {
  title: string;
  uri: string;
}

export interface LocalAnswer {
  text: string;
  links: LocalLink[];
  /** Google's Search Suggestions snippet, shown as provided in a sandboxed frame. */
  suggestionsHtml?: string;
}

// Control and format characters (bidi overrides included); line breaks are kept.
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

const cleanLine = (s: string) => s.replace(UNSAFE_CHARS, " ").replace(/ {2,}/g, " ").trim();

/** Only https links leave the app; javascript:, data: and the rest are dropped. */
function safeUri(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** The grounded answer, made safe to show as text, with its sources. */
export function toAnswer(res: GroundedResponse, tool: GroundingTool): LocalAnswer {
  const text = (res.text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
  const meta = res.candidates?.[0]?.groundingMetadata;
  const seen = new Set<string>();
  const links: LocalLink[] = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const source = tool === "googleMaps" ? chunk.maps : chunk.web;
    const uri = safeUri(source?.uri);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    links.push({ uri, title: cleanLine(source?.title ?? "").slice(0, MAX_TITLE) || new URL(uri).hostname });
    if (links.length === MAX_LINKS) break;
  }
  const html = meta?.searchEntryPoint?.renderedContent;
  return {
    text,
    links,
    ...(tool === "googleSearch" && html && html.length <= MAX_SUGGESTIONS_HTML ? { suggestionsHtml: html } : {}),
  };
}

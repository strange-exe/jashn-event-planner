import type { Change } from "../schema";
import { ChangeSchema } from "../schema";
import { parseAmount } from "./money";
import type { Preference, Priority } from "./types";

// Understands the common requests without any AI, so the assistant still works
// offline or when the model is unavailable. Every result is checked by ChangeSchema.

const PRIORITY_WORDS: [RegExp, Priority][] = [
  [/\b(food|catering|menu)\b/, "food"],
  [/\b(decor|decoration|flowers?)\b/, "decor"],
  [/\b(photos?|photography|photographer|video)\b/, "photography"],
  [/\b(music|entertainment|dj|band|dance)\b/, "entertainment"],
  [/\b(venue|location|place)\b/, "venue"],
  [/\b(outfits?|attire|clothes|dress)\b/, "attire"],
];

const PREFERENCE_WORDS: [RegExp, Preference][] = [
  [/\b(eco|green|sustainable|zero[- ]waste|plastic[- ]free)\b/, "ecoFriendly"],
  [/\b(?<!non[- ])(vegetarian|veg only|pure veg)\b/, "vegetarianOnly"],
  [/\b(alcohol[- ]free|no alcohol|dry event|without alcohol)\b/, "alcoholFree"],
  [/\b(wheelchair|step[- ]free|accessible|elderly)\b/, "stepFreeAccess"],
  [/\b(kids?|children|child[- ]friendly)\b/, "kidsFriendly"],
];

const NEGATION = /\b(remove|drop|no longer|not|without|don'?t need)\b/;

function to24h(h: number, m: number, meridiem?: string): string | null {
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseIntent(message: string): Change[] {
  const t = message.toLowerCase();
  const out: unknown[] = [];

  const pct = /\b(cut|reduce|lower|decrease|trim|increase|raise|grow)\b[^%\d]*\bbudget\b\D*?(\d+(?:\.\d+)?)\s*(%|percent)/.exec(t);
  if (pct) {
    const down = /cut|reduce|lower|decrease|trim/.test(pct[1]);
    out.push({ op: "scaleBudget", percent: Number(pct[2]) * (down ? -1 : 1) });
  } else if (/\bbudget\b/.test(t)) {
    const after = t.slice(t.indexOf("budget"));
    const amount = parseAmount(after);
    if (amount !== null && amount >= 1000) out.push({ op: "setBudget", value: amount });
  }

  const addG = /\b(add|invite|plus)\s+(\d+)\s+(more\s+)?(guests|people)\b/.exec(t);
  const subG = /\b(remove|drop|cut|fewer|minus)\s+(\d+)\s+(guests|people)\b/.exec(t);
  const setG = /\b(\d+)\s+(guests|people)\b/.exec(t) ?? /\bguests?\s+(?:to|=)\s*(\d+)\b/.exec(t);
  if (addG) out.push({ op: "addGuests", value: Number(addG[2]) });
  else if (subG) out.push({ op: "addGuests", value: -Number(subG[2]) });
  else if (setG) out.push({ op: "setGuests", value: Number(setG[1]) });

  const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(t);
  if (date) out.push({ op: "setDate", value: date[1] });

  const time = /\b(?:start|begin)s?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(t);
  if (time) {
    const v = to24h(Number(time[1]), Number(time[2] ?? 0), time[3]);
    if (v) out.push({ op: "setStartTime", value: v });
  }

  if (/\b(outdoors?|open[- ]air|lawn|garden party)\b/.test(t)) out.push({ op: "setSetting", value: "outdoor" });
  else if (/\bindoors?\b/.test(t)) out.push({ op: "setSetting", value: "indoor" });

  if (/\b(prioriti[sz]e|focus on|splurge on|spend more on|most important)\b/.test(t)) {
    const found = PRIORITY_WORDS.map(([re, p]) => ({ p, at: t.search(re) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.p)
      .slice(0, 3);
    if (found.length) out.push({ op: "setPriorities", value: found });
  }

  const negated = NEGATION.test(t);
  for (const [re, key] of PREFERENCE_WORDS) {
    if (re.test(t)) out.push({ op: "setPreference", key, value: !negated });
  }

  if (/\b(venue is (booked|fixed|sorted)|already (have|booked|got) (a |the )?venue|got the venue)\b/.test(t)) {
    out.push({ op: "setVenueBooked", value: true });
  }

  return out.map((c) => ChangeSchema.safeParse(c)).flatMap((r) => (r.success ? [r.data] : []));
}

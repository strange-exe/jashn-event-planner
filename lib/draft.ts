import { addDays } from "./engine/dates";
import { formatINR, parseAmount } from "./engine/money";
import type { EventInput } from "./engine/types";
import { EventInputSchema, LIMITS } from "./schema";

/** The wizard's form state: like EventInput, but number fields hold what the user typed. */
export interface Draft extends Omit<EventInput, "guests" | "budget"> {
  guests: string;
  budget: string;
}

export type FieldErrors = Partial<Record<keyof EventInput, string>>;

export const STEPS = ["Occasion", "When and where", "Guests, budget and style"] as const;

/** Which fields each wizard step owns, so a step only blocks on its own errors. */
export const STEP_FIELDS: (keyof EventInput)[][] = [
  ["type", "title"],
  ["date", "startTime", "city", "cityTier", "setting", "venueBooked"],
  ["guests", "budget", "priorities", "preferences", "style", "notes"],
];

const DEFAULT_LEAD_DAYS = 45;

export function blankDraft(today: string): Draft {
  return {
    type: "birthday",
    title: "",
    date: addDays(today, DEFAULT_LEAD_DAYS),
    startTime: "18:00",
    city: "",
    cityTier: "large",
    guests: "",
    budget: "",
    setting: "indoor",
    venueBooked: false,
    priorities: [],
    preferences: [],
    style: "",
    notes: "",
  };
}

export function toDraft(input: EventInput): Draft {
  return { ...input, guests: String(input.guests), budget: String(input.budget) };
}

/** The draft in EventInput's shape; unparseable numbers become NaN so the schema rejects them. */
export function toInput(d: Draft): unknown {
  const guests = d.guests.trim() === "" ? NaN : Number(d.guests);
  return { ...d, guests, budget: parseAmount(d.budget) ?? NaN };
}

function messageFor(key: keyof EventInput, zodMessage: string): string {
  if (key === "guests") {
    return `Enter between ${LIMITS.guests.min} and ${LIMITS.guests.max.toLocaleString("en-IN")} guests.`;
  }
  if (key === "budget") {
    return `Enter a budget between ${formatINR(LIMITS.budget.min)} and ${formatINR(LIMITS.budget.max)}, for example 3 lakh.`;
  }
  return zodMessage.startsWith("Too big") ? "That is too long." : zodMessage;
}

/** One readable message per field, from the schema plus checks that need today's date. */
export function validateDraft(d: Draft, today: string): FieldErrors {
  const errors: FieldErrors = {};
  const result = EventInputSchema.safeParse(toInput(d));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof EventInput;
      errors[key] ??= messageFor(key, issue.message);
    }
  }
  if (!errors.date && d.date < today) errors.date = "Pick today or a future date.";
  return errors;
}

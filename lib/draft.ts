import { addDays } from "./engine/dates";
import { formatINR, parseAmount } from "./engine/money";
import type { EventFunction, EventInput, EventType } from "./engine/types";
import { EventInputSchema, LIMITS } from "./schema";

/** A function as typed in the wizard; a blank guest count means everyone. */
export interface DraftFunction extends Omit<EventFunction, "guests"> {
  guests: string;
}

/** The wizard's form state: like EventInput, but number fields hold what the user typed. */
export interface Draft extends Omit<EventInput, "guests" | "budget" | "functions"> {
  guests: string;
  budget: string;
  functions: DraftFunction[];
}

export type FieldErrors = Partial<Record<keyof EventInput, string>>;

export const STEPS = ["Occasion", "When and where", "Guests, budget and style"] as const;

/** Which fields each wizard step owns, so a step only blocks on its own errors. */
export const STEP_FIELDS: (keyof EventInput)[][] = [
  ["type", "title"],
  ["date", "days", "functions", "startTime", "city", "cityTier", "setting", "venueBooked"],
  ["guests", "budget", "priorities", "preferences", "style", "notes"],
];

/** Only weddings run over several days with functions. */
export const hasFunctions = (type: EventType) => type === "wedding";

const DEFAULT_LEAD_DAYS = 45;

export function blankDraft(today: string): Draft {
  return {
    type: "birthday",
    title: "",
    date: addDays(today, DEFAULT_LEAD_DAYS),
    days: 1,
    functions: [],
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
  return {
    ...input,
    guests: String(input.guests),
    budget: String(input.budget),
    functions: input.functions.map((f) => ({ ...f, guests: f.guests === undefined ? "" : String(f.guests) })),
  };
}

const toCount = (s: string) => (s.trim() === "" ? NaN : Number(s));

/**
 * The draft in EventInput's shape; unparseable numbers become NaN so the schema rejects them.
 * Events other than weddings drop any functions picked before the type changed.
 */
export function toInput(d: Draft): unknown {
  const multi = hasFunctions(d.type);
  return {
    ...d,
    guests: toCount(d.guests),
    budget: parseAmount(d.budget) ?? NaN,
    days: multi ? d.days : 1,
    functions: multi
      ? d.functions.map(({ guests, ...f }) => (guests.trim() === "" ? f : { ...f, guests: toCount(guests) }))
      : [],
  };
}

function messageFor(key: keyof EventInput, zodMessage: string): string {
  if (key === "guests") {
    return `Enter between ${LIMITS.guests.min} and ${LIMITS.guests.max.toLocaleString("en-IN")} guests.`;
  }
  if (key === "functions" && /^(Invalid|Too)/.test(zodMessage)) {
    return "Check each function's guests: a number up to the event's guest count.";
  }
  if (key === "budget") {
    const { min, max } = LIMITS.budget;
    return `Enter a budget between ${formatINR(min)} and ${formatINR(max)}, for example 3 lakh.`;
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

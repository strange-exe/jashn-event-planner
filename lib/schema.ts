import { z } from "zod";
import { isValidDate } from "./engine/dates";
import { CITY_TIERS, EVENT_TYPES, PREFERENCES, PRIORITIES, SETTINGS } from "./engine/types";

// Zod's JIT probes `new Function`, which the strict CSP blocks and reports. The
// schemas are small, so the interpreter is fast enough.
z.config({ jitless: true });

export const LIMITS = {
  guests: { min: 1, max: 20_000 },
  budget: { min: 5_000, max: 1_000_000_000 },
  title: 80,
  city: 60,
  style: 120,
  notes: 500,
  message: 600,
  priorities: 3,
  ideaTitle: 80,
  ideaText: 300,
  // Saved per plan in localStorage. Lowering one later would make older saved plans fail
  // validation and be dropped, so these only ever grow.
  savedChat: 40,
  savedChatText: 2000,
  savedIdeas: 30,
  // Earlier chat turns sent with each assistant request.
  historyTurns: 6,
} as const;

// Control and format characters (including bidi overrides) never belong in user text.
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export function cleanText(s: string): string {
  return s.replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim();
}

const text = (max: number) => z.string().transform(cleanText).pipe(z.string().max(max));

const isoDate = z.string().refine(isValidDate, "Enter a real date (yyyy-mm-dd).");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 18:30.");

export const EventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: text(LIMITS.title).pipe(z.string().min(1, "Give the event a name.")),
  date: isoDate,
  startTime: timeOfDay,
  city: text(LIMITS.city).pipe(z.string().min(1, "Enter a city or town.")),
  cityTier: z.enum(CITY_TIERS),
  guests: z.number().int().min(LIMITS.guests.min).max(LIMITS.guests.max),
  budget: z.number().int().min(LIMITS.budget.min).max(LIMITS.budget.max),
  setting: z.enum(SETTINGS),
  venueBooked: z.boolean(),
  priorities: z
    .array(z.enum(PRIORITIES))
    .max(LIMITS.priorities)
    .refine((p) => new Set(p).size === p.length, "Priorities must be different."),
  preferences: z
    .array(z.enum(PREFERENCES))
    .max(PREFERENCES.length)
    .transform((p) => [...new Set(p)]),
  style: text(LIMITS.style),
  notes: text(LIMITS.notes),
});

// A change the assistant may propose. The model gets this flat shape (easy for
// structured output); `toChange` turns it into a checked, typed change.
export const CHANGE_OPS = [
  "setBudget",
  "scaleBudget",
  "setGuests",
  "addGuests",
  "setDate",
  "setStartTime",
  "setSetting",
  "setPriorities",
  "setPreference",
  "setVenueBooked",
  "setStyle",
] as const;

export const RawChangeSchema = z.object({
  op: z.enum(CHANGE_OPS),
  number: z.number().optional(),
  text: z.string().max(LIMITS.style).optional(),
  flag: z.boolean().optional(),
  list: z.array(z.string().max(40)).max(5).optional(),
});
export type RawChange = z.infer<typeof RawChangeSchema>;

export const ChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setBudget"), value: z.number().int().min(LIMITS.budget.min).max(LIMITS.budget.max) }),
  z.object({ op: z.literal("scaleBudget"), percent: z.number().min(-90).max(500) }),
  z.object({ op: z.literal("setGuests"), value: z.number().int().min(LIMITS.guests.min).max(LIMITS.guests.max) }),
  z.object({ op: z.literal("addGuests"), value: z.number().int().min(-LIMITS.guests.max).max(LIMITS.guests.max) }),
  z.object({ op: z.literal("setDate"), value: isoDate }),
  z.object({ op: z.literal("setStartTime"), value: timeOfDay }),
  z.object({ op: z.literal("setSetting"), value: z.enum(SETTINGS) }),
  z.object({ op: z.literal("setPriorities"), value: EventInputSchema.shape.priorities }),
  z.object({ op: z.literal("setPreference"), key: z.enum(PREFERENCES), value: z.boolean() }),
  z.object({ op: z.literal("setVenueBooked"), value: z.boolean() }),
  z.object({ op: z.literal("setStyle"), value: text(LIMITS.style) }),
]);
export type Change = z.infer<typeof ChangeSchema>;

/** Converts a model-shaped change into a checked one; returns null when it is invalid. */
export function toChange(raw: RawChange): Change | null {
  const candidate = (() => {
    switch (raw.op) {
      case "scaleBudget":
        return { op: raw.op, percent: raw.number };
      case "setPreference":
        return { op: raw.op, key: raw.text, value: raw.flag };
      case "setVenueBooked":
        return { op: raw.op, value: raw.flag };
      case "setPriorities":
        return { op: raw.op, value: raw.list };
      case "setDate":
      case "setStartTime":
      case "setSetting":
      case "setStyle":
        return { op: raw.op, value: raw.text };
      default:
        return { op: raw.op, value: typeof raw.number === "number" ? Math.round(raw.number) : undefined };
    }
  })();
  const parsed = ChangeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

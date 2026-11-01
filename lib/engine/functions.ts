import { roundingUnit, splitExact } from "./budget";
import { addDays, addMinutes } from "./dates";
import {
  FUNCTION_KINDS,
  type EventFunction,
  type EventInput,
  type FunctionKind,
  type FunctionPlan,
  type RunSheetItem,
} from "./types";

// Planning rules for the functions of a multi-day wedding. Like the rest of the
// engine these are heuristics, not quotes.

// How much a function costs per guest, relative to the others. Haldi and mehendi are
// smaller, daytime and lighter on food; the wedding carries the venue, mandap and dinner.
const COST_WEIGHT: Record<FunctionKind, number> = {
  haldi: 0.45,
  mehendi: 0.6,
  sangeet: 1,
  cocktail: 0.9,
  wedding: 1.6,
  reception: 1.3,
};

const NEEDS: Record<FunctionKind, string[]> = {
  haldi: [
    "Turmeric paste and fresh flowers",
    "An area that can get messy, with a wash point",
    "Old clothes or a dress code in yellow",
  ],
  mehendi: [
    "Henna artists, about one per 15 guests who want henna",
    "Floor seating and cushions",
    "Light snacks that are easy to eat with henna on",
  ],
  sangeet: [
    "Sound system, stage and dance floor",
    "A choreographer if family will perform",
    "A running order for the performances",
  ],
  cocktail: ["Bar service and a licence if alcohol is served", "Lounge seating and music"],
  wedding: ["Priest or officiant and the ritual items", "Mandap or stage decor", "Dinner for every guest"],
  reception: ["A stage for the couple to greet guests", "Dinner and a photo line"],
};

// Steps of each function as [minutes after its start, title, detail].
const STEPS: Record<FunctionKind, [number, string, string][]> = {
  haldi: [
    [-60, "Set up the haldi area", "Sheets on the floor, flowers, turmeric bowls."],
    [0, "Haldi begins", "Family applies turmeric, elders first."],
    [90, "Wash up and lunch", "Keep towels and a wash point ready."],
  ],
  mehendi: [
    [-60, "Henna artists arrive", "Seat the bride where light is good for photos."],
    [0, "Mehendi begins", "Guests join the queue for the artists."],
    [180, "Music and snacks", "Bride's henna needs time to dry; keep her comfortable."],
  ],
  sangeet: [
    [-90, "Sound check and stage run-through", "Test every track and microphone."],
    [0, "Guests arrive", "Welcome drinks."],
    [60, "Performances", "Follow the running order; one host keeps time."],
    [150, "Dinner and open dance floor", "Watch the local sound curfew."],
  ],
  cocktail: [
    [-60, "Bar and lounge set-up", "Check stock and glassware."],
    [0, "Guests arrive", "Music at conversation volume."],
    [120, "Dinner", "Arrange cabs for guests who drank."],
  ],
  wedding: [
    [-120, "Vendors arrive and set up", "Decor, catering and sound check."],
    [-30, "Family and close guests arrive", "Welcome drinks."],
    [0, "Baraat or guest arrival", "Keep the entrance clear."],
    [60, "Ceremony", "The main ritual."],
    [150, "Dinner", "Elders and outstation guests first."],
  ],
  reception: [
    [-90, "Stage and photo set-up", "Lighting check for the photo line."],
    [0, "Guests arrive", "The couple takes the stage."],
    [60, "Dinner", "Keep the photo line moving."],
    [180, "Send-off", "Return gifts at the exit."],
  ],
};

/** The functions in the order they happen: by day, then start time, then the usual order. */
export function sortFunctions(functions: EventFunction[]): EventFunction[] {
  return [...functions].sort(
    (a, b) =>
      a.day - b.day ||
      a.startTime.localeCompare(b.startTime) ||
      FUNCTION_KINDS.indexOf(a.kind) - FUNCTION_KINDS.indexOf(b.kind),
  );
}

/** Guests at a function, never more than the event's own count. */
export function functionGuests(f: EventFunction, input: EventInput): number {
  return Math.min(f.guests ?? input.guests, input.guests);
}

/** Each function with its date and a rough share of the budget by guests and kind. */
export function buildFunctions(input: EventInput): FunctionPlan[] {
  const sorted = sortFunctions(input.functions);
  const weights = sorted.map((f) => COST_WEIGHT[f.kind] * functionGuests(f, input));
  const amounts = splitExact(input.budget, weights, roundingUnit(input.budget));
  return sorted.map((f, i) => {
    const amount = amounts[i] ?? 0;
    return {
      kind: f.kind,
      day: f.day,
      date: addDays(input.date, f.day - 1),
      startTime: f.startTime,
      guests: functionGuests(f, input),
      amount,
      percent: input.budget > 0 ? Math.round((amount / input.budget) * 1000) / 10 : 0,
      needs: NEEDS[f.kind],
    };
  });
}

/** The run sheet across every function, each step dated. */
export function buildFunctionRunSheet(input: EventInput): RunSheetItem[] {
  return sortFunctions(input.functions).flatMap((f) =>
    STEPS[f.kind].map(([offset, title, detail]) => ({
      function: f.kind,
      date: addDays(input.date, f.day - 1),
      time: addMinutes(f.startTime, offset),
      title,
      detail,
    })),
  );
}

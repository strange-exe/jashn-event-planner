import { LIMITS, type Change } from "../schema";
import { formatINR } from "./money";
import type { EventInput } from "./types";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Applies checked changes to the event details. Never mutates the input. */
export function applyChanges(input: EventInput, changes: Change[]): EventInput {
  return changes.reduce<EventInput>((acc, c) => {
    switch (c.op) {
      case "setBudget":
        return { ...acc, budget: c.value };
      case "scaleBudget":
        return { ...acc, budget: clamp(Math.round((acc.budget * (100 + c.percent)) / 100), LIMITS.budget.min, LIMITS.budget.max) };
      case "setGuests":
        return { ...acc, guests: c.value };
      case "addGuests":
        return { ...acc, guests: clamp(acc.guests + c.value, LIMITS.guests.min, LIMITS.guests.max) };
      case "setDate":
        return { ...acc, date: c.value };
      case "setStartTime":
        return { ...acc, startTime: c.value };
      case "setSetting":
        return { ...acc, setting: c.value };
      case "setPriorities":
        return { ...acc, priorities: c.value };
      case "setPreference": {
        const rest = acc.preferences.filter((p) => p !== c.key);
        return { ...acc, preferences: c.value ? [...rest, c.key] : rest };
      }
      case "setVenueBooked":
        return { ...acc, venueBooked: c.value };
      case "setStyle":
        return { ...acc, style: c.value };
    }
  }, input);
}

const PREF_LABEL: Record<string, string> = {
  vegetarianOnly: "vegetarian-only food",
  alcoholFree: "no alcohol",
  ecoFriendly: "eco-friendly choices",
  stepFreeAccess: "step-free access",
  kidsFriendly: "a kids-friendly plan",
};

/** One plain sentence per change, shown before the user applies it. */
export function describeChange(c: Change, input: EventInput): string {
  switch (c.op) {
    case "setBudget":
      return `Set the budget to ${formatINR(c.value)}`;
    case "scaleBudget":
      return `${c.percent < 0 ? "Cut" : "Raise"} the budget by ${Math.abs(c.percent)}% (to ${formatINR(applyChanges(input, [c]).budget)})`;
    case "setGuests":
      return `Set guests to ${c.value}`;
    case "addGuests":
      return `${c.value < 0 ? "Remove" : "Add"} ${Math.abs(c.value)} guests (to ${applyChanges(input, [c]).guests})`;
    case "setDate":
      return `Move the date to ${c.value}`;
    case "setStartTime":
      return `Start at ${c.value}`;
    case "setSetting":
      return `Make it ${c.value === "either" ? "indoor or outdoor" : c.value}`;
    case "setPriorities":
      return c.value.length ? `Prioritise ${c.value.join(", ")}` : "Clear priorities";
    case "setPreference":
      return `${c.value ? "Add" : "Remove"} ${PREF_LABEL[c.key]}`;
    case "setVenueBooked":
      return c.value ? "Mark the venue as already arranged" : "Include finding a venue";
    case "setStyle":
      return `Set the style to "${c.value}"`;
  }
}

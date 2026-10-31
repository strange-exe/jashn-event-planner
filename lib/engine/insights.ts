import { monthOf } from "./dates";
import { formatINR } from "./money";
import type { Budget, CityTier, EventInput, EventType, Insight, RunSheetItem, Task } from "./types";

// Rough catering cost per guest in rupees (2026), by event type and city size.
// These are planning heuristics, not quotes; the UI asks users to check locally.
export const PLATE_COST: Record<EventType, Record<CityTier, number>> = {
  wedding: { metro: 1200, large: 850, town: 600 },
  engagement: { metro: 1000, large: 750, town: 500 },
  birthday: { metro: 600, large: 450, town: 300 },
  anniversary: { metro: 900, large: 650, town: 450 },
  community: { metro: 300, large: 220, town: 150 },
  festival: { metro: 400, large: 300, town: 200 },
};

/** Days of notice below which an event of this type is a rush. */
const RUSH_DAYS: Record<EventType, number> = {
  wedding: 30,
  engagement: 14,
  birthday: 3,
  anniversary: 5,
  community: 10,
  festival: 7,
};

// Food budget per guest as a share of the typical plate cost: below LOW is critical,
// below TIGHT is a warning. Trimming the list aims for TIGHT, so food is still modest.
const CATERING_LOW_RATIO = 0.7;
const CATERING_TIGHT_RATIO = 0.9;
// Above this headcount an outdoor or public event needs crowd planning.
const LARGE_CROWD_GUESTS = 500;
const MONSOON = new Set([6, 7, 8, 9]);
const WEDDING_SEASON = new Set([11, 12, 1, 2]);

interface Context {
  input: EventInput;
  budget: Budget;
  tasks: Task[];
  runSheet: RunSheetItem[];
  daysToGo: number;
}

type Rule = (c: Context) => Insight | null;

const RULES: Rule[] = [
  ({ budget }) =>
    budget.overBy > 0
      ? {
          id: "over-budget",
          severity: "critical",
          title: `Your fixed amounts are ${formatINR(budget.overBy)} over the total`,
          detail: "The lines you set yourself add up to more than the budget, so nothing is left for the others.",
          suggestion: "Lower one of the fixed lines, or raise the total budget.",
        }
      : null,

  ({ input, budget }) => {
    const catering = budget.lines.find((l) => l.category === "catering")?.amount ?? 0;
    if (input.guests <= 0) return null;
    const perPlate = catering / input.guests;
    const typical = PLATE_COST[input.type][input.cityTier];
    const ratio = perPlate / typical;
    if (ratio < CATERING_LOW_RATIO) {
      return {
        id: "catering-low",
        severity: "critical",
        title: `Food budget is about ${formatINR(perPlate)} per guest`,
        detail: `A typical ${input.type} in a ${input.cityTier === "town" ? "town" : `${input.cityTier} city`} costs around ${formatINR(typical)} per guest for food.`,
        suggestion: `Trim the guest list to about ${Math.floor(catering / (typical * CATERING_TIGHT_RATIO))}, choose a simpler menu, or raise the budget.`,
      };
    }
    if (ratio < CATERING_TIGHT_RATIO) {
      return {
        id: "catering-tight",
        severity: "warning",
        title: `Food budget is tight at ${formatINR(perPlate)} per guest`,
        detail: `Typical is around ${formatINR(typical)}. It can work with a focused menu.`,
        suggestion: "Ask caterers for a fixed-price package and fewer, better dishes.",
      };
    }
    return null;
  },

  ({ input, daysToGo }) =>
    daysToGo < RUSH_DAYS[input.type]
      ? {
          id: "rush",
          severity: "critical",
          title: `Only ${daysToGo} day${daysToGo === 1 ? "" : "s"} to go`,
          detail: `Most ${input.type}s are planned with at least ${RUSH_DAYS[input.type]} days of notice.`,
          suggestion: "Book the venue and caterer today; pick vendors who offer packages.",
        }
      : null,

  ({ tasks, daysToGo, input }) => {
    const squeezed = tasks.filter((t) => t.compressed).length;
    if (squeezed === 0 || daysToGo < RUSH_DAYS[input.type]) return null;
    return {
      id: "compressed",
      severity: "warning",
      title: `${squeezed} task${squeezed === 1 ? " was" : "s were"} pulled forward`,
      detail: "There is less time than ideal, so their due dates are earlier in the plan than usual.",
      suggestion: "Start with the bookings at the top of the timeline.",
    };
  },

  ({ input }) =>
    input.setting !== "indoor" && MONSOON.has(monthOf(input.date))
      ? {
          id: "monsoon",
          severity: "warning",
          title: "The date falls in the monsoon",
          detail: "June to September brings heavy rain across most of India.",
          suggestion: "Plan a covered area or an indoor backup, and keep power cables off the ground.",
        }
      : null,

  ({ input }) =>
    (input.type === "wedding" || input.type === "engagement") && WEDDING_SEASON.has(monthOf(input.date))
      ? {
          id: "season",
          severity: "info",
          title: "Peak wedding season",
          detail: "November to February is busy, so popular venues and vendors book up early and may charge more.",
          suggestion: "Lock in your top vendors first and ask for the price in writing.",
        }
      : null,

  ({ input, runSheet }) => {
    const late = runSheet.some((s) => s.time >= "22:00" || s.time < "06:00");
    const loud = input.type === "community" || input.type === "festival" || input.priorities.includes("entertainment");
    if (!late || !loud) return null;
    return {
      id: "noise",
      severity: "warning",
      title: "Music may run past 10 pm",
      detail:
        "India's Noise Pollution Rules, 2000 restrict loudspeakers between 10 pm and 6 am unless local authorities allow it.",
      suggestion: "Start earlier, move loud music before 10 pm, or check the local permission.",
    };
  },

  ({ input }) =>
    input.guests > LARGE_CROWD_GUESTS && (input.setting !== "indoor" || input.type === "community")
      ? {
          id: "crowd",
          severity: "warning",
          title: "Large crowd",
          detail: `${input.guests} guests need planned entry, exits and first aid.`,
          suggestion: "Hire security, mark exits clearly and keep a first-aid desk near the entrance.",
        }
      : null,

  ({ input }) =>
    input.venueBooked
      ? {
          id: "venue-excluded",
          severity: "info",
          title: "Venue cost is not in this budget",
          detail: "You said the venue is already arranged, so the whole budget goes to everything else.",
          suggestion: "Add the venue to the total if you still owe a balance.",
        }
      : null,
];

const ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function buildInsights(c: Context): Insight[] {
  return RULES.map((r) => r(c))
    .filter((x): x is Insight => x !== null)
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

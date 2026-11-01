import { eventNoun, PRIORITY_LABEL } from "../labels";
import type { Budget, BudgetCategory, BudgetLine, EventInput, EventType, Priority } from "./types";

// Starting shares (percent of the total) for each kind of event. They are planning
// heuristics, not market data; the README lists them as an assumption.
export const BASE_SHARES: Record<EventType, Partial<Record<BudgetCategory, number>>> = {
  wedding: {
    venue: 18,
    catering: 32,
    decor: 12,
    photography: 10,
    entertainment: 6,
    attire: 10,
    invitations: 2,
    favours: 2,
    logistics: 2,
    contingency: 6,
  },
  engagement: {
    venue: 20,
    catering: 33,
    decor: 12,
    photography: 10,
    entertainment: 6,
    attire: 8,
    invitations: 2,
    favours: 3,
    contingency: 6,
  },
  birthday: {
    venue: 18,
    catering: 35,
    decor: 14,
    photography: 6,
    entertainment: 12,
    invitations: 2,
    favours: 5,
    logistics: 2,
    contingency: 6,
  },
  anniversary: {
    venue: 20,
    catering: 38,
    decor: 12,
    photography: 8,
    entertainment: 8,
    invitations: 2,
    favours: 4,
    logistics: 2,
    contingency: 6,
  },
  community: {
    venue: 15,
    catering: 30,
    decor: 8,
    photography: 4,
    entertainment: 14,
    invitations: 5,
    logistics: 6,
    permits: 10,
    contingency: 8,
  },
  festival: {
    venue: 10,
    catering: 30,
    decor: 18,
    photography: 4,
    entertainment: 12,
    invitations: 2,
    favours: 6,
    logistics: 4,
    permits: 6,
    contingency: 8,
  },
};

const PRIORITY_CATEGORY: Record<Priority, BudgetCategory> = {
  food: "catering",
  decor: "decor",
  photography: "photography",
  entertainment: "entertainment",
  venue: "venue",
  attire: "attire",
};

/** Multipliers for the first, second and third priority. */
const PRIORITY_BOOST = [
  { rank: "top", factor: 1.3 },
  { rank: "second", factor: 1.2 },
  { rank: "third", factor: 1.1 },
];
// Share given to a priority category the event type has no base share for, before the boost.
const UNLISTED_PRIORITY_SHARE = 4;

interface Weights {
  shares: Map<BudgetCategory, number>;
  reasons: Map<BudgetCategory, string[]>;
}

function note(w: Weights, cat: BudgetCategory, reason: string) {
  w.reasons.set(cat, [...(w.reasons.get(cat) ?? []), reason]);
}

/** Decides how the budget should be split for this event, with a reason per change. */
function budgetWeights(input: EventInput): Weights {
  const w: Weights = { shares: new Map(), reasons: new Map() };
  for (const [cat, share] of Object.entries(BASE_SHARES[input.type]) as [BudgetCategory, number][]) {
    w.shares.set(cat, share);
    note(w, cat, `Typical starting share for ${eventNoun(input.type)} budgets: ${share}%.`);
  }

  if (input.venueBooked) {
    w.shares.delete("venue");
    w.reasons.delete("venue");
  }

  if (input.setting === "outdoor") {
    const bump = (cat: BudgetCategory, by: number, why: string) => {
      w.shares.set(cat, (w.shares.get(cat) ?? 0) + by);
      note(w, cat, why);
    };
    bump("decor", 3, "Outdoor: adds a tent or canopy and lighting.");
    bump("logistics", 2, "Outdoor: adds a generator and power backup.");
    bump("contingency", 2, "Outdoor: extra buffer for weather.");
  }

  input.priorities.forEach((p, i) => {
    const boost = PRIORITY_BOOST[i];
    const cat = PRIORITY_CATEGORY[p];
    if (!boost || (cat === "venue" && input.venueBooked)) return;
    const current = w.shares.get(cat) ?? UNLISTED_PRIORITY_SHARE;
    w.shares.set(cat, current * boost.factor);
    note(
      w,
      cat,
      `You ranked ${PRIORITY_LABEL[p].toLowerCase()} as your ${boost.rank} priority: ` +
        `share raised ${Math.round((boost.factor - 1) * 100)}%.`,
    );
  });

  // Contingency keeps its share; everything else is rescaled to fill the rest.
  const contingency = w.shares.get("contingency") ?? 0;
  const othersSum = [...w.shares].reduce((s, [c, v]) => (c === "contingency" ? s : s + v), 0);
  const scale = othersSum > 0 ? (100 - contingency) / othersSum : 0;
  for (const [cat, v] of w.shares) if (cat !== "contingency") w.shares.set(cat, v * scale);
  note(w, "contingency", "Kept aside for surprises; it is never cut to fund priorities.");
  return w;
}

/** Rupee step used for rounding: whole hundreds once budgets reach a lakh. */
function roundingUnit(total: number): number {
  return total >= 100_000 ? 100 : 1;
}

/**
 * Splits `amount` across `shares` so the parts are multiples of the rounding unit
 * and sum exactly to `amount` (largest-remainder method).
 */
export function splitExact(amount: number, shares: number[], unit: number): number[] {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (amount <= 0 || sum <= 0) return shares.map(() => 0);
  const units = Math.floor(amount / unit);
  const raw = shares.map((s) => (s / sum) * units);
  const left = units - raw.reduce((a, r) => a + Math.floor(r), 0);
  // The `left` parts with the largest fractional remainders each get one more unit.
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const bonus = new Set(order.slice(0, left).map(([, i]) => i));
  const result = raw.map((r, i) => (Math.floor(r) + (bonus.has(i) ? 1 : 0)) * unit);
  // Sub-unit rupees (amount not a multiple of the unit) go to the largest part.
  const rest = amount - result.reduce((a, b) => a + b, 0);
  const biggest = result.indexOf(Math.max(...result));
  return rest === 0 ? result : result.map((r, i) => (i === biggest ? r + rest : r));
}

export type Locks = Partial<Record<BudgetCategory, number>>;

/**
 * Builds the budget. Locked lines keep the amount the user set; the unlocked
 * lines share what remains in proportion to their weights. When locks exceed the
 * total, the overspend is reported, never silently fixed.
 */
export function buildBudget(input: EventInput, locks: Locks = {}): Budget {
  const w = budgetWeights(input);
  const cats = [...w.shares.keys()];
  const total = input.budget;
  const locked = cats.filter((c) => locks[c] !== undefined);
  const lockedSum = locked.reduce((s, c) => s + (locks[c] ?? 0), 0);
  const unlocked = cats.filter((c) => locks[c] === undefined);
  const remaining = Math.max(0, total - lockedSum);
  const parts = splitExact(
    remaining,
    unlocked.map((c) => w.shares.get(c) ?? 0),
    roundingUnit(total),
  );

  const lines: BudgetLine[] = cats.map((category) => {
    const isLocked = locks[category] !== undefined;
    const amount = isLocked ? (locks[category] ?? 0) : (parts[unlocked.indexOf(category)] ?? 0);
    return {
      category,
      amount,
      percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      locked: isLocked,
      reasons: isLocked
        ? ["You set this amount; other lines were rebalanced around it."]
        : (w.reasons.get(category) ?? []),
    };
  });
  // Largest line first, with contingency always last.
  const isContingency = (l: BudgetLine) => Number(l.category === "contingency");
  lines.sort((a, b) => isContingency(a) - isContingency(b) || b.amount - a.amount);

  return {
    total,
    lines,
    perGuest: input.guests > 0 ? Math.round(total / input.guests) : 0,
    overBy: Math.max(0, lockedSum - total),
  };
}

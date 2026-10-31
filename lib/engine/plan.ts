import { buildBudget, type Locks } from "./budget";
import { daysBetween } from "./dates";
import { buildInsights } from "./insights";
import { buildRunSheet, buildTasks } from "./timeline";
import type { EventInput, Plan } from "./types";
import { buildLogistics, buildVendors } from "./vendors";

/**
 * Builds the whole plan from the event details. It is a pure function of its
 * inputs, so the same details always give the same plan; the AI layer only
 * proposes changes to the details and adds ideas on top.
 */
export function buildPlan(input: EventInput, today: string, locks: Locks = {}): Plan {
  const daysToGo = daysBetween(today, input.date);
  const budget = buildBudget(input, locks);
  const tasks = buildTasks(input, today, daysToGo);
  const runSheet = buildRunSheet(input);
  return {
    input,
    today,
    daysToGo,
    budget,
    tasks,
    runSheet,
    vendors: buildVendors(input, tasks),
    logistics: buildLogistics(input),
    insights: buildInsights({ input, budget, tasks, runSheet, daysToGo }),
  };
}

// Shared types for the planning engine. Everything here is plain data so a plan
// can be stored in localStorage, sent to the assistant, and rebuilt deterministically.

export const EVENT_TYPES = ["wedding", "engagement", "birthday", "anniversary", "community", "festival"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CITY_TIERS = ["metro", "large", "town"] as const;
export type CityTier = (typeof CITY_TIERS)[number];

export const SETTINGS = ["indoor", "outdoor", "either"] as const;
export type Setting = (typeof SETTINGS)[number];

export const PRIORITIES = ["food", "decor", "photography", "entertainment", "venue", "attire"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PREFERENCES = ["vegetarianOnly", "alcoholFree", "ecoFriendly", "stepFreeAccess", "kidsFriendly"] as const;
export type Preference = (typeof PREFERENCES)[number];

/** Functions of a multi-day wedding, in the order they usually happen. */
export const FUNCTION_KINDS = ["haldi", "mehendi", "sangeet", "cocktail", "wedding", "reception"] as const;
export type FunctionKind = (typeof FUNCTION_KINDS)[number];

export const MAX_DAYS = 3;

export interface EventFunction {
  kind: FunctionKind;
  /** 1 is the first day of the celebration. */
  day: number;
  /** HH:mm (24 h). */
  startTime: string;
  /** Guests at this function; everyone when left out. */
  guests?: number;
}

export interface EventInput {
  type: EventType;
  title: string;
  /** Event day (the first day of a multi-day wedding), ISO yyyy-mm-dd. */
  date: string;
  /** How many days the celebration spans, 1 to MAX_DAYS. */
  days: number;
  /** The functions of a wedding, each on one of the days. Empty for a single gathering. */
  functions: EventFunction[];
  /** Start time on the day, HH:mm (24 h). */
  startTime: string;
  city: string;
  cityTier: CityTier;
  guests: number;
  /** Total budget in whole rupees. */
  budget: number;
  setting: Setting;
  venueBooked: boolean;
  /** Up to three, most important first. */
  priorities: Priority[];
  preferences: Preference[];
  /** Free-text style or theme, e.g. "pastel garden, minimal". */
  style: string;
  /** Optional extra context: traditions, the honoree, constraints. */
  notes: string;
}

export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "decor",
  "photography",
  "entertainment",
  "attire",
  "invitations",
  "favours",
  "logistics",
  "permits",
  "contingency",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export interface BudgetLine {
  category: BudgetCategory;
  amount: number;
  /** Share of the total, 0-100, rounded to one decimal. */
  percent: number;
  locked: boolean;
  /** Why this line has the size it has. */
  reasons: string[];
}

export interface Budget {
  total: number;
  lines: BudgetLine[];
  perGuest: number;
  /** Amount the locked lines exceed the total by (0 when they fit). */
  overBy: number;
}

export type Phase = "foundation" | "bookings" | "details" | "final-week" | "day-of";

export interface Task {
  id: string;
  title: string;
  phase: Phase;
  /** Due date, ISO yyyy-mm-dd. */
  due: string;
  /** Days before the event the task is ideally done. */
  idealLeadDays: number;
  /** True when the date was pulled closer because the event is soon. */
  compressed: boolean;
  why: string;
}

export interface RunSheetItem {
  /** The function this step belongs to, on multi-day plans. */
  function?: FunctionKind;
  /** ISO date of the step, on multi-day plans. */
  date?: string;
  time: string;
  title: string;
  detail: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: BudgetCategory;
  bookBy: string;
  questions: string[];
  why: string;
}

export interface LogisticsItem {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  why: string;
}

export type Severity = "critical" | "warning" | "info";

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  suggestion: string;
}

/** One function of a multi-day plan, with its date and a rough share of the budget. */
export interface FunctionPlan {
  kind: FunctionKind;
  day: number;
  /** ISO yyyy-mm-dd. */
  date: string;
  startTime: string;
  guests: number;
  /** Rough share of the total budget for this function, in rupees. */
  amount: number;
  percent: number;
  /** What this function needs that the others do not. */
  needs: string[];
}

export interface Plan {
  input: EventInput;
  /** Date the plan was computed for, ISO yyyy-mm-dd. */
  today: string;
  daysToGo: number;
  budget: Budget;
  /** Empty unless the event has functions. */
  functions: FunctionPlan[];
  tasks: Task[];
  runSheet: RunSheetItem[];
  vendors: Vendor[];
  logistics: LogisticsItem[];
  insights: Insight[];
}

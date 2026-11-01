import { z } from "zod";
import { isValidDate } from "./engine/dates";
import { BUDGET_CATEGORIES, type Budget, type BudgetCategory } from "./engine/types";
import { cleanText, LIMITS } from "./schema";

// What was actually paid or is still owed, against the planned budget lines.

export const PAYMENT_STATUSES = ["paid", "due"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PaymentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{8,40}$/),
  category: z.enum(BUDGET_CATEGORIES),
  label: z.string().transform(cleanText).pipe(z.string().max(LIMITS.paymentLabel)),
  amount: z.number().int().min(1).max(LIMITS.budget.max),
  /** Paid on, or due by, ISO yyyy-mm-dd. */
  date: z.string().refine(isValidDate, "Enter a real date."),
  status: z.enum(PAYMENT_STATUSES),
});
export type Payment = z.infer<typeof PaymentSchema>;

export interface LineSpend {
  category: BudgetCategory;
  planned: number;
  paid: number;
  due: number;
  /** Paid plus due minus planned, when that is positive. */
  over: number;
}

export interface Spend {
  lines: LineSpend[];
  planned: number;
  paid: number;
  due: number;
  /** Budget not yet paid or promised (negative when commitments exceed it). */
  left: number;
  /** Unpaid payments, soonest first. */
  upcoming: Payment[];
}

export function summarizeSpend(budget: Budget, payments: readonly Payment[]): Spend {
  const sum = (category: BudgetCategory, status: PaymentStatus) =>
    payments.filter((p) => p.category === category && p.status === status).reduce((n, p) => n + p.amount, 0);
  const lines = budget.lines.map((l) => {
    const paid = sum(l.category, "paid");
    const due = sum(l.category, "due");
    return { category: l.category, planned: l.amount, paid, due, over: Math.max(0, paid + due - l.amount) };
  });
  // A payment for a line that is not in this budget (e.g. the venue after it was marked booked) still counts.
  const total = (status: PaymentStatus) =>
    payments.filter((p) => p.status === status).reduce((n, p) => n + p.amount, 0);
  const paid = total("paid");
  const due = total("due");
  const upcoming = payments
    .filter((p) => p.status === "due")
    .toSorted((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  return { lines, planned: budget.total, paid, due, left: budget.total - paid - due, upcoming };
}

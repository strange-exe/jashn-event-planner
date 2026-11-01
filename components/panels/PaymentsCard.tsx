"use client";

import { useId, useState, type FormEvent } from "react";
import { formatINR, parseAmount } from "@/lib/engine/money";
import type { BudgetCategory } from "@/lib/engine/types";
import { CATEGORY_LABEL, formatDate } from "@/lib/labels";
import { PaymentSchema, type Payment, type PaymentStatus, type Spend } from "@/lib/payments";
import { LIMITS } from "@/lib/schema";
import { updatePlan, type SavedPlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { FieldError, StatusBadge } from "../feedback";
import { Icon } from "../Icon";
import { SpendRing } from "../SpendRing";
import { Card } from "./shared";

interface PaymentsCardProps {
  saved: SavedPlan;
  spend: Spend;
  categories: BudgetCategory[];
  today: string;
}

/** What has been paid and what is still owed, against the budget. */
export function PaymentsCard({ saved, spend, categories, today }: PaymentsCardProps) {
  const setPayments = (update: (p: Payment[]) => Payment[]) =>
    updatePlan(saved.id, (p) => ({ ...p, payments: update(p.payments).slice(0, LIMITS.savedPayments) }));

  const sorted = saved.payments.toSorted((a, b) => b.date.localeCompare(a.date));
  const next = spend.upcoming[0];

  return (
    <Card title="Spending">
      <SpendRing total={spend.planned} paid={spend.paid} due={spend.due} />
      {next && (
        <p className={styles.callout}>
          Next payment: <strong className="num">{formatINR(next.amount)}</strong> for{" "}
          {next.label || CATEGORY_LABEL[next.category]}, due {formatDate(next.date)}.
          {next.date < today && (
            <StatusBadge tone="critical" icon="stop">
              Overdue
            </StatusBadge>
          )}
        </p>
      )}
      <AddPayment categories={categories} today={today} onAdd={(p) => setPayments((all) => [p, ...all])} />
      {sorted.length === 0 ? (
        <p className="muted">No payments yet. Add deposits and advances as you pay them, and dues as you agree them.</p>
      ) : (
        <ul className={styles.list} aria-label="Payments">
          {sorted.map((p) => {
            const name = p.label || CATEGORY_LABEL[p.category];
            return (
              <li key={p.id} className={styles.payment}>
                <div className={styles.guestName}>
                  <span className={styles.paymentName}>{name}</span>
                  <span className="hint">
                    {p.label && `${CATEGORY_LABEL[p.category]}, `}
                    {p.status === "paid" ? "paid" : "due"} {formatDate(p.date)}
                  </span>
                </div>
                <span className={`num ${styles.paymentAmount}`}>{formatINR(p.amount)}</span>
                {p.status === "due" ? (
                  <button
                    type="button"
                    className="btn btn-quiet no-print"
                    onClick={() =>
                      setPayments((all) => all.map((x) => (x.id === p.id ? { ...x, status: "paid", date: today } : x)))
                    }
                  >
                    <Icon name="check" />
                    Mark paid<span className="sr-only"> {name}</span>
                  </button>
                ) : (
                  <StatusBadge tone="success" icon="check">
                    Paid
                  </StatusBadge>
                )}
                <button
                  type="button"
                  className="btn btn-quiet no-print"
                  onClick={() => setPayments((all) => all.filter((x) => x.id !== p.id))}
                >
                  <Icon name="trash" />
                  <span className="sr-only">Remove payment {name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

interface AddPaymentProps {
  categories: BudgetCategory[];
  today: string;
  onAdd: (p: Payment) => void;
}

function AddPayment({ categories, today, onAdd }: AddPaymentProps) {
  const [category, setCategory] = useState<BudgetCategory>(categories[0] ?? "catering");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<PaymentStatus>("paid");
  const [error, setError] = useState("");
  const uid = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = PaymentSchema.safeParse({
      id: crypto.randomUUID(),
      category,
      label,
      amount: parseAmount(amount) ?? NaN,
      date,
      status,
    });
    if (!r.success) {
      setError("Enter an amount in rupees, for example 25000 or 1.5 lakh, and a date.");
      return;
    }
    onAdd(r.data);
    setLabel("");
    setAmount("");
    setError("");
  }

  return (
    <form className={`no-print ${styles.addGuest}`} onSubmit={submit} aria-label="Add a payment">
      <div className={styles.modeSwitch} role="group" aria-label="Payment status">
        <button type="button" aria-pressed={status === "paid"} onClick={() => setStatus("paid")}>
          Paid
        </button>
        <button type="button" aria-pressed={status === "due"} onClick={() => setStatus("due")}>
          Still due
        </button>
      </div>
      <div className={styles.addFields}>
        <div className="field">
          <label htmlFor={`${uid}-cat`}>Budget line</label>
          <select
            id={`${uid}-cat`}
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-label`}>For</label>
          <input
            id={`${uid}-label`}
            className="input"
            value={label}
            maxLength={LIMITS.paymentLabel}
            placeholder="Caterer advance"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-amount`}>Amount</label>
          <input
            id={`${uid}-amount`}
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${uid}-err` : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-date`}>{status === "paid" ? "Paid on" : "Due by"}</label>
          <input
            id={`${uid}-date`}
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          <Icon name="plus" />
          Add payment
        </button>
      </div>
      {error && <FieldError id={`${uid}-err`}>{error}</FieldError>}
    </form>
  );
}

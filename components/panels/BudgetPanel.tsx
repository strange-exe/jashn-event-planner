"use client";

import { useId, useState } from "react";
import { formatINR, parseAmount } from "@/lib/engine/money";
import type { BudgetCategory, BudgetLine } from "@/lib/engine/types";
import { CATEGORY_LABEL } from "@/lib/labels";
import { summarizeSpend, type LineSpend } from "@/lib/payments";
import { updatePlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { FieldError, StatusBadge } from "../feedback";
import { Icon } from "../Icon";
import { SeverityBadge } from "../SeverityBadge";
import { PaymentsCard } from "./PaymentsCard";
import { Card, type PanelProps } from "./shared";

// A single line may be fixed above the total (the overspend is then reported), but not
// absurdly so: past twice the total it is almost certainly a typo.
const MAX_LINE_TO_TOTAL = 2;

export function BudgetPanel({ plan, saved }: PanelProps) {
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const { budget } = plan;

  const lock = (category: BudgetCategory, amount: number) =>
    updatePlan(saved.id, (p) => ({ ...p, locks: { ...p.locks, [category]: amount } }));

  const unlock = (category: BudgetCategory) =>
    updatePlan(saved.id, (p) => {
      const locks = { ...p.locks };
      delete locks[category];
      return { ...p, locks };
    });

  const spend = summarizeSpend(budget, saved.payments);

  return (
    <div className={styles.panelGrid}>
      <Card
        title="Budget split"
        aside={
          <span className="muted num">
            {formatINR(budget.total)} total, {formatINR(budget.perGuest)} per guest
          </span>
        }
      >
        {budget.overBy > 0 && (
          <p className="row" role="alert">
            <SeverityBadge severity="critical" /> Your fixed lines are {formatINR(budget.overBy)} over the total.
          </p>
        )}
        <p className="hint">
          Edit any line with the slider or by typing an amount; the others rebalance to keep the total. Lines always add
          up exactly.
        </p>
        <ul className={styles.list}>
          {budget.lines.map((line) => (
            <BudgetLineItem
              key={line.category}
              line={line}
              spend={spend.lines.find((s) => s.category === line.category)}
              total={budget.total}
              maxAmount={budget.total * MAX_LINE_TO_TOTAL}
              editing={editing === line.category}
              onEdit={() => setEditing(line.category)}
              onCancel={() => setEditing(null)}
              onSave={(amount) => {
                lock(line.category, amount);
                setEditing(null);
              }}
              onUnlock={() => unlock(line.category)}
            />
          ))}
        </ul>
      </Card>
      <PaymentsCard saved={saved} spend={spend} categories={budget.lines.map((l) => l.category)} today={plan.today} />
    </div>
  );
}

interface BudgetLineItemProps {
  line: BudgetLine;
  spend?: LineSpend;
  total: number;
  maxAmount: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (amount: number) => void;
  onUnlock: () => void;
}

function BudgetLineItem({
  line,
  spend,
  total,
  maxAmount,
  editing,
  onEdit,
  onCancel,
  onSave,
  onUnlock,
}: BudgetLineItemProps) {
  const name = CATEGORY_LABEL[line.category];
  return (
    <li className={styles.budgetLine}>
      <div className={styles.budgetRow}>
        <span className={styles.budgetName}>
          {name}
          {line.locked && (
            <StatusBadge tone="neutral" icon="lock">
              Fixed
            </StatusBadge>
          )}
        </span>
        <span className="num">
          <strong>{formatINR(line.amount)}</strong> <span className="muted">{line.percent}%</span>
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, line.percent)}%` }} />
      </div>
      {spend && spend.paid + spend.due > 0 && (
        <p className={`hint num ${styles.lineSpend}`}>
          {formatINR(spend.paid)} paid
          {spend.due > 0 && `, ${formatINR(spend.due)} due`}
          {spend.over > 0 ? (
            <StatusBadge tone="warning" icon="alert">
              {formatINR(spend.over)} over this line
            </StatusBadge>
          ) : (
            `, ${formatINR(line.amount - spend.paid - spend.due)} left`
          )}
        </p>
      )}
      <details className={styles.why}>
        <summary>Why this amount</summary>
        <ul>
          {line.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      {editing ? (
        <AmountForm
          name={name}
          initial={line.amount}
          total={total}
          maxAmount={maxAmount}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <div className="row no-print">
          <button type="button" className="btn btn-quiet" onClick={onEdit}>
            Edit<span className="sr-only"> {name}</span>
          </button>
          {line.locked && (
            <button type="button" className="btn btn-quiet" onClick={onUnlock}>
              <Icon name="unlock" />
              Let it rebalance<span className="sr-only"> {name}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

interface AmountFormProps {
  name: string;
  initial: number;
  total: number;
  maxAmount: number;
  onSave: (amount: number) => void;
  onCancel: () => void;
}

function AmountForm({ name, initial, total, maxAmount, onSave, onCancel }: AmountFormProps) {
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState("");
  const uid = useId();
  // The slider covers the whole budget; typing can go further, up to maxAmount.
  const typed = parseAmount(value);
  const step = total >= 100_000 ? 1_000 : 100;
  const sliderMax = Math.max(total, initial);
  const sliderValue = Math.min(sliderMax, Math.max(0, typed ?? initial));
  const share = total > 0 && typed !== null ? Math.round((typed / total) * 1000) / 10 : null;

  function submit() {
    const amount = parseAmount(value);
    if (amount === null || amount < 0 || amount > maxAmount) {
      setError("Enter an amount in rupees, for example 50000 or 1.2 lakh.");
      return;
    }
    onSave(amount);
  }

  return (
    <form
      className={styles.editForm}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`${uid}-slider`} className="sr-only">
        Amount for {name}, slider
      </label>
      <input
        id={`${uid}-slider`}
        type="range"
        className={styles.slider}
        min={0}
        max={sliderMax}
        step={step}
        value={sliderValue}
        aria-valuetext={formatINR(sliderValue)}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
      />
      <div className={`row ${styles.editRow}`}>
        <label htmlFor={`${uid}-amount`} className="sr-only">
          New amount for {name}
        </label>
        <input
          id={`${uid}-amount`}
          className={`input num ${styles.amountInput}`}
          value={value}
          inputMode="decimal"
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${uid}-share${error ? ` ${uid}-err` : ""}`}
          autoFocus
        />
        <span id={`${uid}-share`} className="hint num">
          {typed !== null
            ? `${formatINR(typed)}${share !== null ? `, ${share}% of the total` : ""}`
            : "Not a number yet"}
        </span>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="submit">
          Save
        </button>
        <button className="btn btn-quiet" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <FieldError id={`${uid}-err`}>{error}</FieldError>}
    </form>
  );
}

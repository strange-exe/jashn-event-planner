"use client";

import { formatNumber } from "@/lib/engine/money";
import styles from "../dashboard.module.css";
import { StatusBadge } from "../feedback";
import { SeverityBadge } from "../SeverityBadge";
import { Card, TaskCheck, type PanelProps } from "./shared";

const NEXT_UP_COUNT = 5;

export function OverviewPanel({ plan, saved }: PanelProps) {
  const open = plan.tasks.filter((t) => !saved.done[t.id]).slice(0, NEXT_UP_COUNT);
  return (
    <div className={styles.panelGrid}>
      <Card title="What needs attention">
        {plan.insights.length === 0 ? (
          <p className="row">
            <StatusBadge tone="success" icon="check">
              On track
            </StatusBadge>{" "}
            Nothing to flag. Keep working through the timeline.
          </p>
        ) : (
          <ul className={styles.list}>
            {plan.insights.map((i) => (
              <li key={i.id} className={styles.insight}>
                <div className="row">
                  <SeverityBadge severity={i.severity} />
                  <strong>{i.title}</strong>
                </div>
                <p className="muted">{i.detail}</p>
                <p>
                  <span className="sr-only">Suggestion: </span>
                  {i.suggestion}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Next up">
        {open.length ? (
          <ul className={styles.list}>
            {open.map((t) => (
              <TaskCheck key={t.id} saved={saved} task={t} today={plan.today} />
            ))}
          </ul>
        ) : (
          <p className="muted">Every task is done. Enjoy the celebration.</p>
        )}
      </Card>

      <Card title="Quantities to plan for">
        <table className={styles.table}>
          <caption className="sr-only">Quantities based on {plan.input.guests} guests</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className={styles.right}>
                Amount
              </th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {plan.logistics.map((l) => (
              <tr key={l.id}>
                <th scope="row">{l.label}</th>
                <td className={`num ${styles.right}`}>
                  {formatNumber(l.quantity)} {l.unit}
                </td>
                <td className="muted">{l.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

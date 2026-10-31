"use client";

import { formatNumber } from "@/lib/engine/money";
import styles from "../dashboard.module.css";
import { Icon } from "../Icon";
import { SeverityBadge } from "../SeverityBadge";
import { TaskCheck, type PanelProps } from "./shared";

const NEXT_UP_COUNT = 5;

export function OverviewPanel({ plan, saved }: PanelProps) {
  const open = plan.tasks.filter((t) => !saved.done[t.id]).slice(0, NEXT_UP_COUNT);
  return (
    <div className={styles.panelGrid}>
      <section className="card stack" aria-labelledby="flags-h">
        <h2 id="flags-h" className={styles.h}>
          What needs attention
        </h2>
        {plan.insights.length === 0 ? (
          <p className="row">
            <span className="badge tone-success">
              <Icon name="check" />
              On track
            </span>{" "}
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
      </section>

      <section className="card stack" aria-labelledby="next-h">
        <h2 id="next-h" className={styles.h}>
          Next up
        </h2>
        {open.length ? (
          <ul className={styles.list}>
            {open.map((t) => (
              <TaskCheck key={t.id} saved={saved} task={t} today={plan.today} />
            ))}
          </ul>
        ) : (
          <p className="muted">Every task is done. Enjoy the celebration.</p>
        )}
      </section>

      <section className="card stack" aria-labelledby="log-h">
        <h2 id="log-h" className={styles.h}>
          Quantities to plan for
        </h2>
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
      </section>
    </div>
  );
}

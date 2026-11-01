"use client";

import type { Phase, RunSheetItem } from "@/lib/engine/types";
import { formatDate, FUNCTION_LABEL, PHASE_LABEL } from "@/lib/labels";
import styles from "../dashboard.module.css";
import { Card, TaskCheck, type PanelProps } from "./shared";

const PHASES: Phase[] = ["foundation", "bookings", "details", "final-week", "day-of"];

export function TimelinePanel({ plan, saved }: PanelProps) {
  return (
    <div className={styles.panelGrid}>
      <Card title="Timeline">
        {plan.tasks.some((t) => t.compressed) && (
          <p className="hint">
            Tasks marked &ldquo;Pulled forward&rdquo; would normally happen earlier; there is less time than ideal, so
            start with them.
          </p>
        )}
        {PHASES.map((phase) => {
          const tasks = plan.tasks.filter((t) => t.phase === phase);
          if (!tasks.length) return null;
          return (
            <div key={phase} className="stack stack-tight">
              <h3 className={styles.phase}>{PHASE_LABEL[phase]}</h3>
              <ul className={styles.list}>
                {tasks.map((t) => (
                  <TaskCheck key={t.id} saved={saved} task={t} today={plan.today} />
                ))}
              </ul>
            </div>
          );
        })}
      </Card>
      <Card title={plan.functions.length ? "Function by function" : "On the day"}>
        {plan.functions.length ? (
          plan.functions.map((f) => (
            <section key={f.kind} className={styles.runGroup} aria-labelledby={`run-${f.kind}`}>
              <h3 id={`run-${f.kind}`} className={styles.phase}>
                {FUNCTION_LABEL[f.kind].name}, {formatDate(f.date)}
              </h3>
              <RunSheet items={plan.runSheet.filter((s) => s.function === f.kind)} />
            </section>
          ))
        ) : (
          <RunSheet items={plan.runSheet} />
        )}
      </Card>
    </div>
  );
}

function RunSheet({ items }: { items: RunSheetItem[] }) {
  return (
    <ol className={styles.runSheet}>
      {items.map((s) => (
        <li key={s.time + s.title}>
          <span className="num">
            <strong>{s.time}</strong>
          </span>
          <span className={styles.runSheetText}>
            <strong>{s.title}</strong>
            <span className="muted">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

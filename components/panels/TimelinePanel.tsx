"use client";

import type { Phase } from "@/lib/engine/types";
import { PHASE_LABEL } from "@/lib/labels";
import styles from "../dashboard.module.css";
import { TaskCheck, type PanelProps } from "./shared";

const PHASES: Phase[] = ["foundation", "bookings", "details", "final-week", "day-of"];

export function TimelinePanel({ plan, saved }: PanelProps) {
  return (
    <div className={styles.panelGrid}>
      <section className="card stack" aria-labelledby="tl-h">
        <h2 id="tl-h" className={styles.h}>
          Timeline
        </h2>
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
      </section>
      <section className="card stack" aria-labelledby="rs-h">
        <h2 id="rs-h" className={styles.h}>
          On the day
        </h2>
        <ol className={styles.runSheet}>
          {plan.runSheet.map((s) => (
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
      </section>
    </div>
  );
}

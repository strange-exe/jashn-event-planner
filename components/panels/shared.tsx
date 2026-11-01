"use client";

import { useId, type ReactNode } from "react";
import type { Plan, Task } from "@/lib/engine/types";
import { formatDate } from "@/lib/labels";
import { updatePlan, type SavedPlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { StatusBadge } from "../feedback";

export interface PanelProps {
  plan: Plan;
  saved: SavedPlan;
}

interface CardProps {
  title: ReactNode;
  /** Short summary shown beside the title, such as a count. */
  aside?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}

/** A dashboard card: a section named by its own heading. */
export function Card({ title, aside, busy, children }: CardProps) {
  const headingId = useId();
  const heading = (
    <h2 id={headingId} className={styles.h}>
      {title}
    </h2>
  );
  return (
    <section className="card stack" aria-labelledby={headingId} aria-busy={busy}>
      {aside === undefined ? (
        heading
      ) : (
        <div className="card-title">
          {heading}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Ticks a task as done or a vendor as booked. */
export function toggle(saved: SavedPlan, field: "done" | "booked", key: string, value: boolean) {
  updatePlan(saved.id, (p) => ({ ...p, [field]: { ...p[field], [key]: value } }));
}

interface TaskCheckProps {
  saved: SavedPlan;
  task: Task;
  today: string;
}

export function TaskCheck({ saved, task, today }: TaskCheckProps) {
  const done = Boolean(saved.done[task.id]);
  const overdue = !done && task.due < today;
  return (
    <li className={styles.task}>
      <label className={styles.check}>
        <input type="checkbox" checked={done} onChange={(e) => toggle(saved, "done", task.id, e.target.checked)} />
        <span className={done ? styles.doneText : undefined}>{task.title}</span>
      </label>
      <span className={`hint num ${styles.due}`}>
        Due {formatDate(task.due)}
        {overdue && (
          <StatusBadge tone="critical" icon="stop">
            Overdue
          </StatusBadge>
        )}
        {task.compressed && !done && <StatusBadge tone="warning">Pulled forward</StatusBadge>}
      </span>
    </li>
  );
}

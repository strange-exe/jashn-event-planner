"use client";

import type { Plan, Task } from "@/lib/engine/types";
import { formatDate } from "@/lib/labels";
import { updatePlan, type SavedPlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { Icon } from "../Icon";

export interface PanelProps {
  plan: Plan;
  saved: SavedPlan;
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
          <span className="badge tone-critical">
            <Icon name="stop" />
            Overdue
          </span>
        )}
        {task.compressed && !done && <span className="badge tone-warning">Pulled forward</span>}
      </span>
    </li>
  );
}

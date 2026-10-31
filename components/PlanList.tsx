"use client";

import Link from "next/link";
import { formatINR } from "@/lib/engine/money";
import { EVENT_LABEL, formatDate } from "@/lib/labels";
import { usePlans } from "@/lib/store";
import { Icon } from "./Icon";
import styles from "./dashboard.module.css";

export function PlanList() {
  const plans = usePlans();
  if (plans === null) return <p className="muted" role="status">Loading your plans.</p>;
  if (plans.length === 0) {
    return (
      <div className="card stack" style={{ maxWidth: 560 }}>
        <h2 className={styles.h}>No plans yet</h2>
        <p className="muted">Start with the occasion and a rough budget; you can change everything later.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/plan/new"><Icon name="plus" />Start a plan</Link>
          <Link className="btn btn-secondary" href="/plan/new?sample=wedding">Try a sample wedding</Link>
        </div>
      </div>
    );
  }
  const sorted = [...plans].sort((a, b) => a.input.date.localeCompare(b.input.date));
  return (
    <ul className={styles.ideas}>
      {sorted.map((p) => (
        <li key={p.id} className="card stack" style={{ gap: "var(--space-2)" }}>
          <span className="hint">{EVENT_LABEL[p.input.type].name}</span>
          <h2 className={styles.h}>
            <Link href={`/plans/${p.id}`}>{p.input.title}</Link>
          </h2>
          <p className="muted num">{formatDate(p.input.date)}, {p.input.city}</p>
          <p className="num">{p.input.guests} guests, {formatINR(p.input.budget)}</p>
        </li>
      ))}
    </ul>
  );
}

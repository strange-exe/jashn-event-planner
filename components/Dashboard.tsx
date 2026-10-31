"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { todayIn } from "@/lib/engine/dates";
import { formatINR } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import { planToIcs } from "@/lib/ics";
import { EVENT_LABEL, formatDate } from "@/lib/labels";
import { deletePlan, updatePlan, usePlan } from "@/lib/store";
import { Assistant } from "./Assistant";
import styles from "./dashboard.module.css";
import { Icon } from "./Icon";
import { BudgetPanel, IdeasPanel, OverviewPanel, TimelinePanel, VendorsPanel } from "./panels";
import { Tabs } from "./Tabs";

export function Dashboard({ id }: { id: string }) {
  const saved = usePlan(id);
  const router = useRouter();
  const [today] = useState(() => todayIn());
  const plan = useMemo(() => (saved ? buildPlan(saved.input, today, saved.locks) : null), [saved, today]);

  if (saved === null) return <p className="muted" role="status">Loading your plan.</p>;
  if (!saved || !plan) {
    return (
      <div className={`card stack ${styles.missing}`}>
        <h1>Plan not found</h1>
        <p className="muted">Plans are saved in the browser where they were made. It may have been deleted, or made on another device.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/plan/new">Start a new plan</Link>
          <Link className="btn btn-secondary" href="/plans">My plans</Link>
        </div>
      </div>
    );
  }

  const doneCount = plan.tasks.filter((t) => saved.done[t.id]).length;
  const flags = plan.insights.filter((i) => i.severity !== "info").length;

  function downloadIcs() {
    const blob = new Blob([planToIcs(plan!, saved!.id)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "jashn-plan.ics" });
    a.click();
    URL.revokeObjectURL(url);
  }

  function remove() {
    if (window.confirm(`Delete "${saved!.input.title}"? This cannot be undone.`)) {
      deletePlan(saved!.id);
      router.push("/plans");
    }
  }

  const countdown = plan.daysToGo === 0 ? "Today" : plan.daysToGo === 1 ? "Tomorrow" : `${plan.daysToGo} days to go`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          <h1 className={styles.title}>{plan.input.title}</h1>
          <p className="muted">
            {EVENT_LABEL[plan.input.type].name} on {formatDate(plan.input.date)} at {plan.input.startTime}, {plan.input.city}.{" "}
            <strong className={styles.countdown}>{countdown}</strong>
          </p>
        </div>
        <div className={`row no-print ${styles.actions}`}>
          <Link className="btn btn-secondary" href={`/plan/new?edit=${saved.id}`}>Edit details</Link>
          <button type="button" className="btn btn-quiet" onClick={downloadIcs}><Icon name="calendar" />Add to calendar</button>
          <button type="button" className="btn btn-quiet" onClick={() => window.print()}><Icon name="print" />Print</button>
          <button type="button" className="btn btn-quiet" onClick={remove}><Icon name="trash" />Delete</button>
        </div>
      </header>

      <dl className={styles.stats}>
        <div><dt>Budget</dt><dd className="num">{formatINR(plan.budget.total)}</dd></div>
        <div><dt>Per guest</dt><dd className="num">{formatINR(plan.budget.perGuest)}</dd></div>
        <div><dt>Guests</dt><dd className="num">{plan.input.guests}</dd></div>
        <div><dt>Tasks done</dt><dd className="num">{doneCount} of {plan.tasks.length}</dd></div>
        <div><dt>Flags</dt><dd className="num">{flags}</dd></div>
      </dl>

      <div className={styles.layout}>
        <Tabs
          label="Plan sections"
          tabs={[
            { id: "overview", label: "Overview", content: <OverviewPanel plan={plan} saved={saved} /> },
            { id: "budget", label: "Budget", content: <BudgetPanel plan={plan} saved={saved} /> },
            { id: "timeline", label: "Timeline", count: plan.tasks.length - doneCount, content: <TimelinePanel plan={plan} saved={saved} /> },
            { id: "vendors", label: "Vendors", count: plan.vendors.filter((v) => !saved.booked[v.id]).length, content: <VendorsPanel plan={plan} saved={saved} /> },
            { id: "ideas", label: "Ideas", content: <IdeasPanel plan={plan} saved={saved} /> },
          ]}
        />
        <Assistant saved={saved} onApplied={(input) => updatePlan(saved.id, (p) => ({ ...p, input }))} />
      </div>
    </div>
  );
}

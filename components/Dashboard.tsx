"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { todayIn } from "@/lib/engine/dates";
import { formatINR } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import type { Plan } from "@/lib/engine/types";
import { planToIcs } from "@/lib/ics";
import { eventSummary } from "@/lib/labels";
import { summarizeGuests } from "@/lib/guests";
import { summarizeSpend } from "@/lib/payments";
import { deletePlan, updatePlan, usePlan, type SavedPlan } from "@/lib/store";
import { Assistant } from "./Assistant";
import styles from "./dashboard.module.css";
import { Icon } from "./Icon";
import { BudgetPanel, GuestsPanel, IdeasPanel, OverviewPanel, TimelinePanel, VendorsPanel } from "./panels";
import { PlanMissing } from "./PlanMissing";
import { ShareButton } from "./ShareButton";
import { Tabs } from "./Tabs";

export function Dashboard({ id }: { id: string }) {
  const saved = usePlan(id);
  const [today] = useState(() => todayIn());
  const plan = useMemo(() => (saved ? buildPlan(saved.input, today, saved.locks) : null), [saved, today]);

  if (saved === null) {
    return (
      <p className="muted" role="status">
        Loading your plan.
      </p>
    );
  }
  if (!saved || !plan) return <PlanMissing />;
  return <PlanView saved={saved} plan={plan} />;
}

/** The countdown as a big figure and the words under it. */
function countdown(daysToGo: number): { figure: string; words: string } {
  if (daysToGo < 0) return { figure: String(-daysToGo), words: daysToGo === -1 ? "day since" : "days since" };
  if (daysToGo === 0) return { figure: "Today", words: "is the day" };
  return { figure: String(daysToGo), words: daysToGo === 1 ? "day to go" : "days to go" };
}

function PlanView({ saved, plan }: { saved: SavedPlan; plan: Plan }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const doneCount = plan.tasks.filter((t) => saved.done[t.id]).length;
  const openVendors = plan.vendors.filter((v) => !saved.booked[v.id]).length;
  const spend = summarizeSpend(plan.budget, saved.payments);
  const guests = summarizeGuests(saved.guests);
  const paidPct = plan.budget.total > 0 ? Math.round((spend.paid / plan.budget.total) * 100) : 0;
  const days = countdown(plan.daysToGo);

  function downloadIcs() {
    const blob = new Blob([planToIcs(plan, saved.id)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "jashn-plan.ics" });
    a.click();
    URL.revokeObjectURL(url);
  }

  function remove() {
    if (window.confirm(`Delete "${saved.input.title}"? This cannot be undone.`)) {
      deletePlan(saved.id);
      router.push("/plans");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{plan.input.title}</h1>
          <p className="muted">{eventSummary(plan.input)}</p>
          <div className={`row no-print ${styles.actions}`}>
            <Link className="btn btn-secondary" href={`/plan/new?edit=${saved.id}`}>
              Edit details
            </Link>
            <ShareButton saved={saved} onNote={setNote} />
            <button type="button" className="btn btn-quiet" onClick={downloadIcs}>
              <Icon name="calendar" />
              Add to calendar
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
              <Icon name="print" />
              Print
            </button>
            <button type="button" className="btn btn-quiet" onClick={remove}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
          <p role="status" className="hint">
            {note}
          </p>
        </div>
        <p className={styles.countdown}>
          <span className={`num ${styles.countFigure}`}>{days.figure}</span>
          <span className={styles.countWords}>{days.words}</span>
        </p>
      </header>

      <dl className={styles.stats}>
        <Stat
          label="Budget"
          value={formatINR(plan.budget.total)}
          sub={`${formatINR(plan.budget.perGuest)} per guest`}
        />
        <Stat label="Paid so far" value={formatINR(spend.paid)} sub={`${paidPct}% of the budget`} />
        <Stat
          label="Guests"
          value={plan.input.guests}
          sub={guests.people.yes > 0 ? `${guests.people.yes} coming` : "No replies yet"}
        />
        <Stat
          label="Tasks done"
          value={`${doneCount} of ${plan.tasks.length}`}
          sub={doneCount === plan.tasks.length ? "All done" : `${plan.tasks.length - doneCount} to go`}
        />
      </dl>

      <div className={styles.layout}>
        <Tabs
          label="Plan sections"
          tabs={[
            { id: "overview", label: "Overview", content: <OverviewPanel plan={plan} saved={saved} /> },
            { id: "budget", label: "Budget", content: <BudgetPanel plan={plan} saved={saved} /> },
            {
              id: "timeline",
              label: "Timeline",
              count: plan.tasks.length - doneCount,
              content: <TimelinePanel plan={plan} saved={saved} />,
            },
            {
              id: "vendors",
              label: "Vendors",
              count: openVendors,
              content: <VendorsPanel plan={plan} saved={saved} />,
            },
            {
              id: "guests",
              label: "Guests",
              count: guests.people.pending || undefined,
              content: <GuestsPanel plan={plan} saved={saved} />,
            },
            { id: "ideas", label: "Ideas", content: <IdeasPanel plan={plan} saved={saved} /> },
          ]}
        />
        <Assistant saved={saved} onApplied={(input) => updatePlan(saved.id, (p) => ({ ...p, input }))} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
      <dd className={`hint num ${styles.statSub}`}>{sub}</dd>
    </div>
  );
}

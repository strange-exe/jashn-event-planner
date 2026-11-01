"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { todayIn } from "@/lib/engine/dates";
import { formatINR } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import { CATEGORY_LABEL, eventSummary, formatDate, PHASE_LABEL } from "@/lib/labels";
import { decodeShared, fragmentData, ShareLinkError, type SharedPlan } from "@/lib/share";
import { createPlan } from "@/lib/store";
import styles from "./dashboard.module.css";
import { ErrorAlert, StatusBadge } from "./feedback";
import { Icon } from "./Icon";
import { Card } from "./panels/shared";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; shared: SharedPlan };

const asRecord = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));

/** A plan opened from a share link: read-only, with an option to save a copy. */
export function SharedPlanView() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const shared = await decodeShared(fragmentData(location.hash));
        if (live) setState({ status: "ready", shared });
      } catch (e) {
        const message = e instanceof ShareLinkError ? e.message : "The link could not be opened.";
        if (live) setState({ status: "error", message });
      }
    }
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      live = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p className="muted" role="status">
        Opening the shared plan.
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <section className={`card stack ${styles.missing}`} aria-labelledby="share-error">
        <h1 id="share-error">This link does not open a plan</h1>
        <ErrorAlert>{state.message}</ErrorAlert>
        <Link className="btn btn-primary" href="/plan/new">
          Start your own plan
        </Link>
      </section>
    );
  }
  return <SharedView shared={state.shared} />;
}

function SharedView({ shared }: { shared: SharedPlan }) {
  const router = useRouter();
  const [today] = useState(() => todayIn());
  const plan = useMemo(() => buildPlan(shared.input, today, shared.locks), [shared, today]);
  const done = new Set(shared.done);
  const booked = new Set(shared.booked);
  const doneCount = plan.tasks.filter((t) => done.has(t.id)).length;

  function saveCopy() {
    const copy = createPlan(shared.input, {
      locks: shared.locks,
      done: asRecord(shared.done),
      booked: asRecord(shared.booked),
    });
    router.push(`/plans/${copy.id}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{plan.input.title}</h1>
          <p className="muted">{eventSummary(plan.input)}</p>
          <p className="row">
            <StatusBadge tone="info" icon="info">
              Shared plan, view only
            </StatusBadge>
            <button type="button" className="btn btn-secondary no-print" onClick={saveCopy}>
              <Icon name="plus" />
              Save a copy to my plans
            </button>
          </p>
        </div>
        <p className={styles.countdown}>
          <span className={`num ${styles.countFigure}`}>{plan.daysToGo >= 0 ? plan.daysToGo : 0}</span>
          <span className={styles.countWords}>{plan.daysToGo === 1 ? "day to go" : "days to go"}</span>
        </p>
      </header>

      <div className={styles.sharedGrid}>
        <Card
          title="Budget"
          aside={
            <span className="muted num">
              {formatINR(plan.budget.total)} for {plan.input.guests} guests
            </span>
          }
        >
          <ul className={styles.list}>
            {plan.budget.lines.map((l) => (
              <li key={l.category} className={styles.budgetLine}>
                <div className={styles.budgetRow}>
                  <span className={styles.budgetName}>{CATEGORY_LABEL[l.category]}</span>
                  <span className="num">
                    <strong>{formatINR(l.amount)}</strong> <span className="muted">{l.percent}%</span>
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, l.percent)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Timeline"
          aside={
            <span className="muted num">
              {doneCount} of {plan.tasks.length} done
            </span>
          }
        >
          <ul className={styles.list}>
            {plan.tasks.map((t) => (
              <li key={t.id} className={styles.task}>
                <span className={styles.check}>
                  {done.has(t.id) ? (
                    <StatusBadge tone="success" icon="check">
                      Done
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">{PHASE_LABEL[t.phase]}</StatusBadge>
                  )}
                  <span className={done.has(t.id) ? styles.doneText : undefined}>{t.title}</span>
                </span>
                <span className="hint num">Due {formatDate(t.due)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Vendors">
          <ul className={styles.list}>
            {plan.vendors.map((v) => (
              <li key={v.id} className="row spread">
                <span>{v.name}</span>
                {booked.has(v.id) ? (
                  <StatusBadge tone="success" icon="check">
                    Booked
                  </StatusBadge>
                ) : (
                  <span className="hint num">Book by {formatDate(v.bookBy)}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

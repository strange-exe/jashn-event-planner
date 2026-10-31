"use client";

import { useId, useState } from "react";
import { formatINR, formatNumber, parseAmount } from "@/lib/engine/money";
import type { BudgetCategory, Phase, Plan } from "@/lib/engine/types";
import { IDEA_CATEGORIES, type Idea, type IdeaCategory } from "@/lib/ideas";
import { CATEGORY_LABEL, formatDate, PHASE_LABEL } from "@/lib/labels";
import { updatePlan, type SavedPlan } from "@/lib/store";
import styles from "./dashboard.module.css";
import { Icon } from "./Icon";
import { SeverityBadge } from "./SeverityBadge";

interface PanelProps {
  plan: Plan;
  saved: SavedPlan;
}

function toggle(saved: SavedPlan, field: "done" | "booked", key: string, value: boolean) {
  updatePlan(saved.id, (p) => ({ ...p, [field]: { ...p[field], [key]: value } }));
}

function TaskCheck({ saved, id, title, due, today, compressed }: { saved: SavedPlan; id: string; title: string; due: string; today: string; compressed: boolean }) {
  const done = Boolean(saved.done[id]);
  const overdue = !done && due < today;
  return (
    <li className={styles.task}>
      <label className={styles.check}>
        <input type="checkbox" checked={done} onChange={(e) => toggle(saved, "done", id, e.target.checked)} />
        <span className={done ? styles.doneText : undefined}>{title}</span>
      </label>
      <span className={`hint num ${styles.due}`}>
        Due {formatDate(due)}
        {overdue && <span className="badge tone-critical"><Icon name="stop" />Overdue</span>}
        {compressed && !done && <span className="badge tone-warning">Pulled forward</span>}
      </span>
    </li>
  );
}

export function OverviewPanel({ plan, saved }: PanelProps) {
  const open = plan.tasks.filter((t) => !saved.done[t.id]).slice(0, 5);
  return (
    <div className={styles.panelGrid}>
      <section className="card stack" aria-labelledby="flags-h">
        <h2 id="flags-h" className={styles.h}>What needs attention</h2>
        {plan.insights.length === 0 ? (
          <p className="row"><span className="badge tone-success"><Icon name="check" />On track</span> Nothing to flag. Keep working through the timeline.</p>
        ) : (
          <ul className={styles.list}>
            {plan.insights.map((i) => (
              <li key={i.id} className={styles.insight}>
                <div className="row"><SeverityBadge severity={i.severity} /><strong>{i.title}</strong></div>
                <p className="muted">{i.detail}</p>
                <p><span className="sr-only">Suggestion: </span>{i.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="next-h">
        <h2 id="next-h" className={styles.h}>Next up</h2>
        {open.length ? (
          <ul className={styles.list}>
            {open.map((t) => <TaskCheck key={t.id} saved={saved} today={plan.today} {...t} />)}
          </ul>
        ) : <p className="muted">Every task is done. Enjoy the celebration.</p>}
      </section>

      <section className="card stack" aria-labelledby="log-h">
        <h2 id="log-h" className={styles.h}>Quantities to plan for</h2>
        <table className={styles.table}>
          <caption className="sr-only">Quantities based on {plan.input.guests} guests</caption>
          <thead><tr><th scope="col">Item</th><th scope="col" className={styles.right}>Amount</th><th scope="col">Why</th></tr></thead>
          <tbody>
            {plan.logistics.map((l) => (
              <tr key={l.id}>
                <th scope="row">{l.label}</th>
                <td className={`num ${styles.right}`}>{formatNumber(l.quantity)} {l.unit}</td>
                <td className="muted">{l.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function BudgetPanel({ plan, saved }: PanelProps) {
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const uid = useId();
  const { budget } = plan;

  function save(cat: BudgetCategory) {
    const amount = parseAmount(value);
    if (amount === null || amount < 0 || amount > budget.total * 2) {
      setError("Enter an amount in rupees, for example 50000 or 1.2 lakh.");
      return;
    }
    updatePlan(saved.id, (p) => ({ ...p, locks: { ...p.locks, [cat]: amount } }));
    setEditing(null);
    setError("");
  }

  const unlock = (cat: BudgetCategory) =>
    updatePlan(saved.id, (p) => {
      const locks = { ...p.locks };
      delete locks[cat];
      return { ...p, locks };
    });

  return (
    <section className="card stack" aria-labelledby="budget-h">
      <div className="card-title">
        <h2 id="budget-h" className={styles.h}>Budget split</h2>
        <span className="muted num">{formatINR(budget.total)} total, {formatINR(budget.perGuest)} per guest</span>
      </div>
      {budget.overBy > 0 && (
        <p className="row" role="alert"><SeverityBadge severity="critical" /> Your fixed lines are {formatINR(budget.overBy)} over the total.</p>
      )}
      <p className="hint">Edit any line to fix its amount; the others rebalance to keep the total. Lines always add up exactly.</p>
      <ul className={styles.list}>
        {budget.lines.map((l) => (
          <li key={l.category} className={styles.budgetLine}>
            <div className={styles.budgetRow}>
              <span className={styles.budgetName}>
                {CATEGORY_LABEL[l.category]}
                {l.locked && <span className="badge tone-neutral"><Icon name="lock" />Fixed</span>}
              </span>
              <span className="num"><strong>{formatINR(l.amount)}</strong> <span className="muted">{l.percent}%</span></span>
            </div>
            <div className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, l.percent)}%` }} /></div>
            <details className={styles.why}>
              <summary>Why this amount</summary>
              <ul>{l.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </details>
            {editing === l.category ? (
              <form className={`row ${styles.editRow}`} onSubmit={(e) => { e.preventDefault(); save(l.category); }}>
                <label htmlFor={`${uid}-${l.category}`} className="sr-only">New amount for {CATEGORY_LABEL[l.category]}</label>
                <input id={`${uid}-${l.category}`} className="input" style={{ maxWidth: 220 }} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${uid}-err` : undefined} autoFocus />
                <button className="btn btn-primary" type="submit">Save</button>
                <button className="btn btn-quiet" type="button" onClick={() => { setEditing(null); setError(""); }}>Cancel</button>
                {error && <span id={`${uid}-err`} className="error"><Icon name="stop" />{error}</span>}
              </form>
            ) : (
              <div className="row no-print">
                <button type="button" className="btn btn-quiet" onClick={() => { setEditing(l.category); setValue(String(l.amount)); setError(""); }}>
                  Edit<span className="sr-only"> {CATEGORY_LABEL[l.category]}</span>
                </button>
                {l.locked && (
                  <button type="button" className="btn btn-quiet" onClick={() => unlock(l.category)}>
                    <Icon name="unlock" />Let it rebalance<span className="sr-only"> {CATEGORY_LABEL[l.category]}</span>
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const PHASES: Phase[] = ["foundation", "bookings", "details", "final-week", "day-of"];

export function TimelinePanel({ plan, saved }: PanelProps) {
  return (
    <div className={styles.panelGrid}>
      <section className="card stack" aria-labelledby="tl-h">
        <h2 id="tl-h" className={styles.h}>Timeline</h2>
        {plan.tasks.some((t) => t.compressed) && (
          <p className="hint">Tasks marked &ldquo;Pulled forward&rdquo; would normally happen earlier; there is less time than ideal, so start with them.</p>
        )}
        {PHASES.map((phase) => {
          const tasks = plan.tasks.filter((t) => t.phase === phase);
          if (!tasks.length) return null;
          return (
            <div key={phase} className="stack" style={{ gap: "var(--space-2)" }}>
              <h3 className={styles.phase}>{PHASE_LABEL[phase]}</h3>
              <ul className={styles.list}>
                {tasks.map((t) => <TaskCheck key={t.id} saved={saved} today={plan.today} {...t} />)}
              </ul>
            </div>
          );
        })}
      </section>
      <section className="card stack" aria-labelledby="rs-h">
        <h2 id="rs-h" className={styles.h}>On the day</h2>
        <ol className={styles.runSheet}>
          {plan.runSheet.map((s) => (
            <li key={s.time + s.title}>
              <span className="num"><strong>{s.time}</strong></span>
              <span><strong>{s.title}</strong><br /><span className="muted">{s.detail}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function VendorsPanel({ plan, saved }: PanelProps) {
  return (
    <section className="card stack" aria-labelledby="v-h">
      <div className="card-title">
        <h2 id="v-h" className={styles.h}>Vendor checklist</h2>
        <span className="muted">{plan.vendors.filter((v) => saved.booked[v.id]).length} of {plan.vendors.length} booked</span>
      </div>
      <ul className={styles.list}>
        {plan.vendors.map((v) => {
          const booked = Boolean(saved.booked[v.id]);
          const late = !booked && v.bookBy < plan.today;
          return (
            <li key={v.id} className={styles.vendor}>
              <div className={`row spread ${styles.vendorHead}`}>
                <label className={styles.check}>
                  <input type="checkbox" checked={booked} onChange={(e) => toggle(saved, "booked", v.id, e.target.checked)} />
                  <strong className={booked ? styles.doneText : undefined}>{v.name}</strong>
                </label>
                <span className="hint num">
                  {booked ? <span className="badge tone-success"><Icon name="check" />Booked</span> : <>Book by {formatDate(v.bookBy)}</>}
                  {late && <span className="badge tone-critical"><Icon name="stop" />Late</span>}
                </span>
              </div>
              <p className="muted">{v.why}</p>
              <details className={styles.why}>
                <summary>Questions to ask ({v.questions.length})</summary>
                <ul>{v.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function IdeasPanel({ plan, saved }: PanelProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [category, setCategory] = useState<IdeaCategory | "">("");
  const [source, setSource] = useState<string>("");
  const uid = useId();

  async function load() {
    setStatus("loading");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: saved.input, ...(category ? { category } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const ideas = data.ideas as Idea[];
      updatePlan(saved.id, (p) => ({ ...p, ideas: [...ideas, ...p.ideas.filter((o) => !ideas.some((n) => n.title === o.title))].slice(0, 30) }));
      setSource(data.source === "ai" ? "Personalised by Gemini for this event." : "AI is unavailable, so these are curated ideas for this kind of event.");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="card stack" aria-labelledby="i-h" aria-busy={status === "loading"}>
      <div className="card-title">
        <h2 id="i-h" className={styles.h}>Ideas for {plan.input.title}</h2>
      </div>
      <div className={`row no-print ${styles.ideaControls}`}>
        <div className="field">
          <label htmlFor={`${uid}-cat`}>Focus</label>
          <select id={`${uid}-cat`} className="input" value={category} onChange={(e) => setCategory(e.target.value as IdeaCategory | "")}>
            <option value="">All kinds</option>
            {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("-", " ")}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={load} disabled={status === "loading"}>
          {status === "loading" ? "Thinking of ideas..." : saved.ideas.length ? "More ideas" : "Get ideas"}
        </button>
      </div>
      <p role="status" className="hint">{status === "error" ? "" : source}</p>
      {status === "error" && (
        <p className="error" role="alert"><Icon name="stop" />Could not get ideas right now. Check your connection and try again.</p>
      )}
      {saved.ideas.length === 0 && status !== "loading" ? (
        <p className="muted">No ideas yet. They use your style, guests, budget and preferences.</p>
      ) : (
        <ul className={styles.ideas}>
          {saved.ideas.map((i) => (
            <li key={i.title} className={styles.idea}>
              <div className="row spread">
                <strong>{i.title}</strong>
                <span className="badge tone-neutral">{i.cost} cost</span>
              </div>
              <p className="muted">{i.description}</p>
              <span className="hint">{i.category.replace("-", " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

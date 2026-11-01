import Link from "next/link";
import { Toran } from "@/components/hero/Toran";
import { Icon } from "@/components/Icon";
import { SeverityBadge } from "@/components/SeverityBadge";
import { todayIn } from "@/lib/engine/dates";
import { formatINR } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import { CATEGORY_LABEL, formatDate } from "@/lib/labels";
import { sampleWedding } from "@/lib/sample";
import styles from "./home.module.css";

const STEPS = [
  {
    title: "Tell us about the event",
    body: "Occasion, date, city, guests, budget and what matters most. About two minutes.",
  },
  {
    title: "Get a plan that adds up",
    body: "A budget split to the rupee, a dated timeline, the vendors you need and what to ask them.",
  },
  {
    title: "Adjust it in plain words",
    body: 'Say "cut the budget by 15%" or "make it eco-friendly". The assistant proposes changes and you approve them.',
  },
];

const FEATURES = [
  {
    title: "Guest list and replies",
    body: "Paste names, track who is coming and what they eat, and set the headcount from real replies.",
  },
  {
    title: "Money paid and owed",
    body: "Log advances and dues against each budget line and see what is left before you commit more.",
  },
  {
    title: "WhatsApp invites",
    body: "An invitation in English or Hindi, written from your plan, ready to edit and send.",
  },
  {
    title: "A link for the family",
    body: "Share a read-only copy of the plan. It travels inside the link, never through our server.",
  },
];

// No single budget line is much over 40% of the total, so the preview bars are
// stretched 2.5x to use the card's width; they are relative, not to scale.
const BAR_SCALE = 2.5;

export default function Home() {
  const plan = buildPlan(sampleWedding(todayIn()), todayIn());
  const top = plan.budget.lines.slice(0, 4);
  const flag = plan.insights[0];

  return (
    <>
      {/* The scene draws a carved doorway around [data-door]; the text sits in its opening. */}
      <section className={styles.band} data-dusk-hero aria-labelledby="hero-title">
        <Toran />
        <div className={styles.door} data-door>
          <h1 id="hero-title" className={styles.title}>
            Plan the whole celebration in one evening
          </h1>
          <p className={styles.lede}>
            Budget, timeline, vendors and guests for weddings, birthdays and community events, worked out from your
            numbers
          </p>
          <div className={styles.ctas}>
            <Link href="/plan/new" className={`btn ${styles.primary}`}>
              Start a plan <Icon name="arrowRight" />
            </Link>
            <Link href="/plan/new?sample=wedding" className={`btn ${styles.secondary}`}>
              Try a sample wedding
            </Link>
          </div>
        </div>
      </section>

      <div className="container">
        <section className={styles.preview} aria-labelledby="sample-title">
          <div className={styles.previewHead}>
            <div className={styles.previewName}>
              <p className={styles.previewMeta}>
                Sample plan, {plan.input.city}, {formatDate(plan.input.date)}
              </p>
              <h2 id="sample-title">{plan.input.title}</h2>
            </div>
            <p className={styles.count}>
              <span className="num">{plan.daysToGo}</span>
              <span className={styles.countWords}>days to go</span>
            </p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Budget</dt>
              <dd className="num">{formatINR(plan.budget.total)}</dd>
            </div>
            <div>
              <dt>Per guest</dt>
              <dd className="num">{formatINR(plan.budget.perGuest)}</dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd className="num">{plan.input.guests}</dd>
            </div>
            <div>
              <dt>Tasks</dt>
              <dd className="num">{plan.tasks.length}</dd>
            </div>
          </dl>
          <div className={styles.previewBody}>
            <dl className={styles.lines} aria-label="Largest budget lines">
              {top.map((l) => (
                <div key={l.category} className={styles.line}>
                  <dt>{CATEGORY_LABEL[l.category]}</dt>
                  <dd className="num">{formatINR(l.amount)}</dd>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, l.percent * BAR_SCALE)}%` }} />
                  </div>
                </div>
              ))}
            </dl>
            <div className={styles.next}>
              {flag && (
                <p className={styles.flag}>
                  <SeverityBadge severity={flag.severity} /> {flag.title}
                </p>
              )}
              <p>
                <span className="muted">Next task</span>
                <br />
                {plan.tasks[0]?.title}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className={styles.split}>
          <div className={styles.splitHead}>
            <h2 id="how">How it works</h2>
            <p className="muted">
              The numbers come from transparent rules you can read, with a reason beside every line. Gemini adds
              personal ideas and understands your requests, and nothing it suggests changes your plan until you approve
              it. Free, with no sign-up.
            </p>
          </div>
          <ol className={styles.rows}>
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="after" className={styles.split}>
          <div className={styles.splitHead}>
            <h2 id="after">After the plan, the running of it</h2>
          </div>
          <dl className={styles.rows}>
            {FEATURES.map((f) => (
              <div key={f.title}>
                <dt>{f.title}</dt>
                <dd className="muted">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

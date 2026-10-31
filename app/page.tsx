import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SeverityBadge } from "@/components/SeverityBadge";
import { todayIn } from "@/lib/engine/dates";
import { formatINR } from "@/lib/engine/money";
import { buildPlan } from "@/lib/engine/plan";
import { CATEGORY_LABEL, formatDate } from "@/lib/labels";
import { sampleWedding } from "@/lib/sample";
import styles from "./home.module.css";

const STEPS = [
  { title: "Tell us about the event", body: "Occasion, date, city, guests, budget and what matters most. About two minutes." },
  { title: "Get a plan that adds up", body: "A budget split to the rupee, a dated timeline, the vendors you need and what to ask them." },
  { title: "Adjust it in plain words", body: 'Say "cut the budget by 15%" or "make it eco-friendly". The assistant proposes changes and you approve them.' },
];

export default function Home() {
  const plan = buildPlan(sampleWedding(todayIn()), todayIn());
  const top = plan.budget.lines.slice(0, 4);
  const flag = plan.insights[0];

  return (
    <div className="container">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.copy}>
          <h1 id="hero-title" className={styles.title}>
            Plan the whole celebration in one evening
          </h1>
          <p className={styles.lede}>
            Weddings, birthdays and community events. Tell Jashn the occasion, guests and budget, and get a budget that adds up,
            a dated timeline, a vendor checklist and ideas made for your family.
          </p>
          <div className="row">
            <Link href="/plan/new" className="btn btn-primary">
              Start a plan <Icon name="arrowRight" />
            </Link>
            <Link href="/plan/new?sample=wedding" className="btn btn-secondary">
              Try a sample wedding
            </Link>
          </div>
          <p className="hint">Free, no sign-up. Plans stay in your browser.</p>
        </div>

        <figure className={`card ${styles.preview}`} aria-label="Sample plan preview">
          <figcaption className={styles.previewHead}>
            <span className="hint">Sample plan</span>
            <strong>{plan.input.title}</strong>
            <span className="muted">
              {plan.input.guests} guests, {plan.input.city}, {formatDate(plan.input.date)}
            </span>
          </figcaption>
          <dl className={styles.lines}>
            {top.map((l) => (
              <div key={l.category} className={styles.line}>
                <dt>{CATEGORY_LABEL[l.category]}</dt>
                <dd className="num">{formatINR(l.amount)}</dd>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, l.percent * 2.5)}%` }} />
                </div>
              </div>
            ))}
          </dl>
          {flag && (
            <p className={styles.flag}>
              <SeverityBadge severity={flag.severity} /> {flag.title}
            </p>
          )}
          <p className="hint">Next: {plan.tasks[0]?.title}</p>
        </figure>
      </section>

      <section aria-labelledby="how" className={styles.how}>
        <h2 id="how">How it works</h2>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className={styles.stepNum} aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.trust}>
          The numbers come from transparent rules you can read, with a reason beside every line. Gemini adds personal ideas and
          understands your requests, and nothing it suggests changes your plan until you approve it.
        </p>
      </section>
    </div>
  );
}

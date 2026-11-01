import { formatINR } from "@/lib/engine/money";
import styles from "./dashboard.module.css";

const R = 52;
const C = 2 * Math.PI * R;

interface SpendRingProps {
  total: number;
  paid: number;
  due: number;
}

/**
 * Paid and promised money against the budget, as one ring. The legend beside it
 * carries every number in words, so the ring is never the only way to read it.
 */
export function SpendRing({ total, paid, due }: SpendRingProps) {
  const share = (n: number) => (total > 0 ? Math.min(1, n / total) : 0);
  const paidLen = share(paid) * C;
  const dueLen = Math.min(C - paidLen, share(due) * C);
  const left = total - paid - due;
  const pct = Math.round(share(paid) * 100);

  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 128 128" role="img" aria-label={`${pct}% of the budget paid`}>
        <circle className={styles.ringTrack} cx="64" cy="64" r={R} />
        {dueLen > 0 && (
          <circle
            className={styles.ringDue}
            cx="64"
            cy="64"
            r={R}
            strokeDasharray={`${dueLen} ${C}`}
            strokeDashoffset={-paidLen}
          />
        )}
        {paidLen > 0 && (
          <circle className={styles.ringPaid} cx="64" cy="64" r={R} strokeDasharray={`${paidLen} ${C}`} />
        )}
        <text x="64" y="62" textAnchor="middle" className={styles.ringFigure}>
          {pct}%
        </text>
        <text x="64" y="80" textAnchor="middle" className={styles.ringLabel}>
          paid
        </text>
      </svg>
      <dl className={styles.ringLegend}>
        <div>
          <dt>
            <span className={`${styles.key} ${styles.keyPaid}`} aria-hidden="true" />
            Paid
          </dt>
          <dd className="num">{formatINR(paid)}</dd>
        </div>
        <div>
          <dt>
            <span className={`${styles.key} ${styles.keyDue}`} aria-hidden="true" />
            Due
          </dt>
          <dd className="num">{formatINR(due)}</dd>
        </div>
        <div>
          <dt>{left >= 0 ? "Not yet committed" : "Over the budget by"}</dt>
          <dd className="num">{formatINR(Math.abs(left))}</dd>
        </div>
      </dl>
    </div>
  );
}

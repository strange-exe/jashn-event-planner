import Link from "next/link";
import styles from "./dashboard.module.css";

/** Shown when a plan id is not in this browser's storage (deleted, or made on another device). */
export function PlanMissing() {
  return (
    <div className={`card stack ${styles.missing}`}>
      <h1>Plan not found</h1>
      <p className="muted">
        Plans are saved in the browser where they were made. It may have been deleted, or made on another device.
      </p>
      <div className="row">
        <Link className="btn btn-primary" href="/plan/new">
          Start a new plan
        </Link>
        <Link className="btn btn-secondary" href="/plans">
          My plans
        </Link>
      </div>
    </div>
  );
}

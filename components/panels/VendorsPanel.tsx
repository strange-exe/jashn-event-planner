"use client";

import type { Vendor } from "@/lib/engine/types";
import { formatDate } from "@/lib/labels";
import type { SavedPlan } from "@/lib/store";
import styles from "../dashboard.module.css";
import { StatusBadge } from "../feedback";
import { Card, toggle, type PanelProps } from "./shared";

export function VendorsPanel({ plan, saved }: PanelProps) {
  const bookedCount = plan.vendors.filter((v) => saved.booked[v.id]).length;
  return (
    <Card
      title="Vendor checklist"
      aside={
        <span className="muted">
          {bookedCount} of {plan.vendors.length} booked
        </span>
      }
    >
      <ul className={styles.list}>
        {plan.vendors.map((v) => (
          <VendorItem key={v.id} vendor={v} saved={saved} today={plan.today} />
        ))}
      </ul>
    </Card>
  );
}

function VendorItem({ vendor, saved, today }: { vendor: Vendor; saved: SavedPlan; today: string }) {
  const booked = Boolean(saved.booked[vendor.id]);
  const late = !booked && vendor.bookBy < today;
  return (
    <li className={styles.vendor}>
      <div className={`row spread ${styles.vendorHead}`}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={booked}
            onChange={(e) => toggle(saved, "booked", vendor.id, e.target.checked)}
          />
          <strong className={booked ? styles.doneText : undefined}>{vendor.name}</strong>
        </label>
        <span className="hint num">
          {booked ? (
            <StatusBadge tone="success" icon="check">
              Booked
            </StatusBadge>
          ) : (
            <>Book by {formatDate(vendor.bookBy)}</>
          )}
          {late && (
            <StatusBadge tone="critical" icon="stop">
              Late
            </StatusBadge>
          )}
        </span>
      </div>
      <p className="muted">{vendor.why}</p>
      <details className={styles.why}>
        <summary>Questions to ask ({vendor.questions.length})</summary>
        <ul>
          {vendor.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </details>
    </li>
  );
}

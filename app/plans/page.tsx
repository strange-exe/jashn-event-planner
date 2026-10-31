import type { Metadata } from "next";
import Link from "next/link";
import { PlanList } from "@/components/PlanList";

export const metadata: Metadata = { title: "My plans" };

export default function PlansPage() {
  return (
    <div className="container stack" style={{ paddingTop: "var(--space-6)", gap: "var(--space-5)" }}>
      <div className="row spread">
        <h1>My plans</h1>
        <Link className="btn btn-primary" href="/plan/new">
          New plan
        </Link>
      </div>
      <PlanList />
    </div>
  );
}

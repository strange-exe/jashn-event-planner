import type { Metadata } from "next";
import Link from "next/link";
import { PlanList } from "@/components/PlanList";

export const metadata: Metadata = { title: "My plans" };

export default function PlansPage() {
  return (
    <div className="container stack page-list">
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

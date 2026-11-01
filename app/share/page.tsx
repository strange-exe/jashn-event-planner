import type { Metadata } from "next";
import { SharedPlanView } from "@/components/SharedPlanView";

export const metadata: Metadata = {
  title: "Shared plan",
  // Each link holds someone's plan; none of them belongs in a search index.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharePage() {
  return (
    <div className="container">
      <SharedPlanView />
    </div>
  );
}

import type { Metadata } from "next";
import { Wizard } from "@/components/Wizard";

export const metadata: Metadata = { title: "New plan" };

export default async function NewPlanPage({ searchParams }: PageProps<"/plan/new">) {
  const params = await searchParams;
  const edit = typeof params.edit === "string" ? params.edit : undefined;
  return (
    <div className="container">
      <Wizard sample={params.sample === "wedding"} editId={edit} />
    </div>
  );
}

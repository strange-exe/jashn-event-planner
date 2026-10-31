import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/engine/plan";
import { planToIcs } from "@/lib/ics";
import { makeInput, TODAY } from "./fixtures";

describe("planToIcs", () => {
  const plan = buildPlan(makeInput({ title: "Riya, Arjun; and family" }), TODAY);
  const ics = planToIcs(plan, "abc", new Date("2026-11-01T10:00:00Z"));
  const lines = ics.split("\r\n");

  it("is a CRLF calendar with one event per task plus the day itself", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const events = lines.filter((l) => l === "BEGIN:VEVENT").length;
    expect(events).toBe(plan.tasks.filter((t) => t.phase !== "day-of").length + 1);
  });

  it("escapes commas and semicolons in text", () => {
    expect(ics).toContain("SUMMARY:Riya\\, Arjun\\; and family");
  });

  it("uses all-day dates ending the next day", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20270410");
    expect(ics).toContain("DTEND;VALUE=DATE:20270411");
  });

  it("folds long lines to 75 octets", () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

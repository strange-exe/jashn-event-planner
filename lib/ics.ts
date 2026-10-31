import type { Plan } from "./engine/types";

// Builds an iCalendar file (RFC 5545) with the event and every task as an
// all-day reminder, so the timeline can go into Google, Apple or Outlook calendars.

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets, as the spec requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compact = (iso: string) => iso.replace(/-/g, "");

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function planToIcs(plan: Plan, uid: string, stamp = new Date()): string {
  const dtstamp = stamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const event = (id: string, date: string, summary: string, description: string) => [
    "BEGIN:VEVENT",
    `UID:${id}-${uid}@jashn`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(date))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT",
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jashn//Event planner//EN",
    "CALSCALE:GREGORIAN",
    ...event("event", plan.input.date, plan.input.title, `${plan.input.city}, starts ${plan.input.startTime}`),
    ...plan.tasks
      .filter((t) => t.phase !== "day-of")
      .flatMap((t) => event(t.id, t.due, `${plan.input.title}: ${t.title}`, t.why)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

import { addDays } from "./engine/dates";
import type { Plan } from "./engine/types";

// Builds an iCalendar file (RFC 5545) with the event and every task as an
// all-day reminder, so the timeline can go into Google, Apple or Outlook calendars.

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();
const octets = (s: string) => encoder.encode(s).length;

// RFC 5545 limits a line to 75 octets; continuation lines start with a space, leaving 74.
const MAX_LINE_OCTETS = 75;

/** Folds long lines without splitting a multi-byte character. */
function fold(line: string): string {
  if (octets(line) <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const width = octets(ch);
    const limit = parts.length ? MAX_LINE_OCTETS - 1 : MAX_LINE_OCTETS;
    if (size + width > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compact = (iso: string) => iso.replace(/-/g, "");

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
    // All-day events end on the next day (DTEND is exclusive).
    `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
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

import { z } from "zod";
import { cleanText, LIMITS } from "./schema";

// The guest list is kept per plan in this browser. It is never sent to the model or
// put in a share link: names of family and friends stay on the device.

export const RSVPS = ["pending", "yes", "maybe", "no"] as const;
export type Rsvp = (typeof RSVPS)[number];

export const FOODS = ["any", "veg", "jain", "vegan", "nonveg"] as const;
export type Food = (typeof FOODS)[number];

const name = (max: number) => z.string().transform(cleanText).pipe(z.string().max(max));

export const GuestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{8,40}$/),
  name: name(LIMITS.guestName).pipe(z.string().min(1, "Enter a name.")),
  group: name(LIMITS.guestGroup),
  /** People in this invitation, the guest included. */
  party: z.number().int().min(1).max(LIMITS.partySize),
  rsvp: z.enum(RSVPS),
  food: z.enum(FOODS),
});
export type Guest = z.infer<typeof GuestSchema>;

export interface GuestSummary {
  /** Invitations sent, one per row. */
  invitations: number;
  /** People invited, counting each party. */
  invited: number;
  people: Record<Rsvp, number>;
  /** Food choices of the people who said yes. */
  food: Record<Food, number>;
}

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function summarizeGuests(guests: readonly Guest[]): GuestSummary {
  const people = zeroes(RSVPS);
  const food = zeroes(FOODS);
  for (const g of guests) {
    people[g.rsvp] += g.party;
    if (g.rsvp === "yes") food[g.food] += g.party;
  }
  return { invitations: guests.length, invited: guests.reduce((n, g) => n + g.party, 0), people, food };
}

/**
 * Headcount to plan food and seats for: everyone who said yes, plus half of the maybes.
 * Null until someone has replied yes, because an empty list says nothing about the event.
 */
export function plannedHeadcount(s: GuestSummary): number | null {
  if (s.people.yes === 0) return null;
  return s.people.yes + Math.ceil(s.people.maybe / 2);
}

/** Names pasted one per line (or comma separated), cleaned, de-duplicated and capped. */
export function parseNames(text: string, max: number): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const n = cleanText(part).slice(0, LIMITS.guestName);
    const key = n.toLowerCase();
    if (!n || seen.has(key)) continue;
    seen.add(key);
    names.push(n);
    if (names.length === max) break;
  }
  return names;
}

/** Groups already used in the list, for the "group" suggestions. */
export function groupsOf(guests: readonly Guest[]): string[] {
  return [...new Set(guests.map((g) => g.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

import type { EventInput } from "@/lib/engine/types";

export const TODAY = "2026-11-01";

export function makeInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    type: "wedding",
    title: "Riya and Arjun's wedding",
    date: "2027-04-10",
    days: 1,
    functions: [],
    startTime: "18:00",
    city: "Dehradun",
    cityTier: "large",
    guests: 200,
    budget: 2_000_000,
    setting: "indoor",
    venueBooked: false,
    priorities: [],
    preferences: [],
    style: "",
    notes: "",
    ...overrides,
  };
}

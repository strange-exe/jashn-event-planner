import { addDays } from "./engine/dates";
import type { EventInput } from "./engine/types";

/** A realistic sample used on the home page and by "Try a sample wedding". */
export function sampleWedding(today: string): EventInput {
  return {
    type: "wedding",
    title: "Riya and Arjun's wedding",
    date: addDays(today, 240),
    startTime: "18:30",
    city: "Dehradun",
    cityTier: "large",
    guests: 220,
    budget: 1_800_000,
    setting: "outdoor",
    venueBooked: false,
    priorities: ["food", "photography"],
    preferences: ["vegetarianOnly", "stepFreeAccess"],
    style: "Marigold and ivory, garden lights",
    notes: "Grandparents travelling from Lucknow.",
  };
}

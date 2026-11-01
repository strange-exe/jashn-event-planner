import type { CityTier, EventType } from "./types";

// Rough catering cost per guest in rupees (2026), by event type and city size.
// These are planning heuristics, not quotes; the UI asks users to check locally.
export const PLATE_COST: Record<EventType, Record<CityTier, number>> = {
  wedding: { metro: 1200, large: 850, town: 600 },
  engagement: { metro: 1000, large: 750, town: 500 },
  birthday: { metro: 600, large: 450, town: 300 },
  anniversary: { metro: 900, large: 650, town: 450 },
  community: { metro: 300, large: 220, town: 150 },
  festival: { metro: 400, large: 300, town: 200 },
};

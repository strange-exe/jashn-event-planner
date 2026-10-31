import type { BudgetCategory, CityTier, EventType, Phase, Preference, Priority, Setting, Severity } from "./engine/types";

export const EVENT_LABEL: Record<EventType, { name: string; hint: string }> = {
  wedding: { name: "Wedding", hint: "Ceremony, reception and family functions" },
  engagement: { name: "Engagement", hint: "Ring ceremony or roka" },
  birthday: { name: "Birthday", hint: "Kids, milestones or a surprise" },
  anniversary: { name: "Anniversary", hint: "Dinner, party or vow renewal" },
  community: { name: "Community event", hint: "Society, school, club or charity" },
  festival: { name: "Festival gathering", hint: "Diwali, Holi, Eid, Christmas and more" },
};

export const TIER_LABEL: Record<CityTier, { name: string; hint: string }> = {
  metro: { name: "Metro", hint: "Delhi, Mumbai, Bengaluru and similar" },
  large: { name: "Large city", hint: "Dehradun, Jaipur, Lucknow and similar" },
  town: { name: "Town", hint: "Smaller towns and villages" },
};

export const SETTING_LABEL: Record<Setting, string> = { indoor: "Indoor", outdoor: "Outdoor", either: "Not sure yet" };

export const PRIORITY_LABEL: Record<Priority, string> = {
  food: "Food",
  decor: "Decor",
  photography: "Photos",
  entertainment: "Music and fun",
  venue: "Venue",
  attire: "Outfits",
};

export const PREFERENCE_LABEL: Record<Preference, string> = {
  vegetarianOnly: "Vegetarian only",
  alcoholFree: "No alcohol",
  ecoFriendly: "Eco-friendly",
  stepFreeAccess: "Step-free access",
  kidsFriendly: "Kids attending",
};

export const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  venue: "Venue",
  catering: "Food and drinks",
  decor: "Decor and flowers",
  photography: "Photos and video",
  entertainment: "Music and entertainment",
  attire: "Outfits and make-up",
  invitations: "Invitations",
  favours: "Return gifts",
  logistics: "Transport, power and logistics",
  permits: "Permits and safety",
  contingency: "Contingency",
};

export const PHASE_LABEL: Record<Phase, string> = {
  foundation: "Foundation",
  bookings: "Bookings",
  details: "Details",
  "final-week": "Final stretch",
  "day-of": "The day",
};

export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Note" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

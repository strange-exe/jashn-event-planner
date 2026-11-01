import type {
  BudgetCategory,
  CityTier,
  EventInput,
  EventType,
  FunctionKind,
  Phase,
  Preference,
  Priority,
  Setting,
  Severity,
} from "./engine/types";
import type { Food, Rsvp } from "./guests";
import type { IdeaCategory } from "./ideas";
import type { InviteLanguage, InviteTone } from "./invite";

export const RSVP_LABEL: Record<Rsvp, string> = {
  pending: "Awaiting reply",
  yes: "Coming",
  maybe: "Maybe",
  no: "Not coming",
};

export const FOOD_LABEL: Record<Food, string> = {
  any: "No preference",
  veg: "Vegetarian",
  jain: "Jain",
  vegan: "Vegan",
  nonveg: "Non-vegetarian",
};

export const LANGUAGE_LABEL: Record<InviteLanguage, string> = { en: "English", hi: "Hindi" };
export const TONE_LABEL: Record<InviteTone, string> = { warm: "Warm", formal: "Formal", fun: "Playful" };

export const EVENT_LABEL: Record<EventType, { name: string; hint: string }> = {
  wedding: { name: "Wedding", hint: "Ceremony, reception and family functions" },
  engagement: { name: "Engagement", hint: "Ring ceremony or roka" },
  birthday: { name: "Birthday", hint: "Kids, milestones or a surprise" },
  anniversary: { name: "Anniversary", hint: "Dinner, party or vow renewal" },
  community: { name: "Community event", hint: "Society, school, club or charity" },
  festival: { name: "Festival gathering", hint: "Diwali, Holi, Eid, Christmas and more" },
};

export const FUNCTION_LABEL: Record<FunctionKind, { name: string; hint: string }> = {
  haldi: { name: "Haldi", hint: "Turmeric ceremony, usually a morning" },
  mehendi: { name: "Mehendi", hint: "Henna for the bride and guests" },
  sangeet: { name: "Sangeet", hint: "Music, dance and performances" },
  cocktail: { name: "Cocktail party", hint: "An evening party before the wedding" },
  wedding: { name: "Wedding ceremony", hint: "Pheras, nikah or the main ritual" },
  reception: { name: "Reception", hint: "Dinner to meet the couple" },
};

/** Lower-case event name for use inside a sentence, e.g. "community event". */
export const eventNoun = (type: EventType) => EVENT_LABEL[type].name.toLowerCase();

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

export const IDEA_CATEGORY_LABEL: Record<IdeaCategory, string> = {
  decor: "Decor",
  food: "Food",
  entertainment: "Entertainment",
  "guest-experience": "Guest experience",
  keepsakes: "Keepsakes",
  tradition: "Tradition",
};

export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Note" };

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

/** One line under a plan's title: the kind of event, when and where. */
export function eventSummary(input: EventInput): string {
  const kind = EVENT_LABEL[input.type].name;
  if (input.functions.length === 0) {
    return `${kind} on ${formatDate(input.date)} at ${input.startTime}, ${input.city}.`;
  }
  const span =
    input.days === 1 ? `on ${formatDate(input.date)}` : `over ${input.days} days from ${formatDate(input.date)}`;
  const n = input.functions.length;
  return `${kind} ${span}, ${input.city}. ${n} ${n === 1 ? "function" : "functions"}.`;
}

import { hasPreference as has, isPublicEvent, needsAttire } from "./rules";
import type { TaskId } from "./timeline";
import type { BudgetCategory, EventInput, LogisticsItem, Task, Vendor } from "./types";

interface VendorTemplate {
  id: string;
  name: string;
  category: BudgetCategory;
  /** Tasks whose due date is the booking deadline, in order of preference (the first one in the plan wins). */
  bookBy: TaskId[];
  when?: (i: EventInput) => boolean;
  questions: (i: EventInput) => string[];
  why: string;
}

// Above this headcount, or for any public event, crowd safety and sanitation need a vendor.
const LARGE_EVENT_GUESTS = 300;

const isOneOf = (i: EventInput, ...types: EventInput["type"][]) => types.includes(i.type);
const isLarge = (i: EventInput) => i.guests > LARGE_EVENT_GUESTS || isPublicEvent(i);

const TEMPLATES: VendorTemplate[] = [
  {
    id: "venue",
    name: "Venue",
    category: "venue",
    bookBy: ["venue"],
    when: (i) => !i.venueBooked,
    questions: (i) => [
      `Does it seat ${i.guests} guests comfortably, and what is the standing capacity?`,
      "What is included: chairs, tables, power backup, air conditioning, parking?",
      "Can we bring our own caterer and decorator?",
      "What time must music stop, and is there an overtime charge?",
      "What is the cancellation and refund policy?",
      ...(has(i, "stepFreeAccess") ? ["Is there step-free entry and an accessible restroom?"] : []),
    ],
    why: "You have not booked a venue yet.",
  },
  {
    id: "caterer",
    name: "Caterer",
    category: "catering",
    bookBy: ["caterer"],
    questions: (i) => [
      "What is the per-plate price, and what is the minimum guaranteed count?",
      "Can we do a tasting before confirming the menu?",
      "Do you hold an FSSAI licence or registration?",
      "How many serving staff come, and is service buffet or plated?",
      ...(has(i, "vegetarianOnly") ? ["Can the whole kitchen be vegetarian, with separate utensils?"] : []),
      ...(has(i, "ecoFriendly") ? ["Can leftover food be donated through a food bank or NGO?"] : []),
    ],
    why: "Food is usually the largest line in the budget.",
  },
  {
    id: "decorator",
    name: "Decorator",
    category: "decor",
    bookBy: ["decor"],
    questions: (i) => [
      `Can you share a mock-up for the theme "${i.style || "to be decided"}"?`,
      "How long do setup and teardown take?",
      "Are the lights and wiring safety-checked?",
      ...(has(i, "ecoFriendly") ? ["Can you use fresh or reusable decor instead of plastic and thermocol?"] : []),
    ],
    why: "Decor sets the look of the event and needs lead time.",
  },
  {
    id: "photographer",
    name: "Photographer",
    category: "photography",
    bookBy: ["photo"],
    questions: () => [
      "What do we receive, and how soon after the event?",
      "How many photographers or videographers will come?",
      "Are travel and overtime charged separately?",
    ],
    why: "Photos are what you keep after the day.",
  },
  {
    id: "entertainment",
    name: "Music and entertainment",
    category: "entertainment",
    bookBy: ["entertainment"],
    questions: (i) => [
      isOneOf(i, "birthday") && has(i, "kidsFriendly")
        ? "Do you have a children's entertainer (magician, games host) for the age group?"
        : "Can you share a sample playlist or performance video?",
      "Do you bring your own sound system and backup?",
      "Will you follow the local sound limits and stop time?",
    ],
    why: "Music and activities set the energy of the event.",
  },
  {
    id: "attire",
    name: "Designer or tailor",
    category: "attire",
    bookBy: ["attire"],
    when: needsAttire,
    questions: () => ["How many fittings are included?", "What is the delivery date, with a buffer for alterations?"],
    why: "Outfits need fittings and alterations.",
  },
  {
    id: "makeup",
    name: "Make-up artist",
    category: "attire",
    bookBy: ["attire"],
    when: (i) => isOneOf(i, "wedding", "engagement"),
    questions: () => [
      "Can we book a trial session?",
      "How many people can you get ready, and how long does each take?",
    ],
    why: "Weddings and engagements usually have a make-up artist.",
  },
  {
    id: "officiant",
    name: "Priest or officiant (if your traditions need one)",
    category: "entertainment",
    bookBy: ["venue", "venue-confirm", "caterer"],
    when: (i) => isOneOf(i, "wedding", "engagement", "festival"),
    questions: () => ["Which items should we arrange for the ritual?", "How long does the ceremony take?"],
    why: "Many ceremonies need someone to lead the rituals; skip it if yours does not.",
  },
  {
    id: "cake",
    name: "Baker",
    category: "catering",
    bookBy: ["menu"],
    when: (i) => isOneOf(i, "birthday", "anniversary"),
    questions: (i) => [
      `Can you make a cake that serves ${i.guests} guests?`,
      "Is there an eggless option, and what are the ingredients for allergies?",
    ],
    why: "Birthdays and anniversaries usually have a cake.",
  },
  {
    id: "invitations",
    name: "Invitation printer or designer",
    category: "invitations",
    bookBy: ["invites"],
    questions: (i) => [
      "Can we get a digital version for WhatsApp as well as print?",
      ...(has(i, "ecoFriendly") ? ["Do you offer seed paper or digital-only invitations?"] : []),
    ],
    why: "Guests need the date, time and place in one clear message.",
  },
  {
    id: "tent",
    name: "Tent, power and generator",
    category: "logistics",
    bookBy: ["tent"],
    when: (i) => i.setting === "outdoor",
    questions: () => [
      "Is the tent rated for rain and wind?",
      "What generator capacity (kVA) do the lights, sound and kitchen need?",
      "Who refuels and runs the generator during the event?",
    ],
    why: "You chose an outdoor setting.",
  },
  {
    id: "safety",
    name: "Security and first aid",
    category: "permits",
    bookBy: ["permits", "caterer"],
    when: isLarge,
    questions: (i) => [
      `How many guards do you recommend for ${i.guests} guests?`,
      "Can a first-aid desk and an ambulance on call be arranged?",
      "Who manages entry, exits and crowd flow?",
    ],
    why: "Large or public events need crowd management and first aid.",
  },
  {
    id: "sanitation",
    name: "Sanitation and waste management",
    category: "logistics",
    bookBy: ["eco", "caterer"],
    when: (i) => isLarge(i) || has(i, "ecoFriendly"),
    questions: () => [
      "Can you provide separate wet and dry waste bins?",
      "Will you clean up and dispose of waste after the event?",
    ],
    why: "Large events and eco-friendly plans need waste handled properly.",
  },
];

/** Picks the vendors this event needs, each with a booking deadline taken from the timeline. */
export function buildVendors(input: EventInput, tasks: Task[]): Vendor[] {
  const dueOf = (ids: TaskId[]) => {
    for (const id of ids) {
      const task = tasks.find((t) => t.id === id);
      if (task) return task.due;
    }
    // None of the tasks is in the plan (they were already past): book as soon as possible.
    return tasks[0]?.due ?? input.date;
  };
  return TEMPLATES.filter((v) => !v.when || v.when(input)).map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    bookBy: dueOf(v.bookBy),
    questions: v.questions(input),
    why: v.why,
  }));
}

// Rules of thumb behind the quantities. The explanations are built from the same
// numbers, so the text can never disagree with the maths.
const THUMB = {
  spareShare: 0.05,
  publicSeatedShare: 0.6,
  seatsPerTable: 8,
  guestsPerServer: 25,
  waterLitresPerGuest: { indoor: 0.5, outdoor: 0.75 },
  eventHours: 4,
  guestsPerCar: 3,
  guestsPerToilet: 75,
  guestsPerVolunteer: 40,
  servingsPerCakeKg: 10,
  guestsPerBinPair: 50,
  binsFromGuests: 150,
} as const;

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** Quantities derived from the headcount. All are rules of thumb, shown with their reasoning. */
export function buildLogistics(input: EventInput): LogisticsItem[] {
  const g = input.guests;
  const outdoor = input.setting === "outdoor";
  const withSpare = Math.ceil(g * (1 + THUMB.spareShare));
  const seated = isPublicEvent(input) ? Math.ceil(g * THUMB.publicSeatedShare) : withSpare;
  const water = THUMB.waterLitresPerGuest[outdoor ? "outdoor" : "indoor"];

  const items: LogisticsItem[] = [
    {
      id: "plates",
      label: "Plates to order",
      quantity: withSpare,
      unit: "plates",
      why: `Your guest count plus ${percent(THUMB.spareShare)}, a common caterer buffer for unexpected guests.`,
    },
    {
      id: "seats",
      label: "Chairs",
      quantity: seated,
      unit: "chairs",
      why: isPublicEvent(input)
        ? `About ${percent(THUMB.publicSeatedShare)} of guests sit at once at public events; the rest move around.`
        : `Every guest gets a seat, plus ${percent(THUMB.spareShare)} spare.`,
    },
    {
      id: "tables",
      label: `Dining tables (${THUMB.seatsPerTable} seats each)`,
      quantity: Math.ceil(seated / THUMB.seatsPerTable),
      unit: "tables",
      why: `Round tables usually seat ${THUMB.seatsPerTable}.`,
    },
    {
      id: "staff",
      label: "Serving staff",
      quantity: Math.max(2, Math.ceil(g / THUMB.guestsPerServer)),
      unit: "people",
      why: `About one server per ${THUMB.guestsPerServer} guests for buffet service.`,
    },
    {
      id: "water",
      label: "Drinking water",
      quantity: Math.ceil(g * water),
      unit: "litres",
      why: `About ${water} L per guest${outdoor ? " outdoors" : ""} over a ${THUMB.eventHours}-hour event.`,
    },
    {
      id: "parking",
      label: "Parking spaces",
      quantity: Math.ceil(g / THUMB.guestsPerCar),
      unit: "cars",
      why: `Assumes about ${THUMB.guestsPerCar} guests per car.`,
    },
  ];
  if (outdoor || isPublicEvent(input)) {
    items.push({
      id: "toilets",
      label: "Restrooms or portable toilets",
      quantity: Math.max(2, Math.ceil(g / THUMB.guestsPerToilet)),
      unit: "units",
      why: `Roughly one per ${THUMB.guestsPerToilet} guests, with at least two.`,
    });
  }
  if (isPublicEvent(input)) {
    items.push({
      id: "volunteers",
      label: "Volunteers",
      quantity: Math.max(4, Math.ceil(g / THUMB.guestsPerVolunteer)),
      unit: "people",
      why: `About one volunteer per ${THUMB.guestsPerVolunteer} guests for entry, queues and help desks.`,
    });
  }
  if (isOneOf(input, "birthday", "anniversary")) {
    items.push({
      id: "cake",
      label: "Cake size",
      quantity: Math.max(1, Math.ceil(g / THUMB.servingsPerCakeKg)),
      unit: "kg",
      why: `About ${THUMB.servingsPerCakeKg} servings per kilogram.`,
    });
  }
  if (has(input, "ecoFriendly") || g > THUMB.binsFromGuests) {
    items.push({
      id: "bins",
      label: "Waste bin pairs (wet and dry)",
      quantity: Math.max(2, Math.ceil(g / THUMB.guestsPerBinPair)),
      unit: "pairs",
      why: `One pair per ${THUMB.guestsPerBinPair} guests keeps waste sorted at the source.`,
    });
  }
  return items;
}

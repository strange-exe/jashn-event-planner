import { addDays, addMinutes } from "./dates";
import type { EventInput, EventType, Phase, RunSheetItem, Task } from "./types";

// How far ahead tasks happen compared with a wedding (1 = wedding lead times).
const LEAD_SCALE: Record<EventType, number> = {
  wedding: 1,
  engagement: 0.5,
  birthday: 0.2,
  anniversary: 0.25,
  community: 0.4,
  festival: 0.35,
};

interface TaskTemplate {
  id: string;
  title: string;
  phase: Phase;
  /** Ideal days before a wedding; scaled by LEAD_SCALE unless `fixed`. */
  lead: number;
  /** Lower bound after scaling. */
  min: number;
  fixed?: boolean;
  when?: (i: EventInput) => boolean;
  why: string;
}

// Outdoor gatherings above this size usually need police and local-body permission.
const OUTDOOR_PERMIT_GUESTS = 200;

const needsPermits = (i: EventInput) =>
  i.type === "community" || i.type === "festival" || (i.setting === "outdoor" && i.guests > OUTDOOR_PERMIT_GUESTS);

const TEMPLATES: TaskTemplate[] = [
  {
    id: "budget",
    title: "Agree the budget and a first guest list",
    phase: "foundation",
    lead: 180,
    min: 7,
    why: "Every booking depends on the headcount and the money available.",
  },
  {
    id: "venue",
    title: "Shortlist and book the venue",
    phase: "bookings",
    lead: 170,
    min: 6,
    when: (i) => !i.venueBooked,
    why: "The venue fixes the date, capacity and which vendors are allowed.",
  },
  {
    id: "venue-confirm",
    title: "Confirm venue date, timings and rules in writing",
    phase: "bookings",
    lead: 160,
    min: 5,
    when: (i) => i.venueBooked,
    why: "Rules on music, decor and outside caterers shape the other bookings.",
  },
  {
    id: "permits",
    title: "Apply for police and municipal permissions, including loudspeaker use",
    phase: "bookings",
    lead: 30,
    min: 7,
    fixed: true,
    when: needsPermits,
    why: "Public and large outdoor gatherings need permission, which can take weeks.",
  },
  {
    id: "caterer",
    title: "Book the caterer and fix a tasting",
    phase: "bookings",
    lead: 150,
    min: 5,
    why: "Good caterers are booked early, and a tasting avoids surprises.",
  },
  {
    id: "photo",
    title: "Book the photographer",
    phase: "bookings",
    lead: 150,
    min: 5,
    why: "Popular photographers fill their calendars months ahead.",
  },
  {
    id: "decor",
    title: "Book the decorator and agree the theme",
    phase: "bookings",
    lead: 120,
    min: 5,
    why: "Decor needs time for materials and a mock-up.",
  },
  {
    id: "entertainment",
    title: "Book music and entertainment",
    phase: "bookings",
    lead: 120,
    min: 5,
    why: "DJs, bands and performers are booked by date.",
  },
  {
    id: "attire",
    title: "Order outfits and plan fittings",
    phase: "details",
    lead: 90,
    min: 5,
    when: (i) => i.type === "wedding" || i.type === "engagement" || i.priorities.includes("attire"),
    why: "Tailoring and alterations usually take several weeks.",
  },
  {
    id: "tent",
    title: "Book tent, generator and a rain plan",
    phase: "bookings",
    lead: 60,
    min: 4,
    when: (i) => i.setting === "outdoor",
    why: "Outdoor events need shelter and power that do not depend on the weather.",
  },
  {
    id: "invites",
    title: "Send invitations or save-the-dates",
    phase: "details",
    lead: 60,
    min: 3,
    why: "Guests need notice to plan travel and leave.",
  },
  {
    id: "access",
    title: "Check ramps, an accessible restroom and seating near exits",
    phase: "details",
    lead: 45,
    min: 3,
    when: (i) => i.preferences.includes("stepFreeAccess"),
    why: "You asked for step-free access, which depends on the venue.",
  },
  {
    id: "eco",
    title: "Arrange reusable or leaf plates and waste segregation bins",
    phase: "details",
    lead: 30,
    min: 3,
    when: (i) => i.preferences.includes("ecoFriendly"),
    why: "You asked for an eco-friendly event.",
  },
  {
    id: "kids",
    title: "Plan a supervised kids' corner",
    phase: "details",
    lead: 21,
    min: 2,
    when: (i) => i.preferences.includes("kidsFriendly"),
    why: "You expect children, who need space and supervision.",
  },
  {
    id: "rsvp",
    title: "Chase RSVPs and give the caterer a final headcount",
    phase: "final-week",
    lead: 14,
    min: 2,
    fixed: true,
    why: "Caterers charge by plates, so the count matters.",
  },
  {
    id: "menu",
    title: "Finalise the menu and label dietary options",
    phase: "final-week",
    lead: 10,
    min: 2,
    fixed: true,
    why: "Guests with dietary needs should know what they can eat.",
  },
  {
    id: "runsheet",
    title: "Share the day-of run sheet with every vendor",
    phase: "final-week",
    lead: 5,
    min: 1,
    fixed: true,
    why: "Everyone working the event needs the same schedule.",
  },
  {
    id: "payments",
    title: "Pay balances and keep receipts",
    phase: "final-week",
    lead: 3,
    min: 1,
    fixed: true,
    why: "Settled payments avoid disputes on the day.",
  },
  {
    id: "reconfirm",
    title: "Reconfirm every vendor's arrival time",
    phase: "final-week",
    lead: 2,
    min: 1,
    fixed: true,
    why: "A last check catches mix-ups while there is time to fix them.",
  },
  {
    id: "kit",
    title: "Pack an emergency kit: first aid, chargers, tape, safety pins",
    phase: "final-week",
    lead: 1,
    min: 0,
    fixed: true,
    why: "Small problems are easy to fix with the right kit.",
  },
  {
    id: "day",
    title: "Event day: follow the run sheet",
    phase: "day-of",
    lead: 0,
    min: 0,
    fixed: true,
    why: "The plan comes together.",
  },
];

function idealLead(t: TaskTemplate, input: EventInput): number {
  if (t.fixed) return t.lead;
  return Math.max(t.min, Math.round(t.lead * LEAD_SCALE[input.type]));
}

/**
 * Builds the dated task list. When the event is too soon for the ideal lead
 * times, long-lead tasks are squeezed into the time left with an order-preserving
 * mapping, so "book the venue" never ends up after "chase RSVPs".
 */
export function buildTasks(input: EventInput, today: string, daysToGo: number): Task[] {
  const chosen = TEMPLATES.filter((t) => !t.when || t.when(input)).map((t) => ({ t, lead: idealLead(t, input) }));
  const window = Math.max(0, daysToGo);
  const maxLead = Math.max(...chosen.map((c) => c.lead));
  const cut = Math.floor(window / 2);

  // Leads at or below `cut` keep their date; longer leads are spread over
  // (cut, window] in the same order, so the mapping never swaps two tasks.
  const fit = (lead: number): number => {
    if (lead <= cut) return lead;
    return Math.floor(cut + ((window - cut) * (lead - cut)) / (maxLead - cut));
  };
  const needsSqueeze = maxLead > window;

  return chosen
    .map(({ t, lead }) => {
      const scheduled = needsSqueeze ? Math.min(fit(lead), window) : lead;
      return {
        id: t.id,
        title: t.title,
        phase: t.phase,
        due: addDays(input.date, -scheduled),
        idealLeadDays: lead,
        compressed: scheduled < lead,
        why: t.why,
      } satisfies Task;
    })
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.idealLeadDays - a.idealLeadDays))
    .filter((task) => task.due >= today || task.phase === "day-of");
}

type Step = [offsetMinutes: number, title: string, detail: string];

const RUN_SHEETS: Record<EventType, Step[]> = {
  wedding: [
    [-180, "Vendors arrive and set up", "Decor, sound and catering teams on site."],
    [-45, "Hosts and family ready", "Final walk-through with the coordinator."],
    [0, "Guests arrive", "Welcome drinks and seating."],
    [45, "Ceremony and main rituals", "Keep the photographer close to the stage."],
    [150, "Dinner opens", "Stagger seating by table to avoid queues."],
    [210, "Music and dance", "Check local sound limits before going late."],
    [300, "Send-off", "Arrange transport for elderly guests first."],
    [330, "Wrap-up and settlement", "Count rented items and settle balances."],
  ],
  engagement: [
    [-120, "Vendors arrive and set up", "Stage, flowers and sound check."],
    [0, "Guests arrive", "Welcome drinks."],
    [40, "Ring exchange", "Photographer at the stage."],
    [70, "Toasts and family introductions", "Keep each speech under three minutes."],
    [100, "Dinner opens", "Buffet or plated service."],
    [180, "Music and goodbyes", "Hand out favours at the exit."],
  ],
  birthday: [
    [-90, "Set up decor and activity stations", "Balloons, banner, music check."],
    [0, "Guests arrive", "Welcome and name tags for kids if needed."],
    [30, "Games or activities", "Run the planned activity."],
    [90, "Cake cutting", "Candles, lighter and knife ready."],
    [105, "Food is served", "Serve children first if there are many."],
    [165, "Return gifts and goodbyes", "Hand favours at the door."],
  ],
  anniversary: [
    [-90, "Set up decor and seating", "Photo display of the years together."],
    [0, "Guests arrive", "Welcome drinks."],
    [45, "Toasts and memories", "Short speeches from family and friends."],
    [75, "Cake and celebration", "Couple's first dance or song."],
    [90, "Dinner opens", "Buffet or plated service."],
    [180, "Thank-you and goodbyes", "Favours at the exit."],
  ],
  community: [
    [-180, "Volunteers and vendors set up", "Stalls, stage, sound check, first-aid desk."],
    [-30, "Volunteer briefing", "Roles, emergency exits and lost-and-found."],
    [0, "Gates open", "Registration and seating."],
    [30, "Opening address", "Thank sponsors and volunteers."],
    [60, "Main programme", "Performances, talks or activities."],
    [150, "Food service", "Separate queues for elders and families with kids."],
    [240, "Closing and clean-up", "Waste segregation and returning borrowed items."],
  ],
  festival: [
    [-150, "Decor and setup", "Lights, rangoli and puja area."],
    [0, "Guests arrive", "Welcome with sweets."],
    [30, "Puja or main ritual", "Keep the area clear and safe around open flames."],
    [75, "Cultural programme", "Music, dance or games."],
    [135, "Food is served", "Label vegetarian and allergy-friendly dishes."],
    [210, "Wrap-up", "Put out lamps and candles before leaving."],
  ],
};

export function buildRunSheet(input: EventInput): RunSheetItem[] {
  return RUN_SHEETS[input.type].map(([offset, title, detail]) => ({
    time: addMinutes(input.startTime, offset),
    title,
    detail,
  }));
}

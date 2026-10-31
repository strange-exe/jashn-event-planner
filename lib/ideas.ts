import { z } from "zod";
import type { EventInput, EventType, Preference } from "./engine/types";
import { LIMITS } from "./schema";

export const IDEA_CATEGORIES = [
  "decor",
  "food",
  "entertainment",
  "guest-experience",
  "keepsakes",
  "tradition",
] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

const IDEA_COSTS = ["low", "medium", "high"] as const;

/** One idea, whether from Gemini, the curated list or localStorage. */
export const IdeaSchema = z.object({
  title: z.string().min(1).max(LIMITS.ideaTitle),
  category: z.enum(IDEA_CATEGORIES),
  description: z.string().min(1).max(LIMITS.ideaText),
  cost: z.enum(IDEA_COSTS),
});
export type Idea = z.infer<typeof IdeaSchema>;

// Hand-picked ideas used when the AI is off or unavailable. Each list is ordered
// from most to least broadly useful.
const BY_TYPE: Record<EventType, Idea[]> = {
  wedding: [
    {
      title: "Story-of-us photo walk",
      category: "decor",
      description: "Line the entrance with framed photos from childhood to engagement, each with a one-line caption.",
      cost: "low",
    },
    {
      title: "Live chaat and dessert counters",
      category: "food",
      description: "Guests watch dishes made fresh; it spreads crowds better than one long buffet line.",
      cost: "medium",
    },
    {
      title: "Family dance-off",
      category: "entertainment",
      description: "Each side of the family prepares one short performance; a neutral friend picks the winner.",
      cost: "low",
    },
    {
      title: "Welcome kit for outstation guests",
      category: "guest-experience",
      description: "Water, snacks, a schedule card and a local contact number waiting in their rooms.",
      cost: "medium",
    },
    {
      title: "Blessings jar",
      category: "keepsakes",
      description: "Guests write wishes on cards to be opened on the first anniversary.",
      cost: "low",
    },
  ],
  engagement: [
    {
      title: "How-they-met trivia",
      category: "entertainment",
      description: "Five quick questions about the couple; the winning table gets dessert first.",
      cost: "low",
    },
    {
      title: "Floral ring platter",
      category: "decor",
      description: "A fresh-flower tray for the rings that doubles as the photo centrepiece.",
      cost: "low",
    },
    {
      title: "Signature mocktails named after the couple",
      category: "food",
      description: "Two drinks, one for each partner, with the story on a small card.",
      cost: "low",
    },
    {
      title: "Polaroid guest book",
      category: "keepsakes",
      description: "Guests take an instant photo and write a note beside it.",
      cost: "medium",
    },
  ],
  birthday: [
    {
      title: "Decade or theme dress code",
      category: "guest-experience",
      description: "A simple theme guests can do from their wardrobe makes photos instantly fun.",
      cost: "low",
    },
    {
      title: "Memory timeline wall",
      category: "decor",
      description: "A string of photos, one per year, ending with a blank card for this year's wish.",
      cost: "low",
    },
    {
      title: "DIY dessert bar",
      category: "food",
      description: "Plain cupcakes with toppings so guests decorate their own.",
      cost: "low",
    },
    {
      title: "Treasure hunt",
      category: "entertainment",
      description: "Clues hidden around the venue lead to the cake or the return gifts.",
      cost: "low",
    },
    {
      title: "Video messages from far-away friends",
      category: "keepsakes",
      description: "Collect 20-second clips beforehand and play them before the cake.",
      cost: "low",
    },
  ],
  anniversary: [
    {
      title: "Then-and-now photo pairs",
      category: "decor",
      description: "Recreate an old photo of the couple and display both side by side.",
      cost: "low",
    },
    {
      title: "Wedding menu revival",
      category: "food",
      description: "Serve two or three dishes from the original wedding menu.",
      cost: "medium",
    },
    {
      title: "Advice cards for the couple",
      category: "keepsakes",
      description: "Guests write one tip for the next ten years together.",
      cost: "low",
    },
    {
      title: "Their song, live",
      category: "entertainment",
      description: "A friend or local musician performs the couple's song for their dance.",
      cost: "medium",
    },
  ],
  community: [
    {
      title: "Neighbourhood potluck table",
      category: "food",
      description: "Each household brings one dish with a name card; it builds conversation and cuts costs.",
      cost: "low",
    },
    {
      title: "Skill-share corners",
      category: "entertainment",
      description: "Residents run 15-minute sessions: rangoli, first aid, gardening, chess.",
      cost: "low",
    },
    {
      title: "Volunteer wall of thanks",
      category: "guest-experience",
      description: "Name every volunteer and sponsor on one board near the entrance.",
      cost: "low",
    },
    {
      title: "Lost-and-found and help desk",
      category: "guest-experience",
      description: "One clearly marked desk for lost children, lost items and first aid.",
      cost: "low",
    },
  ],
  festival: [
    {
      title: "Community rangoli",
      category: "tradition",
      description: "Draw the outline in advance and let guests fill a section each.",
      cost: "low",
    },
    {
      title: "Lamp-lighting moment",
      category: "tradition",
      description: "Everyone lights a diya together at one time; keep water and sand nearby.",
      cost: "low",
    },
    {
      title: "Regional sweets tasting",
      category: "food",
      description: "Small portions of sweets from different states, each labelled with its origin.",
      cost: "medium",
    },
    {
      title: "Kids' craft table",
      category: "entertainment",
      description: "Lantern or card making keeps children busy and safe away from flames.",
      cost: "low",
    },
  ],
};

const BY_PREFERENCE: Partial<Record<Preference, Idea>> = {
  ecoFriendly: {
    title: "Plantable favours",
    category: "keepsakes",
    description: "Seed paper cards or small saplings instead of plastic return gifts.",
    cost: "low",
  },
  kidsFriendly: {
    title: "Supervised kids' zone",
    category: "guest-experience",
    description: "Mats, colouring and a sitter so parents can enjoy the event.",
    cost: "medium",
  },
  stepFreeAccess: {
    title: "Reserved front seating",
    category: "guest-experience",
    description: "Keep seats near the stage and exits for elders and wheelchair users, with a ramp checked in advance.",
    cost: "low",
  },
  alcoholFree: {
    title: "Mocktail bar with a show",
    category: "food",
    description: "A bartender making fresh mocktails gives the fun of a bar without alcohol.",
    cost: "medium",
  },
};

/** Six fallback ideas for this event, with preference-specific ones first. */
export function fallbackIdeas(input: EventInput, category?: IdeaCategory): Idea[] {
  const prefs = input.preferences.map((p) => BY_PREFERENCE[p]).filter((x): x is Idea => Boolean(x));
  const all = [...prefs, ...BY_TYPE[input.type]];
  const filtered = category ? all.filter((i) => i.category === category) : all;
  return filtered.slice(0, 6);
}

// Domain rules shared by the budget, timeline, vendor and insight builders, so each
// question ("is this a public event?") is answered in exactly one place.
import type { EventInput, FunctionKind, Preference } from "./types";

/** Community events and festival gatherings are open to the public: crowds, permits, volunteers. */
export const isPublicEvent = (i: EventInput) => i.type === "community" || i.type === "festival";

/** Weddings and engagements, or anyone who ranked outfits, need tailoring and fittings. */
export const needsAttire = (i: EventInput) =>
  i.type === "wedding" || i.type === "engagement" || i.priorities.includes("attire");

export const hasPreference = (i: EventInput, p: Preference) => i.preferences.includes(p);

export const hasFunction = (i: EventInput, k: FunctionKind) => i.functions.some((f) => f.kind === k);

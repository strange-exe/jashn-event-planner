import { z } from "zod";
import { addDays } from "./engine/dates";
import { sortFunctions } from "./engine/functions";
import type { EventInput, EventType, FunctionKind } from "./engine/types";
import { FUNCTION_LABEL } from "./labels";
import { LIMITS } from "./schema";

// WhatsApp invitations. Gemini writes them when it can; these templates are the
// fallback and the reference for what an invite must contain.

export const INVITE_LANGUAGES = ["en", "hi"] as const;
export type InviteLanguage = (typeof INVITE_LANGUAGES)[number];

export const INVITE_TONES = ["warm", "formal", "fun"] as const;
export type InviteTone = (typeof INVITE_TONES)[number];

/** Days before the event to ask guests to reply by. */
const RSVP_DAYS: Record<EventType, number> = {
  wedding: 21,
  engagement: 10,
  birthday: 3,
  anniversary: 5,
  community: 7,
  festival: 5,
};

// Control and format characters, including bidi overrides; line breaks are kept.
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Model or template text made safe to show and send: no control or bidi characters, tidy lines. */
export function cleanInvite(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(UNSAFE_CHARS, (c) => (c === "\n" ? c : " "))
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITS.invite);
}

/** The reply-by date, or null when it would already have passed. */
export function rsvpBy(input: EventInput, today: string): string | null {
  const by = addDays(input.date, -RSVP_DAYS[input.type]);
  return by > today ? by : null;
}

const fmt = (locale: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" });
const LOCALE: Record<InviteLanguage, string> = { en: "en-IN", hi: "hi-IN" };

export function inviteDate(iso: string, lang: InviteLanguage): string {
  return fmt(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function inviteTime(hhmm: string, lang: InviteLanguage): string {
  return fmt(LOCALE[lang], { hour: "numeric", minute: "2-digit" }).format(new Date(`1970-01-01T${hhmm}:00Z`));
}

const FUNCTION_NAME_HI: Record<FunctionKind, string> = {
  haldi: "हल्दी",
  mehendi: "मेहंदी",
  sangeet: "संगीत",
  cocktail: "कॉकटेल पार्टी",
  wedding: "विवाह समारोह",
  reception: "रिसेप्शन",
};

/**
 * One line per wedding function, each with its own date and time, by day then time.
 * Empty for a single-function event: its one date and start time say it all.
 */
export function inviteSchedule(input: EventInput, lang: InviteLanguage): string[] {
  if (input.type !== "wedding") return [];
  return sortFunctions(input.functions).map((f) => {
    const name = lang === "hi" ? FUNCTION_NAME_HI[f.kind] : FUNCTION_LABEL[f.kind].name;
    return `${name}: ${inviteDate(addDays(input.date, f.day - 1), lang)}, ${inviteTime(f.startTime, lang)}`;
  });
}

interface Parts {
  title: string;
  date: string;
  time: string;
  /** Replaces the date and time lines when the wedding has functions. */
  schedule: string[];
  city: string;
  style: string;
  by: string | null;
}

type Template = (p: Parts) => string[];

/** The schedule lines when there is one, otherwise the template's own date and time lines. */
const when = (p: Parts, single: string[], scheduled = p.schedule) => (p.schedule.length ? scheduled : single);

const TEMPLATES: Record<InviteLanguage, Record<InviteTone, Template>> = {
  en: {
    warm: (p) => [
      `We would love to celebrate ${p.title} with you.`,
      "",
      ...when(p, [`${p.date}, ${p.time}`]),
      p.city,
      p.style ? `Theme: ${p.style}` : "",
      "",
      `Please let us know ${p.by ? `by ${p.by}` : "soon"} if you can come. It would mean a lot to have you there.`,
    ],
    formal: (p) => [
      `You are cordially invited to ${p.title}.`,
      "",
      ...when(p, [`Date: ${p.date}`, `Time: ${p.time}`]),
      `Place: ${p.city}`,
      p.style ? `Theme: ${p.style}` : "",
      "",
      `Kindly confirm your presence ${p.by ? `by ${p.by}` : "at the earliest"}.`,
    ],
    fun: (p) => [
      `Save the date: ${p.title}.`,
      "",
      ...when(p, [`${p.date}, from ${p.time}, in ${p.city}.`], [...p.schedule, `In ${p.city}.`]),
      p.style ? `The theme is ${p.style}, so dress the part.` : "",
      "Good food, good people and plenty to celebrate.",
      "",
      `Tell us you're in ${p.by ? `by ${p.by}` : "soon"}.`,
    ],
  },
  hi: {
    warm: (p) => [
      `हमें बहुत खुशी होगी अगर आप ${p.title} में हमारे साथ शामिल हों।`,
      "",
      ...when(p, [`तारीख: ${p.date}`, `समय: ${p.time}`]),
      `स्थान: ${p.city}`,
      p.style ? `थीम: ${p.style}` : "",
      "",
      `कृपया ${p.by ? `${p.by} तक` : "जल्द"} बताएं कि आप आ पाएंगे या नहीं।`,
    ],
    formal: (p) => [
      `${p.title} के शुभ अवसर पर आप सपरिवार सादर आमंत्रित हैं।`,
      "",
      ...when(p, [`दिनांक: ${p.date}`, `समय: ${p.time}`]),
      `स्थान: ${p.city}`,
      p.style ? `थीम: ${p.style}` : "",
      "",
      `कृपया ${p.by ? `${p.by} तक` : "जल्द"} अपनी उपस्थिति की पुष्टि करें।`,
    ],
    fun: (p) => [
      `तारीख नोट कर लीजिए: ${p.title}`,
      "",
      ...when(p, [`${p.date}, ${p.time} से, ${p.city} में।`], [...p.schedule, `${p.city} में।`]),
      p.style ? `थीम: ${p.style}` : "",
      "अच्छा खाना, अपने लोग और खूब मस्ती।",
      "",
      `${p.by ? `${p.by} तक` : "जल्द"} बताइए कि आप आ रहे हैं।`,
    ],
  },
};

export function fallbackInvite(input: EventInput, lang: InviteLanguage, tone: InviteTone, today: string): string {
  const by = rsvpBy(input, today);
  const lines = TEMPLATES[lang][tone]({
    title: input.title,
    date: inviteDate(input.date, lang),
    time: inviteTime(input.startTime, lang),
    schedule: inviteSchedule(input, lang),
    city: input.city,
    style: input.style,
    by: by && inviteDate(by, lang),
  });
  // Drop the empty optional lines, but keep the blank lines that separate paragraphs.
  return cleanInvite(lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n"));
}

export const InviteSchema = z.object({ text: z.string().min(1).max(LIMITS.invite) });

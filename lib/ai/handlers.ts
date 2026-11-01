import { z } from "zod";
import { describeChange } from "../engine/changes";
import { todayIn } from "../engine/dates";
import { parseIntent } from "../engine/intent";
import { buildPlan } from "../engine/plan";
import { fallbackIdeas, IDEA_CATEGORIES, type Idea } from "../ideas";
import {
  cleanInvite,
  fallbackInvite,
  INVITE_LANGUAGES,
  INVITE_TONES,
  inviteDate,
  InviteSchema,
  inviteSchedule,
  inviteTime,
  rsvpBy,
} from "../invite";
import { cleanText, EventInputSchema, LIMITS, toChange, type Change } from "../schema";
import {
  LOCAL_SYSTEM,
  LOCAL_TOPICS,
  localPrompt,
  mapsSearchUrl,
  toAnswer,
  toolFor,
  type LocalAnswer,
  type LocalTopic,
} from "../local";
import { aiConfigured, generateGrounded, generateJson, type GenerateClient, type GroundedClient } from "./gemini";
import {
  ASSISTANT_SYSTEM,
  AssistantReplySchema,
  assistantPrompt,
  IDEAS_SYSTEM,
  IdeasSchema,
  ideasPrompt,
  INVITE_SYSTEM,
  invitePrompt,
} from "./prompts";

const message = z.string().transform(cleanText).pipe(z.string().min(1).max(LIMITS.message));

export const AssistantRequestSchema = z.object({
  input: EventInputSchema,
  message,
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: message }))
    .max(LIMITS.historyTurns)
    .default([]),
});

export const IdeasRequestSchema = z.object({
  input: EventInputSchema,
  category: z.enum(IDEA_CATEGORIES).optional(),
});

export const InviteRequestSchema = z.object({
  input: EventInputSchema,
  language: z.enum(INVITE_LANGUAGES),
  tone: z.enum(INVITE_TONES),
});

type Source = "ai" | "rules";

/** "not-configured": no API key on the server. "unavailable": the model call failed. */
type Fallback = "not-configured" | "unavailable";

export interface LabelledChange {
  change: Change;
  label: string;
}

/** Response body of POST /api/assistant. */
export interface AssistantResult {
  reply: string;
  changes: LabelledChange[];
  source: Source;
  /** Why the rules answered instead of the model, when they did. */
  fallback?: Fallback;
}

/** Response body of POST /api/ideas. */
export interface IdeasResult {
  ideas: Idea[];
  source: Source;
  fallback?: Fallback;
}

/** Response body of POST /api/invite. */
export interface InviteResult {
  text: string;
  source: Source;
  fallback?: Fallback;
}

interface Options {
  client?: GenerateClient;
  today?: string;
}

const HELP =
  'I can change the plan for you. Try: "cut the budget by 15%", "add 40 guests", "make it eco-friendly", ' +
  '"start at 7 pm", "move it to 2027-03-14" or "prioritise food and photos".';

function aiEnabled(o: { client?: unknown }) {
  return Boolean(o.client) || aiConfigured();
}

/** Logs why the model was skipped (never the key), so a deploy problem shows up in server logs. */
function fallbackReason(o: { client?: unknown }, error?: unknown): Fallback {
  if (!aiEnabled(o)) return "not-configured";
  console.error("Gemini unavailable, using rules:", error instanceof Error ? error.message : "unknown error");
  return "unavailable";
}

export async function handleAssistant(
  body: z.infer<typeof AssistantRequestSchema>,
  o: Options = {},
): Promise<AssistantResult> {
  const plan = buildPlan(body.input, o.today ?? todayIn());
  const label = (changes: Change[]): LabelledChange[] =>
    changes.map((change) => ({ change, label: describeChange(change, body.input) }));

  let error: unknown;
  if (aiEnabled(o)) {
    try {
      const { data } = await generateJson(
        AssistantReplySchema,
        ASSISTANT_SYSTEM,
        assistantPrompt(plan, body.message, body.history),
        o.client,
      );
      const changes = data.changes.map(toChange).filter((c): c is Change => c !== null);
      return { reply: data.reply, changes: label(changes), source: "ai" };
    } catch (e) {
      // Fall through to the rule-based parser so the user still gets an answer.
      error = e;
    }
  }

  const changes = parseIntent(body.message);
  return {
    reply: changes.length ? "Here is what I understood. Review the changes and apply them if they look right." : HELP,
    changes: label(changes),
    source: "rules",
    fallback: fallbackReason(o, error),
  };
}

export async function handleIdeas(body: z.infer<typeof IdeasRequestSchema>, o: Options = {}): Promise<IdeasResult> {
  let error: unknown;
  if (aiEnabled(o)) {
    try {
      const perGuest = Math.round(body.input.budget / body.input.guests);
      const { data } = await generateJson(
        IdeasSchema,
        IDEAS_SYSTEM,
        ideasPrompt(body.input, perGuest, body.category),
        o.client,
      );
      const ideas = body.category ? data.ideas.filter((i) => i.category === body.category) : data.ideas;
      if (ideas.length) return { ideas, source: "ai" };
      error = new Error("No ideas in the requested category");
    } catch (e) {
      // Use the curated list below.
      error = e;
    }
  }
  return { ideas: fallbackIdeas(body.input, body.category), source: "rules", fallback: fallbackReason(o, error) };
}

export const LocalRequestSchema = z.object({
  input: EventInputSchema,
  topic: z.enum(LOCAL_TOPICS),
});

/** Response body of POST /api/local. */
export interface LocalResult {
  topic: LocalTopic;
  /** Where the answer came from; "none" when the model was unavailable. */
  source: "google-maps" | "google-search" | "none";
  answer?: LocalAnswer;
  /** A Google Maps search the user can open themselves, always present. */
  searchUrl: string;
  fallback?: Fallback;
}

export async function handleLocal(
  body: z.infer<typeof LocalRequestSchema>,
  o: { client?: GroundedClient } = {},
): Promise<LocalResult> {
  const { input, topic } = body;
  const searchUrl = mapsSearchUrl(input, topic);
  let error: unknown;
  if (aiEnabled(o)) {
    try {
      const tool = toolFor(topic);
      const { response } = await generateGrounded(tool, LOCAL_SYSTEM, localPrompt(input, topic), o.client);
      const answer = toAnswer(response, tool);
      // A grounded answer without a single source is not shown: it cannot be checked.
      if (answer.text && answer.links.length) {
        return { topic, source: tool === "googleMaps" ? "google-maps" : "google-search", answer, searchUrl };
      }
      error = new Error("Grounded answer had no sources");
    } catch (e) {
      error = e;
    }
  }
  return { topic, source: "none", searchUrl, fallback: fallbackReason(o, error) };
}

export async function handleInvite(body: z.infer<typeof InviteRequestSchema>, o: Options = {}): Promise<InviteResult> {
  const today = o.today ?? todayIn();
  const { input, language, tone } = body;
  let error: unknown;
  if (aiEnabled(o)) {
    try {
      const by = rsvpBy(input, today);
      const { data } = await generateJson(
        InviteSchema,
        INVITE_SYSTEM,
        invitePrompt(input, language, tone, {
          date: inviteDate(input.date, language),
          time: inviteTime(input.startTime, language),
          schedule: inviteSchedule(input, language),
          rsvpBy: by && inviteDate(by, language),
        }),
        o.client,
      );
      const text = cleanInvite(data.text);
      if (text) return { text, source: "ai" };
      error = new Error("Empty invite");
    } catch (e) {
      // Use the template below.
      error = e;
    }
  }
  return {
    text: fallbackInvite(input, language, tone, today),
    source: "rules",
    fallback: fallbackReason(o, error),
  };
}

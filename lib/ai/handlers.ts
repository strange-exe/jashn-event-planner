import { z } from "zod";
import { describeChange } from "../engine/changes";
import { todayIn } from "../engine/dates";
import { parseIntent } from "../engine/intent";
import { buildPlan } from "../engine/plan";
import { fallbackIdeas, IDEA_CATEGORIES, type Idea } from "../ideas";
import { cleanText, EventInputSchema, LIMITS, toChange, type Change } from "../schema";
import { aiConfigured, generateJson, type GenerateClient } from "./gemini";
import { ASSISTANT_SYSTEM, AssistantReplySchema, assistantPrompt, IDEAS_SYSTEM, IdeasSchema, ideasPrompt } from "./prompts";

const message = z.string().transform(cleanText).pipe(z.string().min(1).max(LIMITS.message));

export const AssistantRequestSchema = z.object({
  input: EventInputSchema,
  message,
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: message })).max(6).default([]),
});

export const IdeasRequestSchema = z.object({
  input: EventInputSchema,
  category: z.enum(IDEA_CATEGORIES).optional(),
});

export type Source = "ai" | "rules";

export interface AssistantResult {
  reply: string;
  changes: { change: Change; label: string }[];
  source: Source;
}

interface Options {
  client?: GenerateClient;
  today?: string;
}

const HELP =
  "I can change the plan for you. Try: \"cut the budget by 15%\", \"add 40 guests\", \"make it eco-friendly\", " +
  "\"start at 7 pm\", \"move it to 2027-03-14\" or \"prioritise food and photos\".";

function aiEnabled(o: Options) {
  return Boolean(o.client) || aiConfigured();
}

export async function handleAssistant(body: z.infer<typeof AssistantRequestSchema>, o: Options = {}): Promise<AssistantResult> {
  const plan = buildPlan(body.input, o.today ?? todayIn());
  const label = (changes: Change[]) => changes.map((change) => ({ change, label: describeChange(change, body.input) }));

  if (aiEnabled(o)) {
    try {
      const { data } = await generateJson(AssistantReplySchema, ASSISTANT_SYSTEM, assistantPrompt(plan, body.message, body.history), o.client);
      const changes = data.changes.map(toChange).filter((c): c is Change => c !== null);
      return { reply: data.reply, changes: label(changes), source: "ai" };
    } catch {
      // Fall through to the rule-based parser so the user still gets an answer.
    }
  }

  const changes = parseIntent(body.message);
  return {
    reply: changes.length ? "Here is what I understood. Review the changes and apply them if they look right." : HELP,
    changes: label(changes),
    source: "rules",
  };
}

export async function handleIdeas(body: z.infer<typeof IdeasRequestSchema>, o: Options = {}): Promise<{ ideas: Idea[]; source: Source }> {
  if (aiEnabled(o)) {
    try {
      const perGuest = Math.round(body.input.budget / body.input.guests);
      const { data } = await generateJson(IdeasSchema, IDEAS_SYSTEM, ideasPrompt(body.input, perGuest, body.category), o.client);
      const ideas = body.category ? data.ideas.filter((i) => i.category === body.category) : data.ideas;
      if (ideas.length) return { ideas, source: "ai" };
    } catch {
      // Use the curated list below.
    }
  }
  return { ideas: fallbackIdeas(body.input, body.category), source: "rules" };
}

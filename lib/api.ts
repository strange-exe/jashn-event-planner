import type { AssistantResult, IdeasResult, InviteResult, LocalResult } from "./ai/handlers";
import type { LocalTopic } from "./local";
import type { EventInput } from "./engine/types";
import type { IdeaCategory } from "./ideas";
import type { InviteLanguage, InviteTone } from "./invite";
import type { ChatMessage } from "./store";

// Typed browser client for the app's own API routes. The response types come from the
// server handlers, so a change on one side fails type-checking on the other.

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    throw new Error(typeof message === "string" ? message : fallbackError);
  }
  return data as T;
}

export function askAssistant(input: EventInput, message: string, history: ChatMessage[]): Promise<AssistantResult> {
  return postJson("/api/assistant", { input, message, history }, "The assistant could not answer.");
}

export function getIdeas(input: EventInput, category?: IdeaCategory): Promise<IdeasResult> {
  return postJson("/api/ideas", { input, ...(category ? { category } : {}) }, "Could not get ideas.");
}

export function findLocal(input: EventInput, topic: LocalTopic): Promise<LocalResult> {
  return postJson("/api/local", { input, topic }, "Could not search right now.");
}

export function writeInvite(input: EventInput, language: InviteLanguage, tone: InviteTone): Promise<InviteResult> {
  return postJson("/api/invite", { input, language, tone }, "Could not write the invite.");
}

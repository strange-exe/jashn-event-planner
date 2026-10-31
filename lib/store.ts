"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { BUDGET_CATEGORIES, type EventInput } from "./engine/types";
import { IdeaSchema } from "./ideas";
import { EventInputSchema, LIMITS } from "./schema";

// Plans live in this browser's localStorage, so there is no account or database
// and nothing personal leaves the device except what is sent to the assistant.

const KEY = "jashn.plans.v1";
const MAX_PLANS = 30;

const ChatSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(LIMITS.savedChatText) });
export type ChatMessage = z.infer<typeof ChatSchema>;

const SavedPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{8,40}$/),
  input: EventInputSchema,
  locks: z.partialRecord(z.enum(BUDGET_CATEGORIES), z.number().int().min(0)).default({}),
  done: z.record(z.string(), z.boolean()).default({}),
  booked: z.record(z.string(), z.boolean()).default({}),
  ideas: z.array(IdeaSchema).max(LIMITS.savedIdeas).default([]),
  chat: z.array(ChatSchema).max(LIMITS.savedChat).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedPlan = z.infer<typeof SavedPlanSchema>;

let cache: SavedPlan[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedPlan[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Drop anything malformed rather than crash on an old or edited entry.
    cache = Array.isArray(raw)
      ? raw.flatMap((p) => {
          const r = SavedPlanSchema.safeParse(p);
          return r.success ? [r.data] : [];
        })
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(plans: SavedPlan[]) {
  cache = plans.slice(0, MAX_PLANS);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked (private mode): keep the in-memory copy for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** All saved plans, newest first; `null` during server rendering. */
export function usePlans(): SavedPlan[] | null {
  return useSyncExternalStore<SavedPlan[] | null>(subscribe, read, () => null);
}

export function usePlan(id: string): SavedPlan | undefined | null {
  const plans = usePlans();
  return plans === null ? null : plans.find((p) => p.id === id);
}

export function createPlan(input: EventInput): SavedPlan {
  const now = new Date().toISOString();
  const plan: SavedPlan = {
    id: crypto.randomUUID(),
    input,
    locks: {},
    done: {},
    booked: {},
    ideas: [],
    chat: [],
    createdAt: now,
    updatedAt: now,
  };
  write([plan, ...read()]);
  return plan;
}

export function updatePlan(id: string, update: (p: SavedPlan) => SavedPlan) {
  write(read().map((p) => (p.id === id ? { ...update(p), updatedAt: new Date().toISOString() } : p)));
}

export function deletePlan(id: string) {
  write(read().filter((p) => p.id !== id));
}

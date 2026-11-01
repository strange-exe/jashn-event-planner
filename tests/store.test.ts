import { afterEach, describe, expect, it, vi } from "vitest";
import { makeInput } from "./fixtures";

const KEY = "jashn.plans.v1";

/** Minimal in-memory stand-in for the browser's localStorage. */
class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function savedPlan(id: string) {
  const at = "2026-11-01T00:00:00.000Z";
  return { id, input: makeInput(), createdAt: at, updatedAt: at };
}

/** Loads a fresh copy of the store (it caches what it read) over the given storage contents. */
async function loadStore(raw?: string, storage = new MemoryStorage()) {
  vi.resetModules();
  if (raw !== undefined) storage.setItem(KEY, raw);
  vi.stubGlobal("localStorage", storage);
  const store = await import("@/lib/store");
  const stored = () => JSON.parse(storage.getItem(KEY) ?? "[]") as { id: string; input: { guests: number } }[];
  return { store, stored };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("plan storage", () => {
  it("saves new plans first, with defaults filled in", async () => {
    const { store, stored } = await loadStore();
    const first = store.createPlan(makeInput());
    const second = store.createPlan(makeInput({ title: "Second" }));
    expect(stored().map((p) => p.id)).toEqual([second.id, first.id]);
    expect(first).toMatchObject({ locks: {}, done: {}, booked: {}, ideas: [], chat: [] });
  });

  it("drops malformed saved entries and keeps the valid ones", async () => {
    const raw = JSON.stringify([
      savedPlan("valid-plan-1"),
      { id: "x" },
      "junk",
      { ...savedPlan("bad-guests"), input: { guests: -1 } },
    ]);
    const { store, stored } = await loadStore(raw);
    store.createPlan(makeInput());
    expect(
      stored()
        .map((p) => p.id)
        .slice(1),
    ).toEqual(["valid-plan-1"]);
  });

  it.each(["not json", JSON.stringify({ plans: [] })])("treats unreadable storage (%s) as empty", async (raw) => {
    const { store, stored } = await loadStore(raw);
    store.createPlan(makeInput());
    expect(stored()).toHaveLength(1);
  });

  it("updates and deletes only the plan asked for", async () => {
    const raw = JSON.stringify([savedPlan("plan-aaaa-1"), savedPlan("plan-bbbb-2")]);
    const { store, stored } = await loadStore(raw);
    store.updatePlan("plan-aaaa-1", (p) => ({ ...p, input: { ...p.input, guests: 50 } }));
    expect(stored().map((p) => p.input.guests)).toEqual([50, 200]);
    store.deletePlan("plan-aaaa-1");
    expect(stored().map((p) => p.id)).toEqual(["plan-bbbb-2"]);
  });

  it("keeps at most 30 plans, dropping the oldest", async () => {
    const raw = JSON.stringify(Array.from({ length: 30 }, (_, i) => savedPlan(`old-plan-${i}`)));
    const { store, stored } = await loadStore(raw);
    const plan = store.createPlan(makeInput());
    expect(stored()).toHaveLength(30);
    expect(stored()[0]?.id).toBe(plan.id);
    expect(stored().some((p) => p.id === "old-plan-29")).toBe(false);
  });

  it("still creates the plan when storage is full or blocked", async () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { store } = await loadStore(undefined, storage);
    expect(store.createPlan(makeInput()).input.title).toBe("Riya and Arjun's wedding");
  });
});

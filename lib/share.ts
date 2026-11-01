import { z } from "zod";
import { BUDGET_CATEGORIES } from "./engine/types";
import { EventInputSchema } from "./schema";

// A read-only copy of a plan, packed into the URL fragment. The fragment is never sent
// to a server, so sharing needs no account or storage. Guest names and payments are
// left out on purpose. A link is untrusted input: it is size-capped before and while
// it is decompressed, then validated like any other plan.

const VERSION = 1;
/** Longest fragment accepted, in characters. A typical plan is about 1 KB. */
export const MAX_LINK_CHARS = 8_000;
/** Most bytes a link may inflate to, so a crafted link cannot exhaust memory. */
export const MAX_DECODED_BYTES = 32_000;
const MAX_IDS = 100;

const ids = z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(MAX_IDS);

export const SharedPlanSchema = z.object({
  v: z.literal(VERSION),
  input: EventInputSchema,
  locks: z.partialRecord(z.enum(BUDGET_CATEGORIES), z.number().int().min(0)).default({}),
  done: ids.default([]),
  booked: ids.default([]),
});
export type SharedPlan = z.infer<typeof SharedPlanSchema>;

export class ShareLinkError extends Error {}

const trueKeys = (r: Record<string, boolean>) =>
  Object.entries(r)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .slice(0, MAX_IDS);

/** The shareable part of a saved plan. */
export function toShared(p: {
  input: SharedPlan["input"];
  locks: SharedPlan["locks"];
  done: Record<string, boolean>;
  booked: Record<string, boolean>;
}): SharedPlan {
  return { v: VERSION, input: p.input, locks: p.locks, done: trueKeys(p.done), booked: trueKeys(p.booked) };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new ShareLinkError("The link has unexpected characters.");
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function readCapped(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new ShareLinkError("The link is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export async function encodeShared(plan: SharedPlan): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  const packed = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return toBase64Url(await readCapped(packed, MAX_LINK_CHARS));
}

export async function decodeShared(fragment: string): Promise<SharedPlan> {
  if (fragment.length === 0) throw new ShareLinkError("The link has no plan in it.");
  if (fragment.length > MAX_LINK_CHARS) throw new ShareLinkError("The link is too large.");
  let json: unknown;
  try {
    const packed = fromBase64Url(fragment);
    const inflated = new Blob([packed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    json = JSON.parse(new TextDecoder().decode(await readCapped(inflated, MAX_DECODED_BYTES)));
  } catch (e) {
    if (e instanceof ShareLinkError) throw e;
    throw new ShareLinkError("The link is damaged. Ask for it again.");
  }
  const parsed = SharedPlanSchema.safeParse(json);
  if (!parsed.success) throw new ShareLinkError("The link does not hold a valid plan.");
  return parsed.data;
}

/** Fragment format: #p=<data>. */
export const shareHash = (data: string) => `#p=${data}`;
export const fragmentData = (hash: string) => (hash.startsWith("#p=") ? hash.slice(3) : "");

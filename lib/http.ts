// Small helpers for the API routes: bounded JSON bodies, a per-client rate limit, and
// `jsonRoute`, which puts them together around a validated handler.
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads a JSON body, refusing anything over `maxBytes`. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "Request too large.");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Fixed-window limiter kept in memory. On serverless hosts each instance has its
 * own window, so it blunts bursts rather than enforcing a hard global cap.
 */
// Past this many tracked clients, expired windows are swept so memory stays bounded.
const MAX_TRACKED_CLIENTS = 5_000;

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { ok: boolean; retryAfter: number } => {
    const t = now();
    if (hits.size > MAX_TRACKED_CLIENTS) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return { ok: true, retryAfter: 0 };
    }
    entry.count += 1;
    return entry.count <= limit
      ? { ok: true, retryAfter: 0 }
      : { ok: false, retryAfter: Math.ceil((entry.resetAt - t) / 1000) };
  };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

// Requests per client per minute; the e2e suite raises it because every test shares one IP.
const limiter = createRateLimiter(Number(process.env.RATE_LIMIT_PER_MINUTE) || 12, 60_000);

/** Wraps a JSON API handler with rate limiting, size limits and validation. */
export function jsonRoute<S extends z.ZodType>(schema: S, handle: (body: z.infer<S>) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const rate = limiter(clientKey(req));
    if (!rate.ok) {
      return json({ error: "Too many requests. Try again in a minute." }, 429, {
        "Retry-After": String(rate.retryAfter),
      });
    }
    try {
      const parsed = schema.safeParse(await readJson(req));
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        return json({ error: "Some details are invalid.", issues }, 400);
      }
      return json(await handle(parsed.data));
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      // Log only the message: request bodies can hold personal details.
      console.error("API error", e instanceof Error ? e.message : "unknown");
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

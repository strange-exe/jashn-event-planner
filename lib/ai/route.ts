import { z } from "zod";
import { clientKey, createRateLimiter, HttpError, json, readJson } from "../http";

// Requests per client per minute; the e2e suite raises it because every test shares one IP.
const limiter = createRateLimiter(Number(process.env.RATE_LIMIT_PER_MINUTE) || 12, 60_000);

/** Wraps a JSON API handler with rate limiting, size limits and validation. */
export function jsonRoute<S extends z.ZodType>(schema: S, handle: (body: z.infer<S>) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const rate = limiter(clientKey(req));
    if (!rate.ok) return json({ error: "Too many requests. Try again in a minute." }, 429, { "Retry-After": String(rate.retryAfter) });
    try {
      const parsed = schema.safeParse(await readJson(req));
      if (!parsed.success) return json({ error: "Some details are invalid.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
      return json(await handle(parsed.data));
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("API error", e instanceof Error ? e.message : "unknown");
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const Body = z.object({ name: z.string().min(1) });

/** A fresh route module, so each test gets its own rate-limit window of 2 requests. */
async function makeRoute(handle: (body: z.infer<typeof Body>) => Promise<unknown> = async (b) => ({ hello: b.name })) {
  vi.resetModules();
  vi.stubEnv("RATE_LIMIT_PER_MINUTE", "2");
  const { jsonRoute } = await import("@/lib/http");
  return jsonRoute(Body, handle);
}

const post = (body: string, ip = "203.0.113.1") =>
  new Request("http://localhost/api/test", { method: "POST", body, headers: { "x-forwarded-for": ip } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("jsonRoute", () => {
  it("passes a valid body to the handler and disables caching", async () => {
    const res = await (await makeRoute())(post('{"name":"Riya"}'));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ hello: "Riya" });
  });

  it("rejects an invalid body with the field that failed", async () => {
    const res = await (await makeRoute())(post('{"name":""}'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(["name"]);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await (await makeRoute())(post("name=Riya"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be JSON." });
  });

  it("passes HTTP errors through with their status", async () => {
    const route = await makeRoute(async () => {
      // Same module instance the freshly loaded route uses, so its instanceof check matches.
      const { HttpError } = await import("@/lib/http");
      throw new HttpError(413, "Request too large.");
    });
    expect((await route(post('{"name":"Riya"}'))).status).toBe(413);
  });

  it("hides unexpected errors behind a generic message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = await makeRoute(async () => {
      throw new Error("database password is hunter2");
    });
    const res = await route(post('{"name":"Riya"}'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    expect(log).toHaveBeenCalledOnce();
  });

  it("rate-limits each client separately", async () => {
    const route = await makeRoute();
    await route(post('{"name":"a"}'));
    await route(post('{"name":"b"}'));
    const limited = await route(post('{"name":"c"}'));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await route(post('{"name":"d"}', "198.51.100.7"))).status).toBe(200);
  });
});

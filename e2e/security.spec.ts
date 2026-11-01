import { expect, test } from "@playwright/test";
import { openSample } from "./helpers";

test("pages send a nonce-based CSP and hardening headers", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  const csp = h["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

// Checks the HTML the server sent. Chunks that Next's runtime adds later (the lazy
// three.js scene) have no nonce attribute and are allowed by 'strict-dynamic', so
// reading the live DOM made this test depend on when the idle callback ran.
test("every script tag the server sends carries the nonce", async ({ request }) => {
  const res = await request.get("/");
  const nonce = /'nonce-([^']+)'/.exec(res.headers()["content-security-policy"] ?? "")?.[1];
  expect(nonce).toBeTruthy();
  const tags = (await res.text()).match(/<script\b[^>]*>/g) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) expect(tag).toContain(`nonce="${nonce}"`);
});

test("API rejects invalid, oversized and non-JSON bodies", async ({ request }) => {
  const bad = await request.post("/api/assistant", { data: { input: { type: "rave" }, message: "hi" } });
  expect(bad.status()).toBe(400);
  const big = await request.post("/api/assistant", { data: { message: "x".repeat(20_000) } });
  expect(big.status()).toBe(413);
  const notJson = await request.post("/api/ideas", { data: "{oops", headers: { "content-type": "application/json" } });
  expect(notJson.status()).toBe(400);
});

test("HTML typed by the user is shown as text, never run", async ({ page }) => {
  let alerted = false;
  page.on("dialog", async (d) => {
    alerted = true;
    await d.dismiss();
  });
  await openSample(page);
  const payload = "<img src=x onerror=alert(1)> javascript:alert(1)";
  await page.getByLabel("Message to the planner").fill(payload);
  await page.getByRole("button", { name: "Send" }).click();
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log).toContainText(payload);
  expect(await log.locator("img").count()).toBe(0);
  expect(alerted).toBe(false);
});

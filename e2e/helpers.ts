import { expect, type Page } from "@playwright/test";

/** Collects console errors, uncaught exceptions and failed requests for a page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    // WebKit reports Next's RSC prefetch, cancelled by a reload, as an
    // "access control checks" error; it is not a CORS problem in the app.
    if (e.message.includes("_rsc=") && e.message.includes("access control checks")) return;
    errors.push(`pageerror: ${e.message}`);
  });
  page.on("requestfailed", (r) => {
    // Next aborts in-flight RSC prefetches when a navigation starts; those are expected.
    if (r.url().includes("_rsc=")) return;
    // Browsers fetch icons out of band; a reload can cancel that fetch (Firefox
    // NS_BINDING_ABORTED). The favicon test checks the icons themselves.
    if (/\/(icon\.svg|apple-touch-icon\.png)$/.test(r.url())) return;
    errors.push(`failed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

/** Load, emulate, reload, then prove the colour scheme is really active. */
export async function openIn(page: Page, path: string, colorScheme: "light" | "dark") {
  await page.goto(path);
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.reload();
  const dark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  expect(dark, `colour scheme emulation not applied (${colorScheme})`).toBe(colorScheme === "dark");
}

/** Creates the sample wedding and waits for its dashboard. */
export async function openSample(page: Page) {
  await page.goto("/plan/new?sample=wedding");
  await expect(page.getByRole("heading", { level: 1, name: "Riya and Arjun's wedding" })).toBeVisible();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow, "page scrolls horizontally").toBe(false);
}

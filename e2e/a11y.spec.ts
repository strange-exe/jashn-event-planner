import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { noHorizontalOverflow, openIn, openSample, watchErrors } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const scheme of ["light", "dark"] as const) {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test.describe(`${scheme} ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("home", async ({ page }) => {
        const errors = watchErrors(page);
        await openIn(page, "/", scheme);
        await expect(page.getByRole("link", { name: "Start a plan" })).toBeInViewport();
        await noHorizontalOverflow(page);
        expect(await axe(page)).toEqual([]);
        expect(errors).toEqual([]);
      });

      test("wizard steps, including errors", async ({ page }) => {
        await openIn(page, "/plan/new", scheme);
        await page.getByRole("button", { name: "Continue" }).click();
        await noHorizontalOverflow(page);
        expect(await axe(page)).toEqual([]);
        await page.getByLabel("Name of the event").fill("Society Holi");
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("button", { name: "Continue" }).click();
        expect(await axe(page)).toEqual([]);
        await page.getByLabel("City or town").fill("Noida");
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByLabel("Guests").fill("300");
        await page.getByLabel("Total budget (rupees)").fill("2 lakh");
        await noHorizontalOverflow(page);
        expect(await axe(page)).toEqual([]);
      });

      test("every dashboard tab", async ({ page }) => {
        // Six axe scans; WebKit needs more than the default 30 s for them.
        test.slow();
        const errors = watchErrors(page);
        await openSample(page);
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.reload();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        for (const name of ["Overview", "Budget", "Timeline", "Vendors", "Ideas"]) {
          await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
          await noHorizontalOverflow(page);
          expect(await axe(page), `${name} tab`).toEqual([]);
        }
        await page.getByRole("button", { name: "Get ideas" }).click();
        await expect(page.getByText("Reserved front seating")).toBeVisible();
        expect(await axe(page), "ideas loaded").toEqual([]);
        expect(errors).toEqual([]);
      });
    });
  }
}

test("empty plans list is accessible", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "No plans yet" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("favicon and apple-touch-icon exist and match their declared format", async ({ page, request }) => {
  await page.goto("/");
  const icons = await page.$$eval('link[rel~="icon"], link[rel="apple-touch-icon"]', (els) =>
    els.map((e) => ({ rel: e.getAttribute("rel"), href: (e as HTMLLinkElement).href })),
  );
  expect(icons.some((i) => i.rel?.split(" ").includes("icon"))).toBe(true);
  expect(icons.some((i) => i.rel === "apple-touch-icon")).toBe(true);
  for (const icon of icons) {
    const res = await request.get(icon.href);
    expect(res.status(), icon.href).toBe(200);
    const body = await res.body();
    if (icon.href.endsWith(".svg")) expect(body.subarray(0, 200).toString("utf8")).toContain("<svg");
    else expect(body.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), `${icon.href} is not a PNG`).toBe(true);
  }
});

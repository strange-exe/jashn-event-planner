import { expect, test } from "@playwright/test";
import { openSample, watchErrors } from "./helpers";

test("create a birthday plan through the wizard", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/plan/new");
  await expect(page.getByRole("heading", { level: 1, name: "Occasion" })).toBeVisible();

  // Continuing with an empty name shows an error and focuses the field.
  await page.getByRole("button", { name: "Continue" }).click();
  const title = page.getByLabel("Name of the event");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toBeFocused();
  await expect(page.getByText("Give the event a name.")).toBeVisible();

  await page.getByRole("radio", { name: /Birthday/ }).check();
  await title.fill("Aarav turns 7");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "When and where" })).toBeFocused();
  await page.getByLabel("City or town").fill("Dehradun");
  await page.getByRole("radio", { name: /Outdoor/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Guests").fill("40");
  await page.getByLabel("Total budget (rupees)").fill("60k");
  await expect(page.getByRole("status")).toContainText("1,500 per guest");
  await page.getByRole("checkbox", { name: "Music and fun" }).check();
  await page.getByRole("checkbox", { name: "Food" }).check();
  await page.getByRole("checkbox", { name: "Kids attending" }).check();
  await page.getByRole("button", { name: "Create my plan" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Aarav turns 7" })).toBeVisible();
  await expect(page.locator("dl").first()).toContainText("60,000");
  await expect(page.locator("dl").first()).toContainText("1,500");

  await page.getByRole("tab", { name: /Vendors/ }).click();
  await expect(page.getByText("Baker")).toBeVisible();
  await expect(page.getByText("Tent, power and generator")).toBeVisible();
  expect(errors).toEqual([]);
});

test("rejects a budget that is too small", async ({ page }) => {
  await page.goto("/plan/new");
  await page.getByLabel("Name of the event").fill("Tiny party");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("City or town").fill("Pune");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Guests").fill("10");
  await page.getByLabel("Total budget (rupees)").fill("900");
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page.getByLabel("Total budget (rupees)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Fix the highlighted field" })).toBeVisible();
});

test("tasks stay ticked after a reload", async ({ page }) => {
  await openSample(page);
  await page.getByRole("tab", { name: /Timeline/ }).click();
  const task = page.getByRole("checkbox", { name: "Book the photographer" });
  await task.check();
  await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Timeline/ }).click();
  await expect(page.getByRole("checkbox", { name: "Book the photographer" })).toBeChecked();
});

test("fixing a budget line keeps the total and can be undone", async ({ page }) => {
  await openSample(page);
  await page.getByRole("tab", { name: "Budget" }).click();
  await page.getByRole("button", { name: "Edit Food and drinks" }).click();
  await page.getByLabel("New amount for Food and drinks").fill("9 lakh");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fixed")).toBeVisible();

  const total = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"]:not([hidden]) li strong')]
      .map((el) => Number(el.textContent!.replace(/[^\d]/g, "")))
      .reduce((a, b) => a + b, 0),
  );
  expect(total).toBe(1_800_000);

  await page.getByRole("button", { name: "Let it rebalance Food and drinks" }).click();
  await expect(page.getByText("Fixed")).toHaveCount(0);
});

test("assistant proposes changes and applies them only on approval", async ({ page }) => {
  await openSample(page);
  const box = page.getByLabel("Message to the planner");
  await box.fill("Add 30 guests and make it eco-friendly");
  await page.getByRole("button", { name: "Send" }).click();

  const proposal = page.getByRole("group", { name: "Proposed changes" });
  await expect(proposal).toContainText("Add 30 guests (to 250)");
  await expect(proposal).toContainText("Add eco-friendly choices");
  await expect(page.locator("dl").getByText("220")).toBeVisible();

  await proposal.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Applied 2 changes")).toBeVisible();
  await expect(page.locator("dl").getByText("250")).toBeVisible();
});

test("assistant explains itself when it cannot act", async ({ page }) => {
  await openSample(page);
  await page.getByLabel("Message to the planner").fill("hello there");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText("cut the budget by 15%");
  await expect(page.getByRole("group", { name: "Proposed changes" })).toHaveCount(0);
});

test("ideas fall back to curated ideas without an API key", async ({ page }) => {
  await openSample(page);
  await page.getByRole("tab", { name: "Ideas" }).click();
  await page.getByRole("button", { name: "Get ideas" }).click();
  await expect(page.getByText("AI is unavailable, so these are curated ideas")).toBeVisible();
  await expect(page.getByText("Reserved front seating")).toBeVisible();
});

test("tabs follow the keyboard pattern", async ({ page }) => {
  await openSample(page);
  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Budget" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Ideas" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(overview).toHaveAttribute("aria-selected", "true");
});

test("exports the timeline as a calendar file", async ({ page }) => {
  await openSample(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("jashn-plan.ics");
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(text).toContain("SUMMARY:Riya and Arjun's wedding");
  expect(text.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
});

test("an unknown plan id shows a helpful message", async ({ page }) => {
  await page.goto("/plans/does-not-exist-123");
  await expect(page.getByRole("heading", { name: "Plan not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new plan" })).toBeVisible();
});

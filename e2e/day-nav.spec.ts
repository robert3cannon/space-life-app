import { config as loadEnv } from "dotenv";
import { expect, test, type Page } from "@playwright/test";

loadEnv({ path: ".env.local" });

const ARROW_SCREENS = [
  { path: "/food", prev: "Previous day", next: "Next day" },
  { path: "/schedule", prev: "Previous week", next: "Next week" },
  { path: "/sleep", prev: "Previous morning", next: "Next morning" },
  { path: "/water", prev: "Previous day", next: "Next day" },
];

async function signIn(page: Page) {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is required for the day-nav check");
  await page.goto("/login");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Enter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function expectArrowsInside(page: Page, width: number, labels: { prev: string; next: string }) {
  const nav = page.getByTestId("day-nav");
  await expect(nav).toBeVisible();
  for (const name of [labels.prev, labels.next]) {
    const button = nav.getByRole("button", { name });
    const box = await button.boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, name).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(width + 0.5);
    expect(box!.y, name).toBeGreaterThanOrEqual(0);
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("date arrows stay on a phone", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("keeps both food arrows on screen when the day is Wednesday", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/food");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).not.toHaveText("Food", { timeout: 15_000 });
    let current = (await heading.textContent())?.trim() ?? "";
    for (let step = 0; step < 7 && current !== "Wednesday"; step += 1) {
      await page.getByRole("button", { name: "Previous day" }).click();
      await expect(heading).not.toHaveText(current);
      current = (await heading.textContent())?.trim() ?? "";
    }
    await expect(heading).toHaveText("Wednesday");
    const fit = await heading.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fit).toBe(true);
    await expectArrowsInside(page, 375, { prev: "Previous day", next: "Next day" });
  });

  for (const width of [375, 393]) {
    test(`has no horizontal overflow on date screens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 852 });
      for (const screen of ARROW_SCREENS) {
        await page.goto(screen.path);
        await expect(page.getByTestId("day-nav")).toBeVisible();
        await expectArrowsInside(page, width, screen);
      }
      for (const path of ["/", "/workouts"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, path).toBeLessThanOrEqual(1);
      }
    });
  }
});

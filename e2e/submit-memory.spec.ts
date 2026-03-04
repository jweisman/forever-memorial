import { test, expect } from "@playwright/test";
import { TEST_MEMORIAL_SLUG } from "./test-ids";

// Uses storageState from global-setup (authenticated as TEST_USER)

test.describe("Submit memory", () => {
  test("shows the memory submission form when authenticated", async ({ page }) => {
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);

    // Authenticated users see the form, not the sign-in CTA
    await expect(page.locator("#memory-name")).toBeVisible();
    await expect(page.locator("#memory-text")).toBeVisible();
    await expect(page.getByRole("button", { name: /submit memory/i })).toBeVisible();
  });

  test("submits a memory and shows the success confirmation", async ({ page }) => {
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);

    await page.locator("#memory-name").fill("Playwright Submitter");
    await page.locator("#memory-text").fill("This is an E2E test memory submission.");

    await page.getByRole("button", { name: /submit memory/i }).click();

    // Success state: "Thank you for sharing your memory"
    await expect(
      page.getByText("Thank you for sharing your memory")
    ).toBeVisible();
  });
});

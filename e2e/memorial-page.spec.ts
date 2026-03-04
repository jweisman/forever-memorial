import { test, expect } from "@playwright/test";
import { TEST_MEMORIAL_SLUG, TEST_MEMORIAL_NAME } from "./test-ids";

// Public memorial page — no auth needed
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Public memorial page", () => {
  test("renders the memorial name and death year", async ({ page }) => {
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);

    await expect(page.getByRole("heading", { name: TEST_MEMORIAL_NAME })).toBeVisible();
    // Death year 2024 appears in the header date range (e.g. "d. 2024")
    await expect(page.getByText("2024").first()).toBeVisible();
  });

  test("shows a sign-in prompt in the Share a Memory section", async ({ page }) => {
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);

    // "Share a Memory" heading visible
    await expect(page.getByRole("heading", { name: "Share a Memory" })).toBeVisible();
    // Sign-in CTA is shown (not the submission form) — use exact text to avoid matching nav link
    await expect(page.getByRole("link", { name: "Sign in to share a memory" })).toBeVisible();
    // The submission form input should NOT be present
    await expect(page.locator("#memory-text")).not.toBeVisible();
  });

  test("page title includes the memorial name", async ({ page }) => {
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);
    await expect(page).toHaveTitle(new RegExp(TEST_MEMORIAL_NAME));
  });
});

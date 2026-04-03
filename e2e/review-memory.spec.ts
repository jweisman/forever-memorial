import { test, expect } from "@playwright/test";
import {
  TEST_MEMORIAL_SLUG,
  TEST_MEMORIAL_NAME,
  TEST_MEMORY_TEXT,
  TEST_MEMORY_SUBMITTER,
} from "./test-ids";

// Uses storageState from global-setup (authenticated as TEST_USER, who owns TEST_MEMORIAL)

test.describe("Review memory", () => {
  test("pending memory appears in the dashboard review queue", async ({ page }) => {
    await page.goto("/en/dashboard");

    await expect(page.getByRole("heading", { name: "Pending Reviews" })).toBeVisible();

    // Memorial group heading visible (use first() — name appears in both heading and link)
    await expect(page.getByText(TEST_MEMORIAL_NAME).first()).toBeVisible();

    // Submitter name and text visible in the card
    await expect(page.getByText(TEST_MEMORY_SUBMITTER)).toBeVisible();
  });

  test("owner accepts the memory and it appears on the memorial page", async ({ page }) => {
    await page.goto("/en/dashboard");

    // Find the pending memory card and click Accept
    const memoryCard = page.locator(".rounded-lg.border").filter({
      hasText: TEST_MEMORY_SUBMITTER,
    });
    await expect(memoryCard).toBeVisible();
    await memoryCard.getByRole("button", { name: "Accept" }).click();

    // Card disappears from the review queue after acceptance
    await expect(memoryCard).not.toBeVisible();

    // Navigate to the memorial page and verify the accepted memory is shown
    await page.goto(`/en/memorial/${TEST_MEMORIAL_SLUG}`);

    await expect(page.getByRole("heading", { name: "Shared Memories" })).toBeVisible();
    await expect(page.getByText(TEST_MEMORY_TEXT)).toBeVisible();
  });
});

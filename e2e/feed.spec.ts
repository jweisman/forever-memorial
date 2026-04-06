import { test, expect } from "@playwright/test";
import { TEST_MEMORIAL_NAME } from "./test-ids";

// ---------------------------------------------------------------------------
// Authenticated tests (uses storageState from global-setup)
// ---------------------------------------------------------------------------

test.describe("Feed page — authenticated", () => {
  test("visiting / redirects to /feed", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/feed/);
  });

  test("shows the legacies I follow section", async ({ page }) => {
    await page.goto("/en/feed");
    await expect(page.getByRole("heading", { name: /legacies i follow/i })).toBeVisible();
  });

  test("shows the seeded memorial in Latest Legacy Pages", async ({ page }) => {
    await page.goto("/en/feed");
    await expect(page.getByText(TEST_MEMORIAL_NAME)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated tests
// ---------------------------------------------------------------------------

test.describe("Feed page — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects unauthenticated users away from /feed", async ({ page }) => {
    await page.goto("/en/feed");
    await page.waitForURL((url) => !url.pathname.includes("/feed"), { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/feed/);
  });
});

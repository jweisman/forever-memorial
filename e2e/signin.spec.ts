import { test, expect } from "@playwright/test";

// Sign-in page UI — no auth needed
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-in page", () => {
  test("renders the email input and Send magic link button", async ({ page }) => {
    await page.goto("/en/auth/signin");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("renders the Google sign-in button", async ({ page }) => {
    await page.goto("/en/auth/signin");

    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });
});

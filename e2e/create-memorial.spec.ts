import { test, expect } from "@playwright/test";

// Uses storageState from global-setup (authenticated as TEST_USER)

let createdMemorialId: string | null = null;

test.describe("Create memorial", () => {
  test.afterAll(async ({ request }) => {
    // Clean up the memorial created during the test
    if (createdMemorialId) {
      await request.delete(`/api/memorials/${createdMemorialId}`);
    }
  });

  test("creates a memorial and lands on its page as the owner", async ({ page, request }) => {
    await page.goto("/en/dashboard/create");

    await expect(page.getByRole("heading", { name: "Create a Legacy" })).toBeVisible();

    // Fill required fields
    await page.locator("#create-name").fill("Playwright Test Memorial");
    await page.locator("#create-date-of-death").fill("2023-06-20");

    // Intercept the POST /api/memorials response to capture the created ID
    const responsePromise = page.waitForResponse((r) =>
      r.url().includes("/api/memorials") && r.request().method() === "POST"
    );

    await page.getByRole("button", { name: "Create Legacy" }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    createdMemorialId = body.id;

    // Should redirect to the new memorial page
    await page.waitForURL(/\/en\/memorial\//);
    await expect(page.getByRole("heading", { name: "Playwright Test Memorial" })).toBeVisible();

    // Owner sees the Edit Memorial link
    await expect(page.getByRole("link", { name: /edit legacy/i })).toBeVisible();
  });
});

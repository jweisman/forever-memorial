import pg from "pg";
import { encode } from "@auth/core/jwt";
import fs from "fs/promises";
import path from "path";
import {
  TEST_USER_ID,
  TEST_MEMORIAL_ID,
  TEST_MEMORIAL_SLUG,
  TEST_MEMORIAL_NAME,
  TEST_MEMORY_ID,
  TEST_MEMORY_TEXT,
  TEST_MEMORY_SUBMITTER,
} from "./test-ids";

async function globalSetup() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean up any stale data from a previous run
    await pool.query(`DELETE FROM memories WHERE id = $1`, [TEST_MEMORY_ID]);
    await pool.query(`DELETE FROM memorials WHERE id = $1`, [TEST_MEMORIAL_ID]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);

    // Seed test user
    await pool.query(
      `INSERT INTO users (id, email, name, "updatedAt")
       VALUES ($1, $2, $3, NOW())`,
      [TEST_USER_ID, "e2e-test@example.com", "E2E Test User"]
    );

    // Seed test memorial (no images/eulogies — avoids S3 dependency)
    await pool.query(
      `INSERT INTO memorials (id, slug, "ownerId", name, "dateOfDeath", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [TEST_MEMORIAL_ID, TEST_MEMORIAL_SLUG, TEST_USER_ID, TEST_MEMORIAL_NAME, "2024-01-15"]
    );

    // Seed a pending memory (for the review test)
    await pool.query(
      `INSERT INTO memories (id, "memorialId", "submitterId", name, text, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [TEST_MEMORY_ID, TEST_MEMORIAL_ID, TEST_USER_ID, TEST_MEMORY_SUBMITTER, TEST_MEMORY_TEXT]
    );
  } finally {
    await pool.end();
  }

  // Mint a JWT session cookie for the test user.
  // The salt must match Auth.js v5's cookie name for HTTP (dev).
  const token = await encode({
    token: {
      sub: TEST_USER_ID,
      id: TEST_USER_ID,
      role: "USER",
      disabled: false,
      checkedAt: Date.now(),
    },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });

  // Write the Playwright storageState file
  const authDir = path.join(process.cwd(), "e2e", ".auth");
  await fs.mkdir(authDir, { recursive: true });
  await fs.writeFile(
    path.join(authDir, "user.json"),
    JSON.stringify({
      cookies: [
        {
          name: "authjs.session-token",
          value: token,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    })
  );
}

export default globalSetup;

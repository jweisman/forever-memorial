import pg from "pg";
import { TEST_USER_ID, TEST_MEMORIAL_ID, TEST_MEMORY_ID } from "./test-ids";

async function globalTeardown() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`DELETE FROM memories WHERE id = $1`, [TEST_MEMORY_ID]);
    await pool.query(`DELETE FROM memorials WHERE id = $1`, [TEST_MEMORIAL_ID]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);
  } finally {
    await pool.end();
  }
}

export default globalTeardown;

// Stable IDs and slugs for test data seeded in global-setup.
// Imported by global-setup, global-teardown, and spec files.

// IDs must be exactly 25 characters to match Prisma CUID length.
// The memorial page uses parseIdFromSlug() which does slug.slice(0, 25).
export const TEST_USER_ID = "ce2etestuser0000000000001";     // 25 chars
export const TEST_MEMORIAL_ID = "ce2etestmemorial000000001"; // 25 chars
export const TEST_MEMORIAL_SLUG = "ce2etestmemorial000000001-jane-e2e-doe";
export const TEST_MEMORIAL_NAME = "Jane E2E Doe";
export const TEST_MEMORY_ID = "ce2etestmemory00000000001"; // 25 chars
export const TEST_MEMORY_TEXT = "A wonderful person who touched many lives.";
export const TEST_MEMORY_SUBMITTER = "E2E Submitter";

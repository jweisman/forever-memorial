-- DropIndex
DROP INDEX "memorials_name_trgm_idx";

-- AlterTable
ALTER TABLE "memorials" ADD COLUMN     "deathAfterSunset" BOOLEAN NOT NULL DEFAULT false;

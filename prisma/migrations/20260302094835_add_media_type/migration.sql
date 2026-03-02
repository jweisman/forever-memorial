-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE';

-- AlterTable
ALTER TABLE "memory_images" ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE';

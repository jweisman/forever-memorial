-- AlterTable
ALTER TABLE "memorials" ADD COLUMN     "projects" TEXT;

-- CreateTable
CREATE TABLE "memorial_links" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memorial_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "memorial_links" ADD CONSTRAINT "memorial_links_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "memorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

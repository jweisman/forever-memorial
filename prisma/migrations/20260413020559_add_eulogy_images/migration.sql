-- CreateTable
CREATE TABLE "eulogy_images" (
    "id" TEXT NOT NULL,
    "eulogyId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eulogy_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "eulogy_images" ADD CONSTRAINT "eulogy_images_eulogyId_fkey" FOREIGN KEY ("eulogyId") REFERENCES "eulogies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

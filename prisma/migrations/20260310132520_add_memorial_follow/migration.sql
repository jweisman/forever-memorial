-- CreateTable
CREATE TABLE "memorial_follows" (
    "userId" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memorial_follows_pkey" PRIMARY KEY ("userId","memorialId")
);

-- AddForeignKey
ALTER TABLE "memorial_follows" ADD CONSTRAINT "memorial_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memorial_follows" ADD CONSTRAINT "memorial_follows_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "memorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED', 'RETURNED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "memorials" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memorialPicture" TEXT,
    "birthday" TIMESTAMP(3),
    "dateOfDeath" TIMESTAMP(3) NOT NULL,
    "placeOfDeath" TEXT,
    "funeralInfo" TEXT,
    "survivedBy" TEXT,
    "lifeStory" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memorials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eulogies" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "deliveredBy" TEXT NOT NULL,
    "relation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eulogies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "withholdName" BOOLEAN NOT NULL DEFAULT false,
    "relation" TEXT,
    "text" TEXT NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'PENDING',
    "returnMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_images" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "memorials_slug_key" ON "memorials"("slug");

-- CreateIndex
CREATE INDEX "memorials_name_idx" ON "memorials"("name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memorials" ADD CONSTRAINT "memorials_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "memorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eulogies" ADD CONSTRAINT "eulogies_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "memorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "memorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_images" ADD CONSTRAINT "memory_images_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

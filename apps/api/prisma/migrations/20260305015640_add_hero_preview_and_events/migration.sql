-- CreateEnum
CREATE TYPE "HeroEventType" AS ENUM ('IMPRESSION', 'CLICK');

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "heroPreviewUrl" TEXT;

-- CreateTable
CREATE TABLE "HeroEvent" (
    "id" TEXT NOT NULL,
    "eventType" "HeroEventType" NOT NULL,
    "platform" TEXT NOT NULL,
    "path" TEXT,
    "sessionId" TEXT,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeroEvent_eventType_createdAt_idx" ON "HeroEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "HeroEvent_platform_createdAt_idx" ON "HeroEvent"("platform", "createdAt");

-- CreateIndex
CREATE INDEX "HeroEvent_contentId_createdAt_idx" ON "HeroEvent"("contentId", "createdAt");

-- AddForeignKey
ALTER TABLE "HeroEvent" ADD CONSTRAINT "HeroEvent_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

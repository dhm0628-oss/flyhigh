-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('WEB', 'ROKU', 'FIRE_TV', 'IOS', 'ANDROID', 'OTHER');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('ONESIGNAL');

-- CreateEnum
CREATE TYPE "PushCampaignStatus" AS ENUM ('SENT', 'FAILED', 'QUEUED');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "platform" "PushPlatform" NOT NULL,
    "provider" "PushProvider" NOT NULL DEFAULT 'ONESIGNAL',
    "token" TEXT NOT NULL,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "deeplinkUrl" TEXT,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" "PushProvider" NOT NULL DEFAULT 'ONESIGNAL',
    "requestedById" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_platform_isActive_idx" ON "PushDevice"("platform", "isActive");

-- CreateIndex
CREATE INDEX "PushDevice_userId_isActive_idx" ON "PushDevice"("userId", "isActive");

-- CreateIndex
CREATE INDEX "PushCampaign_status_createdAt_idx" ON "PushCampaign"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

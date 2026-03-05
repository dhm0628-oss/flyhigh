-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE', 'MUX');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "WebhookEventLog" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "payloadJson" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEventLog_provider_createdAt_idx" ON "WebhookEventLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEventLog_status_createdAt_idx" ON "WebhookEventLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEventLog_externalId_idx" ON "WebhookEventLog"("externalId");

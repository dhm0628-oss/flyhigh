-- Flyhigh API combined Prisma migrations
-- Generated: 2026-03-10T22:27:10.4987155-04:00


-- >>> BEGIN 20260224225123_init/migration.sql

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('FILM', 'SERIES', 'EPISODE', 'TRAILER', 'BONUS');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerPriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "playbackUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "releaseYear" INTEGER,
    "tags" TEXT[],
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_slug_key" ON "ContentItem"("slug");

-- CreateIndex
CREATE INDEX "ContentItem_publishStatus_publishedAt_idx" ON "ContentItem"("publishStatus", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_key_key" ON "Collection"("key");

-- CreateIndex
CREATE INDEX "Collection_isActive_isPublic_sortOrder_idx" ON "Collection"("isActive", "isPublic", "sortOrder");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_sortOrder_idx" ON "CollectionItem"("collectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_contentId_key" ON "CollectionItem"("collectionId", "contentId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- <<< END 20260224225123_init/migration.sql


-- >>> BEGIN 20260225031413_add_mux_video_fields/migration.sql

/*
  Warnings:

  - A unique constraint covering the columns `[muxUploadId]` on the table `ContentItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[muxAssetId]` on the table `ContentItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[muxPlaybackId]` on the table `ContentItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "muxAssetId" TEXT,
ADD COLUMN     "muxPlaybackId" TEXT,
ADD COLUMN     "muxUploadId" TEXT,
ADD COLUMN     "videoError" TEXT,
ADD COLUMN     "videoProvider" TEXT,
ADD COLUMN     "videoStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_muxUploadId_key" ON "ContentItem"("muxUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_muxAssetId_key" ON "ContentItem"("muxAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_muxPlaybackId_key" ON "ContentItem"("muxPlaybackId");

-- <<< END 20260225031413_add_mux_video_fields/migration.sql


-- >>> BEGIN 20260225173354_add_device_login_sessions/migration.sql

-- CreateEnum
CREATE TYPE "DeviceLoginStatus" AS ENUM ('PENDING', 'APPROVED', 'CONSUMED', 'EXPIRED', 'DENIED');

-- CreateTable
CREATE TABLE "DeviceLoginSession" (
    "id" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" "DeviceLoginStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "userAgent" TEXT,
    "clientName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLoginSession_userCode_key" ON "DeviceLoginSession"("userCode");

-- CreateIndex
CREATE INDEX "DeviceLoginSession_status_expiresAt_idx" ON "DeviceLoginSession"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceLoginSession" ADD CONSTRAINT "DeviceLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- <<< END 20260225173354_add_device_login_sessions/migration.sql


-- >>> BEGIN 20260225224639_add_watch_progress/migration.sql

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchProgress_userId_lastPlayedAt_idx" ON "WatchProgress"("userId", "lastPlayedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_contentId_key" ON "WatchProgress"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- <<< END 20260225224639_add_watch_progress/migration.sql


-- >>> BEGIN 20260226230021_add_my_list/migration.sql

-- CreateTable
CREATE TABLE "MyListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MyListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MyListItem_userId_createdAt_idx" ON "MyListItem"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MyListItem_userId_contentId_key" ON "MyListItem"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "MyListItem" ADD CONSTRAINT "MyListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyListItem" ADD CONSTRAINT "MyListItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- <<< END 20260226230021_add_my_list/migration.sql


-- >>> BEGIN 20260227100000_add_content_author/migration.sql

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "author" TEXT;

-- CreateIndex
CREATE INDEX "ContentItem_author_idx" ON "ContentItem"("author");

-- <<< END 20260227100000_add_content_author/migration.sql


-- >>> BEGIN 20260227155811_add_coupons_and_trials/migration.sql

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'FREE_TRIAL');

-- CreateEnum
CREATE TYPE "CouponDuration" AS ENUM ('ONCE', 'REPEATING', 'FOREVER');

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "duration" "CouponDuration" NOT NULL DEFAULT 'ONCE',
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "trialDays" INTEGER,
    "durationInMonths" INTEGER,
    "maxRedemptions" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeCouponId" TEXT,
    "stripePromotionCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_stripeCouponId_key" ON "Coupon"("stripeCouponId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_stripePromotionCodeId_key" ON "Coupon"("stripePromotionCodeId");

-- CreateIndex
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_stripeCheckoutSessionId_key" ON "CouponRedemption"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_createdAt_idx" ON "CouponRedemption"("couponId", "createdAt");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_createdAt_idx" ON "CouponRedemption"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- <<< END 20260227155811_add_coupons_and_trials/migration.sql


-- >>> BEGIN 20260227163240_add_push_notifications_marketing/migration.sql

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

-- <<< END 20260227163240_add_push_notifications_marketing/migration.sql


-- >>> BEGIN 20260301040855_add_gift_cards/migration.sql

-- CreateEnum
CREATE TYPE "GiftCardPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'VOID');

-- CreateTable
CREATE TABLE "GiftCardProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "durationMonths" INTEGER NOT NULL DEFAULT 1,
    "stripePriceId" TEXT,
    "planId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCardProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardPurchase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaserName" TEXT NOT NULL,
    "purchaserEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "message" TEXT,
    "status" "GiftCardPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSessionId" TEXT,
    "giftCardId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardProduct_code_key" ON "GiftCardProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardProduct_stripePriceId_key" ON "GiftCardProduct"("stripePriceId");

-- CreateIndex
CREATE INDEX "GiftCardProduct_isActive_createdAt_idx" ON "GiftCardProduct"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardPurchase_stripeCheckoutSessionId_key" ON "GiftCardPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardPurchase_giftCardId_key" ON "GiftCardPurchase"("giftCardId");

-- CreateIndex
CREATE INDEX "GiftCardPurchase_status_createdAt_idx" ON "GiftCardPurchase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCardPurchase_productId_createdAt_idx" ON "GiftCardPurchase"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_purchaseId_key" ON "GiftCard"("purchaseId");

-- CreateIndex
CREATE INDEX "GiftCard_status_createdAt_idx" ON "GiftCard"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCard_redeemedByUserId_redeemedAt_idx" ON "GiftCard"("redeemedByUserId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "GiftCardProduct" ADD CONSTRAINT "GiftCardProduct_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardPurchase" ADD CONSTRAINT "GiftCardPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GiftCardProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GiftCardProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GiftCardPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- <<< END 20260301040855_add_gift_cards/migration.sql


-- >>> BEGIN 20260302014802_add_webhook_event_logs/migration.sql

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

-- <<< END 20260302014802_add_webhook_event_logs/migration.sql


-- >>> BEGIN 20260305015640_add_hero_preview_and_events/migration.sql

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

-- <<< END 20260305015640_add_hero_preview_and_events/migration.sql


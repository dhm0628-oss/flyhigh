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

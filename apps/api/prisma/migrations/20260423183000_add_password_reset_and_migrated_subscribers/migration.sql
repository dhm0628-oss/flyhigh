-- CreateEnum
CREATE TYPE "MigratedSubscriberStatus" AS ENUM ('IMPORTED', 'RESET_REQUIRED', 'CLAIMED', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigratedSubscriber" (
    "id" TEXT NOT NULL,
    "uscreenUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "uscreenStatus" TEXT,
    "uscreenPlanName" TEXT,
    "uscreenNextInvoiceDate" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeStatus" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "couponCode" TEXT,
    "status" "MigratedSubscriberStatus" NOT NULL DEFAULT 'IMPORTED',
    "flyhighUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigratedSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_usedAt_idx" ON "PasswordResetToken"("expiresAt", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MigratedSubscriber_uscreenUserId_key" ON "MigratedSubscriber"("uscreenUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MigratedSubscriber_email_key" ON "MigratedSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MigratedSubscriber_stripeSubscriptionId_key" ON "MigratedSubscriber"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "MigratedSubscriber_flyhighUserId_key" ON "MigratedSubscriber"("flyhighUserId");

-- CreateIndex
CREATE INDEX "MigratedSubscriber_email_status_idx" ON "MigratedSubscriber"("email", "status");

-- CreateIndex
CREATE INDEX "MigratedSubscriber_stripeCustomerId_idx" ON "MigratedSubscriber"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigratedSubscriber" ADD CONSTRAINT "MigratedSubscriber_flyhighUserId_fkey" FOREIGN KEY ("flyhighUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

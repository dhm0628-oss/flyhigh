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

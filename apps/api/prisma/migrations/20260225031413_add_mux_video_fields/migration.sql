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

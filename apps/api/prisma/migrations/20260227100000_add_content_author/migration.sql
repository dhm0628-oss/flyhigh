-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "author" TEXT;

-- CreateIndex
CREATE INDEX "ContentItem_author_idx" ON "ContentItem"("author");

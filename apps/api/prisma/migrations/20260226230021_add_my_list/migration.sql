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

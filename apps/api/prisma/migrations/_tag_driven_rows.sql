ALTER TABLE "Collection"
ADD COLUMN IF NOT EXISTS "sourceTag" TEXT;

ALTER TABLE "Collection"
ADD COLUMN IF NOT EXISTS "sourceLimit" INTEGER NOT NULL DEFAULT 24;

UPDATE "Collection"
SET "sourceLimit" = 24
WHERE "sourceLimit" IS NULL;

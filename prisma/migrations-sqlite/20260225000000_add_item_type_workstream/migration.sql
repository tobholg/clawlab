-- Add itemType column (SQLite stores enums as TEXT)
ALTER TABLE "items"
ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'TASK';

-- Backfill existing structural containers
UPDATE "items"
SET "itemType" = 'WORKSTREAM'
WHERE "parentId" IS NULL
   OR EXISTS (
     SELECT 1
     FROM "items" c
     WHERE c."parentId" = "items"."id"
   );

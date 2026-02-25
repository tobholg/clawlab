-- Add ItemType enum for distinguishing actionable tasks from structural containers
CREATE TYPE "ItemType" AS ENUM ('TASK', 'WORKSTREAM');

ALTER TABLE "items"
ADD COLUMN "itemType" "ItemType" NOT NULL DEFAULT 'TASK';

-- Backfill existing structural containers
UPDATE "items" i
SET "itemType" = 'WORKSTREAM'
WHERE i."parentId" IS NULL
   OR EXISTS (
     SELECT 1
     FROM "items" c
     WHERE c."parentId" = i."id"
   );

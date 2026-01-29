-- AlterTable
ALTER TABLE "items" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "items_projectId_idx" ON "items"("projectId");

-- CreateIndex
CREATE INDEX "items_completedAt_idx" ON "items"("completedAt");

-- CreateEnum
CREATE TYPE "AgentMode" AS ENUM ('PLAN', 'EXECUTE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agentProvider" TEXT,
ADD COLUMN     "apiKeyHash" TEXT,
ADD COLUMN     "isAgent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "acceptedPlanVersion" INTEGER,
ADD COLUMN     "agentMode" "AgentMode",
ADD COLUMN     "planDocId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_apiKeyHash_key" ON "users"("apiKeyHash");

-- CreateIndex
CREATE INDEX "items_planDocId_idx" ON "items"("planDocId");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_planDocId_fkey" FOREIGN KEY ("planDocId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

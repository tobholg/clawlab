-- AlterEnum
ALTER TYPE "AgentMode" ADD VALUE 'COMPLETED';

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "branch" TEXT,
    "filesChanged" INTEGER NOT NULL DEFAULT 0,
    "insertions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "diffSummary" JSONB,
    "itemId" TEXT NOT NULL,
    "sessionId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commits_itemId_idx" ON "commits"("itemId");

-- CreateIndex
CREATE INDEX "commits_authorId_idx" ON "commits"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "commits_sha_itemId_key" ON "commits"("sha", "itemId");

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

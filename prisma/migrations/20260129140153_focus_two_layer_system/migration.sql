/*
  Warnings:

  - You are about to drop the column `itemId` on the `focus_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `currentFocusItemId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `currentFocusStartedAt` on the `users` table. All the data in the column will be lost.
  - Added the required column `activityType` to the `focus_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FocusLane" AS ENUM ('GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK');

-- CreateEnum
CREATE TYPE "FocusActivityType" AS ENUM ('TASK', 'LANE');

-- CreateEnum
CREATE TYPE "FocusEndReason" AS ENUM ('COMPLETED', 'SWITCHED', 'MANUAL_EXIT', 'DAY_END');

-- DropForeignKey
ALTER TABLE "focus_sessions" DROP CONSTRAINT "focus_sessions_itemId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_currentFocusItemId_fkey";

-- DropIndex
DROP INDEX "focus_sessions_itemId_idx";

-- AlterTable
ALTER TABLE "focus_sessions" DROP COLUMN "itemId",
ADD COLUMN     "activityType" "FocusActivityType" NOT NULL,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "commentedAt" TIMESTAMP(3),
ADD COLUMN     "endReason" "FocusEndReason",
ADD COLUMN     "lane" "FocusLane",
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "currentFocusItemId",
DROP COLUMN "currentFocusStartedAt",
ADD COLUMN     "currentActivityStart" TIMESTAMP(3),
ADD COLUMN     "currentLaneFocus" "FocusLane",
ADD COLUMN     "currentProjectFocusId" TEXT,
ADD COLUMN     "currentProjectFocusStart" TIMESTAMP(3),
ADD COLUMN     "currentTaskFocusId" TEXT;

-- CreateIndex
CREATE INDEX "focus_sessions_taskId_idx" ON "focus_sessions"("taskId");

-- CreateIndex
CREATE INDEX "focus_sessions_projectId_idx" ON "focus_sessions"("projectId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentProjectFocusId_fkey" FOREIGN KEY ("currentProjectFocusId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentTaskFocusId_fkey" FOREIGN KEY ("currentTaskFocusId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "IRType" AS ENUM ('QUESTION', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "IRStatus" AS ENUM ('PENDING', 'ANSWERED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ExternalTaskStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_INFO');

-- CreateTable
CREATE TABLE "external_spaces" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "maxIRsPer24h" INTEGER NOT NULL DEFAULT 10,
    "allowTaskSubmission" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholder_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalSpaceId" TEXT NOT NULL,
    "canSubmitTasks" BOOLEAN,
    "maxIRsPer24h" INTEGER,
    "displayName" TEXT,
    "position" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT NOT NULL,

    CONSTRAINT "stakeholder_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_requests" (
    "id" TEXT NOT NULL,
    "externalSpaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "IRType" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "IRStatus" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "votes" JSONB NOT NULL DEFAULT '[]',
    "convertedToTaskId" TEXT,
    "addedToAIContext" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "information_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_tasks" (
    "id" TEXT NOT NULL,
    "externalSpaceId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ExternalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "linkedTaskId" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_comments" (
    "id" TEXT NOT NULL,
    "externalTaskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_context_docs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_context_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_spaces_projectId_idx" ON "external_spaces"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "external_spaces_projectId_slug_key" ON "external_spaces"("projectId", "slug");

-- CreateIndex
CREATE INDEX "stakeholder_access_externalSpaceId_idx" ON "stakeholder_access"("externalSpaceId");

-- CreateIndex
CREATE INDEX "stakeholder_access_userId_idx" ON "stakeholder_access"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stakeholder_access_userId_externalSpaceId_key" ON "stakeholder_access"("userId", "externalSpaceId");

-- CreateIndex
CREATE UNIQUE INDEX "information_requests_convertedToTaskId_key" ON "information_requests"("convertedToTaskId");

-- CreateIndex
CREATE INDEX "information_requests_externalSpaceId_idx" ON "information_requests"("externalSpaceId");

-- CreateIndex
CREATE INDEX "information_requests_createdById_idx" ON "information_requests"("createdById");

-- CreateIndex
CREATE INDEX "information_requests_status_idx" ON "information_requests"("status");

-- CreateIndex
CREATE INDEX "information_requests_createdAt_idx" ON "information_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_tasks_linkedTaskId_key" ON "external_tasks"("linkedTaskId");

-- CreateIndex
CREATE INDEX "external_tasks_externalSpaceId_idx" ON "external_tasks"("externalSpaceId");

-- CreateIndex
CREATE INDEX "external_tasks_submittedById_idx" ON "external_tasks"("submittedById");

-- CreateIndex
CREATE INDEX "external_tasks_status_idx" ON "external_tasks"("status");

-- CreateIndex
CREATE INDEX "external_tasks_createdAt_idx" ON "external_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "external_comments_externalTaskId_idx" ON "external_comments"("externalTaskId");

-- CreateIndex
CREATE INDEX "external_comments_authorId_idx" ON "external_comments"("authorId");

-- CreateIndex
CREATE INDEX "ai_context_docs_projectId_idx" ON "ai_context_docs"("projectId");

-- AddForeignKey
ALTER TABLE "external_spaces" ADD CONSTRAINT "external_spaces_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_access" ADD CONSTRAINT "stakeholder_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_access" ADD CONSTRAINT "stakeholder_access_externalSpaceId_fkey" FOREIGN KEY ("externalSpaceId") REFERENCES "external_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholder_access" ADD CONSTRAINT "stakeholder_access_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_externalSpaceId_fkey" FOREIGN KEY ("externalSpaceId") REFERENCES "external_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_convertedToTaskId_fkey" FOREIGN KEY ("convertedToTaskId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_tasks" ADD CONSTRAINT "external_tasks_externalSpaceId_fkey" FOREIGN KEY ("externalSpaceId") REFERENCES "external_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_tasks" ADD CONSTRAINT "external_tasks_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_tasks" ADD CONSTRAINT "external_tasks_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_comments" ADD CONSTRAINT "external_comments_externalTaskId_fkey" FOREIGN KEY ("externalTaskId") REFERENCES "external_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_comments" ADD CONSTRAINT "external_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_docs" ADD CONSTRAINT "ai_context_docs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_docs" ADD CONSTRAINT "ai_context_docs_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

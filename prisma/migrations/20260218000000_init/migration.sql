-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'INVITED', 'OCCUPIED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('FILE', 'LINK', 'EMBED');

-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "ItemComplexity" AS ENUM ('TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE', 'EPIC');

-- CreateEnum
CREATE TYPE "ItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AgentMode" AS ENUM ('PLAN', 'EXECUTE');

-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('IDLE', 'ACTIVE', 'AWAITING_REVIEW', 'TERMINATED');

-- CreateEnum
CREATE TYPE "FocusLane" AS ENUM ('GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK');

-- CreateEnum
CREATE TYPE "FocusActivityType" AS ENUM ('TASK', 'LANE');

-- CreateEnum
CREATE TYPE "FocusEndReason" AS ENUM ('COMPLETED', 'SWITCHED', 'MANUAL_EXIT', 'DAY_END');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGE', 'PROGRESS_UPDATE', 'ASSIGNMENT', 'COMMENT', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WORKSPACE', 'PROJECT', 'EXTERNAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ChannelVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ChannelRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "IRType" AS ENUM ('QUESTION', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "IRStatus" AS ENUM ('PENDING', 'ANSWERED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ExternalTaskStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_INFO');

-- CreateEnum
CREATE TYPE "SpaceUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "billingEmail" TEXT,
    "trialEndsAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "SeatType" NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "userId" TEXT,
    "occupiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_invites" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "workspaceId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '0000',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_monthly_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyHash" TEXT,
    "agentProvider" TEXT,
    "position" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentProjectFocusId" TEXT,
    "currentProjectFocusStart" TIMESTAMP(3),
    "currentTaskFocusId" TEXT,
    "currentLaneFocus" "FocusLane",
    "currentActivityStart" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '0000',
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "projectId" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'TODO',
    "subStatus" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "complexity" "ItemComplexity",
    "priority" "ItemPriority" DEFAULT 'MEDIUM',
    "agentMode" "AgentMode",
    "planDocId" TEXT,
    "acceptedPlanVersion" INTEGER,
    "repoUrl" TEXT,
    "repoPath" TEXT,
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'FILE',
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "itemId" TEXT,
    "messageId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "type" "VersionType" NOT NULL DEFAULT 'MINOR',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_assignments" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_stakeholders" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "item_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_dependencies" (
    "id" TEXT NOT NULL,
    "blockedItemId" TEXT NOT NULL,
    "blockingItemId" TEXT NOT NULL,

    CONSTRAINT "item_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "itemId" TEXT,
    "projectId" TEXT,
    "terminalId" TEXT,
    "checkedOutAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "activityType" "FocusActivityType" NOT NULL,
    "taskId" TEXT,
    "lane" "FocusLane",
    "projectId" TEXT,
    "endReason" "FocusEndReason",
    "comment" TEXT,
    "commentedAt" TIMESTAMP(3),

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "type" "ChannelType" NOT NULL DEFAULT 'CUSTOM',
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'PUBLIC',
    "inheritMembers" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_read_states" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChannelRole" NOT NULL DEFAULT 'MEMBER',
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "embeds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

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
    "externalTaskId" TEXT,
    "informationRequestId" TEXT,
    "authorId" TEXT NOT NULL,
    "isTeamMember" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE "space_updates" (
    "id" TEXT NOT NULL,
    "externalSpaceId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "status" "SpaceUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "risks" JSONB NOT NULL DEFAULT '[]',
    "wins" JSONB NOT NULL DEFAULT '[]',
    "projectSnapshot" JSONB,
    "aiModel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "seats_organizationId_type_status_idx" ON "seats"("organizationId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seat_invites_seatId_key" ON "seat_invites"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "seat_invites_token_key" ON "seat_invites"("token");

-- CreateIndex
CREATE INDEX "seat_invites_token_idx" ON "seat_invites"("token");

-- CreateIndex
CREATE INDEX "seat_invites_organizationId_status_idx" ON "seat_invites"("organizationId", "status");

-- CreateIndex
CREATE INDEX "seat_invites_email_organizationId_idx" ON "seat_invites"("email", "organizationId");

-- CreateIndex
CREATE INDEX "user_monthly_usage_organizationId_month_idx" ON "user_monthly_usage"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "user_monthly_usage_organizationId_userId_month_key" ON "user_monthly_usage"("organizationId", "userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_apiKeyHash_key" ON "users"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_key" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "magic_link_tokens_token_idx" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "magic_link_tokens_expiresAt_idx" ON "magic_link_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_organizationId_idx" ON "workspaces"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "items_workspaceId_idx" ON "items"("workspaceId");

-- CreateIndex
CREATE INDEX "items_parentId_idx" ON "items"("parentId");

-- CreateIndex
CREATE INDEX "items_projectId_idx" ON "items"("projectId");

-- CreateIndex
CREATE INDEX "items_ownerId_idx" ON "items"("ownerId");

-- CreateIndex
CREATE INDEX "items_planDocId_idx" ON "items"("planDocId");

-- CreateIndex
CREATE INDEX "items_status_idx" ON "items"("status");

-- CreateIndex
CREATE INDEX "items_lastActivityAt_idx" ON "items"("lastActivityAt");

-- CreateIndex
CREATE INDEX "items_completedAt_idx" ON "items"("completedAt");

-- CreateIndex
CREATE INDEX "attachments_itemId_idx" ON "attachments"("itemId");

-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- CreateIndex
CREATE INDEX "attachments_uploadedById_idx" ON "attachments"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_itemId_idx" ON "documents"("itemId");

-- CreateIndex
CREATE INDEX "documents_projectId_idx" ON "documents"("projectId");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

-- CreateIndex
CREATE INDEX "item_assignments_userId_idx" ON "item_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "item_assignments_itemId_userId_key" ON "item_assignments"("itemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "item_stakeholders_itemId_userId_key" ON "item_stakeholders"("itemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "item_dependencies_blockedItemId_blockingItemId_key" ON "item_dependencies"("blockedItemId", "blockingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_terminalId_key" ON "agent_sessions"("terminalId");

-- CreateIndex
CREATE INDEX "agent_sessions_agentId_idx" ON "agent_sessions"("agentId");

-- CreateIndex
CREATE INDEX "agent_sessions_itemId_idx" ON "agent_sessions"("itemId");

-- CreateIndex
CREATE INDEX "agent_sessions_terminalId_idx" ON "agent_sessions"("terminalId");

-- CreateIndex
CREATE INDEX "focus_sessions_userId_idx" ON "focus_sessions"("userId");

-- CreateIndex
CREATE INDEX "focus_sessions_taskId_idx" ON "focus_sessions"("taskId");

-- CreateIndex
CREATE INDEX "focus_sessions_projectId_idx" ON "focus_sessions"("projectId");

-- CreateIndex
CREATE INDEX "focus_sessions_startedAt_idx" ON "focus_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "activities_itemId_idx" ON "activities"("itemId");

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "comments_itemId_idx" ON "comments"("itemId");

-- CreateIndex
CREATE INDEX "comments_parentCommentId_idx" ON "comments"("parentCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_projectId_key" ON "channels"("projectId");

-- CreateIndex
CREATE INDEX "channels_workspaceId_idx" ON "channels"("workspaceId");

-- CreateIndex
CREATE INDEX "channels_parentId_idx" ON "channels"("parentId");

-- CreateIndex
CREATE INDEX "channels_projectId_idx" ON "channels"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspaceId_name_key" ON "channels"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "channel_read_states_userId_idx" ON "channel_read_states"("userId");

-- CreateIndex
CREATE INDEX "channel_read_states_channelId_idx" ON "channel_read_states"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_read_states_channelId_userId_key" ON "channel_read_states"("channelId", "userId");

-- CreateIndex
CREATE INDEX "channel_members_channelId_idx" ON "channel_members"("channelId");

-- CreateIndex
CREATE INDEX "channel_members_userId_idx" ON "channel_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channelId_userId_key" ON "channel_members"("channelId", "userId");

-- CreateIndex
CREATE INDEX "messages_channelId_createdAt_idx" ON "messages"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_parentId_idx" ON "messages"("parentId");

-- CreateIndex
CREATE INDEX "message_mentions_userId_messageId_idx" ON "message_mentions"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_mentions_messageId_userId_key" ON "message_mentions"("messageId", "userId");

-- CreateIndex
CREATE INDEX "reactions_messageId_idx" ON "reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_messageId_userId_emoji_key" ON "reactions"("messageId", "userId", "emoji");

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
CREATE INDEX "external_comments_informationRequestId_idx" ON "external_comments"("informationRequestId");

-- CreateIndex
CREATE INDEX "external_comments_authorId_idx" ON "external_comments"("authorId");

-- CreateIndex
CREATE INDEX "ai_context_docs_projectId_idx" ON "ai_context_docs"("projectId");

-- CreateIndex
CREATE INDEX "space_updates_externalSpaceId_status_idx" ON "space_updates"("externalSpaceId", "status");

-- CreateIndex
CREATE INDEX "space_updates_externalSpaceId_createdAt_idx" ON "space_updates"("externalSpaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_invites" ADD CONSTRAINT "seat_invites_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_invites" ADD CONSTRAINT "seat_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_invites" ADD CONSTRAINT "seat_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_invites" ADD CONSTRAINT "seat_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentProjectFocusId_fkey" FOREIGN KEY ("currentProjectFocusId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentTaskFocusId_fkey" FOREIGN KEY ("currentTaskFocusId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_planDocId_fkey" FOREIGN KEY ("planDocId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stakeholders" ADD CONSTRAINT "item_stakeholders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_stakeholders" ADD CONSTRAINT "item_stakeholders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_blockedItemId_fkey" FOREIGN KEY ("blockedItemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_blockingItemId_fkey" FOREIGN KEY ("blockingItemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "external_comments" ADD CONSTRAINT "external_comments_informationRequestId_fkey" FOREIGN KEY ("informationRequestId") REFERENCES "information_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_comments" ADD CONSTRAINT "external_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_docs" ADD CONSTRAINT "ai_context_docs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_docs" ADD CONSTRAINT "ai_context_docs_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_updates" ADD CONSTRAINT "space_updates_externalSpaceId_fkey" FOREIGN KEY ("externalSpaceId") REFERENCES "external_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_updates" ADD CONSTRAINT "space_updates_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


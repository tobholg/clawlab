-- Catch-up migration for tables/columns/enums added via db push
-- that were never captured in a migration file.

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'INVITED', 'OCCUPIED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SpaceUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

-- AlterTable: organizations
ALTER TABLE "organizations" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "organizations" ADD COLUMN "billingEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

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
CREATE TABLE "space_updates" (
    "id" TEXT NOT NULL,
    "externalSpaceId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "status" "SpaceUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "risks" JSONB DEFAULT '[]',
    "wins" JSONB DEFAULT '[]',
    "projectSnapshot" JSONB,
    "aiModel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seats_organizationId_type_status_idx" ON "seats"("organizationId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seat_invites_seatId_key" ON "seat_invites"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "seat_invites_token_key" ON "seat_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_monthly_usage_organizationId_userId_month_key" ON "user_monthly_usage"("organizationId", "userId", "month");

-- CreateIndex
CREATE INDEX "user_monthly_usage_organizationId_month_idx" ON "user_monthly_usage"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "channel_read_states_channelId_userId_key" ON "channel_read_states"("channelId", "userId");

-- CreateIndex
CREATE INDEX "channel_read_states_userId_idx" ON "channel_read_states"("userId");

-- CreateIndex
CREATE INDEX "channel_read_states_channelId_idx" ON "channel_read_states"("channelId");

-- CreateIndex
CREATE INDEX "space_updates_externalSpaceId_idx" ON "space_updates"("externalSpaceId");

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
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_read_states" ADD CONSTRAINT "channel_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_updates" ADD CONSTRAINT "space_updates_externalSpaceId_fkey" FOREIGN KEY ("externalSpaceId") REFERENCES "external_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_updates" ADD CONSTRAINT "space_updates_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

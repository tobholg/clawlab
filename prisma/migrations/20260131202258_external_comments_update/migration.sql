-- AlterTable
ALTER TABLE "external_comments" ADD COLUMN     "informationRequestId" TEXT,
ADD COLUMN     "isTeamMember" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "externalTaskId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "external_comments_informationRequestId_idx" ON "external_comments"("informationRequestId");

-- AddForeignKey
ALTER TABLE "external_comments" ADD CONSTRAINT "external_comments_informationRequestId_fkey" FOREIGN KEY ("informationRequestId") REFERENCES "information_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

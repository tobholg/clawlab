-- Add message ownership for attachments
ALTER TABLE "attachments" ADD COLUMN "messageId" TEXT;

-- Add lookup index for message attachments
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- Add relation to messages
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing AI proposal payloads under a clearer field name
ALTER TABLE "messages" RENAME COLUMN "attachments" TO "embeds";

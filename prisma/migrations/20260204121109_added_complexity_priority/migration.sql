-- CreateEnum
CREATE TYPE "ItemComplexity" AS ENUM ('TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE', 'EPIC');

-- CreateEnum
CREATE TYPE "ItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "complexity" "ItemComplexity",
ADD COLUMN     "priority" "ItemPriority" DEFAULT 'MEDIUM';

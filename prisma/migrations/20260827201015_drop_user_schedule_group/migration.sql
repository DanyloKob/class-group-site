-- DropIndex
DROP INDEX "User_scheduleGroup_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "scheduleGroup";

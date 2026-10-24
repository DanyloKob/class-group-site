-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "canManageNews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSchedule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTasks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "Role";

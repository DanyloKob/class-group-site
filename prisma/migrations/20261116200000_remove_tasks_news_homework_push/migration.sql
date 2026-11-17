-- Removes «Завдання» (tasks and fundraisers), «Оголошення» (news), «ДЗ» (homework),
-- web push notifications, the theme switch and the accent-colour picker.
-- Deleting this data is intentional and owner-approved (2026-11-16); production is
-- backed up before this migration is deployed.

-- Audit entries about content that no longer exists anywhere.
DELETE FROM "AuditLog" WHERE "entityType" IN ('Task', 'News', 'Homework');

-- Children before parents. DROP TABLE also drops each table's own indexes and FKs.
DROP TABLE "HomeworkLike";
DROP TABLE "Homework";
DROP TABLE "NewsLike";
DROP TABLE "NewsPost";
DROP TABLE "FundraiserEntry";
DROP TABLE "TaskCompletion";
DROP TABLE "Task";
DROP TABLE "PushSubscription";

-- Columns first, then the enum types they used.
ALTER TABLE "User"
  DROP COLUMN "theme",
  DROP COLUMN "accentColor",
  DROP COLUMN "notifyTasks",
  DROP COLUMN "notifyNews",
  DROP COLUMN "notifyHomework",
  DROP COLUMN "notifyMemories",
  DROP COLUMN "canManageTasks",
  DROP COLUMN "canManageNews",
  DROP COLUMN "canManageSchedule";

DROP TYPE "Theme";
DROP TYPE "TaskType";
DROP TYPE "PaymentStatus";

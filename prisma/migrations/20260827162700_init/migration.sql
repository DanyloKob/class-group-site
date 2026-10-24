-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ScheduleGroup" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "LoginStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PLAIN', 'FUNDRAISER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PAID_WITH_NOTE');

-- CreateEnum
CREATE TYPE "WeekParity" AS ENUM ('NUMERATOR', 'DENOMINATOR');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateEnum
CREATE TYPE "ClassGroupScope" AS ENUM ('A', 'B', 'SHARED');

-- CreateEnum
CREATE TYPE "DutyType" AS ENUM ('CAFETERIA', 'BOARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "canPostMemories" BOOLEAN NOT NULL DEFAULT false,
    "telegramUserId" BIGINT,
    "telegramUsername" TEXT,
    "avatarUrl" TEXT,
    "scheduleGroup" "ScheduleGroup",
    "theme" "Theme" NOT NULL DEFAULT 'DARK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLoginRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "LoginStatus" NOT NULL DEFAULT 'PENDING',
    "telegramChatId" BIGINT,
    "telegramUserId" BIGINT,
    "matchedUserId" TEXT,
    "failureReason" TEXT,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "FundraiserEntry" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraiserEntry_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsLike" (
    "userId" TEXT NOT NULL,
    "newsPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsLike_pkey" PRIMARY KEY ("userId","newsPostId")
);

-- CreateTable
CREATE TABLE "MemoryPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryPostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "MemoryPostImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryPostLike" (
    "userId" TEXT NOT NULL,
    "memoryPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryPostLike_pkey" PRIMARY KEY ("userId","memoryPostId")
);

-- CreateTable
CREATE TABLE "ScheduleSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "parityAnchorDate" DATE NOT NULL,
    "parityAnchorType" "WeekParity" NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyRoster" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "parity" "WeekParity" NOT NULL,
    "dutyType" "DutyType" NOT NULL,
    "group" "ScheduleGroup" NOT NULL,
    "personId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyOverride" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dutyType" "DutyType" NOT NULL,
    "group" "ScheduleGroup" NOT NULL,
    "personId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTemplate" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "parity" "WeekParity" NOT NULL,
    "slot" INTEGER NOT NULL,
    "scope" "ClassGroupScope" NOT NULL,
    "subject" TEXT NOT NULL,
    "teacher" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassOverride" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" INTEGER NOT NULL,
    "scope" "ClassGroupScope" NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,
    "teacher" TEXT,
    "room" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" INTEGER NOT NULL,
    "scope" "ClassGroupScope" NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkLike" (
    "userId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkLike_pkey" PRIMARY KEY ("userId","homeworkId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_scheduleGroup_idx" ON "User"("scheduleGroup");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLoginRequest_token_key" ON "TelegramLoginRequest"("token");

-- CreateIndex
CREATE INDEX "TelegramLoginRequest_status_expiresAt_idx" ON "TelegramLoginRequest"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Task_type_dueDate_idx" ON "Task"("type", "dueDate");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "FundraiserEntry_taskId_status_idx" ON "FundraiserEntry"("taskId", "status");

-- CreateIndex
CREATE INDEX "NewsPost_eventAt_idx" ON "NewsPost"("eventAt");

-- CreateIndex
CREATE INDEX "NewsPost_createdById_idx" ON "NewsPost"("createdById");

-- CreateIndex
CREATE INDEX "NewsLike_newsPostId_idx" ON "NewsLike"("newsPostId");

-- CreateIndex
CREATE INDEX "MemoryPost_authorId_idx" ON "MemoryPost"("authorId");

-- CreateIndex
CREATE INDEX "MemoryPost_createdAt_idx" ON "MemoryPost"("createdAt");

-- CreateIndex
CREATE INDEX "MemoryPostImage_postId_idx" ON "MemoryPostImage"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryPostImage_postId_order_key" ON "MemoryPostImage"("postId", "order");

-- CreateIndex
CREATE INDEX "MemoryPostLike_memoryPostId_idx" ON "MemoryPostLike"("memoryPostId");

-- CreateIndex
CREATE INDEX "DutyRoster_weekday_parity_idx" ON "DutyRoster"("weekday", "parity");

-- CreateIndex
CREATE UNIQUE INDEX "DutyRoster_weekday_parity_dutyType_group_key" ON "DutyRoster"("weekday", "parity", "dutyType", "group");

-- CreateIndex
CREATE INDEX "DutyOverride_date_idx" ON "DutyOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DutyOverride_date_dutyType_group_key" ON "DutyOverride"("date", "dutyType", "group");

-- CreateIndex
CREATE INDEX "ClassTemplate_weekday_parity_idx" ON "ClassTemplate"("weekday", "parity");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTemplate_weekday_parity_slot_scope_key" ON "ClassTemplate"("weekday", "parity", "slot", "scope");

-- CreateIndex
CREATE INDEX "ClassOverride_date_idx" ON "ClassOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassOverride_date_slot_scope_key" ON "ClassOverride"("date", "slot", "scope");

-- CreateIndex
CREATE INDEX "Homework_date_slot_scope_idx" ON "Homework"("date", "slot", "scope");

-- CreateIndex
CREATE INDEX "HomeworkLike_homeworkId_idx" ON "HomeworkLike"("homeworkId");

-- AddForeignKey
ALTER TABLE "TelegramLoginRequest" ADD CONSTRAINT "TelegramLoginRequest_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserEntry" ADD CONSTRAINT "FundraiserEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserEntry" ADD CONSTRAINT "FundraiserEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserEntry" ADD CONSTRAINT "FundraiserEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsLike" ADD CONSTRAINT "NewsLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsLike" ADD CONSTRAINT "NewsLike_newsPostId_fkey" FOREIGN KEY ("newsPostId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPost" ADD CONSTRAINT "MemoryPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPostImage" ADD CONSTRAINT "MemoryPostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MemoryPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPostLike" ADD CONSTRAINT "MemoryPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPostLike" ADD CONSTRAINT "MemoryPostLike_memoryPostId_fkey" FOREIGN KEY ("memoryPostId") REFERENCES "MemoryPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSettings" ADD CONSTRAINT "ScheduleSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyRoster" ADD CONSTRAINT "DutyRoster_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyRoster" ADD CONSTRAINT "DutyRoster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyOverride" ADD CONSTRAINT "DutyOverride_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyOverride" ADD CONSTRAINT "DutyOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassOverride" ADD CONSTRAINT "ClassOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkLike" ADD CONSTRAINT "HomeworkLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkLike" ADD CONSTRAINT "HomeworkLike_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

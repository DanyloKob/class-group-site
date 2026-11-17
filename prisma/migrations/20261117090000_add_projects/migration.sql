-- Adds «Проєкти»: ProjectTopic (a topic with a due date) and ProjectMaterial (link, PDF or PPTX under a topic).
-- Also creates the MaterialKind and ConversionStatus enums (PPTX conversion state for the presenter).

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('LINK', 'PDF', 'PPTX');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "ProjectTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "dueDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterial" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "text" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "conversionStatus" "ConversionStatus",
    "conversionError" TEXT,
    "conversionAttempts" INTEGER NOT NULL DEFAULT 0,
    "convertedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTopic_dueDate_idx" ON "ProjectTopic"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectTopic_createdById_idx" ON "ProjectTopic"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMaterial_token_key" ON "ProjectMaterial"("token");

-- CreateIndex
CREATE INDEX "ProjectMaterial_topicId_createdAt_idx" ON "ProjectMaterial"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectMaterial_conversionStatus_idx" ON "ProjectMaterial"("conversionStatus");

-- CreateIndex
CREATE INDEX "ProjectMaterial_authorId_idx" ON "ProjectMaterial"("authorId");

-- AddForeignKey
ALTER TABLE "ProjectTopic" ADD CONSTRAINT "ProjectTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterial" ADD CONSTRAINT "ProjectMaterial_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ProjectTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterial" ADD CONSTRAINT "ProjectMaterial_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The weekday+parity duty template (DutyRoster) and its per-date exception
-- table (DutyOverride) are both dropped: a fixed two-week cycle could never
-- fit 33 people rotating at the board while meals happen only on some days.
-- Duty is now entered per date, any number of people per date + duty type.

-- DropTable
DROP TABLE "DutyRoster";

-- DropTable
DROP TABLE "DutyOverride";

-- CreateTable
CREATE TABLE "DutyAssignment" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dutyType" "DutyType" NOT NULL,
    "personId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DutyAssignment_date_idx" ON "DutyAssignment"("date");

-- CreateIndex
CREATE INDEX "DutyAssignment_personId_idx" ON "DutyAssignment"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "DutyAssignment_date_dutyType_personId_key" ON "DutyAssignment"("date", "dutyType", "personId");

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

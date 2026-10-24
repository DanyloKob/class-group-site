-- canManageDuty splits duty-roster editing out of canManageSchedule, which
-- was labelled "can write homework" but in fact opened every schedule admin
-- screen. Nobody is granted the new flag automatically: the superadmin hands
-- it out deliberately. canManageSchedule keeps its column name and now means
-- homework moderation only.
ALTER TABLE "User" ADD COLUMN "canManageDuty" BOOLEAN NOT NULL DEFAULT false;

-- Per-person A/Б class half. Nullable: nobody is assigned until set.
ALTER TABLE "User" ADD COLUMN "scheduleGroup" "ScheduleGroup";

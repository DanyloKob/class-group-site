import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const superadminFields = {
    lastName: "Суперадмін",
    firstName: "Тест",
    isSuperAdmin: true,
    canPostMemories: true,
  };
  const superadmin = await prisma.user.upsert({
    where: { phone: "+380990000001" },
    update: superadminFields,
    create: { phone: "+380990000001", ...superadminFields },
  });

  const helperFields = {
    lastName: "Староста",
    firstName: "Тест",
    canManageTasks: true,
    canManageNews: true,
    canManageSchedule: true,
    canManageDuty: true,
    canPostMemories: true,
  };
  const helper = await prisma.user.upsert({
    where: { phone: "+380990000002" },
    update: helperFields,
    create: { phone: "+380990000002", ...helperFields },
  });

  const memberFields = {
    lastName: "Учасник",
    firstName: "Тест",
  };
  const member = await prisma.user.upsert({
    where: { phone: "+380990000003" },
    update: memberFields,
    create: { phone: "+380990000003", ...memberFields },
  });

  console.log("Seeded:", { superadmin: superadmin.id, helper: helper.id, member: member.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

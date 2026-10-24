import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-time bootstrap for a fresh production database: creates exactly the
// one superadmin account needed to log in and start registering everyone
// else through the app's own member-management UI. Not meant to be re-run
// repeatedly the way prisma/seed.ts (dev test accounts) is.
//
// The superadmin's phone and name come from the environment (see
// .env.example) so that no real person's contact details live in the repo.
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set - see .env.example`);
    process.exit(1);
  }
  return value;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const phone = required("SEED_SUPERADMIN_PHONE");
  const fields = {
    lastName: required("SEED_SUPERADMIN_LAST_NAME"),
    firstName: required("SEED_SUPERADMIN_FIRST_NAME"),
    isSuperAdmin: true,
  };
  const user = await prisma.user.upsert({
    where: { phone },
    update: fields,
    create: { phone, ...fields },
  });
  console.log("Seeded production superadmin:", user.id);
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

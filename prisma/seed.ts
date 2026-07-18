import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMINS = [
  {
    name: "Dharmendra Soni",
    phone: "+917597365803",
    email: "soni@elitale.com",
  },
] as const;

async function main(): Promise<void> {
  for (const admin of ADMINS) {
    const user = await prisma.user.upsert({
      where: { phone: admin.phone },
      update: { name: admin.name, email: admin.email, role: "ADMIN" },
      create: {
        name: admin.name,
        phone: admin.phone,
        email: admin.email,
        role: "ADMIN",
      },
    });
    console.log(
      `✔ Admin ready: ${user.name} (${user.phone}) — role ${user.role}, id ${user.id}`,
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

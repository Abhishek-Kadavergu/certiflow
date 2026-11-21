
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("demo123", 10);

  const users = [
    { name: "Anika", email: "anika@certiflow.com", role: "TRAINING_CENTER" as const, district: "Hyderabad" },
    { name: "Dev", email: "dev@certiflow.com", role: "DISTRICT_OFFICER" as const, district: "Hyderabad" },
    { name: "Meera", email: "meera@certiflow.com", role: "DISTRICT_OFFICER" as const, district: "Hyderabad" },
    { name: "Kabir", email: "kabir@certiflow.com", role: "QUALITY_REVIEWER" as const, district: null },
    { name: "Neha", email: "neha@certiflow.com", role: "STATE_ADMIN" as const, district: null },
    { name: "Farah", email: "farah@certiflow.com", role: "TRAINING_CENTER" as const, district: "Hyderabad" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        password,
      },
    });
  }

  console.log("Demo users seeded successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

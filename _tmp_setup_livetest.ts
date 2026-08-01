import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./src/generated/prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  const password = await bcrypt.hash("LiveTest123!", 10);
  const user = await prisma.user.create({
    data: {
      name: "Live Test User",
      email: `livetest+${Date.now()}@example.com`,
      password,
      walletBalance: 1000,
    },
  });

  const code = await prisma.unipinCode.create({
    data: { denom: "0", code: `LIVETEST-CODE-${Date.now()}`, status: "UNUSED" },
  });

  console.log("USER_ID=" + user.id);
  console.log("USER_EMAIL=" + user.email);
  console.log("CODE_ID=" + code.id);
  await prisma.$disconnect();
}

main();

import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../src/generated/prisma/client";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.rechargeOption.updateMany({
    where: { denom: { not: null }, deliveryMethod: "MANUAL" },
    data: { deliveryMethod: "UNIPIN" },
  });
  console.log(`Backfilled ${result.count} recharge option(s) with a denom recipe to deliveryMethod = UNIPIN.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

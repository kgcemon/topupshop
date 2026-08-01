import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./src/generated/prisma/client";

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  const product = await prisma.product.findUnique({ where: { id: 3 } });
  console.log("slug=" + product?.slug);
  await prisma.$disconnect();
}

main();

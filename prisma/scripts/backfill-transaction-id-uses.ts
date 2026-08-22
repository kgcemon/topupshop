import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../src/generated/prisma/client";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

// Seeds the TransactionIdUse ledger from every order/wallet request that
// already spent a gateway trx id. Run once after `npm run db:push` adds the
// table — until then the ledger is empty and only new submissions are
// recorded in it (checkTransactionIdAvailable still falls back to scanning
// both tables, so nothing is unguarded meanwhile; this just makes the ledger
// the complete picture).
//
// Orders are claimed first, so any trx id that was already used on BOTH sides
// before this rule existed keeps its order claim and gets reported below for
// manual review rather than silently picking a winner.
async function main() {
  const orders = await prisma.order.findMany({
    where: { transactionId: { not: null } },
    select: { id: true, transactionId: true, paymentMethod: true, orderSerial: true },
  });

  let orderClaims = 0;
  for (const order of orders) {
    const created = await prisma.transactionIdUse.createMany({
      data: [{ trxId: order.transactionId!, method: order.paymentMethod, orderId: order.id }],
      skipDuplicates: true,
    });
    orderClaims += created.count;
  }
  console.log(`Claimed ${orderClaims} trx id(s) from orders (of ${orders.length} orders with a trx id).`);

  const deposits = await prisma.walletTransaction.findMany({
    where: { transactionId: { not: null } },
    select: { id: true, transactionId: true, method: true, amount: true, userId: true },
  });

  let walletClaims = 0;
  const collisions: string[] = [];
  for (const deposit of deposits) {
    const created = await prisma.transactionIdUse.createMany({
      data: [
        { trxId: deposit.transactionId!, method: deposit.method, walletTransactionId: deposit.id },
      ],
      skipDuplicates: true,
    });
    if (created.count === 0) collisions.push(deposit.transactionId!);
    else walletClaims += created.count;
  }
  console.log(
    `Claimed ${walletClaims} trx id(s) from wallet requests (of ${deposits.length} with a trx id).`
  );

  if (collisions.length > 0) {
    console.log(
      `\n⚠️  ${collisions.length} trx id(s) were spent on BOTH an order and a wallet request before this rule existed. ` +
        `The order keeps the claim; review these by hand:\n  ${collisions.join("\n  ")}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

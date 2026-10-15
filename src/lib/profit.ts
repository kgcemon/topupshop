import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getDhakaDayRange } from "@/lib/utils";

type Db = Prisma.TransactionClient | typeof prisma;
type DecimalLike = { toNumber(): number } | number | null | undefined;

export function toNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function splitDenomRecipe(denom: string | null | undefined): string[] {
  return (denom ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function getDenomCostMap(db: Db = prisma): Promise<Map<string, number>> {
  const rows = await db.unipinDenomCost.findMany();
  return new Map(rows.map((r) => [r.denom, r.cost.toNumber()]));
}

/**
 * Cost of one unit of a package: its own costPrice when the admin set one,
 * otherwise — for a UNIPIN package — the sum of its denom recipe's voucher
 * costs, provided every denom in the recipe has a cost. null = not set.
 */
export function getEffectiveCost(
  option: { costPrice: DecimalLike; deliveryMethod: string; denom: string | null },
  denomCosts: Map<string, number>
): number | null {
  const own = toNumber(option.costPrice);
  if (own !== null) return own;
  if (option.deliveryMethod !== "UNIPIN") return null;
  const tokens = splitDenomRecipe(option.denom);
  if (tokens.length === 0) return null;
  let sum = 0;
  for (const token of tokens) {
    const cost = denomCosts.get(token);
    if (cost === undefined) return null;
    sum += cost;
  }
  return round2(sum);
}

/** The cost to snapshot onto a new order for this package (null = not set). */
export async function resolveOrderCost(
  db: Db,
  option: { costPrice: DecimalLike; deliveryMethod: string; denom: string | null }
): Promise<number | null> {
  if (toNumber(option.costPrice) !== null) return toNumber(option.costPrice);
  if (option.deliveryMethod !== "UNIPIN" || splitDenomRecipe(option.denom).length === 0) return null;
  return getEffectiveCost(option, await getDenomCostMap(db));
}

// ---------- Profit dashboard ----------

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProfitPeriod = {
  key: string;
  label: string;
  rangeLabel: string;
  orders: number;
  revenue: number;
  cost: number;
  profit: number; // revenue − cost, over orders that have a cost only
  uncostedOrders: number;
  uncostedRevenue: number;
};

export type ProfitDay = { label: string; orders: number; revenue: number; profit: number; uncostedOrders: number };

export type StockRow = { denom: string; unused: number; cost: number | null; value: number | null };

export type ProfitData = {
  periods: ProfitPeriod[];
  days: ProfitDay[];
  stock: { rows: StockRow[]; total: number; uncostedCodes: number };
  backfillableOrders: number;
};

function dhakaDateLabel(start: Date) {
  return start.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });
}

type DeliveredOrder = { amount: number; costAmount: DecimalLike; createdAt: Date };

function summarize(orders: DeliveredOrder[], start: Date, end: Date) {
  let count = 0;
  let revenue = 0;
  let cost = 0;
  let costedRevenue = 0;
  let uncostedOrders = 0;
  let uncostedRevenue = 0;
  for (const o of orders) {
    if (o.createdAt < start || o.createdAt >= end) continue;
    count += 1;
    revenue += o.amount;
    const c = toNumber(o.costAmount);
    if (c === null) {
      uncostedOrders += 1;
      uncostedRevenue += o.amount;
    } else {
      cost += c;
      costedRevenue += o.amount;
    }
  }
  return {
    orders: count,
    revenue,
    cost: round2(cost),
    profit: round2(costedRevenue - cost),
    uncostedOrders,
    uncostedRevenue,
  };
}

export async function getProfitData(): Promise<ProfitData> {
  const today = getDhakaDayRange(0);
  const yesterday = getDhakaDayRange(1);

  // Bangladesh's working week starts on Saturday.
  const dhakaWeekday = new Date(today.start.getTime() + DHAKA_OFFSET_MS).getUTCDay(); // 0 = Sun … 6 = Sat
  const daysSinceSaturday = (dhakaWeekday + 1) % 7;
  const weekStart = new Date(today.start.getTime() - daysSinceSaturday * DAY_MS);

  const shifted = new Date(today.start.getTime() + DHAKA_OFFSET_MS);
  const monthStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - DHAKA_OFFSET_MS);

  const last7Start = getDhakaDayRange(6).start;
  const windowStart = new Date(Math.min(monthStart.getTime(), last7Start.getTime(), yesterday.start.getTime()));

  const [orders, unusedByDenom, denomCosts, backfillableOrders, unipinOptions] = await Promise.all([
    prisma.order.findMany({
      where: { status: "DELIVERED", createdAt: { gte: windowStart, lt: today.end } },
      select: { amount: true, costAmount: true, createdAt: true },
    }),
    prisma.unipinCode.groupBy({ by: ["denom"], where: { status: "UNUSED" }, _count: { _all: true } }),
    getDenomCostMap(),
    prisma.order.count({ where: { status: "DELIVERED", costAmount: null } }),
    prisma.rechargeOption.findMany({ where: { denom: { not: null } }, select: { denom: true } }),
  ]);

  const periods: ProfitPeriod[] = [
    { key: "today", label: "আজ", start: today.start, end: today.end },
    { key: "yesterday", label: "গতকাল", start: yesterday.start, end: yesterday.end },
    { key: "week", label: "এই সপ্তাহ", start: weekStart, end: today.end },
    { key: "month", label: "এই মাস", start: monthStart, end: today.end },
  ].map((p) => ({
    key: p.key,
    label: p.label,
    rangeLabel:
      p.end.getTime() - p.start.getTime() <= DAY_MS
        ? dhakaDateLabel(p.start)
        : `${dhakaDateLabel(p.start)} – ${dhakaDateLabel(new Date(p.end.getTime() - 1))}`,
    ...summarize(orders, p.start, p.end),
  }));

  const days: ProfitDay[] = [];
  for (let i = 0; i < 7; i++) {
    const { start, end } = getDhakaDayRange(i);
    const s = summarize(orders, start, end);
    days.push({
      label: i === 0 ? "আজ" : i === 1 ? "গতকাল" : dhakaDateLabel(start),
      orders: s.orders,
      revenue: s.revenue,
      profit: s.profit,
      uncostedOrders: s.uncostedOrders,
    });
  }

  // Every denom worth pricing: stocked ones, ones a package recipe uses, and
  // ones that already have a rate — so a rate can be set before stocking.
  const unusedCount = new Map(unusedByDenom.map((r) => [r.denom, r._count._all]));
  const allDenoms = new Set<string>([...unusedCount.keys(), ...denomCosts.keys()]);
  for (const option of unipinOptions) for (const token of splitDenomRecipe(option.denom)) allDenoms.add(token);

  const rows: StockRow[] = [...allDenoms]
    .map((denom) => {
      const cost = denomCosts.get(denom) ?? null;
      const unused = unusedCount.get(denom) ?? 0;
      return { denom, unused, cost, value: cost === null ? null : round2(cost * unused) };
    })
    .sort((a, b) => a.denom.localeCompare(b.denom, undefined, { numeric: true }));

  return {
    periods,
    days,
    stock: {
      rows,
      total: round2(rows.reduce((sum, r) => sum + (r.value ?? 0), 0)),
      uncostedCodes: rows.filter((r) => r.cost === null).reduce((sum, r) => sum + r.unused, 0),
    },
    backfillableOrders,
  };
}

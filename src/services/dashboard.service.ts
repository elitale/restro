import { computeBill } from "@/services/billing";
import {
  aggregateSettledBetween,
  countVoidedSince,
  findOrdersByRestaurant,
  findSettledOrdersSince,
  type OrderWithRelations,
} from "@/repositories/order.repository";
import { findTablesByRestaurant } from "@/repositories/table.repository";
import type {
  DashboardDTO,
  DashboardMetrics,
  DashboardTrendPoint,
} from "@/types/dashboard";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => Number(v);
const pad = (n: number): string => String(n).padStart(2, "0");

// India has no DST, so IST is a fixed +5:30 — day boundaries are exact.
const IST_OFFSET_MS = 330 * 60 * 1000;

interface IstParts {
  readonly y: number;
  readonly m: number;
  readonly day: number;
}

/** IST calendar parts (y/m/day) for an instant. */
export const istParts = (d: Date): IstParts => {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

/** The UTC instant of IST wall-clock midnight for (y, m, day). */
export const istMidnight = (y: number, m: number, day: number): Date =>
  new Date(Date.UTC(y, m - 1, day) - IST_OFFSET_MS);

/** "YYYY-MM-DD" IST calendar key for bucketing settled orders by day. */
const istDayKey = (d: Date): string => {
  const p = istParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.day)}`;
};

const metricsOf = (orders: readonly OrderWithRelations[]): DashboardMetrics => {
  let sales = 0;
  let tax = 0;
  let discount = 0;
  for (const o of orders) {
    sales += num(o.grandTotal);
    tax += num(o.taxTotal);
    discount += num(o.discountTotal);
  }
  const count = orders.length;
  return {
    sales: round2(sales),
    orders: count,
    aov: count > 0 ? round2(sales / count) : 0,
    tax: round2(tax),
    discount: round2(discount),
  };
};

const billLines = (o: OrderWithRelations) =>
  o.items
    .filter((i) => i.state !== "VOID")
    .map((i) => ({
      unitPrice: num(i.unitPrice),
      modifiersDelta: i.modifiers.reduce((s, m) => s + num(m.priceDelta), 0),
      quantity: i.quantity,
      taxRate: num(i.taxRate),
      taxInclusive: i.taxInclusive,
      isComp: i.isComp,
    }));

/**
 * Everything the `/dashboard` overview needs: today + month-to-date metrics,
 * open-now exposure, occupancy, payment mix, order-type split, the month's
 * daily sales trend, and top items today. All day boundaries are IST.
 */
export const getDashboard = async (
  restaurantId: string,
  now: Date = new Date(),
): Promise<DashboardDTO> => {
  const p = istParts(now);
  const todayStart = istMidnight(p.y, p.m, p.day);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const monthStart = istMidnight(p.y, p.m, 1);
  const lastMonthStart = istMidnight(
    p.m === 1 ? p.y - 1 : p.y,
    p.m === 1 ? 12 : p.m - 1,
    1,
  );
  // Fetch far enough back to always include "yesterday" (even on the 1st).
  const fetchSince =
    yesterdayStart.getTime() < monthStart.getTime() ? yesterdayStart : monthStart;

  const [settled, openOrders, tables, voidsToday, lastMonthAgg] =
    await Promise.all([
      findSettledOrdersSince(restaurantId, fetchSince),
      findOrdersByRestaurant(restaurantId, ["OPEN"]),
      findTablesByRestaurant(restaurantId),
      countVoidedSince(restaurantId, todayStart),
      aggregateSettledBetween(restaurantId, lastMonthStart, monthStart),
    ]);

  const settledAt = (o: OrderWithRelations): number =>
    o.settledAt ? o.settledAt.getTime() : 0;

  const monthOrders = settled.filter(
    (o) => settledAt(o) >= monthStart.getTime(),
  );
  const todayOrders = settled.filter(
    (o) => settledAt(o) >= todayStart.getTime(),
  );
  const yesterdayOrders = settled.filter(
    (o) =>
      settledAt(o) >= yesterdayStart.getTime() &&
      settledAt(o) < todayStart.getTime(),
  );

  // Daily sales trend, day 1..today (continuous axis, 0-filled).
  const trendMap = new Map<string, number>();
  for (const o of monthOrders) {
    if (!o.settledAt) {
      continue;
    }
    const key = istDayKey(o.settledAt);
    trendMap.set(key, (trendMap.get(key) ?? 0) + num(o.grandTotal));
  }
  const trend: DashboardTrendPoint[] = [];
  for (let day = 1; day <= p.day; day++) {
    const key = `${p.y}-${pad(p.m)}-${pad(day)}`;
    trend.push({ date: key, label: String(day), sales: round2(trendMap.get(key) ?? 0) });
  }

  // Top items today.
  const itemMap = new Map<string, number>();
  for (const o of todayOrders) {
    for (const it of o.items) {
      if (it.state === "VOID") {
        continue;
      }
      itemMap.set(it.name, (itemMap.get(it.name) ?? 0) + it.quantity);
    }
  }
  const topItemsToday = [...itemMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Payment mix today.
  const payMap = new Map<string, number>();
  for (const o of todayOrders) {
    for (const pay of o.payments) {
      payMap.set(pay.mode, (payMap.get(pay.mode) ?? 0) + num(pay.amount));
    }
  }
  const paymentMixToday = [...payMap.entries()].map(([mode, amount]) => ({
    mode,
    amount: round2(amount),
  }));

  // Order-type split today (fixed order for a stable UI).
  const typeMap = new Map<string, number>();
  for (const o of todayOrders) {
    typeMap.set(o.orderType, (typeMap.get(o.orderType) ?? 0) + 1);
  }
  const orderTypeToday = (["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map(
    (type) => ({ type, orders: typeMap.get(type) ?? 0 }),
  );

  // Open-now exposure + occupancy.
  let openValue = 0;
  let oldestMs: number | null = null;
  const occupied = new Set<string>();
  for (const o of openOrders) {
    openValue += computeBill(billLines(o)).grandTotal;
    const created = o.createdAt.getTime();
    oldestMs = oldestMs === null ? created : Math.min(oldestMs, created);
    if (o.tableId) {
      occupied.add(o.tableId);
    }
  }

  return {
    today: metricsOf(todayOrders),
    yesterdaySales: metricsOf(yesterdayOrders).sales,
    month: metricsOf(monthOrders),
    lastMonthSales: round2(lastMonthAgg.sum),
    openNow: {
      count: openOrders.length,
      value: round2(openValue),
      oldestMinutes:
        oldestMs === null
          ? null
          : Math.max(0, Math.round((now.getTime() - oldestMs) / 60_000)),
    },
    occupancy: { occupied: occupied.size, total: tables.length },
    voidsToday,
    paymentMixToday,
    orderTypeToday,
    trend,
    topItemsToday,
  };
};

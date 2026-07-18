import {
  countVoidedSince,
  findSettledOrdersSince,
} from "@/repositories/order.repository";
import type { TodaySalesDTO } from "@/types/order";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Lightweight "today's sales" summary (full Z-report is v1.1). */
export const getTodaySales = async (
  restaurantId: string,
): Promise<TodaySalesDTO> => {
  const since = startOfToday();
  const [orders, voids] = await Promise.all([
    findSettledOrdersSince(restaurantId, since),
    countVoidedSince(restaurantId, since),
  ]);

  const byMode = new Map<string, { amount: number; count: number }>();
  let gross = 0;
  let tax = 0;
  let discount = 0;

  for (const order of orders) {
    gross += Number(order.grandTotal);
    tax += Number(order.taxTotal);
    discount += Number(order.discountTotal);
    for (const payment of order.payments) {
      const current = byMode.get(payment.mode) ?? { amount: 0, count: 0 };
      current.amount += Number(payment.amount);
      current.count += 1;
      byMode.set(payment.mode, current);
    }
  }

  return {
    orders: orders.length,
    gross: round2(gross),
    tax: round2(tax),
    discount: round2(discount),
    voids,
    byMode: [...byMode.entries()].map(([mode, v]) => ({
      mode,
      amount: round2(v.amount),
      count: v.count,
    })),
  };
};

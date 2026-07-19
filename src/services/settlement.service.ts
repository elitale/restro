import type { SettleInput, SettleTableInput } from "@/lib/validators/order";
import { settleManyOrders, settleOrder } from "@/repositories/order.repository";
import { computeBill } from "@/services/billing";
import {
  loadOwnedOrder,
  mapOrder,
  orderToBillLines,
  ORDER_NOT_OPEN,
  type OrderContext,
} from "@/services/order.service";
import type { OrderDTO } from "@/types/order";

export const PAYMENT_SHORT = "PAYMENT_SHORT";

/** Compute the bill (with discount/comp), verify tender covers it, then settle. */
export const settle = async (
  ctx: OrderContext,
  input: SettleInput,
): Promise<OrderDTO> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }

  const bill = computeBill(orderToBillLines(order), {
    type: input.discountType,
    value: input.discountValue,
  });

  const paid = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paid + 0.5 < bill.grandTotal) {
    throw new Error(PAYMENT_SHORT);
  }

  const settled = await settleOrder(input.orderId, ctx.restaurantId, {
    subtotal: bill.subtotal,
    taxTotal: bill.taxTotal,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountReason: input.discountReason ?? null,
    discountTotal: bill.discountTotal,
    compTotal: bill.compTotal,
    roundOff: bill.roundOff,
    grandTotal: bill.grandTotal,
    payments: input.payments.map((p) => ({
      mode: p.mode,
      amount: p.amount,
      tendered: p.tendered ?? null,
      reference: p.reference ?? null,
      receivedById: ctx.userId,
    })),
  });
  return mapOrder(settled);
};

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

interface PaymentPart {
  readonly mode: "CASH" | "UPI" | "CARD" | "OTHER";
  readonly amount: number;
  readonly reference: string | null;
}

/**
 * Waterfall-allocate a table's combined payments across its orders: fill each
 * order's grand total from the payment pool in turn, slicing a payment when it
 * spans an order boundary. Every returned order is fully covered and the
 * payment modes are preserved in aggregate.
 */
export const allocatePayments = (
  orders: readonly { orderId: string; grandTotal: number }[],
  payments: readonly PaymentPart[],
): Map<string, PaymentPart[]> => {
  const pool = payments.map((p) => ({ ...p, left: round2(p.amount) }));
  const result = new Map<string, PaymentPart[]>();
  for (const order of orders) {
    let need = round2(order.grandTotal);
    const slices: PaymentPart[] = [];
    for (const part of pool) {
      if (need <= 0.005) {
        break;
      }
      if (part.left <= 0.005) {
        continue;
      }
      const take = round2(Math.min(need, part.left));
      slices.push({ mode: part.mode, amount: take, reference: part.reference });
      part.left = round2(part.left - take);
      need = round2(need - take);
    }
    result.set(order.orderId, slices);
  }
  return result;
};

/** Settle every open order of a table with one combined (split) payment. */
export const settleTable = async (
  ctx: OrderContext,
  input: SettleTableInput,
): Promise<OrderDTO[]> => {
  const orders = await Promise.all(
    input.orderIds.map((id) => loadOwnedOrder(ctx.restaurantId, id)),
  );
  for (const order of orders) {
    if (order.status !== "OPEN") {
      throw new Error(ORDER_NOT_OPEN);
    }
  }

  const bills = orders.map((order) => ({
    order,
    bill: computeBill(orderToBillLines(order), { type: "NONE", value: 0 }),
  }));
  const combined = round2(bills.reduce((s, b) => s + b.bill.grandTotal, 0));
  const paid = round2(input.payments.reduce((s, p) => s + p.amount, 0));
  if (paid + 0.5 < combined) {
    throw new Error(PAYMENT_SHORT);
  }

  const allocation = allocatePayments(
    bills.map((b) => ({ orderId: b.order.id, grandTotal: b.bill.grandTotal })),
    input.payments.map((p) => ({
      mode: p.mode,
      amount: p.amount,
      reference: p.reference ?? null,
    })),
  );

  const settlements = bills.map((b) => ({
    orderId: b.order.id,
    data: {
      subtotal: b.bill.subtotal,
      taxTotal: b.bill.taxTotal,
      discountType: "NONE" as const,
      discountValue: 0,
      discountReason: null,
      discountTotal: b.bill.discountTotal,
      compTotal: b.bill.compTotal,
      roundOff: b.bill.roundOff,
      grandTotal: b.bill.grandTotal,
      payments: (allocation.get(b.order.id) ?? []).map((s) => ({
        mode: s.mode,
        amount: s.amount,
        tendered: null,
        reference: s.reference,
        receivedById: ctx.userId,
      })),
    },
  }));

  const settled = await settleManyOrders(ctx.restaurantId, settlements);
  return settled.map(mapOrder);
};

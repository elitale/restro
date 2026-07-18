import type { SettleInput } from "@/lib/validators/order";
import { settleOrder } from "@/repositories/order.repository";
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

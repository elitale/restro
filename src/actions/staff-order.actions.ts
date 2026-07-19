"use server";

import { withStaffValidation } from "@/actions/helpers";
import type { StaffContext } from "@/lib/staff-auth";
import { addItemsSchema, createOrderSchema } from "@/lib/validators/order";
import { addItems, createOrder, fireOrder } from "@/services/order.service";

/** Order context for a waiter — no manager userId; attributed to the staff. */
const asOrderContext = (ctx: StaffContext) => ({
  restaurantId: ctx.restaurantId,
  userId: null,
  staffId: ctx.staffId,
});

export const createWaiterOrderAction = withStaffValidation(
  createOrderSchema,
  (data, ctx) => createOrder(asOrderContext(ctx), data),
  { role: "WAITER" },
);

/** Add items to an open order and fire them to the kitchen (fire-all). */
export const addWaiterItemsAction = withStaffValidation(
  addItemsSchema,
  async (data, ctx) => {
    await addItems(asOrderContext(ctx), data);
    return fireOrder(asOrderContext(ctx), data.orderId);
  },
  { role: "WAITER" },
);

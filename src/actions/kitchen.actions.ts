"use server";

import { withStaffValidation } from "@/actions/helpers";
import { kitchenTicketSchema } from "@/lib/validators/order";
import { advanceTicket, markPickedUp } from "@/services/kitchen.service";

/** Kitchen advances a whole ticket one step (start / mark ready). */
export const advanceTicketAction = withStaffValidation(
  kitchenTicketSchema,
  (data, ctx) => advanceTicket(ctx.restaurantId, data.orderId),
  { role: "KITCHEN" },
);

/** Waiter clears a ready ticket after collecting it from the pass. */
export const markPickedUpAction = withStaffValidation(
  kitchenTicketSchema,
  (data, ctx) => markPickedUp(ctx.restaurantId, data.orderId),
  { role: "WAITER" },
);

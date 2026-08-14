import { z } from "zod";

import { idSchema, phoneSchema } from "@/lib/validators/shared";

// Mobile Order channel enum \u2014 lowercase to match the mobile client. The
// service maps this onto Prisma's `OrderType` enum.
export const mobileOrderChannelSchema = z.enum([
  "dine-in",
  "takeaway",
  "delivery",
  "aggregator",
]);
export type MobileOrderChannel = z.infer<typeof mobileOrderChannelSchema>;

// Mobile action ids \u2014 the state machine surface used by the dashboard.
// Server enforces the role \u2192 action allow-list.
export const mobileOrderActionSchema = z.enum([
  "acknowledge",
  "start-cooking",
  "mark-ready",
  "mark-served",
  "recall",
  "escalate",
  "approve",
]);
export type MobileOrderAction = z.infer<typeof mobileOrderActionSchema>;

const clientRequestIdSchema = z.string().trim().min(4).max(64);

// One item on a create-order payload. In Phase 0 the mobile client sends
// `name` + `priceRupees` directly (no menu backend yet); `menuItemId` is
// optional so Phase 1 can link real menu items without breaking clients.
const mobileOrderItemInputSchema = z.object({
  menuItemId: z.string().trim().min(1).max(120).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive().max(99),
  priceRupees: z.number().nonnegative().max(1_000_000).optional(),
  modifiers: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  station: z.enum(["hot", "cold", "bar", "grill"]).optional(),
});
export type MobileOrderItemInput = z.infer<typeof mobileOrderItemInputSchema>;

export const mobileCreateOrderSchema = z.object({
  clientRequestId: clientRequestIdSchema,
  tableLabel: z.string().trim().min(1).max(60),
  channel: mobileOrderChannelSchema.default("dine-in"),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerPhone: phoneSchema.optional(),
  note: z.string().trim().max(500).optional(),
  covers: z.number().int().positive().max(50).optional(),
  waiterName: z.string().trim().max(120).optional(),
  items: z.array(mobileOrderItemInputSchema).min(1).max(80),
});
export type MobileCreateOrderInput = z.infer<typeof mobileCreateOrderSchema>;

// PATCH accepts three disjoint operations. Waiter role is limited to
// `addItems` + note/phone \u2014 the service rejects the rest with a 403.
export const mobileEditOrderSchema = z.object({
  clientRequestId: clientRequestIdSchema,
  note: z.string().trim().max(500).nullable().optional(),
  customerPhone: phoneSchema.nullable().optional(),
  addItems: z.array(mobileOrderItemInputSchema).optional(),
  updateItems: z
    .array(
      z.object({
        id: idSchema,
        quantity: z.number().int().positive().max(99).optional(),
        modifiers: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
      }),
    )
    .optional(),
  removeItemIds: z
    .array(
      z.object({
        id: idSchema,
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .optional(),
});
export type MobileEditOrderInput = z.infer<typeof mobileEditOrderSchema>;

export const mobileOrderActionBodySchema = z.object({
  clientRequestId: clientRequestIdSchema,
  reason: z.string().trim().max(200).optional(),
});
export type MobileOrderActionBody = z.infer<typeof mobileOrderActionBodySchema>;

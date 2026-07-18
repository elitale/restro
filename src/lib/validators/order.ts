import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

export const orderTypeSchema = z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]);
export const paymentModeSchema = z.enum(["CASH", "UPI", "CARD", "OTHER"]);
export const discountTypeSchema = z.enum(["NONE", "PERCENT", "FLAT"]);

const shortNote = z.string().trim().max(200).optional();

/** A line the client wants to add. Prices/tax are snapshotted server-side —
 *  the client only sends references + quantity + note (never trusted prices). */
export const cartLineSchema = z.object({
  menuItemId: idSchema,
  variantId: idSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(99),
  lineNote: shortNote,
  isComp: z.boolean().default(false),
  compReason: shortNote,
  modifierIds: z.array(idSchema).max(30).default([]),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const createOrderSchema = z.object({
  orderType: orderTypeSchema.default("TAKEAWAY"),
  tableLabel: z.string().trim().max(40).optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  customerAddress: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(100),
  items: z.array(cartLineSchema).min(1, "Add at least one item"),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const addItemsSchema = z.object({
  orderId: idSchema,
  items: z.array(cartLineSchema).min(1, "Add at least one item"),
});
export type AddItemsInput = z.infer<typeof addItemsSchema>;

export const fireOrderSchema = z.object({ orderId: idSchema });
export type FireOrderInput = z.infer<typeof fireOrderSchema>;

export const serveLineSchema = z.object({ orderId: idSchema, itemId: idSchema });
export type ServeLineInput = z.infer<typeof serveLineSchema>;

export const voidLineSchema = z.object({
  orderId: idSchema,
  itemId: idSchema,
  reason: z.string().trim().min(1, "Reason is required").max(200),
});
export type VoidLineInput = z.infer<typeof voidLineSchema>;

export const voidOrderSchema = z.object({
  orderId: idSchema,
  reason: z.string().trim().min(1, "Reason is required").max(200),
});
export type VoidOrderInput = z.infer<typeof voidOrderSchema>;

export const paymentSchema = z.object({
  mode: paymentModeSchema,
  amount: z.coerce.number().nonnegative().max(10_000_000),
  tendered: z.coerce.number().nonnegative().max(10_000_000).optional(),
  reference: z.string().trim().max(60).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const settleSchema = z
  .object({
    orderId: idSchema,
    discountType: discountTypeSchema.default("NONE"),
    discountValue: z.coerce.number().min(0).max(1_000_000).default(0),
    discountReason: z.string().trim().max(200).optional(),
    payments: z.array(paymentSchema).min(1, "Add at least one payment"),
  })
  .refine((s) => s.discountType === "NONE" || s.discountValue > 0, {
    message: "Enter a discount value",
    path: ["discountValue"],
  });
export type SettleInput = z.infer<typeof settleSchema>;

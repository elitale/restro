import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

export const stockUnitSchema = z.enum([
  "KG",
  "GRAM",
  "LITRE",
  "ML",
  "PIECE",
  "PACK",
  "BOTTLE",
  "DOZEN",
]);

const nonNegQty = z.coerce.number().nonnegative().max(1_000_000);
const optionalQty = z.coerce.number().nonnegative().max(1_000_000).optional();
const positiveQty = z.coerce.number().positive().max(1_000_000);
const optionalCost = z.coerce.number().nonnegative().max(10_000_000).optional();
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createStockItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  unit: stockUnitSchema,
  category: optionalText(60),
  openingOnHand: nonNegQty.default(0),
  reorderLevel: optionalQty,
  parLevel: optionalQty,
  costPerUnit: optionalCost,
  supplier: optionalText(120),
  notes: optionalText(300),
  isActive: z.boolean().default(true),
});
export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;

export const updateStockItemSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
  unit: stockUnitSchema,
  category: optionalText(60),
  reorderLevel: optionalQty,
  parLevel: optionalQty,
  costPerUnit: optionalCost,
  supplier: optionalText(120),
  notes: optionalText(300),
  isActive: z.boolean(),
});
export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;

export const deleteStockItemSchema = z.object({ id: idSchema });
export type DeleteStockItemInput = z.infer<typeof deleteStockItemSchema>;

export const adjustStockSchema = z.object({
  stockItemId: idSchema,
  type: z.enum(["RECEIVE", "WASTE"]),
  quantity: positiveQty,
  reason: optionalText(60),
  note: optionalText(200),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const bulkReceiveSchema = z.object({
  rows: z
    .array(z.object({ stockItemId: idSchema, quantity: positiveQty }))
    .min(1, "Add at least one item"),
  note: optionalText(200),
});
export type BulkReceiveInput = z.infer<typeof bulkReceiveSchema>;

export const countStockSchema = z.object({
  rows: z
    .array(z.object({ stockItemId: idSchema, countedOnHand: nonNegQty }))
    .min(1, "Nothing to count"),
  note: optionalText(200),
});
export type CountStockInput = z.infer<typeof countStockSchema>;

// ------------------------------------------------------------------- recipe ---

export const setRecipeComponentSchema = z.object({
  menuItemId: idSchema,
  stockItemId: idSchema,
  quantity: positiveQty,
});
export type SetRecipeComponentInput = z.infer<typeof setRecipeComponentSchema>;

export const removeRecipeComponentSchema = z.object({ id: idSchema });
export type RemoveRecipeComponentInput = z.infer<
  typeof removeRecipeComponentSchema
>;

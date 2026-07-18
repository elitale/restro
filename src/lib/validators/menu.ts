import { z } from "zod";

import { idSchema, nameSchema } from "@/lib/validators/shared";

/** Money value from a form field (coerced from string), 2-decimal rupees. */
const priceSchema = z.coerce
  .number()
  .nonnegative("Price must be 0 or more")
  .max(1_000_000, "Price is too large");

/** GST percentage (0–100). */
const gstRateSchema = z.coerce
  .number()
  .min(0, "GST rate can't be negative")
  .max(100, "GST rate can't exceed 100%");

const sortOrderSchema = z.coerce.number().int().min(0).default(0);
const shortText = z.string().trim().max(160).optional();
const longText = z.string().trim().max(2000).optional();

export const menuItemTypeSchema = z.enum(["SERVED", "PACKAGED_GOODS"]);
export const dietaryTypeSchema = z.enum(["VEG", "NON_VEG", "EGG"]);
export const disable86ReasonSchema = z.enum([
  "OUT_OF_STOCK",
  "QUALITY",
  "PREP_TIME",
  "OTHER",
]);

export const idOnlySchema = z.object({ id: idSchema });
export type IdOnlyInput = z.infer<typeof idOnlySchema>;

// ---------------------------------------------------------------- Category ---

export const createMenuCategorySchema = z.object({
  name: nameSchema,
  description: shortText,
  sortOrder: sortOrderSchema,
  isActive: z.boolean().default(true),
});
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

export const updateMenuCategorySchema = createMenuCategorySchema.extend({
  id: idSchema,
});
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

// ----------------------------------------------------------------- Variant ---

export const menuItemVariantSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  price: priceSchema,
  sortOrder: sortOrderSchema,
  isActive: z.boolean().default(true),
});
export type MenuItemVariantInput = z.infer<typeof menuItemVariantSchema>;

// -------------------------------------------------------------------- Item ---

export const createMenuItemSchema = z.object({
  categoryId: idSchema,
  name: nameSchema,
  shortDescription: shortText,
  longDescription: longText,
  itemType: menuItemTypeSchema.default("SERVED"),
  dietaryType: dietaryTypeSchema.optional(),
  price: priceSchema,
  priceTaxInclusive: z.boolean().optional(),
  goodsGstRate: gstRateSchema.optional(),
  hsnSacCode: z.string().trim().max(20).optional(),
  sortOrder: sortOrderSchema,
  isActive: z.boolean().default(true),
  variants: z.array(menuItemVariantSchema).max(20).default([]),
  modifierGroupIds: z.array(idSchema).max(20).default([]),
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const updateMenuItemSchema = createMenuItemSchema.extend({
  id: idSchema,
});
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// ----------------------------------------------------------- Modifier group ---

export const modifierSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  priceDelta: priceSchema,
  sortOrder: sortOrderSchema,
  isActive: z.boolean().default(true),
});
export type ModifierInput = z.infer<typeof modifierSchema>;

const modifierGroupShape = {
  name: nameSchema,
  minSelect: z.coerce.number().int().min(0).default(0),
  maxSelect: z.coerce.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: sortOrderSchema,
  modifiers: z.array(modifierSchema).min(1, "Add at least one option").max(50),
};

const maxAtLeastMin = (g: { minSelect: number; maxSelect: number }): boolean =>
  g.maxSelect >= g.minSelect;
const maxWithinOptions = (g: {
  maxSelect: number;
  modifiers: readonly unknown[];
}): boolean => g.maxSelect <= g.modifiers.length;

const MIN_MAX_MSG = { message: "Max select must be ≥ min select", path: ["maxSelect"] };
const MAX_OPTIONS_MSG = {
  message: "Max select can't exceed the number of options",
  path: ["maxSelect"],
};

export const createModifierGroupSchema = z
  .object(modifierGroupShape)
  .refine(maxAtLeastMin, MIN_MAX_MSG)
  .refine(maxWithinOptions, MAX_OPTIONS_MSG);
export type CreateModifierGroupInput = z.infer<
  typeof createModifierGroupSchema
>;

export const updateModifierGroupSchema = z
  .object({ ...modifierGroupShape, id: idSchema })
  .refine(maxAtLeastMin, MIN_MAX_MSG)
  .refine(maxWithinOptions, MAX_OPTIONS_MSG);
export type UpdateModifierGroupInput = z.infer<
  typeof updateModifierGroupSchema
>;

// ------------------------------------------------------------- Availability ---

export const disableItemSchema = z.object({
  itemId: idSchema,
  reason: disable86ReasonSchema,
  note: z.string().trim().max(200).optional(),
  /** When the item should auto-return; omit for "until I turn it back on". */
  resumeAt: z.coerce.date().optional(),
});
export type DisableItemInput = z.infer<typeof disableItemSchema>;

export const reenableItemSchema = z.object({ itemId: idSchema });
export type ReenableItemInput = z.infer<typeof reenableItemSchema>;

// -------------------------------------------------------------------- Image ---

export const deleteMenuItemImageSchema = z.object({ imageId: idSchema });
export type DeleteMenuItemImageInput = z.infer<
  typeof deleteMenuItemImageSchema
>;

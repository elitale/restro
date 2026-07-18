import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";

const labelSchema = z.string().trim().min(1, "Label is required").max(40);
const seatsSchema = z.coerce.number().int().min(1).max(99).optional();
const sectionSchema = z.string().trim().max(40).optional();

export const createTableSchema = z.object({
  label: labelSchema,
  seats: seatsSchema,
  section: sectionSchema,
  isActive: z.boolean().default(true),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = z.object({
  id: idSchema,
  label: labelSchema,
  seats: seatsSchema,
  section: sectionSchema,
  isActive: z.boolean(),
});
export type UpdateTableInput = z.infer<typeof updateTableSchema>;

export const deleteTableSchema = z.object({ id: idSchema });
export type DeleteTableInput = z.infer<typeof deleteTableSchema>;

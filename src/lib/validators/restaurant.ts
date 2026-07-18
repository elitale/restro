import { z } from "zod";

export const gstRegistrationTypeSchema = z.enum([
  "REGULAR",
  "COMPOSITION",
  "UNREGISTERED",
]);

export const updateTaxProfileSchema = z
  .object({
    gstRegistrationType: gstRegistrationTypeSchema,
    serviceGstRate: z.coerce.number().min(0).max(100).optional(),
    pricesTaxInclusive: z.boolean().default(false),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9A-Z]{15}$/, "GSTIN must be 15 characters")
      .optional(),
    sacCode: z.string().trim().max(10).optional(),
  })
  .refine(
    (v) =>
      v.gstRegistrationType === "UNREGISTERED" ||
      (v.serviceGstRate != null && v.serviceGstRate > 0),
    { message: "Enter the GST rate (e.g. 5)", path: ["serviceGstRate"] },
  );

export type UpdateTaxProfileInput = z.infer<typeof updateTaxProfileSchema>;

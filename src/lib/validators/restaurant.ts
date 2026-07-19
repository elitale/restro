import { z } from "zod";

import { orderTypeSchema } from "@/lib/validators/order";
import { idSchema } from "@/lib/validators/shared";

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

// ------------------------------------------------------------ restaurant profile ---

export const restaurantFormatSchema = z.enum([
  "FINE_DINING",
  "CASUAL_DINING",
  "QSR",
  "CAFE",
  "CLOUD_KITCHEN",
  "BAR",
  "BAKERY",
  "FOOD_TRUCK",
  "OTHER",
]);

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const businessHoursDaySchema = z.object({
  day: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  opensAt: timeSchema,
  closesAt: timeSchema,
});

export const businessHoursSchema = z.array(businessHoursDaySchema).length(7);
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    legalName: optionalText(160),
    tagline: optionalText(120),
    brandColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #C2410C")
      .optional(),
    addressLine1: optionalText(160),
    addressLine2: optionalText(160),
    city: optionalText(80),
    state: optionalText(80),
    postalCode: optionalText(12),
    phone: optionalText(20),
    email: z.string().trim().email("Invalid email").max(160).optional(),
    website: optionalText(200),
    instagramUrl: optionalText(200),
    facebookUrl: optionalText(200),
    googleUrl: optionalText(200),
    restaurantFormat: restaurantFormatSchema.optional(),
    cuisines: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    seatingCapacity: z.coerce.number().int().min(1).max(100000).optional(),
    fssaiLicense: z
      .string()
      .trim()
      .regex(/^\d{14}$/, "FSSAI licence is 14 digits")
      .optional(),
    fssaiExpiry: z.coerce.date().optional(),
    panNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN")
      .optional(),
    serviceDineIn: z.boolean(),
    serviceTakeaway: z.boolean(),
    serviceDelivery: z.boolean(),
    defaultOrderType: orderTypeSchema.default("TAKEAWAY"),
    businessHours: businessHoursSchema.optional(),
  })
  .refine(
    (v) => v.serviceDineIn || v.serviceTakeaway || v.serviceDelivery,
    { message: "Enable at least one service option", path: ["serviceDineIn"] },
  )
  .refine(
    (v) =>
      ({
        DINE_IN: v.serviceDineIn,
        TAKEAWAY: v.serviceTakeaway,
        DELIVERY: v.serviceDelivery,
      })[v.defaultOrderType],
    {
      message: "The default must be an enabled service option",
      path: ["defaultOrderType"],
    },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const removeGalleryImageSchema = z.object({ imageId: idSchema });
export type RemoveGalleryImageInput = z.infer<typeof removeGalleryImageSchema>;

export const addVideoLinkSchema = z.object({
  url: z.string().trim().url("Enter a valid video link").max(500),
  caption: optionalText(120),
});
export type AddVideoLinkInput = z.infer<typeof addVideoLinkSchema>;

export const removeVideoSchema = z.object({ id: idSchema });
export type RemoveVideoInput = z.infer<typeof removeVideoSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    "Use 3–20 lowercase letters, numbers or underscores",
  );

export const updateUsernameSchema = z.object({ username: usernameSchema });
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;

export const setSelfOrderSchema = z.object({ enabled: z.boolean() });
export type SetSelfOrderInput = z.infer<typeof setSelfOrderSchema>;

export const setInvoiceFooterSchema = z.object({
  note: z.string().trim().max(300),
});
export type SetInvoiceFooterInput = z.infer<typeof setInvoiceFooterSchema>;

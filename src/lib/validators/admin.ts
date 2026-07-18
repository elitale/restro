import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validators/shared";

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE);

export const userListQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["MANAGER", "ADMIN", "SUPER_ADMIN"]).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const restaurantListQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>;

export const onboardRestaurantSchema = z.object({
  name: nameSchema,
  ownerPhone: phoneSchema,
  ownerName: nameSchema.optional(),
  email: emailSchema.optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).toUpperCase().default("IN"),
  timezone: z.string().trim().max(64).optional(),
});
export type OnboardRestaurantInput = z.infer<typeof onboardRestaurantSchema>;

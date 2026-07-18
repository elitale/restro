import { z } from "zod";

import { emailSchema, nameSchema, phoneSchema } from "./shared";

/** Register a restaurant manager. Phone is required; name is optional. */
export const registerManagerSchema = z.object({
  phone: phoneSchema,
  name: nameSchema.optional(),
});
export type RegisterManagerInput = z.infer<typeof registerManagerSchema>;

/** Add (or change) a manager's email — used later for notifications. */
export const addEmailSchema = z.object({
  email: emailSchema,
});
export type AddEmailInput = z.infer<typeof addEmailSchema>;

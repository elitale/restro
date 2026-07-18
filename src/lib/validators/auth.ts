import { z } from "zod";

import { phoneSchema } from "@/lib/validators/shared";

export const requestOtpSchema = z.object({ phone: phoneSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const managerPinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/, "PIN must be 4–6 digits");

export const setPinSchema = z.object({ pin: managerPinSchema });
export type SetPinInput = z.infer<typeof setPinSchema>;

export const verifyPinSchema = z.object({
  phone: phoneSchema,
  pin: managerPinSchema,
});
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;

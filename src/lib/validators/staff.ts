import { z } from "zod";

import { idSchema } from "@/lib/validators/shared";
import { usernameSchema } from "@/lib/validators/restaurant";

export const staffRoleSchema = z.enum(["WAITER", "KITCHEN", "MANAGEMENT"]);
export const staffStatusSchema = z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]);
export const employmentTypeSchema = z.enum([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
]);
export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/, "PIN must be 4–6 digits");

const optionalText = (max: number) => z.string().trim().max(max).optional();

const profileFields = {
  employeeCode: z.string().trim().min(1, "Employee ID is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: staffRoleSchema,
  status: staffStatusSchema.default("ACTIVE"),
  phone: z.string().trim().min(1, "Phone is required").max(20),
  email: z.string().trim().email("Invalid email").max(160).optional(),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(12),
  dateOfBirth: z.coerce.date().optional(),
  gender: genderSchema.optional(),
  joiningDate: z.coerce.date().optional(),
  employmentType: employmentTypeSchema.optional(),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(20),
  notes: optionalText(300),
};

export const createStaffSchema = z.object({ ...profileFields, pin: pinSchema });
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({ id: idSchema, ...profileFields });
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const deleteStaffSchema = z.object({ id: idSchema });
export type DeleteStaffInput = z.infer<typeof deleteStaffSchema>;

export const resetPinSchema = z.object({ id: idSchema, pin: pinSchema });
export type ResetPinInput = z.infer<typeof resetPinSchema>;

export const staffLoginSchema = z.object({
  username: usernameSchema,
  employeeCode: z.string().trim().min(1, "Employee ID is required").max(40),
  pin: pinSchema,
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

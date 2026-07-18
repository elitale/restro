"use server";

import { redirect } from "next/navigation";

import { withValidation } from "@/actions/helpers";
import { createSession, destroySession } from "@/lib/session";
import { requestOtpSchema, verifyOtpSchema } from "@/lib/validators/auth";
import { requestOtp, verifyOtp } from "@/services/auth.service";

export const requestOtpAction = withValidation(
  requestOtpSchema,
  async (data): Promise<void> => {
    await requestOtp(data.phone);
  },
);

export const verifyOtpAction = withValidation(
  verifyOtpSchema,
  async (data): Promise<void> => {
    const userId = await verifyOtp(data.phone, data.code);
    await createSession(userId);
  },
);

export const logoutAction = async (): Promise<void> => {
  await destroySession();
  redirect("/login");
};

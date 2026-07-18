"use server";

import { withValidation } from "@/actions/helpers";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { createSession } from "@/lib/session";
import {
  requestOtpSchema,
  setPinSchema,
  verifyPinSchema,
} from "@/lib/validators/auth";
import { startLogin } from "@/services/auth.service";
import {
  removeManagerPin,
  setManagerPin,
  verifyPinLogin,
} from "@/services/pin-auth.service";
import { failure, success, type ActionResult } from "@/types";

/** Phone step: decide whether to ask for a PIN or send an OTP. */
export const startLoginAction = withValidation(
  requestOtpSchema,
  async (data): Promise<{ method: "pin" | "otp" }> => ({
    method: await startLogin(data.phone),
  }),
);

/** Verify a phone + PIN and open a session. */
export const verifyPinAction = withValidation(
  verifyPinSchema,
  async (data): Promise<void> => {
    const userId = await verifyPinLogin(data.phone, data.pin);
    await createSession(userId);
  },
);

/** Set / change the signed-in manager's PIN. */
export const setPinAction = withValidation(
  setPinSchema,
  async (data): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("NO_SESSION");
    }
    await setManagerPin(userId, data.pin);
  },
);

/** Remove the signed-in manager's PIN. */
export const removePinAction = async (): Promise<ActionResult<void>> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return failure("NO_SESSION");
  }
  try {
    await removeManagerPin(userId);
    return success();
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Something went wrong");
  }
};

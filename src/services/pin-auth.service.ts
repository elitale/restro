import { hashPin, verifyPin } from "@/lib/pin";
import {
  clearUserPin,
  findUserById,
  findUserByPhone,
  recordPinFailure,
  resetPinCounters,
  setUserPin,
} from "@/repositories/user.repository";

export const PIN_INVALID = "PIN_INVALID";
export const PIN_LOCKED = "PIN_LOCKED";

export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60_000;

export interface PinStatus {
  readonly hasPin: boolean;
  readonly pinUpdatedAt: string | null;
}

/** Set (or replace) the signed-in manager's login PIN. */
export const setManagerPin = async (
  userId: string,
  pin: string,
): Promise<void> => {
  await setUserPin(userId, hashPin(pin));
};

/** Remove the manager's login PIN (OTP remains available). */
export const removeManagerPin = async (userId: string): Promise<void> => {
  await clearUserPin(userId);
};

/** PIN status for the settings card — never exposes the hash. */
export const getPinStatus = async (userId: string): Promise<PinStatus> => {
  const user = await findUserById(userId);
  return {
    hasPin: Boolean(user?.pinHash),
    pinUpdatedAt: user?.pinUpdatedAt ? user.pinUpdatedAt.toISOString() : null,
  };
};

/**
 * Verify a phone + PIN login. Returns the user id on success.
 * Failures are generic (`PIN_INVALID`) to avoid account enumeration; a locked
 * account throws `PIN_LOCKED` so the UI can steer the user to OTP.
 */
export const verifyPinLogin = async (
  phone: string,
  pin: string,
): Promise<string> => {
  const user = await findUserByPhone(phone);
  if (
    !user ||
    user.deletedAt ||
    user.suspendedAt ||
    !user.isActive ||
    !user.pinHash
  ) {
    throw new Error(PIN_INVALID);
  }
  if (user.pinLockedUntil && user.pinLockedUntil.getTime() > Date.now()) {
    throw new Error(PIN_LOCKED);
  }
  if (!verifyPin(pin, user.pinHash)) {
    const failedAttempts = user.pinFailedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_PIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_WINDOW_MS)
        : null;
    await recordPinFailure(user.id, { failedAttempts, lockedUntil });
    throw new Error(PIN_INVALID);
  }
  await resetPinCounters(user.id);
  return user.id;
};

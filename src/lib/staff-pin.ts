import { createHmac } from "node:crypto";

/**
 * HMAC-hash a staff PIN with AUTH_SECRET, scoped to the restaurant. Raw PINs are
 * never stored; the deterministic per-restaurant hash lets us enforce PIN
 * uniqueness and (later) look a staff member up from their PIN. A POS PIN is
 * low-entropy by design and authorizes low-stakes actions, not money movement.
 */
export const hashStaffPin = (pin: string, restaurantId: string): string => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return createHmac("sha256", secret)
    .update(`${restaurantId}:${pin}`)
    .digest("hex");
};

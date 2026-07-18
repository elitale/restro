import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Hash a sign-in PIN with scrypt + a random per-user salt.
 * Returns a self-describing string: `scrypt$<saltHex>$<derivedHex>`.
 * Unlike the staff PIN (deterministic HMAC for uniqueness lookups), a login
 * PIN is salted + slow so a DB leak can't trivially recover it.
 */
export const hashPin = (pin: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
};

/** Constant-time verify a PIN against a stored `scrypt$salt$hash` value. */
export const verifyPin = (pin: string, stored: string): boolean => {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(pin, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

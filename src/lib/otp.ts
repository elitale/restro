import { createHmac, randomInt } from "node:crypto";

/** Generate a random 6-digit numeric OTP code. */
export const generateOtpCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

/** HMAC-hash an OTP code with AUTH_SECRET so raw codes are never stored. */
export const hashOtpCode = (code: string): string => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return createHmac("sha256", secret).update(code).digest("hex");
};

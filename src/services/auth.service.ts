import type { User } from "@/generated/prisma/client";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";
import { sendSms } from "@/lib/twilio";
import {
  consumeChallenge,
  countRecentChallenges,
  createOtpChallenge,
  findLatestActiveChallenge,
  incrementChallengeAttempts,
} from "@/repositories/otp.repository";
import { findUserByPhone } from "@/repositories/user.repository";

export const OTP_RATE_LIMITED = "OTP_RATE_LIMITED";
export const OTP_EXPIRED = "OTP_EXPIRED";
export const OTP_INVALID = "OTP_INVALID";
export const OTP_TOO_MANY_ATTEMPTS = "OTP_TOO_MANY_ATTEMPTS";
export const OTP_USER_NOT_FOUND = "OTP_USER_NOT_FOUND";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WINDOW_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

/** Only a registered, active (non-suspended, non-deleted) user may sign in. */
const findEligibleUser = async (phone: string): Promise<User> => {
  const user = await findUserByPhone(phone);
  if (!user || user.deletedAt || user.suspendedAt) {
    throw new Error(OTP_USER_NOT_FOUND);
  }
  return user;
};

/** Generate + store a hashed OTP for a registered phone and text it via Twilio. */
export const requestOtp = async (phone: string): Promise<void> => {
  await findEligibleUser(phone);

  const recent = await countRecentChallenges(
    phone,
    new Date(Date.now() - RESEND_WINDOW_MS),
  );
  if (recent > 0) {
    throw new Error(OTP_RATE_LIMITED);
  }

  const code = generateOtpCode();
  await createOtpChallenge({
    phone,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendSms(
    phone,
    `Your ElitaleRestro verification code is ${code}. It expires in 5 minutes.`,
  );
};

/** Verify an OTP for a registered user and return their id. */
export const verifyOtp = async (
  phone: string,
  code: string,
): Promise<string> => {
  const challenge = await findLatestActiveChallenge(phone, new Date());
  if (!challenge) {
    throw new Error(OTP_EXPIRED);
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new Error(OTP_TOO_MANY_ATTEMPTS);
  }
  if (hashOtpCode(code) !== challenge.codeHash) {
    await incrementChallengeAttempts(challenge.id);
    throw new Error(OTP_INVALID);
  }

  const user = await findEligibleUser(phone);
  await consumeChallenge(challenge.id);

  return user.id;
};

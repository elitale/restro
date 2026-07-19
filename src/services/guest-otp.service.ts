import { generateOtpCode, hashOtpCode } from "@/lib/otp";
import { sendSms } from "@/lib/twilio";
import {
  consumeChallenge,
  countRecentChallenges,
  createOtpChallenge,
  findLatestActiveChallenge,
  incrementChallengeAttempts,
} from "@/repositories/otp.repository";

export const GUEST_OTP_RATE_LIMITED = "GUEST_OTP_RATE_LIMITED";
export const GUEST_OTP_EXPIRED = "GUEST_OTP_EXPIRED";
export const GUEST_OTP_INVALID = "GUEST_OTP_INVALID";
export const GUEST_OTP_TOO_MANY_ATTEMPTS = "GUEST_OTP_TOO_MANY_ATTEMPTS";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WINDOW_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Send a 6-digit code to a guest's phone for the public self-order flow.
 * Unlike the manager OTP, this never looks up (or creates) a user account —
 * any diner can verify a phone to place a table order.
 */
export const requestGuestOtp = async (phone: string): Promise<void> => {
  const recent = await countRecentChallenges(
    phone,
    new Date(Date.now() - RESEND_WINDOW_MS),
  );
  if (recent > 0) {
    throw new Error(GUEST_OTP_RATE_LIMITED);
  }

  const code = generateOtpCode();
  await createOtpChallenge({
    phone,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendSms(
    phone,
    `Your ElitaleRestro order verification code is ${code}. It expires in 5 minutes.`,
  );
};

/** Verify a guest's OTP. Resolves on success; throws a domain error otherwise. */
export const verifyGuestOtp = async (
  phone: string,
  code: string,
): Promise<void> => {
  const challenge = await findLatestActiveChallenge(phone, new Date());
  if (!challenge) {
    throw new Error(GUEST_OTP_EXPIRED);
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new Error(GUEST_OTP_TOO_MANY_ATTEMPTS);
  }
  if (hashOtpCode(code) !== challenge.codeHash) {
    await incrementChallengeAttempts(challenge.id);
    throw new Error(GUEST_OTP_INVALID);
  }
  await consumeChallenge(challenge.id);
};

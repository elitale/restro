import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OtpChallenge } from "@/generated/prisma/client";

process.env.AUTH_SECRET = "test-secret-value";

vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/repositories/otp.repository", () => ({
  createOtpChallenge: vi.fn(),
  findLatestActiveChallenge: vi.fn(),
  incrementChallengeAttempts: vi.fn(),
  consumeChallenge: vi.fn(),
  countRecentChallenges: vi.fn(),
}));

import { hashOtpCode } from "@/lib/otp";
import { sendSms } from "@/lib/twilio";
import {
  consumeChallenge,
  countRecentChallenges,
  createOtpChallenge,
  findLatestActiveChallenge,
  incrementChallengeAttempts,
} from "@/repositories/otp.repository";
import {
  GUEST_OTP_EXPIRED,
  GUEST_OTP_INVALID,
  GUEST_OTP_RATE_LIMITED,
  GUEST_OTP_TOO_MANY_ATTEMPTS,
  requestGuestOtp,
  verifyGuestOtp,
} from "./guest-otp.service";

const PHONE = "+919876543210";

const makeChallenge = (overrides: Partial<OtpChallenge> = {}): OtpChallenge => ({
  id: "otp_1",
  phone: PHONE,
  codeHash: hashOtpCode("123456"),
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe("requestGuestOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a hashed challenge and texts the code (no user lookup)", async () => {
    vi.mocked(countRecentChallenges).mockResolvedValue(0);
    vi.mocked(createOtpChallenge).mockResolvedValue(makeChallenge());

    await requestGuestOtp(PHONE);

    expect(createOtpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ phone: PHONE }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining("verification code"),
    );
  });

  it("rate-limits rapid resends", async () => {
    vi.mocked(countRecentChallenges).mockResolvedValue(1);

    await expect(requestGuestOtp(PHONE)).rejects.toThrow(GUEST_OTP_RATE_LIMITED);
    expect(createOtpChallenge).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("verifyGuestOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consumes the challenge on a correct code", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());

    await verifyGuestOtp(PHONE, "123456");

    expect(consumeChallenge).toHaveBeenCalledWith("otp_1");
    expect(incrementChallengeAttempts).not.toHaveBeenCalled();
  });

  it("throws when there is no active challenge", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(null);

    await expect(verifyGuestOtp(PHONE, "123456")).rejects.toThrow(
      GUEST_OTP_EXPIRED,
    );
  });

  it("increments attempts and throws on a wrong code", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());

    await expect(verifyGuestOtp(PHONE, "000000")).rejects.toThrow(
      GUEST_OTP_INVALID,
    );
    expect(incrementChallengeAttempts).toHaveBeenCalledWith("otp_1");
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("throws after too many attempts", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(
      makeChallenge({ attempts: 5 }),
    );

    await expect(verifyGuestOtp(PHONE, "123456")).rejects.toThrow(
      GUEST_OTP_TOO_MANY_ATTEMPTS,
    );
    expect(consumeChallenge).not.toHaveBeenCalled();
  });
});

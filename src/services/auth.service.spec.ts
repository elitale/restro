import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OtpChallenge, User } from "@/generated/prisma/client";

process.env.AUTH_SECRET = "test-secret-value";

vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/repositories/otp.repository", () => ({
  createOtpChallenge: vi.fn(),
  findLatestActiveChallenge: vi.fn(),
  incrementChallengeAttempts: vi.fn(),
  consumeChallenge: vi.fn(),
  countRecentChallenges: vi.fn(),
}));
vi.mock("@/repositories/user.repository", () => ({
  findUserByPhone: vi.fn(),
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
import { findUserByPhone } from "@/repositories/user.repository";
import {
  OTP_EXPIRED,
  OTP_INVALID,
  OTP_RATE_LIMITED,
  OTP_TOO_MANY_ATTEMPTS,
  OTP_USER_NOT_FOUND,
  requestOtp,
  verifyOtp,
} from "./auth.service";

const PHONE = "+919876543210";

const makeChallenge = (
  overrides: Partial<OtpChallenge> = {},
): OtpChallenge => ({
  id: "otp_1",
  phone: PHONE,
  codeHash: hashOtpCode("123456"),
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "usr_1",
  phone: PHONE,
  phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  email: null,
  emailVerifiedAt: null,
  name: null,
  role: "MANAGER",
  isActive: true,
  suspendedAt: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("requestOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a hashed challenge and texts the code", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser());
    vi.mocked(countRecentChallenges).mockResolvedValue(0);
    vi.mocked(createOtpChallenge).mockResolvedValue(makeChallenge());

    await requestOtp(PHONE);

    expect(createOtpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ phone: PHONE }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining("verification code"),
    );
  });

  it("does not send an OTP to an unregistered phone", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);

    await expect(requestOtp(PHONE)).rejects.toThrow(OTP_USER_NOT_FOUND);
    expect(createOtpChallenge).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("does not send an OTP to a suspended or deleted user", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ suspendedAt: new Date() }),
    );

    await expect(requestOtp(PHONE)).rejects.toThrow(OTP_USER_NOT_FOUND);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rate-limits rapid resends", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser());
    vi.mocked(countRecentChallenges).mockResolvedValue(1);

    await expect(requestOtp(PHONE)).rejects.toThrow(OTP_RATE_LIMITED);
    expect(createOtpChallenge).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("verifyOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user id for a correct code from a registered user", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser({ id: "usr_9" }));

    const userId = await verifyOtp(PHONE, "123456");

    expect(consumeChallenge).toHaveBeenCalledWith("otp_1");
    expect(userId).toBe("usr_9");
  });

  it("rejects a correct code when the phone is not registered", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());
    vi.mocked(findUserByPhone).mockResolvedValue(null);

    await expect(verifyOtp(PHONE, "123456")).rejects.toThrow(
      OTP_USER_NOT_FOUND,
    );
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("rejects a correct code from a suspended user", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ suspendedAt: new Date() }),
    );

    await expect(verifyOtp(PHONE, "123456")).rejects.toThrow(
      OTP_USER_NOT_FOUND,
    );
  });

  it("rejects a wrong code and records an attempt", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());

    await expect(verifyOtp(PHONE, "000000")).rejects.toThrow(OTP_INVALID);
    expect(incrementChallengeAttempts).toHaveBeenCalledWith("otp_1");
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("rejects when no active challenge exists", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(null);

    await expect(verifyOtp(PHONE, "123456")).rejects.toThrow(OTP_EXPIRED);
  });

  it("rejects after too many attempts", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(
      makeChallenge({ attempts: 5 }),
    );

    await expect(verifyOtp(PHONE, "123456")).rejects.toThrow(
      OTP_TOO_MANY_ATTEMPTS,
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OtpChallenge } from "@/generated/prisma/client";

const { create, findFirst, update, count } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { otpChallenge: { create, findFirst, update, count } },
}));

import {
  consumeChallenge,
  countRecentChallenges,
  createOtpChallenge,
  findLatestActiveChallenge,
  incrementChallengeAttempts,
} from "./otp.repository";

const makeChallenge = (
  overrides: Partial<OtpChallenge> = {},
): OtpChallenge => ({
  id: "otp_1",
  phone: "+919876543210",
  codeHash: "hash",
  expiresAt: new Date("2026-01-01T00:05:00.000Z"),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("otpRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createOtpChallenge forwards data", async () => {
    const challenge = makeChallenge();
    create.mockResolvedValue(challenge);

    const result = await createOtpChallenge({
      phone: challenge.phone,
      codeHash: "hash",
      expiresAt: challenge.expiresAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: challenge.phone,
        codeHash: "hash",
        expiresAt: challenge.expiresAt,
      },
    });
    expect(result).toBe(challenge);
  });

  it("findLatestActiveChallenge filters unconsumed + unexpired", async () => {
    const now = new Date("2026-01-01T00:02:00.000Z");
    findFirst.mockResolvedValue(null);

    await findLatestActiveChallenge("+919876543210", now);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        phone: "+919876543210",
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("incrementChallengeAttempts increments", async () => {
    update.mockResolvedValue(makeChallenge({ attempts: 1 }));

    await incrementChallengeAttempts("otp_1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "otp_1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("consumeChallenge sets consumedAt", async () => {
    update.mockResolvedValue(makeChallenge({ consumedAt: new Date() }));

    await consumeChallenge("otp_1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "otp_1" } }),
    );
  });

  it("countRecentChallenges counts since a time", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    count.mockResolvedValue(0);

    await countRecentChallenges("+919876543210", since);

    expect(count).toHaveBeenCalledWith({
      where: { phone: "+919876543210", createdAt: { gt: since } },
    });
  });
});

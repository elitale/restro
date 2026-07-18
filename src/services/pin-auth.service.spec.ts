import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/generated/prisma/client";

vi.mock("@/lib/pin", () => ({
  hashPin: (pin: string) => `hashed:${pin}`,
  verifyPin: (pin: string, stored: string) => stored === `hashed:${pin}`,
}));
vi.mock("@/repositories/user.repository", () => ({
  clearUserPin: vi.fn(),
  findUserById: vi.fn(),
  findUserByPhone: vi.fn(),
  recordPinFailure: vi.fn(),
  resetPinCounters: vi.fn(),
  setUserPin: vi.fn(),
}));

import {
  clearUserPin,
  findUserById,
  findUserByPhone,
  recordPinFailure,
  resetPinCounters,
  setUserPin,
} from "@/repositories/user.repository";
import {
  getPinStatus,
  MAX_PIN_ATTEMPTS,
  PIN_INVALID,
  PIN_LOCKED,
  removeManagerPin,
  setManagerPin,
  verifyPinLogin,
} from "./pin-auth.service";

const PHONE = "+919876543210";

const makeUser = (o: Partial<User> = {}): User => ({
  id: "usr_1",
  phone: PHONE,
  phoneVerifiedAt: null,
  email: null,
  emailVerifiedAt: null,
  name: null,
  role: "MANAGER",
  isActive: true,
  suspendedAt: null,
  deletedAt: null,
  pinHash: "hashed:1234",
  pinUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
});

describe("setManagerPin / removeManagerPin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashes then stores the pin", async () => {
    await setManagerPin("usr_1", "1234");
    expect(setUserPin).toHaveBeenCalledWith("usr_1", "hashed:1234");
  });

  it("removes the pin", async () => {
    await removeManagerPin("usr_1");
    expect(clearUserPin).toHaveBeenCalledWith("usr_1");
  });
});

describe("getPinStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports hasPin + updatedAt, never the hash", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUser());

    const status = await getPinStatus("usr_1");

    expect(status.hasPin).toBe(true);
    expect(status.pinUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(status).not.toHaveProperty("pinHash");
  });

  it("reports no pin when unset", async () => {
    vi.mocked(findUserById).mockResolvedValue(
      makeUser({ pinHash: null, pinUpdatedAt: null }),
    );

    expect(await getPinStatus("usr_1")).toEqual({
      hasPin: false,
      pinUpdatedAt: null,
    });
  });
});

describe("verifyPinLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user id and resets counters on a correct pin", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinFailedAttempts: 2 }),
    );

    const id = await verifyPinLogin(PHONE, "1234");

    expect(id).toBe("usr_1");
    expect(resetPinCounters).toHaveBeenCalledWith("usr_1");
  });

  it("throws generic PIN_INVALID for unknown / no-pin / ineligible users", async () => {
    vi.mocked(findUserByPhone).mockResolvedValueOnce(null);
    await expect(verifyPinLogin(PHONE, "1234")).rejects.toThrow(PIN_INVALID);

    vi.mocked(findUserByPhone).mockResolvedValueOnce(makeUser({ pinHash: null }));
    await expect(verifyPinLogin(PHONE, "1234")).rejects.toThrow(PIN_INVALID);

    vi.mocked(findUserByPhone).mockResolvedValueOnce(
      makeUser({ suspendedAt: new Date() }),
    );
    await expect(verifyPinLogin(PHONE, "1234")).rejects.toThrow(PIN_INVALID);
  });

  it("increments attempts on a wrong pin", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinFailedAttempts: 1 }),
    );

    await expect(verifyPinLogin(PHONE, "0000")).rejects.toThrow(PIN_INVALID);

    expect(recordPinFailure).toHaveBeenCalledWith("usr_1", {
      failedAttempts: 2,
      lockedUntil: null,
    });
  });

  it("locks the account after MAX attempts", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinFailedAttempts: MAX_PIN_ATTEMPTS - 1 }),
    );

    await expect(verifyPinLogin(PHONE, "0000")).rejects.toThrow(PIN_INVALID);

    expect(recordPinFailure).toHaveBeenCalledWith("usr_1", {
      failedAttempts: MAX_PIN_ATTEMPTS,
      lockedUntil: expect.any(Date),
    });
  });

  it("rejects a locked account with PIN_LOCKED (no attempt recorded)", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinLockedUntil: new Date(Date.now() + 60_000) }),
    );

    await expect(verifyPinLogin(PHONE, "1234")).rejects.toThrow(PIN_LOCKED);
    expect(recordPinFailure).not.toHaveBeenCalled();
  });
});

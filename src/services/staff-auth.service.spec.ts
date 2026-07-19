import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Staff } from "@/generated/prisma/client";

vi.mock("@/lib/staff-pin", () => ({
  hashStaffPin: (pin: string, restaurantId: string) => `h:${restaurantId}:${pin}`,
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantByUsername: vi.fn(),
}));
vi.mock("@/repositories/staff.repository", () => ({
  findStaffByEmployeeCode: vi.fn(),
  findStaffByRestaurant: vi.fn(),
  recordStaffLoginFailure: vi.fn(),
  resetStaffLoginCounters: vi.fn(),
}));

import {
  findStaffByEmployeeCode,
  findStaffByRestaurant,
  recordStaffLoginFailure,
  resetStaffLoginCounters,
} from "@/repositories/staff.repository";
import { findRestaurantByUsername } from "@/repositories/restaurant.repository";
import {
  getStaffLoginRestaurant,
  listLoginStaff,
  MAX_STAFF_ATTEMPTS,
  STAFF_LOGIN_INVALID,
  STAFF_LOGIN_LOCKED,
  verifyStaffLogin,
} from "./staff-auth.service";

const makeStaff = (o: Record<string, unknown> = {}): Staff =>
  ({
    id: "st1",
    restaurantId: "res_1",
    employeeCode: "E1",
    name: "Ramesh",
    role: "WAITER",
    status: "ACTIVE",
    photoUrl: null,
    pinHash: "h:res_1:1234",
    loginFailedAttempts: 0,
    loginLockedUntil: null,
    deletedAt: null,
    ...o,
  }) as unknown as Staff;

describe("verifyStaffLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns staffId + role and resets counters on success", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ loginFailedAttempts: 2 }),
    );

    const result = await verifyStaffLogin("res_1", "E1", "1234");

    expect(result).toEqual({ staffId: "st1", role: "WAITER" });
    expect(resetStaffLoginCounters).toHaveBeenCalledWith("st1");
  });

  it("allows a kitchen staff member", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ role: "KITCHEN" }),
    );

    const result = await verifyStaffLogin("res_1", "E1", "1234");

    expect(result.role).toBe("KITCHEN");
  });

  it("rejects unknown / management / non-active / deleted with a generic error", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValueOnce(null);
    await expect(verifyStaffLogin("res_1", "E1", "1234")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );

    vi.mocked(findStaffByEmployeeCode).mockResolvedValueOnce(
      makeStaff({ role: "MANAGEMENT" }),
    );
    await expect(verifyStaffLogin("res_1", "E1", "1234")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );

    vi.mocked(findStaffByEmployeeCode).mockResolvedValueOnce(
      makeStaff({ status: "ON_LEAVE" }),
    );
    await expect(verifyStaffLogin("res_1", "E1", "1234")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );

    vi.mocked(findStaffByEmployeeCode).mockResolvedValueOnce(
      makeStaff({ deletedAt: new Date() }),
    );
    await expect(verifyStaffLogin("res_1", "E1", "1234")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );
  });

  it("increments attempts on a wrong pin", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ loginFailedAttempts: 1 }),
    );

    await expect(verifyStaffLogin("res_1", "E1", "0000")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );
    expect(recordStaffLoginFailure).toHaveBeenCalledWith("st1", {
      failedAttempts: 2,
      lockedUntil: null,
    });
  });

  it("locks after MAX attempts", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ loginFailedAttempts: MAX_STAFF_ATTEMPTS - 1 }),
    );

    await expect(verifyStaffLogin("res_1", "E1", "0000")).rejects.toThrow(
      STAFF_LOGIN_INVALID,
    );
    expect(recordStaffLoginFailure).toHaveBeenCalledWith("st1", {
      failedAttempts: MAX_STAFF_ATTEMPTS,
      lockedUntil: expect.any(Date),
    });
  });

  it("rejects a locked account with STAFF_LOGIN_LOCKED", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ loginLockedUntil: new Date(Date.now() + 30_000) }),
    );

    await expect(verifyStaffLogin("res_1", "E1", "1234")).rejects.toThrow(
      STAFF_LOGIN_LOCKED,
    );
    expect(recordStaffLoginFailure).not.toHaveBeenCalled();
  });
});

describe("getStaffLoginRestaurant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns public info for an active restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue({
      id: "res_1",
      name: "Spice Route",
      username: "spice12",
      logoUrl: null,
      deletedAt: null,
      isActive: true,
    } as never);

    expect(await getStaffLoginRestaurant("spice12")).toEqual({
      id: "res_1",
      name: "Spice Route",
      username: "spice12",
      logoUrl: null,
    });
  });

  it("returns null for an unknown or inactive restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValueOnce(null);
    expect(await getStaffLoginRestaurant("nope")).toBeNull();

    vi.mocked(findRestaurantByUsername).mockResolvedValueOnce({
      id: "res_1",
      isActive: false,
      deletedAt: null,
    } as never);
    expect(await getStaffLoginRestaurant("spice12")).toBeNull();
  });
});

describe("listLoginStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only active waiter/kitchen staff without the pin hash", async () => {
    vi.mocked(findStaffByRestaurant).mockResolvedValue([
      makeStaff({ employeeCode: "E1", name: "Asha", role: "WAITER" }),
      makeStaff({ employeeCode: "E2", name: "Vikram", role: "KITCHEN" }),
      makeStaff({ employeeCode: "E3", name: "Boss", role: "MANAGEMENT" }),
      makeStaff({ employeeCode: "E4", name: "Leave", status: "ON_LEAVE" }),
    ]);

    const options = await listLoginStaff("res_1");

    expect(options).toEqual([
      { employeeCode: "E1", name: "Asha", role: "WAITER", photoUrl: null },
      { employeeCode: "E2", name: "Vikram", role: "KITCHEN", photoUrl: null },
    ]);
    expect(options[0]).not.toHaveProperty("pinHash");
  });
});
